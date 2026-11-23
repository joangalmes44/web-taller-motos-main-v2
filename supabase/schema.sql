-- Ride Service: Supabase/PostgreSQL schema
create extension if not exists pgcrypto;

create type public.rol_tipo as enum ('cliente','mecanico','recepcion','administracion');
create type public.reserva_estado as enum ('Pendiente','Confirmada','En taller','No asistió','Cancelada','Reprogramada');
create type public.orden_estado as enum ('Recibida','En diagnóstico','Esperando aprobación','Esperando repuesto','En reparación','Prueba de ruta','Lista para retirar','Entregada','Garantía','Anulada');

create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol rol_tipo not null default 'cliente', nombre text not null default '', telefono text,
  creado_en timestamptz not null default now()
);
create table public.puestos (id text primary key, numero integer not null unique, nombre text not null, descripcion text not null default '', equipado boolean not null default false);
create table public.servicios (id text primary key, nombre text not null, descripcion text not null, solo_puesto_equipado boolean not null default false, nota text, orden integer not null default 0);
create table public.servicio_tarifas (
  id text primary key, servicio_id text not null references public.servicios(id), rango text not null check (rango in ('A','B','C')),
  duracion_min integer not null check (duracion_min > 0 and duracion_min % 30 = 0), precio_clp integer not null check (precio_clp >= 0),
  unique(servicio_id,rango)
);
create table public.mecanicos (id text primary key, user_id uuid unique references auth.users(id) on delete set null, nombre text not null, comision_pct integer not null check (comision_pct in (35,40)), especialidad text);
create table public.proveedores (id text primary key, nombre text not null, rubro text not null, contacto text, telefono text, plazo_dias integer not null check(plazo_dias >= 0));
create table public.repuestos (
  id text primary key, sku text unique not null, nombre text not null, compatibilidad text not null, costo_clp integer not null check(costo_clp >= 0),
  precio_clp integer not null check(precio_clp >= 0), stock_minimo integer not null default 0 check(stock_minimo >= 0), especial boolean not null default false,
  proveedor_id text references public.proveedores(id)
);
create table public.movimientos_stock (
  id text primary key, repuesto_id text not null references public.repuestos(id), tipo text not null check(tipo in ('ingreso','salida','ajuste','reserva','liberacion')),
  cantidad integer not null, nota text, orden_id text, compra_id text, operation_id text, creado_en timestamptz not null default now()
);
create table public.motos (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade, patente text unique not null,
  marca text not null, modelo text not null, cc integer not null check(cc between 125 and 1300), km_actual integer not null default 0 check(km_actual >= 0), creado_en timestamptz not null default now()
);
create table public.moto_km (id text primary key, moto_id text not null references public.motos(id) on delete cascade, km integer not null check(km >= 0), fuente text not null default 'cliente', creado_en timestamptz not null default now());
create table public.reservas (
  id text primary key, operation_id text not null unique, user_id uuid not null references auth.users(id) on delete cascade,
  moto_id text not null references public.motos(id), servicio_id text not null references public.servicios(id), puesto_id text not null references public.puestos(id),
  inicio timestamptz not null, fin timestamptz not null check(fin > inicio), duracion_min integer not null check(duracion_min > 0), precio_clp integer not null,
  estado reserva_estado not null default 'Confirmada', abono_requerido_clp integer not null default 0, abono_pagado_clp integer not null default 0,
  reprogramada_de text unique, creado_en timestamptz not null default now()
);
create table public.ordenes (
  id text primary key, operation_id text not null unique, numero integer not null unique, reserva_id text unique references public.reservas(id),
  user_id uuid not null references auth.users(id) on delete cascade, moto_id text not null references public.motos(id), servicio_id text not null references public.servicios(id),
  puesto_id text not null references public.puestos(id), mecanico_id text references public.mecanicos(id), origen text not null default 'reserva' check(origen in ('reserva','sin_hora')),
  estado orden_estado not null default 'Recibida', km_ingreso integer not null default 0, combustible text not null default '1/2', danos text not null default '', notas text not null default '',
  mano_obra_clp integer not null default 0, extra_min integer not null default 0, inicio_plan timestamptz not null, fin_plan timestamptz not null,
  entrega_estimada timestamptz not null, entrega_movida boolean not null default false, lista_en timestamptz, entregada_en timestamptz, estado_antes_repuesto orden_estado,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table public.orden_historial (id text primary key, orden_id text not null references public.ordenes(id) on delete cascade, estado text not null, nota text not null default '', autor text not null default '', creado_en timestamptz not null default now());
create table public.adicionales (id text primary key, orden_id text not null references public.ordenes(id) on delete cascade, mecanico_id text not null references public.mecanicos(id), descripcion text not null, mano_obra_clp integer not null default 0 check(mano_obra_clp >= 0), tiempo_extra_min integer not null default 0 check(tiempo_extra_min >= 0), estado text not null default 'Propuesto' check(estado in ('Propuesto','Aprobado','Rechazado','Vencido')), estado_antes text not null default 'En diagnóstico', propuesto_en timestamptz not null, vence_en timestamptz not null, respondido_en timestamptz, respuesta_op text, operation_id text not null unique);
create table public.adicional_repuestos (id text primary key, adicional_id text not null references public.adicionales(id) on delete cascade, repuesto_id text not null references public.repuestos(id), cantidad integer not null check(cantidad > 0), precio_clp integer not null default 0);
create table public.orden_repuestos (id text primary key, orden_id text not null references public.ordenes(id) on delete cascade, repuesto_id text not null references public.repuestos(id), adicional_id text references public.adicionales(id), cantidad integer not null check(cantidad > 0), precio_clp integer not null, estado text not null check(estado in ('Reservado','Esperando abono','Pedido','Usado','Liberado')), creado_en timestamptz not null default now());
create table public.abonos (id text primary key, orden_id text not null references public.ordenes(id) on delete cascade, orden_repuesto_id text references public.orden_repuestos(id), concepto text not null, requerido_clp integer not null check(requerido_clp >= 0), pagado_clp integer not null default 0, estado text not null default 'Pendiente' check(estado in ('Pendiente','Pagado','Aplicado')), operation_id text, creado_en timestamptz not null default now(), pagado_en timestamptz);
create table public.compras (id text primary key, numero integer not null unique, proveedor_id text not null references public.proveedores(id), estado text not null default 'Borrador' check(estado in ('Borrador','Enviada','Recibida parcial','Recibida','Anulada')), orden_id text references public.ordenes(id), nota text not null default '', creado_en timestamptz not null default now(), enviada_en timestamptz, recibida_en timestamptz);
create table public.compra_items (id text primary key, compra_id text not null references public.compras(id) on delete cascade, repuesto_id text not null references public.repuestos(id), orden_repuesto_id text references public.orden_repuestos(id), cantidad integer not null check(cantidad > 0), recibida integer not null default 0 check(recibida >= 0), costo_clp integer not null check(costo_clp >= 0));
create table public.recepciones_compra (id text primary key, compra_id text not null references public.compras(id) on delete cascade, operation_id text not null unique, resumen text not null default '', creado_en timestamptz not null default now());
create table public.recibos (id text primary key, numero integer not null unique, orden_id text not null unique references public.ordenes(id), user_id uuid not null references auth.users(id) on delete cascade, operation_id text not null unique, mano_obra_clp integer not null, repuestos_clp integer not null, bodegaje_dias integer not null default 0, bodegaje_clp integer not null default 0, abonos_clp integer not null default 0, total_clp integer not null, cobrado_clp integer not null, medio_pago text not null, cobrado_por text not null default '', creado_en timestamptz not null default now());

alter table public.movimientos_stock add constraint movimientos_stock_orden_fk foreign key (orden_id) references public.ordenes(id);
alter table public.movimientos_stock add constraint movimientos_stock_compra_fk foreign key (compra_id) references public.compras(id);

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select rol::text from public.perfiles where user_id=auth.uid()),
    case when auth.uid() is not null then 'cliente' else null end);
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role_name() in ('recepcion','administracion'); $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role_name()='administracion'; $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin
  insert into public.perfiles(user_id,rol,nombre) values(new.id,'cliente',coalesce(new.raw_user_meta_data->>'name','')) on conflict(user_id) do update set nombre=excluded.nombre; return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.validate_reservation()
