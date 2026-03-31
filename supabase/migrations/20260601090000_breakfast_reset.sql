-- CLEAN BREAKFAST RESET (DEV)
-- Drops old breakfast objects, recreates one consistent schema and create_order function.

drop function if exists public.admin_dashboard_stats(date, date, date, date, date);
drop function if exists public.create_order(text, date, text, jsonb, numeric);
drop table if exists public.order_menus cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.daily_order_counters cascade;
drop table if exists public.menus cascade;
drop table if exists public.products cascade;

create table public.products (
  id bigint generated always as identity primary key,
  name text not null,
  price numeric(10,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.menus (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.daily_order_counters (
  pickup_date date primary key,
  last_number int not null default 0
);

create table public.orders (
  id bigint generated always as identity primary key,
  order_number int not null,
  customer_name text not null,
  pickup_date date not null,
  status text not null check (status in ('pending','delivered')),
  source text not null default 'qr',
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create unique index orders_pickup_date_order_number_uniq on public.orders(pickup_date, order_number);
create index orders_pickup_date_status_idx on public.orders(pickup_date, status);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete restrict,
  product_id bigint references public.products(id) on delete restrict,
  menu_id bigint references public.menus(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  constraint order_items_exactly_one_ref check (
    ((product_id is not null)::int + (menu_id is not null)::int) = 1
  )
);

create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_product_id_idx on public.order_items(product_id);
create index order_items_menu_id_idx on public.order_items(menu_id);

create or replace function public.create_order(
  p_customer_name text,
  p_pickup_date date,
  p_source text,
  p_items jsonb,
  p_total_amount numeric default 0
)
returns table(order_id bigint, order_number int)
language plpgsql
as $$
declare
  v_next_number int;
  v_order_id bigint;
  v_item jsonb;
begin
  insert into public.daily_order_counters (pickup_date, last_number)
  values (p_pickup_date, 0)
  on conflict (pickup_date) do nothing;

  update public.daily_order_counters
  set last_number = last_number + 1
  where pickup_date = p_pickup_date
  returning last_number into v_next_number;

  insert into public.orders (order_number, customer_name, pickup_date, status, source, total_amount)
  values (v_next_number, p_customer_name, p_pickup_date, 'pending', coalesce(p_source, 'qr'), coalesce(p_total_amount, 0))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.order_items (order_id, product_id, menu_id, quantity, unit_price)
    values (
      v_order_id,
      nullif(v_item->>'product_id','')::bigint,
      nullif(v_item->>'menu_id','')::bigint,
      greatest(1, coalesce((v_item->>'quantity')::int, 1)),
      coalesce((v_item->>'unit_price')::numeric, 0)
    );
  end loop;

  return query select v_order_id, v_next_number;
end;
$$;

insert into public.products (name, price, image_url, is_active)
values
  ('Knusperbrötchen', 0.50, null, true),
  ('Farmerbrötchen', 0.80, null, true),
  ('Laugenbrezel', 1.20, null, true),
  ('Buttercroissant', 1.50, null, true);
