-- Canonical breakfast schema (German-only module)

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  price numeric(10,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.menus (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_order_counters (
  pickup_date date primary key,
  last_number int not null default 0
);

create table if not exists public.orders (
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

create table if not exists public.order_items (
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