returns trigger language plpgsql as $$
declare cc int; begin
  select m.cc into cc from public.motos m where m.id=new.moto_id;
  if cc is null or cc not between 125 and 1300 then raise exception 'Cilindrada fuera de rango (125-1300 cc)'; end if;
  if extract(epoch from (new.fin-new.inicio))/60 % 30 <> 0 then raise exception 'Las reservas deben usar bloques de 30 minutos'; end if;
  if exists(select 1 from public.reservas r where r.id <> coalesce(new.id,'') and r.puesto_id=new.puesto_id and r.estado in ('Pendiente','Confirmada','En taller') and tstzrange(r.inicio,r.fin,'[)') && tstzrange(new.inicio,new.fin,'[)')) then raise exception 'El puesto ya está ocupado'; end;
  if not exists(select 1 from public.puestos p where p.id=new.puesto_id) then raise exception 'Puesto inexistente'; end if;
  return new;
end $$;
drop trigger if exists reservations_business_rules on public.reservas;
create trigger reservations_business_rules before insert or update on public.reservas for each row execute function public.validate_reservation();

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.actualizado_en=now(); return new; end $$;
drop trigger if exists ordenes_updated_at on public.ordenes;
create trigger ordenes_updated_at before update on public.ordenes for each row execute function public.set_updated_at();

