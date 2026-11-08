-- Require an authenticated seller account as well as ownership for all
-- store-management and product-management writes.
--
-- The role is read from public.profiles, whose client UPDATE grant excludes
-- the role column and whose RLS policy exposes only the caller's own row.

drop policy if exists "Users can create one store for themselves" on public.stores;
create policy "Sellers can create one store for themselves"
on public.stores
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Owners can update their own store" on public.stores;
create policy "Sellers can update their own store"
on public.stores
for update
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Owners can delete their own store" on public.stores;
create policy "Sellers can delete their own store"
on public.stores
for delete
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Store owners can add products" on public.products;
create policy "Sellers can add products to their own store"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.stores s
    join public.profiles p on p.id = s.owner_id
    where s.id = products.store_id
      and s.owner_id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Store owners can update products" on public.products;
create policy "Sellers can update products in their own store"
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.stores s
    join public.profiles p on p.id = s.owner_id
    where s.id = products.store_id
      and s.owner_id = (select auth.uid())
      and p.role = 'seller'
  )
)
with check (
  exists (
    select 1
    from public.stores s
    join public.profiles p on p.id = s.owner_id
    where s.id = products.store_id
      and s.owner_id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Store owners can delete products" on public.products;
create policy "Sellers can delete products in their own store"
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.stores s
    join public.profiles p on p.id = s.owner_id
    where s.id = products.store_id
      and s.owner_id = (select auth.uid())
      and p.role = 'seller'
  )
);
