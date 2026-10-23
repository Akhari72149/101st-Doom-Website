alter table public.token_transactions
  add column if not exists transfer_group_id uuid,
  add column if not exists counterparty_platoon_id uuid references public.platoons(id) on delete set null;

update public.token_transactions transactions
set performed_by = null
where performed_by is not null
  and not exists (
    select 1
    from public.app_auth_users users
    where users.id = transactions.performed_by
  );

alter table public.token_transactions
  drop constraint if exists token_transactions_performed_by_fkey;

alter table public.token_transactions
  add constraint token_transactions_performed_by_fkey
  foreign key (performed_by) references public.app_auth_users(id) on delete set null;

create index if not exists token_transactions_transfer_group_idx
  on public.token_transactions(transfer_group_id)
  where transfer_group_id is not null;

create index if not exists token_transactions_counterparty_idx
  on public.token_transactions(counterparty_platoon_id, created_at desc)
  where counterparty_platoon_id is not null;
