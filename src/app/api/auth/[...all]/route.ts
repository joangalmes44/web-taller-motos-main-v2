import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ error: 'Better Auth ha sido eliminado. Usa Supabase Auth.' }, { status: 410 });
}

export function POST() {
  return NextResponse.json({ error: 'Better Auth ha sido eliminado. Usa Supabase Auth.' }, { status: 410 });
}
