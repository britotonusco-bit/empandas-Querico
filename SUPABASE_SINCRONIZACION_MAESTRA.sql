-- EMPANADAS QUE RICO — SINCRONIZACIÓN MAESTRA
-- Ejecutar DESPUÉS de supabase_integracion.sql y productos_imagenes.sql.
-- Este archivo corrige la base actual y habilita Realtime.

create table if not exists public.productos (
  id text primary key,
  categoria text not null,
  icono text not null default '🍽️',
  nombre text not null,
  descripcion text not null default '',
  precio numeric(12,2) null,
  sucursales text[] not null default '{}',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  imagen_url text
);

alter table public.productos add column if not exists imagen_url text;

-- No borra filas para no romper referencias de pedidos históricos.
-- Todo producto que no pertenece al catálogo actual queda inactivo.
update public.productos
set activo=false, sucursales='{}'::text[], actualizado_en=now()
where id not in ('emp-carne','emp-pollo','emp-queso','emp-mixta','mega-tradicional','mega-carne-desmechada','mega-barril','mega-arroz-arecho','jugo-del-valle-mango-fresa-500','jugo-del-valle-mango-500','jugo-del-valle-salpicon-500','power-mountain-blast-500','power-frutas-tropicales-500','fuzetea-400','coca-cola-original-400','coca-cola-zero-400','brisa-agua-pura-1l','brisa-agua-pura-600','brisa-gas-600','brisa-gas-maracuya-600','brisa-gas-manzana-600','coca-cola-original-1-5l','coca-cola-zero-1-5l','coca-cola-original-1l','avena-casera','quatro-original-toronja-400','soda-schweppes-400','premio-rojo-400','sprite-original-400','del-valle-ponche-400','del-valle-frutas-criticas-400','ginger-ale-schweppes-400','coca-cola-lata-original-330','coca-cola-zero-250','coca-cola-original-250','fanta-naranja-269','fanta-roja-269','brisa-gas-manzana-280','brisa-gas-maracuya-280','del-valle-ponche-1-5l','del-valle-mango-1-2l','del-valle-mango-fresa-1-2l','del-valle-mora-1-2l','coca-cola-original-2-5l','sprite-original-1-5l','quatro-original-toronja-1-5l','del-valle-frutas-criticas-1-5l','cong-carne','cong-pollo','cong-mixta','cong-queso','cong-barril','cong-ranchera','cong-chicharron','salsa-pimenton','salsa-aji','salsa-jalapeno','salsa-miel-jalapeno','salsa-guacamole-picante','salsa-miel-mostaza-picante','salsa-miel-mostaza','salsa-pina-picante','salsa-pina','salsa-aji-puro','salsa-mayonesa-jalapeno','salsa-queso','salsa-maiz','salsa-rosada','salsa-tartara','salsa-crema-lena','salsa-maracuya','salsa-maracuya-picante','salsa-guacamole','salsa-tocineta','salsa-rosada-pepinillos','salsa-mora','salsa-ochua','salsa-mayomostaza','salsa-bbq','salsa-ajo','salsa-ceviche','salsa-ceviche-picante','salsa-encurtido','salsa-cilantro');

-- IMPORTANTE: se permite precio NULL ANTES de insertar el catálogo.
-- COCA-COLA ORIGINAL 1L no tiene precio definido todavía.
alter table public.productos alter column precio drop not null;

