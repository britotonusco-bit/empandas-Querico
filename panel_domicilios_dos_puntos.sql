-- Ejecutar DESPUÉS de panel_arreglos.sql.
-- Permite que una misma zona tenga una tarifa distinta para El Modelo y Providencia.

alter table public.configuracion_domicilios
  drop constraint if exists configuracion_domicilios_ciudad_zona_key;

alter table public.configuracion_domicilios
  add constraint configuracion_domicilios_ciudad_zona_sucursal_key
  unique (ciudad, zona, sucursal);

-- No se requiere cambiar las políticas RLS existentes.
-- El panel ahora guarda una fila independiente por punto.
