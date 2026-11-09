-- Restore the six marketplace categories after development data resets.
-- Upsert by stable slug so this migration is safe to re-run and reactivates categories.
insert into public.categories (name, slug, sort_order, is_active)
values
  ('Phones & gadgets', 'phones-gadgets', 1, true),
  ('Fashion', 'fashion', 2, true),
  ('Beauty', 'beauty', 3, true),
  ('Home & living', 'home-living', 4, true),
  ('Food & treats', 'food-treats', 5, true),
  ('Art & crafts', 'art-crafts', 6, true)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;
