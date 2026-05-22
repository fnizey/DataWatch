import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ColumnType = 'date' | 'numeric' | 'categorical' | 'geographic';

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  sample: string[];
}

export interface ParseResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  preview: Record<string, unknown>[];
  fileName: string;
  sheetNames?: string[];
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,
  /^\d{2}[./]\d{2}[./]\d{4}/,
  /^\d{1,2}\s+\w+\s+\d{4}/,
  /^Q[1-4]\s*\d{4}$/i,
  /^\d{4}Q[1-4]$/i,
  /^\d{4}M\d{2}$/i,
  /^\d{4}$/,
  /^\w+\s+\d{4}$/,
];

const GEO_COLUMN_KEYWORDS = [
  'kommune','kommunenr','kommunenavn','fylke','fylkenr','fylkesnavn',
  'land','country','nation','region','county','city','by','state',
  'municipality','district','geo','location','sted','place',
  'postnr','postnummer','zipcode',
];

function detectColumnType(colName: string, values: unknown[]): ColumnType {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'categorical';

  const colLower = colName.toLowerCase();
  if (GEO_COLUMN_KEYWORDS.some(kw => colLower.includes(kw))) return 'geographic';

  const numericCount = nonEmpty.filter(v => {
    const str = String(v).replace(/\s/g, '').replace(',', '.');
    return !isNaN(Number(str)) && str !== '';
  }).length;
  if (numericCount / nonEmpty.length > 0.85) return 'numeric';

  const dateCount = nonEmpty.filter(v => {
    const str = String(v).trim();
    return DATE_PATTERNS.some(p => p.test(str)) || (!isNaN(Date.parse(str)) && str.length > 4);
  }).length;
  if (dateCount / nonEmpty.length > 0.7) return 'date';

  return 'categorical';
}

// Normalize Norwegian/SSB date formats to ISO
function normalizeDate(value: string): string {
  const str = String(value).trim();
  if (!str) return str;

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;

  // SSB: 2024M01 → 2024-01
  const ssb = str.match(/^(\d{4})M(\d{2})$/i);
  if (ssb) return `${ssb[1]}-${ssb[2]}`;

  // Q1 2024 → 2024-01-01
  const q = str.match(/^Q([1-4])\s*(\d{4})$/i);
  if (q) { const m = ['01','04','07','10'][parseInt(q[1])-1]; return `${q[2]}-${m}-01`; }

  // 2024Q1 → 2024-01-01
  const q2 = str.match(/^(\d{4})Q([1-4])$/i);
  if (q2) { const m = ['01','04','07','10'][parseInt(q2[2])-1]; return `${q2[1]}-${m}-01`; }

  return str;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k.trim()] = v;
    return out;
  });
}

export async function parseFile(
  buffer: Buffer,
  filename: string,
  sheetName?: string
): Promise<ParseResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  let rows: Record<string, unknown>[] = [];
  let sheetNames: string[] | undefined;

  if (ext === 'csv') {
    const text = buffer.toString('utf-8');
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: '',             // auto-detect: comma, semicolon, tab, pipe
      transformHeader: h => h.trim(),
    });
    if (result.errors.length > 0 && result.data.length === 0)
      throw new Error(`CSV parsing feilet: ${result.errors[0].message}`);
    rows = result.data;
  } else if (ext === 'xls' || ext === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    sheetNames = workbook.SheetNames;
    const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheet];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  } else {
    throw new Error('Filformat støttes ikke. Bruk .csv, .xls eller .xlsx');
  }

  if (rows.length === 0) throw new Error('Filen er tom eller kunne ikke leses');

  rows = normalizeRows(rows);
  const columnNames = Object.keys(rows[0]);
  if (columnNames.length === 0) throw new Error('Ingen kolonner funnet');

  const columns: ColumnInfo[] = columnNames.map(name => {
    const values = rows.map(r => r[name]);
    const type = detectColumnType(name, values);
    return { name, type, sample: values.slice(0, 5).map(v => v == null ? '' : String(v)) };
  });

  // Normalize date columns
  columns.forEach(col => {
    if (col.type === 'date') {
      rows = rows.map(row => ({ ...row, [col.name]: normalizeDate(String(row[col.name] ?? '')) }));
      col.sample = rows.slice(0, 5).map(r => String(r[col.name] ?? ''));
    }
  });

  return {
    columns,
    rows,
    totalRows: rows.length,
    preview: rows.slice(0, 10),
    fileName: filename,
    sheetNames,
  };
}

export function rowsToCsv(
  rows: Record<string, unknown>[],
  xColumn?: string,
  yColumn?: string,
  seriesColumn?: string | null
): string {
  if (!rows?.length) return '';
  let orderedRows = rows;
  if (xColumn && yColumn) {
    const priority = [xColumn, yColumn, ...(seriesColumn ? [seriesColumn] : [])];
    orderedRows = rows.map(row => {
      const r: Record<string, unknown> = {};
      for (const col of priority) if (col in row) r[col] = row[col];
      for (const key of Object.keys(row)) if (!priority.includes(key)) r[key] = row[key];
      return r;
    });
  }
  return Papa.unparse(orderedRows);
}

export function pivotToWide(
  rows: Record<string, unknown>[],
  xCol: string,
  seriesCol: string,
  valueCol: string
): Record<string, unknown>[] {
  if (!rows.length) return rows;
  const xValues = Array.from(new Set(rows.map(r => String(r[xCol] ?? ''))));
  const seriesValues = Array.from(new Set(rows.map(r => String(r[seriesCol] ?? '')))).filter(Boolean);
  return xValues.map(x => {
    const result: Record<string, unknown> = { [xCol]: x };
    for (const s of seriesValues) {
      const match = rows.find(r => String(r[xCol]) === x && String(r[seriesCol]) === s);
      result[s] = match ? match[valueCol] : null;
    }
    return result;
  });
}
