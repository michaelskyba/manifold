import * as admin from 'firebase-admin'
import { sortBy, sumBy } from 'lodash'

import { BountiedQuestionContract } from 'common/contract'
import { getAutoBountyPayoutPerHour } from 'common/bounty'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { awardBounty } from 'shared/bounty'
import { promptGPT4 } from 'shared/helpers/openai-utils'

export const autoAwardBounty = async () => {
  const pg = createSupabaseDirectClient()

  const contracts = await pg.map(
    `select data from contracts
    where
      outcome_type = 'BOUNTIED_QUESTION'
      and (data->>'bountyLeft')::numeric > 1
      and data->>'isAutoBounty' = 'true'
      and created_time < now() - interval '1 hour'
  `,
    [],
    (r) => r.data as BountiedQuestionContract
  )

  console.log(
    'Auto awarding bounties for contracts:',
    contracts.map((c) => c.question)
  )

  for (const contract of contracts) {
    const totalPayout = getAutoBountyPayoutPerHour(contract)
    console.log('total payout', totalPayout)
    const comments = await pg.map(
      `select
        comment_id, user_id, likes, (data->>'bountyAwarded')::numeric as bountyAwarded,
        data->>'content' as content
      from contract_comments
      where contract_id = $1
      and likes > 0`,
      [contract.id],
      (r) => ({
        likes: Number(r.likes),
        commentId: r.comment_id as string,
        userId: r.user_id as string,
        bountyAwarded: Number(r.bountyAwarded ?? 0),
        content: r.content as string,
      })
    )
    console.log('comments', comments)
    const totalLikes = sumBy(comments, 'likes')

    for (const comment of comments) {
      const { likes, commentId, userId, bountyAwarded } = comment
      const amount = (likes / totalLikes) * totalPayout
      await awardBounty({
        contractId: contract.id,
        fromUserId: contract.creatorId,
        toUserId: userId,
        commentId,
        prevBountyAwarded: bountyAwarded,
        amount,
      })
    }

    const sortedComments = sortBy(comments, 'likes').reverse()
    const prompt =
      `
A user of our site has asked a question, and other users have written comments in reply.
Each comment has a number of likes, which represent how many other users have clicked the "like" button on that comment.
Please create one clear summary of all the comments that have been written in reply to the question, but put more emphasis on the comments that have received more likes.
Do not mention any comment specifically or that you are attempting to summarize the comments -- rather, you should write one coherent summary that borrows content from any or all of the comments, feeling free to ignore some parts.

The following comments have been submitted:` +
      sortedComments.map((c) => `${c.likes} likes:\n${c.content}`).join('\n\n')
    const resultMessage = await promptGPT4(prompt)
    if (resultMessage) {
      const firestore = admin.firestore()
      const contractRef = firestore.collection('contracts').doc(contract.id)
      await contractRef.update({ gptCommentSummary: resultMessage })
    }
  }

  console.log('Done awarding bounties')
}