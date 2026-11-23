// Cuentas de prueba (solo en la vista previa). Las crea `npx tsx scripts/seed.ts`.
import type { Rol } from '@/db/schema';

export const DEMO_PASSWORD = 'RideService2026';

export const DEMO_ACCOUNTS: { rol: Rol; nombre: string; email: string; detalle: string }[] = [
  { rol: 'cliente', nombre: 'Valentina Rojas', email: 'cliente@rideservice.demo', detalle: 'Reservá, seguí tu orden y aprobá adicionales.' },
  { rol: 'mecanico', nombre: 'Felipe Quintana', email: 'mecanico@rideservice.demo', detalle: 'Tus órdenes asignadas y el stock sin costos.' },
  { rol: 'recepcion', nombre: 'Daniela Fuentes', email: 'recepcion@rideservice.demo', detalle: 'Agenda, ingresos, órdenes y caja.' },
  { rol: 'administracion', nombre: 'Rodrigo Vial', email: 'admin@rideservice.demo', detalle: 'Todo el sistema, compras y liquidaciones.' },
];
