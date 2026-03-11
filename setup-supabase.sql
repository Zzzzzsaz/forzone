-- Business OS — Supabase Setup (z Realtime)
-- Uruchom w Supabase → SQL Editor → New query → Run

-- 1. Tabela
create table if not exists user_state (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  data       jsonb        not null default '{}',
  updated_at timestamptz  not null default now()
);

-- 2. Row Level Security — każdy widzi TYLKO swoje dane
alter table user_state enable row level security;

drop policy if exists "own_state" on user_state;
create policy "own_state" on user_state
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Auto-aktualizacja updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_state_updated_at on user_state;
create trigger trg_user_state_updated_at
  before update on user_state
  for each row execute function update_updated_at();

-- 4. *** REALTIME — BEZ TEJ LINII sync nie działa ***
alter publication supabase_realtime add table user_state;

-- Sprawdź: select * from user_state;
