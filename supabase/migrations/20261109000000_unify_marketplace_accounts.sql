-- Unified marketplace accounts: store ownership enables selling; every user can shop.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

alter table public.profiles drop column if exists role;

drop policy if exists "Sellers can create one store for themselves" on public.stores;
drop policy if exists "Sellers can update their own store" on public.stores;
drop policy if exists "Sellers can delete their own store" on public.stores;
create policy "Users can create one store for themselves" on public.stores
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can update their own store" on public.stores
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy "Owners can delete their own store" on public.stores
for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Sellers can add products to their own store" on public.products;
drop policy if exists "Sellers can update products in their own store" on public.products;
drop policy if exists "Sellers can delete products in their own store" on public.products;
create policy "Store owners can add products" on public.products
for insert to authenticated with check (exists (
 select 1 from public.stores s where s.id = products.store_id and s.owner_id = (select auth.uid())
));
create policy "Store owners can update products" on public.products
for update to authenticated using (exists (
 select 1 from public.stores s where s.id = products.store_id and s.owner_id = (select auth.uid())
)) with check (exists (
 select 1 from public.stores s where s.id = products.store_id and s.owner_id = (select auth.uid())
));
create policy "Store owners can delete products" on public.products
for delete to authenticated using (exists (
 select 1 from public.stores s where s.id = products.store_id and s.owner_id = (select auth.uid())
));

-- Admin access is trusted only when the signed JWT app_metadata role is admin.
create policy "Admins can manage stores" on public.stores for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can manage products" on public.products for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Customers can create carts for active stores" on public.carts;
create policy "Users can create carts for other active stores" on public.carts
for insert to authenticated with check (
 customer_id = (select auth.uid()) and status = 'active' and exists (
  select 1 from public.stores s where s.id = carts.store_id
   and s.is_active and s.owner_id <> (select auth.uid())
 )
);

drop policy if exists "Customers can add matching vendor products to their carts" on public.cart_items;
create policy "Users can add products from other stores to their carts" on public.cart_items
for insert to authenticated with check (exists (
 select 1 from public.carts c
 join public.products p on p.id = cart_items.product_id
 join public.stores s on s.id = c.store_id
 where c.id = cart_items.cart_id and c.customer_id = (select auth.uid())
  and c.status = 'active' and p.store_id = c.store_id and p.is_published
  and s.is_active and s.owner_id <> (select auth.uid())
));

drop policy if exists "Customers can update items in their own active carts" on public.cart_items;
create policy "Users can update items in carts from other stores" on public.cart_items
for update to authenticated using (exists (
 select 1 from public.carts c join public.stores s on s.id = c.store_id
 where c.id = cart_items.cart_id and c.customer_id = (select auth.uid())
  and c.status = 'active' and s.owner_id <> (select auth.uid())
)) with check (exists (
 select 1 from public.carts c
 join public.products p on p.id = cart_items.product_id
 join public.stores s on s.id = c.store_id
 where c.id = cart_items.cart_id and c.customer_id = (select auth.uid())
  and c.status = 'active' and p.store_id = c.store_id and p.is_published
  and s.owner_id <> (select auth.uid())
));

create or replace function private.checkout_vendor_cart_internal(p_cart_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
 v_customer_id uuid := auth.uid();
 v_cart public.carts%rowtype;
 v_store public.stores%rowtype;
 v_order_id uuid;
 v_order_number text;
 v_subtotal numeric(12,2);
 v_currency text;
 v_items jsonb;
 v_item_count integer;
 v_invalid_count integer;
begin
 if v_customer_id is null then
  raise exception 'You must be signed in to check out.' using errcode = '28000';
 end if;
 select * into v_cart from public.carts
 where id = p_cart_id and customer_id = v_customer_id for update;
 if not found then raise exception 'Cart not found.' using errcode = 'P0002'; end if;
 if v_cart.status <> 'active' then raise exception 'This cart has already been checked out.' using errcode = '55000'; end if;

 select * into v_store from public.stores
 where id = v_cart.store_id and is_active = true for share;
 if not found then raise exception 'This vendor is currently unavailable.' using errcode = '55000'; end if;
 if v_store.owner_id = v_customer_id then
  raise exception 'You cannot purchase products from your own store.' using errcode = '42501';
 end if;

 perform p.id from public.cart_items ci join public.products p on p.id = ci.product_id
 where ci.cart_id = v_cart.id order by p.id for update of p;

 select count(*), coalesce(sum(p.price * ci.quantity), 0), min(p.currency::text),
  count(*) filter (where p.id is null or not p.is_published or p.store_id <> v_cart.store_id or p.stock_quantity < ci.quantity),
  jsonb_agg(jsonb_build_object('product_name', p.name, 'unit_price', p.price,
   'quantity', ci.quantity, 'line_total', p.price * ci.quantity) order by p.name)
 into v_item_count, v_subtotal, v_currency, v_invalid_count, v_items
 from public.cart_items ci left join public.products p on p.id = ci.product_id
 where ci.cart_id = v_cart.id;
 if v_item_count = 0 then raise exception 'Your cart is empty.' using errcode = '22023'; end if;
 if v_invalid_count > 0 then
  raise exception 'One or more products are unavailable or have insufficient stock. Update your cart and try again.' using errcode = '22023';
 end if;
 if (select count(distinct p.currency) from public.cart_items ci
     join public.products p on p.id = ci.product_id where ci.cart_id = v_cart.id) > 1 then
  raise exception 'This cart contains products with different currencies.' using errcode = '22023';
 end if;

 insert into public.orders (customer_id, store_id, status, subtotal_amount, total_amount, currency)
 values (v_customer_id, v_cart.store_id, 'pending', v_subtotal, v_subtotal, coalesce(v_currency, 'NGN'))
 returning id, order_number into v_order_id, v_order_number;
 insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
 select v_order_id, p.id, p.name, p.price, ci.quantity from public.cart_items ci
 join public.products p on p.id = ci.product_id where ci.cart_id = v_cart.id;
 update public.carts set status = 'checked_out', updated_at = now() where id = v_cart.id;
 return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
  'store_name', v_store.name, 'whatsapp_number', v_store.whatsapp_number,
  'subtotal', v_subtotal, 'currency', coalesce(v_currency, 'NGN'), 'items', v_items);
end;
$function$;

drop policy if exists "Sellers can view their marketplace image objects" on storage.objects;
create policy "Store owners can view their marketplace image objects" on storage.objects
for select to authenticated using (
 bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = (select auth.uid()::text)
 and (storage.foldername(name))[2] in ('products', 'store')
 and exists (select 1 from public.stores s where s.owner_id = (select auth.uid()))
);
drop policy if exists "Sellers can update their marketplace image objects" on storage.objects;
create policy "Store owners can update their marketplace image objects" on storage.objects
for update to authenticated using (
 bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = (select auth.uid()::text)
 and (storage.foldername(name))[2] in ('products', 'store')
 and exists (select 1 from public.stores s where s.owner_id = (select auth.uid()))
) with check (
 bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = (select auth.uid()::text)
 and (storage.foldername(name))[2] in ('products', 'store')
 and exists (select 1 from public.stores s where s.owner_id = (select auth.uid()))
);
drop policy if exists "Sellers can delete their marketplace image objects" on storage.objects;
create policy "Store owners can delete their marketplace image objects" on storage.objects
for delete to authenticated using (
 bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = (select auth.uid()::text)
 and (storage.foldername(name))[2] in ('products', 'store')
 and exists (select 1 from public.stores s where s.owner_id = (select auth.uid()))
);
