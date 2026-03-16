create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  color text not null default '#4f7ef8',
  vat_rate numeric(5,2) not null default 23,
  profit_share_type text not null default 'headcount'
    check (profit_share_type in ('headcount', 'percentage', 'fixed')),
  profit_share_value numeric(12,2) not null default 0,
  headcount integer not null default 1 check (headcount >= 1),
  calculation_mode text not null default 'gross_to_net'
    check (calculation_mode in ('gross_to_net', 'manual_net')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists stores_name_unique_idx
  on stores (lower(name));

create table if not exists daily_store_stats (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  date date not null,
  revenue_gross numeric(12,2) not null default 0,
  revenue_net numeric(12,2),
  ad_cost_tiktok numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  extra_costs numeric(12,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_store_stats_unique_day unique (store_id, date)
);

create index if not exists daily_store_stats_store_date_idx
  on daily_store_stats (store_id, date desc);

drop trigger if exists stores_set_updated_at on stores;
create trigger stores_set_updated_at
before update on stores
for each row
execute function set_updated_at();

drop trigger if exists daily_store_stats_set_updated_at on daily_store_stats;
create trigger daily_store_stats_set_updated_at
before update on daily_store_stats
for each row
execute function set_updated_at();

create or replace view store_daily_metrics as
select
  d.id,
  d.store_id,
  s.name as store_name,
  d.date,
  d.revenue_gross,
  coalesce(
    d.revenue_net,
    case
      when s.calculation_mode = 'gross_to_net'
        then round(d.revenue_gross / nullif(1 + (s.vat_rate / 100.0), 0), 2)
      else 0
    end
  ) as revenue_net_resolved,
  d.ad_cost_tiktok,
  d.refunds,
  d.extra_costs,
  round(
    coalesce(
      d.revenue_net,
      case
        when s.calculation_mode = 'gross_to_net'
          then d.revenue_gross / nullif(1 + (s.vat_rate / 100.0), 0)
        else 0
      end
    ) - d.ad_cost_tiktok - d.refunds - d.extra_costs,
    2
  ) as income,
  round(
    case
      when d.revenue_gross > 0 then (d.ad_cost_tiktok / d.revenue_gross) * 100
      else 0
    end,
    2
  ) as ad_cost_pct
from daily_store_stats d
join stores s on s.id = d.store_id;

insert into stores (name, is_active, color, vat_rate, profit_share_type, profit_share_value, headcount, calculation_mode)
select *
from (
  values
    ('FashionDrop', true, '#4f7ef8', 23, 'headcount', 0, 2, 'gross_to_net'),
    ('TechGear', true, '#22c55e', 23, 'percentage', 35, 3, 'gross_to_net'),
    ('HomeBloom', true, '#f97316', 8, 'fixed', 900, 1, 'manual_net')
) as seed(name, is_active, color, vat_rate, profit_share_type, profit_share_value, headcount, calculation_mode)
where not exists (
  select 1
  from stores
  where lower(stores.name) = lower(seed.name)
);
