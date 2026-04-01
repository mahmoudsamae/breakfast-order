create table if not exists public.menu_items (
  id bigserial primary key,
  menu_id bigint not null references public.menus(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity >= 1),
  created_at timestamptz not null default now()
);

create unique index if not exists menu_items_menu_product_uq
  on public.menu_items(menu_id, product_id);

create index if not exists menu_items_menu_id_idx on public.menu_items(menu_id);
create index if not exists menu_items_product_id_idx on public.menu_items(product_id);
