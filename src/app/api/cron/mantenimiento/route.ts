import { cronJob } from '@/lib/cron-job';
import { marcarAusentes, vencerAdicionalesVencidos } from '@/lib/mantenimiento';

export function POST(req: Request) {
  return cronJob(req, 'mantenimiento', async () => ({ ausentes: await marcarAusentes(), adicionales: await vencerAdicionalesVencidos() }));
}
