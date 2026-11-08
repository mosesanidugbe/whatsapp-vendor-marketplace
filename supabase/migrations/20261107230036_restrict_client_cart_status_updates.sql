-- Cart lifecycle transitions (especially checked_out) are server-controlled.
revoke update on public.carts from authenticated;
drop policy if exists "Customers can update their own carts" on public.carts;
