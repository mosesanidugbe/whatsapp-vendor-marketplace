-- Cover remaining foreign keys identified by the Supabase performance advisor.
create index categories_parent_id_idx on public.categories (parent_id);
create index order_items_product_id_idx on public.order_items (product_id);
