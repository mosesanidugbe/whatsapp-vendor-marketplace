
-- Core marketplace schema. Auth identities remain in auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  whatsapp_number text not null,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null default 'NGN',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_urls text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_store_slug_unique unique (store_id, slug)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  customer_id uuid references public.profiles (id) on delete set null,
  store_id uuid not null references public.stores (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
  subtotal_amount numeric(12, 2) not null check (subtotal_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  currency char(3) not null default 'NGN',
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(14, 2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

create index stores_active_idx on public.stores (is_active);
create index products_store_id_idx on public.products (store_id);
create index products_category_id_idx on public.products (category_id);
create index products_public_listing_idx on public.products (is_published, created_at desc);
create index orders_customer_id_idx on public.orders (customer_id, created_at desc);
create index orders_store_id_idx on public.orders (store_id, created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);

-- Keep updated_at consistent on mutable records.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Create a profile automatically when a Supabase Auth user signs up.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Trigger functions are not intended to be callable as RPC endpoints.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Enable RLS on every exposed marketplace table.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Least-privilege table grants; RLS further restricts rows.
grant select, insert, update on public.profiles to authenticated;
grant select on public.stores, public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.stores, public.products to authenticated;
grant select on public.orders, public.order_items to authenticated;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Active stores are publicly visible"
on public.stores for select to anon, authenticated
using (is_active or (select auth.uid()) = owner_id);

create policy "Users can create one store for themselves"
on public.stores for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update their own store"
on public.stores for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their own store"
on public.stores for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "Active categories are publicly visible"
on public.categories for select to anon, authenticated
using (is_active);

create policy "Published products in active stores are public"
on public.products for select to anon, authenticated
using (
  (
    is_published
    and exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.is_active
    )
  )
  or exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "Store owners can add products"
on public.products for insert to authenticated
with check (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "Store owners can update products"
on public.products for update to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "Store owners can delete products"
on public.products for delete to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "Customers and store owners can read orders"
on public.orders for select to authenticated
using (
  customer_id = (select auth.uid())
  or exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "Customers and store owners can read order items"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_items.order_id
      and (
        o.customer_id = (select auth.uid())
        or s.owner_id = (select auth.uid())
      )
  )
);

-- Order writes are intentionally not granted to browser clients yet.
-- We'll add a validated server-side checkout flow before enabling order creation.
