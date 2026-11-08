-- Seed the six provisional categories already shown in the marketplace homepage.
-- The upsert makes this migration safe to re-run without duplicating rows.
insert into public.categories (name, slug, sort_order, is_active)
values
  ('Phones & gadgets', 'phones-gadgets', 1, true),
  ('Fashion', 'fashion', 2, true),
  ('Beauty', 'beauty', 3, true),
  ('Home & living', 'home-living', 4, true),
  ('Food & treats', 'food-treats', 5, true),
  ('Art & crafts', 'art-crafts', 6, true)
on conflict (slug) do nothing;
