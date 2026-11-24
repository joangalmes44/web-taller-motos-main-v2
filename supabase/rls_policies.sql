-- ============================================================================
-- Ride Service - Politicas de Row Level Security (RLS) en Supabase
-- Separa permisos entre cliente, mecanico, recepcion y administracion
-- ============================================================================

-- 1. Funciones auxiliares SECURITY DEFINER (evitan recursion sobre perfiles/mecanicos)
CREATE OR REPLACE FUNCTION public.current_app_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.perfiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_mecanico_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.mecanicos WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_rol() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_rol() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.current_mecanico_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_mecanico_id() TO anon, authenticated;

-- 2. Activar RLS en todas las tablas del esquema publico
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mecanicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moto_km ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adicionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adicional_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recepciones_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar politicas previas para ejecucion idempotente
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 4. PERFILES: cada usuario ve/edita su propio perfil; staff lee perfiles; admin gestiona
CREATE POLICY "perfiles_select_own_or_staff" ON public.perfiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion'));

CREATE POLICY "perfiles_insert_own" ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND rol = 'cliente');

CREATE POLICY "perfiles_update_own_or_admin" ON public.perfiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.current_app_rol() = 'administracion')
  WITH CHECK (
    (user_id = auth.uid() AND rol = public.current_app_rol())
    OR public.current_app_rol() = 'administracion'
  );

-- 5. CATALOGOS (puestos, servicios, tarifas, mecanicos): lectura publica; escritura recepcion/admin
CREATE POLICY "puestos_select_all" ON public.puestos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "puestos_write_staff" ON public.puestos FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "servicios_select_all" ON public.servicios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "servicios_write_staff" ON public.servicios FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "tarifas_select_all" ON public.servicio_tarifas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tarifas_write_staff" ON public.servicio_tarifas FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "mecanicos_select_all" ON public.mecanicos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mecanicos_write_admin" ON public.mecanicos FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

-- 6. MOTOS Y KILOMETRAJE: cliente solo sus motos; staff ve todas; recepcion/admin modifican
CREATE POLICY "motos_select_policy" ON public.motos
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion')
  );

CREATE POLICY "motos_insert_policy" ON public.motos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

CREATE POLICY "motos_update_policy" ON public.motos
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion')
  );

CREATE POLICY "moto_km_select_policy" ON public.moto_km
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.motos m
      WHERE m.id = moto_km.moto_id
        AND (m.user_id = auth.uid() OR public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion'))
    )
  );

CREATE POLICY "moto_km_insert_policy" ON public.moto_km
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.motos m
      WHERE m.id = moto_km.moto_id
        AND (m.user_id = auth.uid() OR public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion'))
    )
  );

-- 7. RESERVAS: cliente solo las suyas; recepcion y administracion todas
CREATE POLICY "reservas_select_policy" ON public.reservas
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

CREATE POLICY "reservas_insert_policy" ON public.reservas
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

CREATE POLICY "reservas_update_policy" ON public.reservas
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

-- 8. ORDENES: cliente lee las suyas; mecanico lee y actualiza sus asignadas; recepcion/admin todo
CREATE POLICY "ordenes_select_policy" ON public.ordenes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.current_app_rol() = 'mecanico' AND mecanico_id = public.current_mecanico_id())
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

CREATE POLICY "ordenes_insert_staff" ON public.ordenes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "ordenes_update_policy" ON public.ordenes
  FOR UPDATE TO authenticated
  USING (
    (public.current_app_rol() = 'mecanico' AND mecanico_id = public.current_mecanico_id())
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

-- 9. HISTORIAL, ADICIONALES, REPUESTOS DE ORDEN Y ABONOS
CREATE POLICY "orden_historial_select" ON public.orden_historial
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = orden_historial.orden_id
        AND (
          o.user_id = auth.uid()
          OR (public.current_app_rol() = 'mecanico' AND o.mecanico_id = public.current_mecanico_id())
          OR public.current_app_rol() IN ('recepcion', 'administracion')
        )
    )
  );

