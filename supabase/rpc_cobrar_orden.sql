-- ============================================================================
-- Ride Service - Cierre y cobro atomico de orden en una sola transaccion
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

create or replace function public.cobrar_orden_atomico(
  p_recibo_id text,
  p_orden_id text,
  p_operation_id text,
  p_mano_obra_clp integer,
  p_repuestos_clp integer,
  p_bodegaje_dias integer,
  p_bodegaje_clp integer,
  p_abonos_clp integer,
  p_total_clp integer,
  p_cobrado_clp integer,
  p_medio_pago text,
  p_cobrado_por text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recibo_existente text;
  v_op_existente text;
  v_orden record;
  v_next_num integer;
  v_ahora timestamptz := now();
begin
  -- 1. Idempotencia: si ya existe recibo para esta orden
  select id, operation_id into v_recibo_existente, v_op_existente
  from public.recibos
  where orden_id = p_orden_id
  limit 1;

  if v_recibo_existente is not null then
    if v_op_existente = p_operation_id then
      return v_recibo_existente;
    else
      raise exception 'orden_ya_cobrada';
    end if;
  end if;

  -- 2. Bloquear fila de la orden para evitar cierres concurrentes
  select id, numero, user_id, estado
  into v_orden
  from public.ordenes
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'orden_no_encontrada';
  end if;

  if v_orden.estado <> 'Lista para retirar' then
    raise exception 'estado_invalido_para_cobro';
  end if;

  -- 3. Insertar recibo unico
  select coalesce(max(numero), 0) + 1 into v_next_num from public.recibos;

  insert into public.recibos (
    id, numero, orden_id, user_id, operation_id,
    mano_obra_clp, repuestos_clp, bodegaje_dias, bodegaje_clp,
    abonos_clp, total_clp, cobrado_clp, medio_pago, cobrado_por, creado_en
  ) values (
    p_recibo_id, v_next_num, v_orden.id, v_orden.user_id, p_operation_id,
    p_mano_obra_clp, p_repuestos_clp, p_bodegaje_dias, p_bodegaje_clp,
    p_abonos_clp, p_total_clp, p_cobrado_clp, p_medio_pago, p_cobrado_por, v_ahora
  );

  -- 4. Liberar reservas y registrar salida definitiva de stock en kardex
  insert into public.movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id, operation_id)
  select 'lib-' || id, repuesto_id, 'liberacion', cantidad, 'Se uso en la orden', orden_id, p_operation_id
  from public.orden_repuestos
  where orden_id = v_orden.id and estado = 'Reservado'
  on conflict (id) do nothing;

  insert into public.movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id, operation_id)
  select 'sal-' || id, repuesto_id, 'salida', -abs(cantidad), 'Usado en OT-' || lpad(v_orden.numero::text, 4, '0'), orden_id, p_operation_id
  from public.orden_repuestos
  where orden_id = v_orden.id and estado = 'Reservado'
  on conflict (id) do nothing;

  -- 5. Marcar repuestos reservados como Usados y abonos pagados como Aplicados
  update public.orden_repuestos
  set estado = 'Usado'
  where orden_id = v_orden.id and estado = 'Reservado';

  update public.abonos
  set estado = 'Aplicado'
  where orden_id = v_orden.id and estado = 'Pagado';

  -- 6. Cerrar orden como Entregada y registrar historial
  update public.ordenes
  set estado = 'Entregada',
      entregada_en = v_ahora,
      actualizado_en = v_ahora
  where id = v_orden.id;

  insert into public.orden_historial (id, orden_id, estado, nota, autor)
  values (
    'hist-' || p_recibo_id,
    v_orden.id,
    'Entregada',
    'Moto entregada. Gracias por confiar en Ride Service.',
    p_cobrado_por
  );

  return p_recibo_id;
end;
$$;

revoke all on function public.cobrar_orden_atomico(text, text, text, integer, integer, integer, integer, integer, integer, integer, text, text) from public;
grant execute on function public.cobrar_orden_atomico(text, text, text, integer, integer, integer, integer, integer, integer, integer, text, text) to authenticated, service_role;