insert into public.productos
(id,categoria,icono,nombre,descripcion,precio,sucursales,activo,creado_en,actualizado_en,imagen_url)
values
('emp-carne','Empanadas','🥟','Empanada de Carne','Empanada tradicional de carne.',3000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('emp-pollo','Empanadas','🥟','Empanada de Pollo','Empanada tradicional de pollo.',3000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('emp-queso','Empanadas','🥟','Empanada de Queso','Empanada rellena de queso.',3500,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('emp-mixta','Empanadas','🥟','Empanada Mixta','Deliciosa combinación de carne y pollo.',4000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('mega-tradicional','Mega empanadas de 30 cm','🥟','Mega Tradicional','Mega empanada tradicional de 30 cm.',12000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('mega-carne-desmechada','Mega empanadas de 30 cm','🥟','Mega de Carne Desmechada','Mega empanada de 30 cm con carne desmechada.',15000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('mega-barril','Mega empanadas de 30 cm','🥟','Mega Barril','Mega empanada de 30 cm.',15000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('mega-arroz-arecho','Mega empanadas de 30 cm','🥟','Mega de Arroz Arecho','Mega empanada de 30 cm con arroz arecho.',15000,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('jugo-del-valle-mango-fresa-500','Gaseosas Coca-Cola','🥤','MANGO FRESA 500ML','Jugo Del Valle.',5000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('jugo-del-valle-mango-500','Gaseosas Coca-Cola','🥤','MANGO 500ML','Jugo Del Valle.',5000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('jugo-del-valle-salpicon-500','Gaseosas Coca-Cola','🥤','SALPICON 500ML','Jugo Del Valle.',5000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('power-mountain-blast-500','Gaseosas Coca-Cola','🥤','POWER MOUNTAIN BLAST 500ML','Bebida Power.',5000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('power-frutas-tropicales-500','Gaseosas Coca-Cola','🥤','POWER FRUTAS TROPICALES 500ML','Bebida Power.',5000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('fuzetea-400','Gaseosas Coca-Cola','🥤','FUZETEA 400ML','Bebida fría.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-original-400','Gaseosas Coca-Cola','🥤','COCA-COLA ORIGINAL 400ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-zero-400','Gaseosas Coca-Cola','🥤','COCA-COLA ZERO 400ML','Bebida gaseosa sin azúcar.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-agua-pura-1l','Gaseosas Coca-Cola','🥤','BRISA AGUA PURA 1L','Agua.',3000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-agua-pura-600','Gaseosas Coca-Cola','🥤','BRISA AGUA PURA 600ML','Agua.',2000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-gas-600','Gaseosas Coca-Cola','🥤','BRISA CON GAS 600ML','Agua con gas.',2000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-gas-maracuya-600','Gaseosas Coca-Cola','🥤','BRISA CON GAS MARACUYÁ 600ML','Agua con gas.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-gas-manzana-600','Gaseosas Coca-Cola','🥤','BRISA CON GAS MANZANA 600ML','Agua con gas.',40000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-original-1-5l','Gaseosas Coca-Cola','🥤','COCA-COLA ORIGINAL 1.5L','Bebida gaseosa.',7000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-zero-1-5l','Gaseosas Coca-Cola','🥤','COCA-COLA ZERO 1.5L','Bebida gaseosa sin azúcar.',7000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-original-1l','Gaseosas Coca-Cola','🥤','COCA-COLA ORIGINAL 1L','Bebida gaseosa.',NULL,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('avena-casera','Gaseosas Coca-Cola','🥤','AVENA CASERA','Bebida.',5000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('quatro-original-toronja-400','Gaseosas Coca-Cola','🥤','QUATRO SABOR ORIGINAL TORONJA 400L','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('soda-schweppes-400','Gaseosas Coca-Cola','🥤','SODA SCHEPPES 400ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('premio-rojo-400','Gaseosas Coca-Cola','🥤','PREMIO ROJO 400ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('sprite-original-400','Gaseosas Coca-Cola','🥤','SPRITE SABOR ORIGINAL LIMA LIMON 400ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-ponche-400','Gaseosas Coca-Cola','🥤','DEL VALLE PONCHE DE FRUTAS 400ML','Jugo Del Valle.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-frutas-criticas-400','Gaseosas Coca-Cola','🥤','DEL VALLE FRUTAS CRITICAS 400ML','Jugo Del Valle.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('ginger-ale-schweppes-400','Gaseosas Coca-Cola','🥤','GINGER ALE SCHEPPES 400ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-lata-original-330','Gaseosas Coca-Cola','🥤','COCA-COLA EN LATA ORIGINAL 330ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-zero-250','Gaseosas Coca-Cola','🥤','COCA-COLA ZERO 250ML','Bebida gaseosa sin azúcar.',3000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-original-250','Gaseosas Coca-Cola','🥤','COCA-COLA ORIGINAL 250ML','Bebida gaseosa.',3000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('fanta-naranja-269','Gaseosas Coca-Cola','🥤','FANTA NARANJA 269ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('fanta-roja-269','Gaseosas Coca-Cola','🥤','FANTA ROJA 269 ML','Bebida gaseosa.',4000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-gas-manzana-280','Gaseosas Coca-Cola','🥤','BRISA CON GAS MANZANA 280ML','Agua con gas.',3000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('brisa-gas-maracuya-280','Gaseosas Coca-Cola','🥤','BRISA CON GAS MARACUYÁ 280ML','Agua con gas.',3000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-ponche-1-5l','Gaseosas Coca-Cola','🥤','DEL VALLE PONCHE DE FRUTAS 1.5L','Jugo Del Valle.',7000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-mango-1-2l','Gaseosas Coca-Cola','🥤','DEL VALLE MANGO 1.2 L','Jugo Del Valle.',6000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-mango-fresa-1-2l','Gaseosas Coca-Cola','🥤','DEL VALLE MANGO FRESA 1.2L','Jugo Del Valle.',6000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-mora-1-2l','Gaseosas Coca-Cola','🥤','DEL VALLE MORA 1.2L','Jugo Del Valle.',6000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('coca-cola-original-2-5l','Gaseosas Coca-Cola','🥤','COCA-COLA ORIGINAL 2.5L','Bebida gaseosa.',9000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('sprite-original-1-5l','Gaseosas Coca-Cola','🥤','SPRITE SABOR ORIGINAL LIMA LIMON 1.5L','Bebida gaseosa.',7000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('quatro-original-toronja-1-5l','Gaseosas Coca-Cola','🥤','QUATRO SABOR ORIGINAL TORONJA 1.5L','Bebida gaseosa.',7000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('del-valle-frutas-criticas-1-5l','Gaseosas Coca-Cola','🥤','DEL VALLE FRUTAS CRITICAS 1.5L','Jugo Del Valle.',7000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-carne','Congeladas','🧊','Empanadas congeladas de carne x12','Paquete de 12 unidades.',24000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-pollo','Congeladas','🧊','Empanadas congeladas de pollo x12','Paquete de 12 unidades.',24000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-mixta','Congeladas','🧊','Empanadas congeladas mixtas x12','Paquete de 12 unidades.',24000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-queso','Congeladas','🧊','Empanadas congeladas de queso x12','Paquete de 12 unidades.',30000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-barril','Congeladas','🧊','Empanadas congeladas de carne al barril x12','Paquete de 12 unidades.',30000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-ranchera','Congeladas','🧊','Empanadas congeladas rancheras x12','Paquete de 12 unidades.',30000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('cong-chicharron','Congeladas','🧊','Empanadas congeladas de chicharrón x12','Paquete de 12 unidades.',30000,ARRAY['Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-pimenton','Salsas','🧂','Pimentón','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-aji','Salsas','🧂','Aji','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-jalapeno','Salsas','🧂','Jalapeño','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-miel-jalapeno','Salsas','🧂','miel de jalapeño','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-guacamole-picante','Salsas','🧂','Guacamole picante','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-miel-mostaza-picante','Salsas','🧂','Miel mostaza picante','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-miel-mostaza','Salsas','🧂','Miel mostaza','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-pina-picante','Salsas','🧂','Piña picante','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-pina','Salsas','🧂','Piña','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-aji-puro','Salsas','🧂','Aji puro','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-mayonesa-jalapeno','Salsas','🧂','mayonesa jalapeño','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-queso','Salsas','🧂','Queso','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-maiz','Salsas','🧂','Maíz','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-rosada','Salsas','🧂','Rosada','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-tartara','Salsas','🧂','Tártara','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-crema-lena','Salsas','🧂','Crema de leña','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-maracuya','Salsas','🧂','Maracuyá','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-maracuya-picante','Salsas','🧂','Maracuyá picante','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-guacamole','Salsas','🧂','Guacamole','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-tocineta','Salsas','🧂','Tocineta','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-rosada-pepinillos','Salsas','🧂','Rosada con pepinillos','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-mora','Salsas','🧂','Mora','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-ochua','Salsas','🧂','Ochua','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-mayomostaza','Salsas','🧂','Mayomostaza','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-bbq','Salsas','🧂','BBQ','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-ajo','Salsas','🧂','Ajo','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-ceviche','Salsas','🧂','Ceviche','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-ceviche-picante','Salsas','🧂','Ceviche picante','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-encurtido','Salsas','🧂','Encurtido','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL),
('salsa-cilantro','Salsas','🧂','Cilantro','Salsa para acompañar.',0,ARRAY['Centro','Cuba','Circunvalar']::text[],true,now(),now(),NULL)
on conflict (id) do update set
  categoria=excluded.categoria, icono=excluded.icono, nombre=excluded.nombre,
  descripcion=excluded.descripcion, precio=excluded.precio,
  sucursales=excluded.sucursales, activo=excluded.activo, actualizado_en=now();

-- Reglas de sucursal del catálogo actual.
update public.productos set sucursales=ARRAY['Cuba','Circunvalar']::text[], activo=true, actualizado_en=now()
where categoria='Gaseosas Coca-Cola';
update public.productos set sucursales=ARRAY['Cuba','Circunvalar']::text[], activo=true, actualizado_en=now()
where categoria='Congeladas';
update public.productos set sucursales=ARRAY['Centro','Cuba','Circunvalar']::text[], activo=true, actualizado_en=now()
where categoria='Salsas';

-- Postobón queda administrable pero no se publica hasta que el administrador lo active.
update public.productos set activo=false, sucursales='{}'::text[], actualizado_en=now()
where categoria='Postobón';

-- RLS. El público solo ve productos activos; usuarios autenticados del panel pueden gestionar.
alter table public.productos enable row level security;
drop policy if exists "public puede ver productos activos" on public.productos;
create policy "public puede ver productos activos" on public.productos for select to anon,authenticated using (activo=true);
drop policy if exists "admin puede insertar productos" on public.productos;
create policy "admin puede insertar productos" on public.productos for insert to authenticated with check (true);
drop policy if exists "admin puede actualizar productos" on public.productos;
create policy "admin puede actualizar productos" on public.productos for update to authenticated using (true) with check (true);


-- Realtime: index y panel reciben productos, pedidos, historial y domicilios sin recargar.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='productos') then alter publication supabase_realtime add table public.productos; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pedidos') then alter publication supabase_realtime add table public.pedidos; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='historial_pedidos') then alter publication supabase_realtime add table public.historial_pedidos; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='configuracion_domicilios') then alter publication supabase_realtime add table public.configuracion_domicilios; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='configuracion_ciudades_domicilios') then alter publication supabase_realtime add table public.configuracion_ciudades_domicilios; end if;
end $$;

notify pgrst, 'reload schema';
