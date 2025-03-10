import { z } from 'zod'
import { APIError, authEndpoint, validate } from 'api/helpers/endpoint'
import { log, getPrivateUser, getUser } from 'shared/utils'
import {
  createSupabaseDirectClient,
  SupabaseDirectClient,
} from 'shared/supabase/init'
import { Json } from 'common/supabase/schema'
import { contentSchema } from 'common/api/zod-types'
import { MAX_COMMENT_JSON_LENGTH } from 'api/create-comment'
import { insertPrivateMessage } from 'shared/supabase/private-messages'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'
import * as timezone from 'dayjs/plugin/timezone'
import { User } from 'common/user'
import { first } from 'lodash'
import * as crypto from 'crypto'
import { getNotificationDestinationsForUser } from 'common/user-notification-preferences'
import { Notification } from 'common/notification'
import { createPushNotification } from 'shared/create-push-notification'
import { sendNewMessageEmail } from 'shared/emails'
import { HOUR_MS } from 'common/util/time'
import { JSONContent } from '@tiptap/core'
import { ChatVisibility } from 'common/chat-message'
import { track } from 'shared/analytics'
import { broadcast } from 'shared/websockets/server'
dayjs.extend(utc)
dayjs.extend(timezone)

const postSchema = z
  .object({
    content: contentSchema,
    channelId: z.number().gte(0).int(),
  })
  .strict()

export const createprivateusermessage = authEndpoint(async (req, auth) => {
  const { content, channelId } = validate(postSchema, req.body)
  if (JSON.stringify(content).length > MAX_COMMENT_JSON_LENGTH) {
    throw new APIError(
      400,
      `Message JSON should be less than ${MAX_COMMENT_JSON_LENGTH}`
    )
  }
  const pg = createSupabaseDirectClient()
  const creator = await getUser(auth.uid)
  if (!creator) throw new APIError(401, 'Your account was not found')
  if (creator.isBannedFromPosting) throw new APIError(403, 'You are banned')
  return await createPrivateUserMessageMain(
    creator,
    channelId,
    content,
    pg,
    'private'
  )
})

export const createPrivateUserMessageMain = async (
  creator: User,
  channelId: number,
  content: JSONContent,
  pg: SupabaseDirectClient,
  visibility: ChatVisibility
) => {
  // Normally, users can only submit messages to channels that they are members of
  const authorized = await pg.oneOrNone(
    `select 1
       from private_user_message_channel_members
       where channel_id = $1
         and user_id = $2`,
    [channelId, creator.id]
  )
  if (!authorized)
    throw new APIError(403, 'You are not authorized to post to this channel')

  await notifyOtherUserInChannelIfInactive(channelId, creator, pg)
  await insertPrivateMessage(content, channelId, creator.id, visibility, pg)

  const privateMessage = {
    content: content as Json,
    channel_id: channelId,
    user_id: creator.id,
  }

  const otherUserIds = await pg.map<string>(
    `select user_id from private_user_message_channel_members
        where channel_id = $1 and user_id != $2
        and status != 'left'
        `,
    [channelId, creator.id],
    (r) => r.user_id
  )
  otherUserIds.concat(creator.id).forEach((otherUserId) => {
    broadcast(`private-user-messages/${otherUserId}`, {})
  })
  let bothHaveLoverProfiles = false
  const hasLoverProfile = await pg.oneOrNone(
    'select 1 from lovers where user_id = $1',
    [creator.id]
  )
  if (hasLoverProfile) {
    const otherUserId = first(otherUserIds)

    if (otherUserId && otherUserIds.length === 1) {
      const otherHasLoverProfile = await pg.oneOrNone(
        'select 1 from lovers where user_id = $1',
        [otherUserId]
      )
      bothHaveLoverProfiles = !!otherHasLoverProfile
    }
  }

  track(creator.id, 'send private message', {
    channelId,
    otherUserIds,
    bothHaveLoverProfiles,
  })

  return { status: 'success', privateMessage }
}

const notifyOtherUserInChannelIfInactive = async (
  channelId: number,
  creator: User,
  pg: SupabaseDirectClient
) => {
  const otherUserIds = await pg.manyOrNone<{ user_id: string }>(
    `select user_id from private_user_message_channel_members
        where channel_id = $1 and user_id != $2
        and status != 'left'
        `,
    [channelId, creator.id]
  )
  // We're only sending notifs for 1:1 channels
  if (!otherUserIds || otherUserIds.length > 1) return

  const otherUserId = first(otherUserIds)
  if (!otherUserId) return

  const startOfDay = dayjs()
    .tz('America/Los_Angeles')
    .startOf('day')
    .toISOString()
  const previousMessagesThisDayBetweenTheseUsers = await pg.one(
    `select count(*) from private_user_messages
            where channel_id = $1
            and user_id = $2
            and created_time > $3
            `,
    [channelId, creator.id, startOfDay]
  )
  log('previous messages this day', previousMessagesThisDayBetweenTheseUsers)
  if (previousMessagesThisDayBetweenTheseUsers.count > 0) return

  const lastUserEvent = await pg.oneOrNone(
    `select coalesce(ts_to_millis(max(greatest(ucv.last_page_view_ts, ucv.last_promoted_view_ts, ucv.last_card_view_ts))),0) as ts
     from user_contract_views ucv where ucv.user_id = $1`,
    [otherUserId.user_id]
  )
  log('last user contract view for user ' + otherUserId.user_id, lastUserEvent)
  if (lastUserEvent && lastUserEvent.ts > Date.now() - HOUR_MS) return

  const otherUser = await getUser(otherUserId.user_id)
  if (!otherUser) return
  // We're only sending emails for users who have a lover profile
  const hasLoverProfile = await pg.oneOrNone(
    `select 1 from lovers where user_id = $1`,
    [otherUserId.user_id]
  )
  await createNewMessageNotification(
    creator,
    otherUser,
    channelId,
    hasLoverProfile
  )
}

const createNewMessageNotification = async (
  fromUser: User,
  toUser: User,
  channelId: number,
  otherUserHasLoverProfile: boolean
) => {
  const privateUser = await getPrivateUser(toUser.id)
  if (!privateUser) return
  const reason = 'new_message'
  const { sendToMobile, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  const sourceText = `${fromUser.name} sent you a message!`
  const id = crypto.randomUUID()
  const notification: Notification = {
    id,
    userId: privateUser.id,
    reason,
    createdTime: Date.now(),
    isSeen: false,
    sourceId: channelId.toString(),
    sourceType: reason,
    sourceUpdateType: 'created',
    sourceUserName: fromUser.name,
    sourceUserUsername: fromUser.username,
    sourceUserAvatarUrl: fromUser.avatarUrl,
    sourceSlug: '/messages/' + channelId,
    sourceText,
  }

  if (sendToMobile) {
    await createPushNotification(
      notification,
      privateUser,
      `New message`,
      sourceText
    )
  }
  if (sendToEmail && otherUserHasLoverProfile) {
    await sendNewMessageEmail(
      reason,
      privateUser,
      fromUser,
      toUser,
      channelId,
      sourceText
    )
  }
}
