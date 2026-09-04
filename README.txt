# EMPANADAS QUE RICO — PANEL + INDEX CONECTADOS

## Fuente única del menú
El `index.html` y el `panel.html` usan la tabla `public.productos` de Supabase.
El panel permite editar esa tabla y el index lee esos mismos datos.

## Instalación
1. Ejecuta `supabase_integracion.sql` completo en Supabase.
2. Ejecuta `sincronizar_menu_actual.sql` una vez.
3. Deja juntos estos archivos:
   - index.html
   - estilos.css
   - script.js
   - config.js
   - logo-empanadas-que-rico.png
   - panel.html
   - panel.css
   - panel.js

No necesitas GitHub ni hosting para probarlos localmente.

## Menú sincronizado
La sincronización contiene los 83 productos que aparecen en el `index` entregado.
Los productos antiguos que no pertenecen a ese menú se eliminan de `public.productos`.
Por eso las papas antiguas que no aparecen en el index tampoco volverán a aparecer en el panel.

## Sucursales
- Bombay / Centro: solo menú, sin domicilios ni checkout.
- Barrio El Modelo / Cuba: pedidos y domicilios.
- Barrio Providencia / Circunvalar: pedidos y domicilios.

## Categorías del panel
El panel usa exactamente las categorías del menú:
Papas rellenas, Empanadas, Arepas, Mega empanadas de 30 cm, Coca-Cola, Postobón, Congeladas y Salsas.

## Importante
`config.js` contiene solamente la clave publicable de Supabase.


ACTUALIZACION 2026-09-04: index actualizado con inventario solicitado de salsas para los 3 puntos y bebidas/gaseosas para El Modelo y Providencia.


IMÁGENES DE PRODUCTOS
- Ejecuta una sola vez productos_imagenes.sql en Supabase para crear la columna imagen_url y el bucket de imágenes.
- Luego, desde Gestión de productos, puedes seleccionar una imagen al crear o editar un producto.
- El index público mostrará la imagen; si no hay imagen, mostrará el emoji.


Actualización 2026-09-04: caja de empaque $2.500. Punto 1 — Bombay 3 es únicamente menú: sin pedidos, carrito ni domicilios.
