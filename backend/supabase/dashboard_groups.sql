-- This file is autogenerated from regen-schema.ts
create table if not exists
  dashboard_groups (
    dashboard_id text not null,
    group_id text not null
  );

-- Foreign Keys
alter table dashboard_groups
add constraint dashboard_groups_dashboard_id_fkey foreign key (dashboard_id) references dashboards (id);

alter table dashboard_groups
add constraint public_dashboard_groups_group_id_fkey foreign key (group_id) references groups (id) on update cascade on delete cascade;

-- Policies
alter table dashboard_groups enable row level security;

drop policy if exists "Enable read access for admin" on dashboard_groups;

create policy "Enable read access for admin" on dashboard_groups for
select
  using (true);

-- Indexes
drop index if exists dashboard_groups_pkey;

create unique index dashboard_groups_pkey on public.dashboard_groups using btree (dashboard_id, group_id);
