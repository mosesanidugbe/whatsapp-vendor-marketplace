-- Harden the checkout RPC's SECURITY DEFINER execution context.
-- All application objects in the function body are schema-qualified.
alter function public.checkout_vendor_cart(uuid) set search_path = '';

-- Keep this RPC callable only by authenticated customers. Its body independently
-- verifies auth.uid() owns the active cart before creating an order.
revoke all on function public.checkout_vendor_cart(uuid) from public, anon;
grant execute on function public.checkout_vendor_cart(uuid) to authenticated;
