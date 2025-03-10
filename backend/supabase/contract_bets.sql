-- This file is autogenerated from regen-schema.ts
create table if not exists
  contract_bets (
    contract_id text not null,
    bet_id text default random_alphanumeric (12) not null,
    data jsonb not null,
    updated_time timestamp with time zone default now() not null,
    user_id text not null,
    created_time timestamp with time zone default now() not null,
    amount numeric,
    shares numeric,
    outcome text,
    prob_before numeric,
    prob_after numeric,
    is_redemption boolean,
    is_api boolean,
    answer_id text,
    loan_amount numeric
  );

-- Triggers
create trigger contract_bet_populate before insert
or
update on public.contract_bets for each row
execute function contract_bet_populate_cols ();

create trigger contract_bet_update
after
update on public.contract_bets for each row
execute function contract_bet_set_updated_time ();

-- Functions
create
or replace function public.contract_bet_populate_cols () returns trigger language plpgsql as $function$
begin
    if new.bet_id is not null then
        new.data := new.data || jsonb_build_object('id', new.bet_id);
    end if;
    if new.updated_time is null and new.created_time is not null then
        new.updated_time := new.created_time;
    end if;
    if new.data is not null then
        new.user_id := (new.data) ->> 'userId';
        new.amount := ((new.data) ->> 'amount')::numeric;
        new.shares := ((new.data) ->> 'shares')::numeric;
        new.outcome := ((new.data) ->> 'outcome');
        new.prob_before := ((new.data) ->> 'probBefore')::numeric;
        new.prob_after := ((new.data) ->> 'probAfter')::numeric;
        new.is_redemption := ((new.data) -> 'isRedemption')::boolean;
        new.answer_id := ((new.data) ->> 'answerId')::text;
        new.is_api := ((new.data) ->> 'isApi')::boolean;
        new.loan_amount := ((new.data) ->> 'loanAmount')::numeric;
    end if;
    return new;
end
$function$;

create
or replace function public.contract_bet_set_updated_time () returns trigger language plpgsql as $function$
begin
    new.updated_time = now();
    return new;
end;
$function$;

-- Policies
alter table contract_bets enable row level security;

drop policy if exists "public read" on contract_bets;

create policy "public read" on contract_bets for
select
  using (true);

-- Indexes
drop index if exists contract_bets_pkey;

create unique index contract_bets_pkey on public.contract_bets using btree (contract_id, bet_id);

drop index if exists contract_bets_answer_id_created_time;

create index contract_bets_answer_id_created_time on public.contract_bets using btree (answer_id, created_time desc);

drop index if exists contract_bets_bet_id;

create index contract_bets_bet_id on public.contract_bets using btree (bet_id);

drop index if exists contract_bets_contract_user_id;

create index contract_bets_contract_user_id on public.contract_bets using btree (contract_id, user_id, created_time desc);

drop index if exists contract_bets_created_time;

create index contract_bets_created_time on public.contract_bets using btree (contract_id, created_time desc);

drop index if exists contract_bets_user_id;

create index contract_bets_user_id on public.contract_bets using btree (user_id, created_time desc);

drop index if exists contract_bets_user_outstanding_limit_orders;

create index contract_bets_user_outstanding_limit_orders on public.contract_bets using btree (
  user_id,
  (((data -> 'isFilled'::text))::boolean),
  (((data -> 'isCancelled'::text))::boolean)
);

drop index if exists contract_bets_historical_probs;

create index contract_bets_historical_probs on public.contract_bets using btree (contract_id, answer_id, created_time desc) include (prob_before, prob_after);

drop index if exists contract_bets_user_updated_time;

create index contract_bets_user_updated_time on public.contract_bets using btree (user_id, updated_time desc);

drop index if exists contract_bets_created_time_only;

create index contract_bets_created_time_only on public.contract_bets using btree (created_time desc);

drop index if exists contract_bets_contract_limit_orders;

create index contract_bets_contract_limit_orders on public.contract_bets using btree (
  contract_id,
  (((data -> 'isFilled'::text))::boolean),
  (((data -> 'isCancelled'::text))::boolean),
  is_redemption,
  created_time desc
);

drop index if exists contract_bets_user_id_contract_id;

create index contract_bets_user_id_contract_id on public.contract_bets using btree (user_id, contract_id, created_time);