alter table public.perfiles enable row level security;
alter table public.puestos enable row level security;
alter table public.servicios enable row level security;
alter table public.servicio_tarifas enable row level security;
alter table public.mecanicos enable row level security;
alter table public.proveedores enable row level security;
alter table public.repuestos enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.motos enable row level security;
alter table public.moto_km enable row level security;
alter table public.reservas enable row level security;
alter table public.ordenes enable row level security;
alter table public.orden_historial enable row level security;
alter table public.adicionales enable row level security;
alter table public.adicional_repuestos enable row level security;
alter table public.orden_repuestos enable row level security;
alter table public.abonos enable row level security;
alter table public.compras enable row level security;
alter table public.compra_items enable row level security;
alter table public.recepciones_compra enable row level security;
alter table public.recibos enable row level security;

create policy perfiles_self on public.perfiles for select using (auth.uid()=user_id or public.is_admin());
create policy perfiles_admin_update on public.perfiles for update using(public.is_admin()) with check(public.is_admin());
create policy catalog_public_read on public.servicios for select using(true);
create policy catalog_tarifas_public_read on public.servicio_tarifas for select using(true);
create policy puestos_staff_read on public.puestos for select using(public.is_staff());
create policy mecanicos_staff_read on public.mecanicos for select using(public.is_staff());
create policy motos_owner_or_staff on public.motos for all using(auth.uid()=user_id or public.is_staff()) with check(auth.uid()=user_id or public.is_staff());
create policy moto_km_owner_or_staff on public.moto_km for all using(exists(select 1 from public.motos m where m.id=moto_id and (m.user_id=auth.uid() or public.is_staff()))) with check(exists(select 1 from public.motos m where m.id=moto_id and (m.user_id=auth.uid() or public.is_staff())));
create policy reservas_owner_or_staff on public.reservas for all using(auth.uid()=user_id or public.is_staff()) with check(auth.uid()=user_id or public.is_staff());
create policy ordenes_owner_mechanic_or_staff on public.ordenes for select using(auth.uid()=user_id or public.is_staff() or mecanico_id=(select id from public.mecanicos where user_id=auth.uid()));
create policy ordenes_staff_update on public.ordenes for update using(public.is_staff()) with check(public.is_staff());
create policy mecanico_orden_update on public.ordenes for update using(mecanico_id=(select id from public.mecanicos where user_id=auth.uid())) with check(mecanico_id=(select id from public.mecanicos where user_id=auth.uid()));
create policy historial_owner_or_staff on public.orden_historial for select using(public.is_staff() or exists(select 1 from public.ordenes o where o.id=orden_id and o.user_id=auth.uid()));
create policy providers_staff on public.proveedores for all using(public.is_staff()) with check(public.is_staff());
create policy repuestos_read on public.repuestos for select using(auth.role()='authenticated');
create policy stock_staff on public.movimientos_stock for all using(public.is_staff()) with check(public.is_staff());
create policy additional_owner_mechanic_staff on public.adicionales for all using(public.is_staff() or mecanico_id=(select id from public.mecanicos where user_id=auth.uid()) or exists(select 1 from public.ordenes o where o.id=orden_id and o.user_id=auth.uid())) with check(public.is_staff() or mecanico_id=(select id from public.mecanicos where user_id=auth.uid()));
create policy order_parts_staff on public.orden_repuestos for all using(public.is_staff()) with check(public.is_staff());
create policy deposits_owner_staff on public.abonos for select using(public.is_staff() or exists(select 1 from public.ordenes o where o.id=orden_id and o.user_id=auth.uid()));
create policy purchases_staff on public.compras for all using(public.is_staff()) with check(public.is_staff());
create policy purchase_items_staff on public.compra_items for all using(public.is_staff()) with check(public.is_staff());
create policy purchase_receipts_staff on public.recepciones_compra for all using(public.is_staff()) with check(public.is_staff());
create policy receipts_owner_staff on public.recibos for select using(public.is_staff() or auth.uid()=user_id);

-- Seed must be executed separately from scripts/seed.ts using the Supabase service role.
