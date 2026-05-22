import { NextRequest, NextResponse } from 'next/server';
import { parseFile } from '@/lib/parseData';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_EXTENSIONS = ['csv', 'xls', 'xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sheet = formData.get('sheet') as string | null;

    if (!file) return NextResponse.json({ error: 'Ingen fil mottatt' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return NextResponse.json({ error: `Filformat '${ext}' støttes ikke. Bruk .csv, .xls eller .xlsx` }, { status: 400 });

    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: `Filen er for stor (${(file.size/1024/1024).toFixed(1)} MB). Maks 10 MB.` }, { status: 400 });

    if (file.size === 0) return NextResponse.json({ error: 'Filen er tom' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseFile(buffer, file.name, sheet || undefined);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ukjent feil';
    console.error('[/api/upload]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
