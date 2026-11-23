import { totalum } from 'totalum-sdk';

const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/mantenimiento`;
const jobs = await totalum.cron.list();
const job = jobs.find((j) => j.name === 'mantenimiento') ?? (await totalum.cron.create({ name: 'mantenimiento', env: 'dev', schedule: '*/15 * * * *', request: { method: 'POST', url } }));
console.log(job.id);