CREATE POLICY "orden_historial_insert" ON public.orden_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = orden_historial.orden_id
        AND (
          o.user_id = auth.uid()
          OR (public.current_app_rol() = 'mecanico' AND o.mecanico_id = public.current_mecanico_id())
          OR public.current_app_rol() IN ('recepcion', 'administracion')
        )
    )
  );

CREATE POLICY "adicionales_select" ON public.adicionales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = adicionales.orden_id
        AND (
          o.user_id = auth.uid()
          OR (public.current_app_rol() = 'mecanico' AND o.mecanico_id = public.current_mecanico_id())
          OR public.current_app_rol() IN ('recepcion', 'administracion')
        )
    )
  );

CREATE POLICY "adicionales_insert_mecanico_staff" ON public.adicionales
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.current_app_rol() = 'mecanico' AND mecanico_id = public.current_mecanico_id())
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

CREATE POLICY "adicionales_update_cliente_or_staff" ON public.adicionales
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = adicionales.orden_id
        AND (
          o.user_id = auth.uid()
          OR (public.current_app_rol() = 'mecanico' AND o.mecanico_id = public.current_mecanico_id())
          OR public.current_app_rol() IN ('recepcion', 'administracion')
        )
    )
  );

CREATE POLICY "adicional_repuestos_policy" ON public.adicional_repuestos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adicionales a
      JOIN public.ordenes o ON o.id = a.orden_id
      WHERE a.id = adicional_repuestos.adicional_id
        AND (
          o.user_id = auth.uid()
          OR (public.current_app_rol() = 'mecanico' AND o.mecanico_id = public.current_mecanico_id())
          OR public.current_app_rol() IN ('recepcion', 'administracion')
        )
    )
  );

CREATE POLICY "orden_repuestos_policy" ON public.orden_repuestos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = orden_repuestos.orden_id
        AND (
          o.user_id = auth.uid()
          OR (public.current_app_rol() = 'mecanico' AND o.mecanico_id = public.current_mecanico_id())
          OR public.current_app_rol() IN ('recepcion', 'administracion')
        )
    )
  );

CREATE POLICY "abonos_select_policy" ON public.abonos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = abonos.orden_id
        AND (o.user_id = auth.uid() OR public.current_app_rol() IN ('recepcion', 'administracion'))
    )
  );

CREATE POLICY "abonos_write_staff" ON public.abonos
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

-- 10. REPUESTOS Y MOVIMIENTOS DE STOCK: staff interno (mecanico solo lectura / movimientos operativos)
CREATE POLICY "repuestos_select_staff" ON public.repuestos
  FOR SELECT TO authenticated
  USING (public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion'));

CREATE POLICY "repuestos_write_admin_recep" ON public.repuestos
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "movimientos_stock_select_staff" ON public.movimientos_stock
  FOR SELECT TO authenticated
  USING (public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion'));

CREATE POLICY "movimientos_stock_insert_staff" ON public.movimientos_stock
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_rol() IN ('mecanico', 'recepcion', 'administracion'));

-- 11. PROVEEDORES Y COMPRAS: exclusivo recepcion y administracion (bloqueado para cliente y mecanico)
CREATE POLICY "proveedores_staff_only" ON public.proveedores
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "compras_staff_only" ON public.compras
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "compra_items_staff_only" ON public.compra_items
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

CREATE POLICY "recepciones_compra_staff_only" ON public.recepciones_compra
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

-- 12. RECIBOS: cliente solo lee los suyos; recepcion y administracion gestionan todos
CREATE POLICY "recibos_select_policy" ON public.recibos
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_rol() IN ('recepcion', 'administracion')
  );

CREATE POLICY "recibos_write_staff" ON public.recibos
  FOR ALL TO authenticated
  USING (public.current_app_rol() IN ('recepcion', 'administracion'))
  WITH CHECK (public.current_app_rol() IN ('recepcion', 'administracion'));

