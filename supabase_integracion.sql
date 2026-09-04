-- ============================================================
-- LA ESQUINA DEL SABOR — SUPABASE DESDE CERO
-- Ejecuta TODO este archivo en Supabase SQL Editor.
-- No contiene contraseñas ni service_role.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text not null unique,
  tracking_token uuid not null default gen_random_uuid() unique,
  sucursal text not null,
  modalidad text not null check (modalidad in ('domicilio','recoger')),
  metodo_pago text not null check (metodo_pago in ('transferencia','efectivo')),
  cliente jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  empaque numeric(12,2) not null default 0,
  domicilio numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado text not null default 'verificacion'
    check (estado in ('verificacion','validado','rechazado','preparacion','en_domicilio','entregado')),
  motivo_invalido text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);



-- ============================================================
-- PRODUCTOS: fuente única del menú público y del panel.
-- El index y el panel leen la misma tabla.
-- ============================================================

create table if not exists public.productos (
  id text primary key,
  categoria text not null,
  icono text not null default '🍽️',
  nombre text not null,
  descripcion text not null default '',
  precio numeric(12,2) not null default 0,
  sucursales text[] not null default '{}',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.productos enable row level security;

drop policy if exists "public puede ver productos activos" on public.productos;
create policy "public puede ver productos activos"
on public.productos for select
to anon, authenticated
using (activo = true);

drop policy if exists "admin puede ver todos los productos" on public.productos;
create policy "admin puede ver todos los productos"
on public.productos for select
to authenticated
using (true);

drop policy if exists "admin puede crear productos" on public.productos;
create policy "admin puede crear productos"
on public.productos for insert
to authenticated
with check (true);

drop policy if exists "admin puede editar productos" on public.productos;
create policy "admin puede editar productos"
on public.productos for update
to authenticated
using (true)
with check (true);

grant select on public.productos to anon, authenticated;
grant insert, update on public.productos to authenticated;

create or replace function public.actualizar_producto_fecha()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists productos_actualizado_en on public.productos;
create trigger productos_actualizado_en
before update on public.productos
for each row execute function public.actualizar_producto_fecha();

-- Estados usados por index + panel.
update public.pedidos
   set estado='rechazado'
 where estado='invalido';

update public.pedidos
   set estado='en_domicilio'
 where estado='camino';

alter table public.pedidos
  drop constraint if exists pedidos_estado_check;

alter table public.pedidos
  add constraint pedidos_estado_check
  check (estado in ('verificacion','validado','rechazado','preparacion','en_domicilio','entregado'));


create sequence if not exists public.pedidos_numero_seq;

do $$
declare
  ultimo bigint;
begin
  select coalesce(max(nullif(numero_pedido,'')::bigint),0)
    into ultimo
    from public.pedidos
   where numero_pedido ~ '^[0-9]+$';

  if ultimo = 0 then
    perform setval('public.pedidos_numero_seq', 1, false);
  else
    perform setval('public.pedidos_numero_seq', ultimo, true);
  end if;
end $$;

alter table public.pedidos
  alter column numero_pedido
  set default lpad(nextval('public.pedidos_numero_seq')::text,6,'0');

grant usage on schema public to anon, authenticated;

alter table public.pedidos enable row level security;

-- Elimina políticas anteriores para evitar conflictos.
do $$
declare r record;
begin
  for r in
    select policyname
      from pg_policies
     where schemaname='public' and tablename='pedidos'
  loop
    execute format('drop policy if exists %I on public.pedidos', r.policyname);
  end loop;
end $$;

-- El navegador NO inserta directamente. Usa la RPC SECURITY DEFINER.
revoke all on public.pedidos from anon;
grant insert, select, update on public.pedidos to authenticated;

create or replace function public.registrar_pedido_publico(
  p_sucursal text,
  p_modalidad text,
  p_metodo_pago text,
  p_cliente jsonb,
  p_items jsonb,
  p_subtotal numeric,
  p_empaque numeric,
  p_domicilio numeric,
  p_total numeric
)
returns table(id uuid, numero_pedido text, tracking_token uuid, estado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_modalidad not in ('domicilio','recoger') then
    raise exception 'Modalidad de entrega inválida';
  end if;

  if p_metodo_pago not in ('transferencia','efectivo') then
    raise exception 'Método de pago inválido';
  end if;

  return query
  insert into public.pedidos
    (sucursal, modalidad, metodo_pago, cliente, items,
     subtotal, empaque, domicilio, total, estado)
  values
    (coalesce(p_sucursal,''),
     p_modalidad,
     p_metodo_pago,
     coalesce(p_cliente,'{}'::jsonb),
     coalesce(p_items,'[]'::jsonb),
     greatest(coalesce(p_subtotal,0),0),
     greatest(coalesce(p_empaque,0),0),
     greatest(coalesce(p_domicilio,0),0),
     greatest(coalesce(p_total,0),0),
     'verificacion')
  returning pedidos.id, pedidos.numero_pedido, pedidos.tracking_token, pedidos.estado;
end;
$$;

revoke all on function public.registrar_pedido_publico(
  text,text,text,jsonb,jsonb,numeric,numeric,numeric,numeric
) from public;

grant execute on function public.registrar_pedido_publico(
  text,text,text,jsonb,jsonb,numeric,numeric,numeric,numeric
) to anon, authenticated;

grant usage, select on sequence public.pedidos_numero_seq to anon, authenticated;

create or replace function public.consultar_pedido_por_numero(p_numero text)
returns table(numero_pedido text, estado text, motivo_invalido text)
language sql
security definer
set search_path=public
as $$
  select p.numero_pedido,p.estado,p.motivo_invalido
    from public.pedidos p
   where p.numero_pedido = p_numero
   limit 1;
$$;

grant execute on function public.consultar_pedido_por_numero(text) to anon, authenticated;

create or replace function public.consultar_pedido_por_token(p_token uuid)
returns table(numero_pedido text, estado text, motivo_invalido text)
language sql
security definer
set search_path=public
as $$
  select p.numero_pedido,p.estado,p.motivo_invalido
    from public.pedidos p
   where p.tracking_token = p_token
   limit 1;
$$;

grant execute on function public.consultar_pedido_por_token(uuid) to anon, authenticated;

-- Vista administrativa: los usuarios autenticados pueden consultar pedidos.
drop policy if exists "admin puede ver pedidos" on public.pedidos;
create policy "admin puede ver pedidos"
on public.pedidos for select
to authenticated
using (true);

drop policy if exists "admin puede actualizar pedidos" on public.pedidos;
create policy "admin puede actualizar pedidos"
on public.pedidos for update
to authenticated
using (true)
with check (true);

-- Actualización automática.
create or replace function public.actualizar_pedido_fecha()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists pedidos_actualizado_en on public.pedidos;
create trigger pedidos_actualizado_en
before update on public.pedidos
for each row execute function public.actualizar_pedido_fecha();

-- Verificación rápida después de ejecutar:
-- select public.registrar_pedido_publico(
--   'Cuba','recoger','efectivo',
--   '{"nombre":"Prueba","telefono":"3000000000","sucursal":"Cuba","nota":"Prueba"}'::jsonb,
--   '[{"id":"emp-carne","cantidad":1}]'::jsonb,
--   3000,2000,0,5000
-- );


-- Fuerza a PostgREST a recargar las funciones nuevas/modificadas.
notify pgrst, 'reload schema';
