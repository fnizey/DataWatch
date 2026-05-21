import { NextRequest, NextResponse } from 'next/server';
import { parseFile } from '@/lib/parseData';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_EXTENSIONS = ['csv', 'xls', 'xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Kunne ikke lese forespørselen. Sjekk at filen er gyldig.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil mottatt' }, { status: 400 });
    }

    // Validate file extension
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Filformat '${ext}' støttes ikke. Last opp .csv, .xls eller .xlsx`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `Filen er for stor (${sizeMB} MB). Maks filstørrelse er 10 MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Filen er tom' }, { status: 400 });
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the file
    const result = await parseFile(buffer, fileName);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ukjent feil ved opplasting';
    console.error('[/api/upload]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
