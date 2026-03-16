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

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists companies_name_unique_idx
  on companies (lower(name));

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
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

create unique index if not exists stores_company_name_unique_idx
  on stores (company_id, lower(name));

create index if not exists stores_company_idx
  on stores (company_id);

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

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at
before update on companies
for each row
execute function set_updated_at();

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
  c.id as company_id,
  c.name as company_name,
  s.id as store_id,
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
      when s.profit_share_type = 'percentage' then
        (
          coalesce(
            d.revenue_net,
            case
              when s.calculation_mode = 'gross_to_net'
                then d.revenue_gross / nullif(1 + (s.vat_rate / 100.0), 0)
              else 0
            end
          ) - d.ad_cost_tiktok - d.refunds - d.extra_costs
        ) * (s.profit_share_value / 100.0)
      when s.profit_share_type = 'fixed' then s.profit_share_value
      else (
        coalesce(
          d.revenue_net,
          case
            when s.calculation_mode = 'gross_to_net'
              then d.revenue_gross / nullif(1 + (s.vat_rate / 100.0), 0)
            else 0
          end
        ) - d.ad_cost_tiktok - d.refunds - d.extra_costs
      ) / nullif(s.headcount, 0)
    end,
    2
  ) as per_head,
  round(
    case
      when d.revenue_gross > 0 then (d.ad_cost_tiktok / d.revenue_gross) * 100
      else 0
    end,
    2
  ) as ad_cost_pct
from daily_store_stats d
join stores s on s.id = d.store_id
join companies c on c.id = s.company_id;

insert into companies (name, is_active)
select *
from (
  values
    ('Forzone Commerce', true),
    ('Nova Brands', true)
) as seed(name, is_active)
where not exists (
  select 1
  from companies
  where lower(companies.name) = lower(seed.name)
);

insert into stores (company_id, name, is_active, color, vat_rate, profit_share_type, profit_share_value, headcount, calculation_mode)
select
  c.id,
  seed.name,
  seed.is_active,
  seed.color,
  seed.vat_rate,
  seed.profit_share_type,
  seed.profit_share_value,
  seed.headcount,
  seed.calculation_mode
from (
  values
    ('Forzone Commerce', 'FashionDrop PL', true, '#2d5be3', 23, 'headcount', 0, 2, 'gross_to_net'),
    ('Forzone Commerce', 'TechGear EU', true, '#22c55e', 23, 'headcount', 0, 3, 'gross_to_net'),
    ('Nova Brands', 'GlowSkin Studio', true, '#f97316', 23, 'percentage', 35, 2, 'manual_net'),
    ('Nova Brands', 'HomeCraft Lab', true, '#8b5cf6', 8, 'fixed', 850, 1, 'gross_to_net')
) as seed(company_name, name, is_active, color, vat_rate, profit_share_type, profit_share_value, headcount, calculation_mode)
join companies c on lower(c.name) = lower(seed.company_name)
where not exists (
  select 1
  from stores s
  where s.company_id = c.id
    and lower(s.name) = lower(seed.name)
);

insert into daily_store_stats (store_id, date, revenue_gross, revenue_net, ad_cost_tiktok, refunds, extra_costs, notes)
select
  s.id,
  seed.date,
  seed.revenue_gross,
  seed.revenue_net,
  seed.ad_cost_tiktok,
  seed.refunds,
  seed.extra_costs,
  seed.notes
from (
  values
    ('FashionDrop PL', current_date - interval '14 day', 15400, null, 2600, 340, 180, 'Wyprzedaz weekendowa'),
    ('FashionDrop PL', current_date - interval '11 day', 18220, null, 3180, 520, 240, 'Nowe kreacje UGC'),
    ('TechGear EU', current_date - interval '13 day', 12340, null, 2140, 210, 120, 'Start nowej kampanii'),
    ('TechGear EU', current_date - interval '7 day', 14180, null, 2480, 280, 190, ''),
    ('GlowSkin Studio', current_date - interval '12 day', 9800, 7967, 1690, 120, 80, 'Manualne netto z ERP'),
    ('GlowSkin Studio', current_date - interval '5 day', 11750, 9552, 1910, 180, 130, ''),
    ('HomeCraft Lab', current_date - interval '10 day', 8340, null, 980, 60, 110, 'Niski koszt zwrotow'),
    ('HomeCraft Lab', current_date - interval '3 day', 9050, null, 1140, 90, 140, 'Nowa oferta pakietowa')
) as seed(store_name, date, revenue_gross, revenue_net, ad_cost_tiktok, refunds, extra_costs, notes)
join stores s on lower(s.name) = lower(seed.store_name)
where not exists (
  select 1
  from daily_store_stats d
  where d.store_id = s.id
    and d.date = seed.date::date
);
