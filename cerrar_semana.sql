-- ============================================================
-- CIERRE SEMANAL — SOLO TÉCNICO
-- Elimina TODOS los pedidos de la semana actual.
-- NO elimina productos.
-- NO elimina historial_pedidos.
-- Semana: lunes 00:00 a domingo 23:59:59, hora Colombia.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- ============================================================

create or replace function public.cerrar_semana_tecnico()
returns integer
language plpgsql
security invoker
as $$
declare
  v_rol text;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_eliminados integer;
begin
  v_rol := public.mi_rol_privado();

  if v_rol <> 'tecnico' then
    raise exception 'Solo un técnico puede cerrar la semana.';
  end if;

  v_inicio := date_trunc('week', now() at time zone 'America/Bogota')
              at time zone 'America/Bogota';
  v_fin := v_inicio + interval '7 days';

  delete from public.pedidos
   where creado_en >= v_inicio
     and creado_en < v_fin;

  get diagnostics v_eliminados = row_count;
  return v_eliminados;
end;
$$;

revoke all on function public.cerrar_semana_tecnico() from public;
grant execute on function public.cerrar_semana_tecnico() to authenticated;
