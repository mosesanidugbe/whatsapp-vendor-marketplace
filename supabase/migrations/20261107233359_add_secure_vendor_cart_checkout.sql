create or replace function public.checkout_vendor_cart(p_cart_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  select * into v_cart
  from public.carts
  where id = p_cart_id and customer_id = v_customer_id
  for update;

  if not found then
    raise exception 'Cart not found.' using errcode = 'P0002';
  end if;
  if v_cart.status <> 'active' then
    raise exception 'This cart has already been checked out.' using errcode = '55000';
  end if;

  select * into v_store
  from public.stores
  where id = v_cart.store_id and is_active = true;

  if not found then
    raise exception 'This vendor is currently unavailable.' using errcode = '55000';
  end if;

  select count(*),
         coalesce(sum(p.price * ci.quantity), 0),
         min(p.currency::text),
         count(*) filter (where p.id is null or not p.is_published or p.store_id <> v_cart.store_id or p.stock_quantity < ci.quantity),
         jsonb_agg(jsonb_build_object(
           'product_name', p.name,
           'unit_price', p.price,
           'quantity', ci.quantity,
           'line_total', p.price * ci.quantity
         ) order by p.name)
  into v_item_count, v_subtotal, v_currency, v_invalid_count, v_items
  from public.cart_items ci
  left join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart.id;

  if v_item_count = 0 then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;
  if v_invalid_count > 0 then
    raise exception 'One or more products are unavailable or have insufficient stock. Update your cart and try again.' using errcode = '22023';
  end if;
  if (select count(distinct p.currency) from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = v_cart.id) > 1 then
    raise exception 'This cart contains products with different currencies.' using errcode = '22023';
  end if;

  insert into public.orders (customer_id, store_id, status, subtotal_amount, total_amount, currency)
  values (v_customer_id, v_cart.store_id, 'pending', v_subtotal, v_subtotal, coalesce(v_currency, 'NGN'))
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
  select v_order_id, p.id, p.name, p.price, ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart.id;

  update public.carts set status = 'checked_out', updated_at = now()
  where id = v_cart.id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'store_name', v_store.name,
    'whatsapp_number', v_store.whatsapp_number,
    'subtotal', v_subtotal,
    'currency', coalesce(v_currency, 'NGN'),
    'items', v_items
  );
end;
$$;

revoke all on function public.checkout_vendor_cart(uuid) from public;
grant execute on function public.checkout_vendor_cart(uuid) to authenticated;
