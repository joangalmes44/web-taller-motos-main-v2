# Ride Service — gestión del taller de motos

Web para un taller de motos en Chile: reservas con agenda, órdenes de trabajo, repuestos y compras, caja con recibos internos (sin valor fiscal, desde 0001), garantías, liquidaciones e informes. Moneda: pesos chilenos.

## Configuración con Supabase

1. Creá un proyecto en [Supabase](https://supabase.com).
2. Copiá `.env.example` a `.env.local` y completá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` solo si necesitás operaciones administrativas desde scripts del servidor. Nunca la expongas al navegador.
3. En el SQL Editor de Supabase ejecutá `supabase/schema.sql`.
4. En **Authentication → Providers** habilitá Email y, opcionalmente, Google. Configurá las URLs de redirección permitidas para local y producción.
5. Ejecutá `npm install` y luego `npm run dev`. Abrí http://localhost:3100.

La aplicación usa Supabase Auth y PostgreSQL. Las consultas usan el cliente de Supabase y las tablas están protegidas con Row Level Security (RLS). No uses la clave de servicio en código del navegador.

## Qué está simulado
- WhatsApp: no se envía nada; hay un texto para copiar («Copiar texto») y se manda a mano.
- Calendario: archivo .ics descargable, sin conexión con Google ni Apple.
- Recibos: internos, numerados desde 0001, sin valor fiscal (no hay boleta electrónica).
- Pagos: la caja solo registra el medio de pago; no hay pasarela ni cobro real.
- Cuentas demo y órdenes de ejemplo: solo existen en la base de pruebas.

## Roles
Cliente, Mecánico, Recepción y Administración. Cada cuenta tiene un solo rol; no se elige en formularios públicos. El mecánico nunca ve costos de compra. La dirección del dueño es administración.

| Dato | Cliente | Recepción | Mecánico | Administración |
|---|---|---|---|---|
| Sus motos y reservas | leer y escribir (solo las suyas) | leer y escribir (todas) | — | leer y escribir (todas) |
| Agenda | — | leer y escribir | leer (sus órdenes) | leer y escribir |
| Órdenes y adicionales | leer las suyas; aprobar/rechazar adicionales | leer y escribir | leer y actualizar las asignadas | leer y escribir |
| Inventario y proveedores | — | leer y escribir | leer (sin costos de compra) | leer y escribir |
| Compras (con costos) | — | leer y escribir | — | leer y escribir |
| Caja y recibos | leer los suyos | leer y escribir | — | leer y escribir |
| Informes y CSV | — | — | — | leer |
| Roles de usuarios | — | — | — | solo por la base (ver abajo) |

## Datos de ejemplo (solo vista previa)
`npx tsx scripts/seed.ts` crea las cuentas de prueba (clave `RideService2026`) y tres órdenes cobradas del mes. Se puede repetir sin duplicar.

## Cambiar los roles de los usuarios
Cada persona se registra en `/register` y comienza con el rol `cliente`. Cambia los roles desde el SQL Editor o Table Editor de Supabase con el `user_id` obtenido en **Authentication → Users**:

```sql
select id, email from auth.users where email = 'persona@correo.cl';

insert into public.perfiles (user_id, rol, nombre)
values ('UUID_DEL_USUARIO', 'mecanico', 'Nombre Apellido')
on conflict (user_id) do update set rol = excluded.rol, nombre = excluded.nombre;

update public.mecanicos set user_id = 'UUID_DEL_USUARIO' where id = 'mec-1';
```

Usa siempre la clave correspondiente al usuario real y nunca un rol decidido por el formulario público.

## Reiniciar los datos de prueba
- Ejecuta `scripts/seed.ts` únicamente contra un proyecto de prueba configurado con `SUPABASE_SERVICE_ROLE_KEY`.
- Para vaciar operaciones de prueba ejecuta el borrado completo en el SQL Editor, respetando las dependencias entre tablas y sin ejecutar el borrado en producción.
- Las tablas maestras de puestos, servicios, tarifas, mecánicos, repuestos y proveedores pueden mantenerse.
- Los recibos vuelven a numerarse desde `0001` al vaciar la tabla `recibos`.

## Pruebas guiadas
1. **Reservar**: como cliente (`cliente@rideservice.demo`), «Mis motos» → agregar moto → «Reservar hora». Elegí servicio y horario.
2. **Recibir**: como recepción, «Agenda» → recibir la reserva con el checklist → asignar mecánico.
3. **Adicional**: como mecánico, abrí la orden → «Proponer trabajo adicional». El cliente lo aprueba o rechaza (vence en 24 h).
4. **Repuesto especial**: registrá el abono, en «Compras» recibí el pedido y la orden sigue sola.
5. **Cobrar**: dejá la orden «Lista para retirar» → «Caja» → cobrar → «Ver recibo».
6. **Garantía**: en una orden entregada (hasta 30 días) → «Abrir garantía»; al resolver, «Cerrar garantía».
7. **Informes**: como administración, «Informes» → mes, ingresos, servicios más pedidos y comisión de cada mecánico (35 % o 40 % de la mano de obra cobrada).

## Reglas y pruebas
- Doble cierre: una orden tiene un solo recibo (índices únicos por orden, por número y por operación); cobrar dos veces o repetir el envío no duplica recibo, stock ni abonos.
- Garantía: 30 días desde la entrega o 1000 km desde el ingreso anterior.
- Prueba automática de ambas reglas (base de pruebas, no deja datos): `npx tsx scripts/test-reglas.ts`. Termina con código 0 si todo pasa.
- Los permisos por rol se aplican en el servidor de la app, no con políticas de la base.

## Notas
- Sin servicios externos: WhatsApp es manual («Copiar texto») y hay archivo .ics para el calendario.
- Los meses de Informes se cortan en hora de Chile.
