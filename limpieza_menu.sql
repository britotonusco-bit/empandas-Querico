-- OBSOLETO — NO EJECUTAR. Usar SUPABASE_SINCRONIZACION_MAESTRA.sql
-- Este archivo pertenece a una versión anterior del menú.

-- Limpieza de productos que ya no existen en el menú original.
-- Ejecutar una sola vez en Supabase.
update public.productos
set activo = false
where lower(trim(categoria)) in ('Coca-Cola', 'Coca Cola')
   or lower(trim(nombre)) in (
      'empanada de carne y queso',
      'empanada de pollo y queso',
      'empanada especial',
      'papa rellena tradicional',
      'papa rellena especial',
      'salsa de tomate',
      'mayonesa',
      'salsa de aguacate',
      'salsa ranchy',
      'salsa especial'
   );

-- Las nuevas gaseosas Coca-Cola se siguen administrando desde el panel
-- con categoría "Gaseosas Coca-Cola".
