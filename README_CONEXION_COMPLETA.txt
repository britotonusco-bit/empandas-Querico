EMPANADAS QUE RICO — CORRECCIÓN DE CONEXIÓN COMPLETA
====================================================

Esta versión corrige la arquitectura para que Supabase sea la fuente única de verdad.

1. EJECUTAR EN SUPABASE
------------------------
Ejecuta primero los SQL base que ya tenía el proyecto, si todavía no los ejecutaste:
- supabase_integracion.sql
- productos_imagenes.sql

Después ejecuta OBLIGATORIAMENTE:
- SUPABASE_SINCRONIZACION_MAESTRA.sql

NO ejecutes sincronizar_menu_actual.sql ni limpieza_menu.sql de versiones anteriores:
quedaron obsoletos porque contenían productos y categorías antiguas.

2. QUÉ QUEDA CONECTADO
----------------------
- index.html/script.js lee el catálogo desde public.productos.
- panel.html/panel.js lee y modifica la misma tabla public.productos.
- Los cambios de productos del panel llegan al index automáticamente mediante Supabase Realtime.
- Los pedidos creados desde el index quedan en public.pedidos y aparecen en el panel automáticamente.
- Los cambios de estado del panel se reflejan en la misma base y se actualizan en el panel sin refrescar.
- Los cambios de configuración de domicilios se sincronizan en tiempo real.
- Las imágenes usan Supabase Storage (bucket productos).

3. PUNTO 1 — BOMBAY 3
---------------------
Es solamente menú.
No permite carrito, agregar productos, pedidos, checkout, pagos ni domicilios.

4. CATÁLOGO
-----------
- Mega empanadas: 4 productos oficiales.
- Empanadas regulares: 4 productos oficiales.
- Salsas: 30 salsas oficiales, gratis.
- Gaseosas Coca-Cola: Cuba + Circunvalar.
- Congeladas: Cuba + Circunvalar.
- Postobón: administrable desde el panel y restringido a Cuba.

5. REGLA IMPORTANTE
-------------------
El index NO puede modificar el catálogo. Eso sería inseguro porque cualquier visitante
podría cambiar precios o productos. El flujo correcto es:

PANEL -> SUPABASE -> INDEX
INDEX -> SUPABASE (PEDIDOS) -> PANEL

Así se conserva la conexión completa sin permitir que un cliente público altere el menú.

6. CAJA
-------
El valor actual de caja por pedido queda en $2.500 en el código del index.

7. REALTIME
----------
El SQL maestro agrega a supabase_realtime:
productos, pedidos, historial_pedidos, configuracion_domicilios y
configuracion_ciudades_domicilios.

Si Supabase muestra un mensaje indicando que alguna tabla ya estaba en la publicación,
es normal; el SQL comprueba antes de agregarla.


CORRECCIÓN IMPORTANTE DE SUPABASE V3
- Ejecuta SUPABASE_SINCRONIZACION_MAESTRA.sql completo.
- La sentencia que permite precio NULL ahora está ANTES del INSERT del catálogo.
- COCA-COLA ORIGINAL 1L conserva precio NULL porque su precio aún no está definido.
- NO ejecutes sincronizar_menu_actual.sql; ese archivo antiguo quedó desactivado para evitar cargar productos obsoletos.
