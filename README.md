# Ride Service â€” gestiÃ³n del taller de motos

Web para un taller de motos en Chile: reservas con agenda, Ã³rdenes de trabajo, repuestos y compras, caja con recibos internos (sin valor fiscal, desde 0001), garantÃ­as, liquidaciones e informes. Moneda: pesos chilenos.


## Usuarios Testing
CLIENTE
cliente@test.com
adminadmin

MECÃNICO
mecanico@test.com
adminadmin

RECEPCION
recepcion@test.com
adminadmin

ADMINISTRACION
administracion@test.com
adminadmin



## ConfiguraciÃ³n con Supabase

1. CreÃ¡ un proyecto en [Supabase](https://supabase.com).
2. CopiÃ¡ `.env.example` a `.env.local` y completÃ¡:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` solo si necesitÃ¡s operaciones administrativas desde scripts del servidor. Nunca la expongas al navegador.
3. En el SQL Editor de Supabase ejecutá `supabase/schema.sql` y luego `supabase/rls_policies.sql` para activar las políticas de Row Level Security (RLS).
4. En **Authentication â†’ Providers** habilitÃ¡ Email y, opcionalmente, Google. ConfigurÃ¡ las URLs de redirecciÃ³n permitidas para local y producciÃ³n.
5. EjecutÃ¡ `npm install` y luego `npm run dev`. AbrÃ­ http://localhost:3100.

La aplicación usa Supabase Auth y PostgreSQL. El aislamiento de datos entre `cliente`, `mecanico`, `recepcion` y `administracion` se valida directamente en la base de datos mediante **Row Level Security (RLS)** definido en `supabase/rls_policies.sql`, complementado por la autorización en el servidor.

## QuÃ© estÃ¡ simulado
- WhatsApp: no se envÃ­a nada; hay un texto para copiar (Â«Copiar textoÂ») y se manda a mano.
- Calendario: archivo .ics descargable, sin conexiÃ³n con Google ni Apple.
- Recibos: internos, numerados desde 0001, sin valor fiscal (no hay boleta electrÃ³nica).
- Pagos: la caja solo registra el medio de pago; no hay pasarela ni cobro real.
- Cuentas demo y Ã³rdenes de ejemplo: solo existen en la base de pruebas.

## Roles
Cliente, MecÃ¡nico, RecepciÃ³n y AdministraciÃ³n. Cada cuenta tiene un solo rol; no se elige en formularios pÃºblicos. El mecÃ¡nico nunca ve costos de compra. La direcciÃ³n del dueÃ±o es administraciÃ³n.

| Dato | Cliente | RecepciÃ³n | MecÃ¡nico | AdministraciÃ³n |
|---|---|---|---|---|
| Sus motos y reservas | leer y escribir (solo las suyas) | leer y escribir (todas) | â€” | leer y escribir (todas) |
| Agenda | â€” | leer y escribir | leer (sus Ã³rdenes) | leer y escribir |
| Ã“rdenes y adicionales | leer las suyas; aprobar/rechazar adicionales | leer y escribir | leer y actualizar las asignadas | leer y escribir |
| Inventario y proveedores | â€” | leer y escribir | leer (sin costos de compra) | leer y escribir |
| Compras (con costos) | â€” | leer y escribir | â€” | leer y escribir |
| Caja y recibos | leer los suyos | leer y escribir | â€” | leer y escribir |
| Informes y CSV | â€” | â€” | â€” | leer |
| Roles de usuarios | â€” | â€” | â€” | solo por la base (ver abajo) |

## Datos de ejemplo (solo vista previa)
`npx tsx scripts/seed.ts` crea las cuentas de prueba (clave `RideService2026`) y tres Ã³rdenes cobradas del mes. Se puede repetir sin duplicar.

## Cambiar los roles de los usuarios
Cada persona se registra en `/register` y comienza con el rol `cliente`. Cambia los roles desde el SQL Editor o Table Editor de Supabase con el `user_id` obtenido en **Authentication â†’ Users**:

```sql
select id, email from auth.users where email = 'persona@correo.cl';

insert into public.perfiles (user_id, rol, nombre)
values ('UUID_DEL_USUARIO', 'mecanico', 'Nombre Apellido')
on conflict (user_id) do update set rol = excluded.rol, nombre = excluded.nombre;

update public.mecanicos set user_id = 'UUID_DEL_USUARIO' where id = 'mec-1';
```

La separación de permisos entre clientes y mecánicos (órdenes propias vs. órdenes asignadas, restricciones sobre compras/costos y recibos) está aplicada a nivel de base de datos mediante las políticas RLS de `supabase/rls_policies.sql`. Usa siempre el `user_id` del usuario real y nunca un rol decidido por el formulario público.

## Reiniciar los datos de prueba
- Ejecuta `scripts/seed.ts` Ãºnicamente contra un proyecto de prueba configurado con `SUPABASE_SERVICE_ROLE_KEY`.
- Para vaciar operaciones de prueba ejecuta el borrado completo en el SQL Editor, respetando las dependencias entre tablas y sin ejecutar el borrado en producciÃ³n.
- Las tablas maestras de puestos, servicios, tarifas, mecÃ¡nicos, repuestos y proveedores pueden mantenerse.
- Los recibos vuelven a numerarse desde `0001` al vaciar la tabla `recibos`.

## Pruebas guiadas
1. **Reservar**: como cliente (`cliente@rideservice.demo`), Â«Mis motosÂ» â†’ agregar moto â†’ Â«Reservar horaÂ». ElegÃ­ servicio y horario.
2. **Recibir**: como recepciÃ³n, Â«AgendaÂ» â†’ recibir la reserva con el checklist â†’ asignar mecÃ¡nico.
3. **Adicional**: como mecÃ¡nico, abrÃ­ la orden â†’ Â«Proponer trabajo adicionalÂ». El cliente lo aprueba o rechaza (vence en 24 h).
4. **Repuesto especial**: registrÃ¡ el abono, en Â«ComprasÂ» recibÃ­ el pedido y la orden sigue sola.
5. **Cobrar**: dejÃ¡ la orden Â«Lista para retirarÂ» â†’ Â«CajaÂ» â†’ cobrar â†’ Â«Ver reciboÂ».
6. **GarantÃ­a**: en una orden entregada (hasta 30 dÃ­as) â†’ Â«Abrir garantÃ­aÂ»; al resolver, Â«Cerrar garantÃ­aÂ».
7. **Informes**: como administraciÃ³n, Â«InformesÂ» â†’ mes, ingresos, servicios mÃ¡s pedidos y comisiÃ³n de cada mecÃ¡nico (35 % o 40 % de la mano de obra cobrada).

## Reglas y pruebas
- Doble cierre: una orden tiene un solo recibo (Ã­ndices Ãºnicos por orden, por nÃºmero y por operaciÃ³n); cobrar dos veces o repetir el envÃ­o no duplica recibo, stock ni abonos.
- GarantÃ­a: 30 dÃ­as desde la entrega o 1000 km desde el ingreso anterior.
- Prueba automÃ¡tica de ambas reglas (base de pruebas, no deja datos): `npx tsx scripts/test-reglas.ts`. Termina con cÃ³digo 0 si todo pasa.
- Los permisos por rol se aplican en el servidor de la app, no con polÃ­ticas de la base.

## Notas
- Sin servicios externos: WhatsApp es manual (Â«Copiar textoÂ») y hay archivo .ics para el calendario.
- Los meses de Informes se cortan en hora de Chile.

