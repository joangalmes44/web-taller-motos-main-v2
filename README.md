# Ride Service - gestion del taller de motos

Web para un taller de motos en Chile: reservas con agenda, ordenes de trabajo, repuestos y compras, caja con recibos internos (sin valor fiscal, desde 0001), garantias, liquidaciones e informes. Moneda: pesos chilenos.


## Usuarios Testing
CLIENTE
cliente@test.com
adminadmin

MECANICO
mecanico@test.com
adminadmin

RECEPCION
recepcion@test.com
adminadmin

ADMINISTRACION
administracion@test.com
adminadmin



## Configuracion con Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` solo si necesitas operaciones administrativas desde scripts del servidor. Nunca la expongas al navegador.
3. En el SQL Editor de Supabase ejecuto `supabase/schema.sql` y luego `supabase/rls_policies.sql` para activar las poloticas de Row Level Security (RLS).
4. En **Authentication -> Providers** habilita Email y, opcionalmente, Google. Configura las URLs de redireccion permitidas para local y produccion.
5. Ejecuta `npm install` y luego `npm run dev`. Abri http://localhost:3100.

La aplicacion usa Supabase Auth y PostgreSQL. El aislamiento de datos entre `cliente`, `mecanico`, `recepcion` y `administracion` se valida directamente en la base de datos mediante **Row Level Security (RLS)** definido en `supabase/rls_policies.sql`, complementado por la autorizacion en el servidor.

## Que esta simulado
- WhatsApp: no se envia nada; hay un texto para copiar ("Copiar texto") y se manda a mano.
- Calendario: archivo .ics descargable, sin conexion con Google ni Apple.
- Recibos: internos, numerados desde 0001, sin valor fiscal (no hay boleta electronica).
- Pagos: la caja solo registra el medio de pago; no hay pasarela ni cobro real.
- Cuentas demo y ordenes de ejemplo: solo existen en la base de pruebas.

## Roles
Cliente, Mecanico, Recepcion y Administracion. Cada cuenta tiene un solo rol; no se elige en formularios publicos. El mecanico nunca ve costos de compra. La direccion del dueno es administracion.

| Dato | Cliente | Recepcion | Mecanico | Administracion |
|---|---|---|---|---|
| Sus motos y reservas | leer y escribir (solo las suyas) | leer y escribir (todas) | - | leer y escribir (todas) |
| Agenda | - | leer y escribir | leer (sus ordenes) | leer y escribir |
| Ã“rdenes y adicionales | leer las suyas; aprobar/rechazar adicionales | leer y escribir | leer y actualizar las asignadas | leer y escribir |
| Inventario y proveedores | - | leer y escribir | leer (sin costos de compra) | leer y escribir |
| Compras (con costos) | - | leer y escribir | - | leer y escribir |
| Caja y recibos | leer los suyos | leer y escribir | - | leer y escribir |
| Informes y CSV | - | - | - | leer |
| Roles de usuarios | - | - | - | solo por la base (ver abajo) |

## Datos de ejemplo (solo vista previa)
`npx tsx scripts/seed.ts` crea las cuentas de prueba (clave `RideService2026`) y tres ordenes cobradas del mes. Se puede repetir sin duplicar.

## Cambiar los roles de los usuarios
Cada persona se registra en `/register` y comienza con el rol `cliente`. Cambia los roles desde el SQL Editor o Table Editor de Supabase con el `user_id` obtenido en **Authentication -> Users**:

```sql
select id, email from auth.users where email = 'persona@correo.cl';

insert into public.perfiles (user_id, rol, nombre)
values ('UUID_DEL_USUARIO', 'mecanico', 'Nombre Apellido')
on conflict (user_id) do update set rol = excluded.rol, nombre = excluded.nombre;

update public.mecanicos set user_id = 'UUID_DEL_USUARIO' where id = 'mec-1';
```

La separacion de permisos entre clientes y meconicos (ordenes propias vs. ordenes asignadas, restricciones sobre compras/costos y recibos) esto aplicada a nivel de base de datos mediante las poloticas RLS de `supabase/rls_policies.sql`. Usa siempre el `user_id` del usuario real y nunca un rol decidido por el formulario poblico.

## Reiniciar los datos de prueba
- Ejecuta `scripts/seed.ts` unicamente contra un proyecto de prueba configurado con `SUPABASE_SERVICE_ROLE_KEY`.
- Para vaciar operaciones de prueba ejecuta el borrado completo en el SQL Editor, respetando las dependencias entre tablas y sin ejecutar el borrado en produccion.
- Las tablas maestras de puestos, servicios, tarifas, mecanicos, repuestos y proveedores pueden mantenerse.
- Los recibos vuelven a numerarse desde `0001` al vaciar la tabla `recibos`.

## Pruebas guiadas
1. **Reservar**: como cliente (`cliente@rideservice.demo`), "Mis motos" -> agregar moto -> "Reservar hora". Elegi servicio y horario.
2. **Recibir**: como recepcion, "Agenda" -> recibir la reserva con el checklist -> asignar mecanico.
3. **Adicional**: como mecanico, abri la orden -> "Proponer trabajo adicional". El cliente lo aprueba o rechaza (vence en 24 h).
4. **Repuesto especial**: registra el abono, en "Compras" recibi el pedido y la orden sigue sola.
5. **Cobrar**: deja la orden "Lista para retirar" -> "Caja" -> cobrar -> "Ver recibo".
6. **Garantia**: en una orden entregada (hasta 30 dias) -> "Abrir garantia"; al resolver, "Cerrar garantia".
7. **Informes**: como administracion, "Informes" -> mes, ingresos, servicios mas pedidos y comision de cada mecanico (35 % o 40 % de la mano de obra cobrada).

## Reglas y pruebas
- Doble cierre: una orden tiene un solo recibo (indices unicos por orden, por numero y por operacion); cobrar dos veces o repetir el envio no duplica recibo, stock ni abonos.
- Garantia: 30 dias desde la entrega o 1000 km desde el ingreso anterior.
- Prueba automatica de ambas reglas (base de pruebas, no deja datos): `npx tsx scripts/test-reglas.ts`. Termina con codigo 0 si todo pasa.
- Los permisos por rol se aplican directamente en PostgreSQL mediante Row Level Security (RLS) en supabase/rls_policies.sql, complementados por la validación en el servidor.

## Notas
- Sin servicios externos: WhatsApp es manual ("Copiar texto") y hay archivo .ics para el calendario.
- Los meses de Informes se cortan en hora de Chile.


