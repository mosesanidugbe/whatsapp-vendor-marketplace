revoke all privileges on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
revoke all privileges on tables from anon, authenticated;

grant select on table public.categories, public.stores, public.products to anon;
grant select on table public.categories, public.stores, public.products to authenticated;

grant select, update (display_name, phone, avatar_url)
on table public.profiles to authenticated;

grant select, insert, delete on table public.carts to authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;

grant select, insert, update, delete on table public.stores to authenticated;
grant select, insert, update, delete on table public.products to authenticated;

grant select on table public.orders, public.order_items to authenticated;
