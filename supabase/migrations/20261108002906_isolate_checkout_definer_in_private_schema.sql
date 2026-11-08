-- Keep the existing checkout RPC name public, but move its privileged implementation
-- into a schema that is not exposed through the Supabase Data API.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.checkout_vendor_cart(uuid) set schema private;
alter function private.checkout_vendor_cart(uuid) rename to checkout_vendor_cart_internal;

-- The internal implementation remains SECURITY DEFINER because it must atomically
-- create orders and transition carts despite client-facing table grants/RLS.
-- Its existing auth.uid() ownership check and empty search_path are preserved.
alter function private.checkout_vendor_cart_internal(uuid) set search_path = '';

revoke all on function private.checkout_vendor_cart_internal(uuid) from public, anon, authenticated;
grant execute on function private.checkout_vendor_cart_internal(uuid) to authenticated;

-- Preserve the existing PostgREST RPC endpoint as a narrow SECURITY INVOKER wrapper.
create function public.checkout_vendor_cart(p_cart_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.checkout_vendor_cart_internal(p_cart_id);
$function$;

revoke all on function public.checkout_vendor_cart(uuid) from public, anon;
grant execute on function public.checkout_vendor_cart(uuid) to authenticated;

comment on schema private is 'Internal database functions and objects; do not expose through the Supabase Data API.';
comment on function private.checkout_vendor_cart_internal(uuid) is
  'Privileged checkout implementation. Callable only through authenticated invoker wrapper; validates auth.uid() and cart ownership.';
