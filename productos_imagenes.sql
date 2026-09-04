-- ============================================================
-- EMPANADAS QUE RICO — IMÁGENES DE PRODUCTOS
-- Ejecutar UNA sola vez en Supabase SQL Editor.
-- ============================================================

alter table public.productos
  add column if not exists imagen_url text;

-- Bucket público para que el index pueda mostrar las imágenes.
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "admin puede subir imagenes de productos" on storage.objects;
create policy "admin puede subir imagenes de productos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'productos');

drop policy if exists "admin puede actualizar imagenes de productos" on storage.objects;
create policy "admin puede actualizar imagenes de productos"
on storage.objects for update
to authenticated
using (bucket_id = 'productos')
with check (bucket_id = 'productos');

drop policy if exists "public puede ver imagenes de productos" on storage.objects;
create policy "public puede ver imagenes de productos"
on storage.objects for select
to public
using (bucket_id = 'productos');

drop policy if exists "admin puede borrar imagenes de productos" on storage.objects;
create policy "admin puede borrar imagenes de productos"
on storage.objects for delete
to authenticated
using (bucket_id = 'productos');
