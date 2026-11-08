-- Force new marketplace image uploads through the authenticated validation
-- Edge Function. Service-role uploads bypass RLS; sellers retain folder-scoped
-- access to read, replace, and remove their own existing objects.

drop policy if exists "Sellers can upload marketplace images" on storage.objects;

drop policy if exists "Sellers can view their marketplace image objects" on storage.objects;
create policy "Sellers can view their marketplace image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] in ('products', 'store')
  and exists (
    select 1
    from public.profiles p
    join public.stores s on s.owner_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Sellers can update their marketplace image objects" on storage.objects;
create policy "Sellers can update their marketplace image objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] in ('products', 'store')
  and exists (
    select 1
    from public.profiles p
    join public.stores s on s.owner_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
)
with check (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] in ('products', 'store')
  and exists (
    select 1
    from public.profiles p
    join public.stores s on s.owner_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
);

drop policy if exists "Sellers can delete their marketplace image objects" on storage.objects;
create policy "Sellers can delete their marketplace image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] in ('products', 'store')
  and exists (
    select 1
    from public.profiles p
    join public.stores s on s.owner_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller'
  )
);
