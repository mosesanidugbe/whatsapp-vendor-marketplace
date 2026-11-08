insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'marketplace-images',
    'marketplace-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  );

create policy "Sellers can upload marketplace images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'marketplace-images'
  and owner_id = (select auth.uid()::text)
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

create policy "Sellers can view their marketplace image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'marketplace-images'
  and owner_id = (select auth.uid()::text)
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

create policy "Sellers can update their marketplace image objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'marketplace-images'
  and owner_id = (select auth.uid()::text)
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
  and owner_id = (select auth.uid()::text)
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

create policy "Sellers can delete their marketplace image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marketplace-images'
  and owner_id = (select auth.uid()::text)
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
