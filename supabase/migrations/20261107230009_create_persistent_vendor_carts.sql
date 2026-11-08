-- Persistent customer carts, isolated per vendor.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'checked_out', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A customer can have only one active cart for a given store.
create unique index carts_one_active_per_customer_store_idx
  on public.carts (customer_id, store_id)
  where status = 'active';
create index carts_customer_status_idx
  on public.carts (customer_id, status, updated_at desc);
create index carts_store_id_idx on public.carts (store_id);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_product_unique unique (cart_id, product_id)
);

create index cart_items_product_id_idx on public.cart_items (product_id);
create index cart_items_cart_id_idx on public.cart_items (cart_id);

create trigger carts_set_updated_at
before update on public.carts
for each row execute function public.set_updated_at();

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

create policy "Customers can read their own carts"
on public.carts for select to authenticated
using (customer_id = (select auth.uid()));

create policy "Customers can create carts for active stores"
on public.carts for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'active'
  and exists (
    select 1 from public.stores s
    where s.id = carts.store_id and s.is_active
  )
);

create policy "Customers can update their own carts"
on public.carts for update to authenticated
using (customer_id = (select auth.uid()))
with check (
  customer_id = (select auth.uid())
  and status in ('active', 'checked_out', 'abandoned')
);

create policy "Customers can delete their own carts"
on public.carts for delete to authenticated
using (customer_id = (select auth.uid()));

create policy "Customers can read items in their own carts"
on public.cart_items for select to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id
      and c.customer_id = (select auth.uid())
  )
);

create policy "Customers can add matching vendor products to their carts"
on public.cart_items for insert to authenticated
with check (
  exists (
    select 1
    from public.carts c
    join public.products p on p.id = cart_items.product_id
    join public.stores s on s.id = c.store_id
    where c.id = cart_items.cart_id
      and c.customer_id = (select auth.uid())
      and c.status = 'active'
      and p.store_id = c.store_id
      and p.is_published
      and s.is_active
  )
);

create policy "Customers can update items in their own active carts"
on public.cart_items for update to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id
      and c.customer_id = (select auth.uid())
      and c.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.carts c
    join public.products p on p.id = cart_items.product_id
    where c.id = cart_items.cart_id
      and c.customer_id = (select auth.uid())
      and c.status = 'active'
      and p.store_id = c.store_id
      and p.is_published
  )
);

create policy "Customers can remove items from their own carts"
on public.cart_items for delete to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id
      and c.customer_id = (select auth.uid())
  )
);
