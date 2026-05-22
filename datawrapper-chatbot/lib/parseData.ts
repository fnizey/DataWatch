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
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,           // 2024-01-15
  /^\d{2}[./]\d{2}[./]\d{4}/,     // 15.01.2024 or 15/01/2024
  /^\d{1,2}\s+\w+\s+\d{4}/,       // 15 januar 2024
  /^Q[1-4]\s*\d{4}$/i,             // Q1 2024
  /^\d{4}Q[1-4]$/i,                // 2024Q1
  /^\d{4}$/,                        // 2024 (year only)
  /^\w+\s+\d{4}$/,                  // Januar 2024
];

const GEO_COLUMN_KEYWORDS = [
  'kommune', 'kommunenr', 'kommunenavn',
  'fylke', 'fylkenr', 'fylkesnavn',
  'land', 'country', 'nation',
  'region', 'county', 'city', 'by',
  'state', 'municipality', 'district',
  'geo', 'location', 'sted', 'place',
  'postnr', 'postnummer', 'zipcode',
];

function detectColumnType(colName: string, values: unknown[]): ColumnType {
  const nonEmpty = values.filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  if (nonEmpty.length === 0) return 'categorical';

  // Check geographic first (by column name)
  const colLower = colName.toLowerCase();
  if (GEO_COLUMN_KEYWORDS.some((kw) => colLower.includes(kw))) {
    return 'geographic';
  }

  // Check numeric
  const numericCount = nonEmpty.filter((v) => {
    const str = String(v).replace(/\s/g, '').replace(',', '.');
    return !isNaN(Number(str)) && str !== '';
  }).length;

  if (numericCount / nonEmpty.length > 0.85) return 'numeric';

  // Check date
  const dateCount = nonEmpty.filter((v) => {
    const str = String(v).trim();
    return DATE_PATTERNS.some((p) => p.test(str)) || (!isNaN(Date.parse(str)) && str.length > 4);
  }).length;

  if (dateCount / nonEmpty.length > 0.7) return 'date';

  return 'categorical';
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      // Clean up key names
      const cleanKey = String(key).trim();
      normalized[cleanKey] = value;
    }
    return normalized;
  });
}

export async function parseFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const ext = filename.split('.').pop()?.toLowerCase();

  let rows: Record<string, unknown>[] = [];

  if (ext === 'csv') {
    const text = buffer.toString('utf-8');
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header) => header.trim(),
    });

    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
    }

    rows = result.data;
  } else if (ext === 'xls' || ext === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false, // convert to strings for consistent type detection
    });
  } else {
    throw new Error('Filformat støttes ikke. Bruk .csv, .xls eller .xlsx');
  }

  if (rows.length === 0) {
    throw new Error('Filen er tom eller kunne ikke leses');
  }

  rows = normalizeRows(rows);
  const columnNames = Object.keys(rows[0]);

  if (columnNames.length === 0) {
    throw new Error('Ingen kolonner funnet i filen');
  }

  const columns: ColumnInfo[] = columnNames.map((name) => {
    const values = rows.map((r) => r[name]);
    const type = detectColumnType(name, values);
    const sample = values
      .slice(0, 5)
      .map((v) => (v === null || v === undefined ? '' : String(v)));
    return { name, type, sample };
  });

  return {
    columns,
    rows,
    totalRows: rows.length,
    preview: rows.slice(0, 10),
    fileName: filename,
  };
}

export function rowsToCsv(
  rows: Record<string, unknown>[],
  xColumn?: string,
  yColumn?: string,
  seriesColumn?: string | null
): string {
  if (!rows || rows.length === 0) return '';

  let orderedRows = rows;

  // Reorder columns: x first, then y, then series, then rest
  if (xColumn && yColumn) {
    const priority = [xColumn, yColumn, ...(seriesColumn ? [seriesColumn] : [])];
    orderedRows = rows.map((row) => {
      const reordered: Record<string, unknown> = {};
      for (const col of priority) {
        if (col in row) reordered[col] = row[col];
      }
      for (const key of Object.keys(row)) {
        if (!priority.includes(key)) reordered[key] = row[key];
      }
      return reordered;
    });
  }

  return Papa.unparse(orderedRows);
}

/**
 * Pivot data from long format to wide format for multi-series charts.
 * Long: { år: 2024, bank: "DNB", verdi: 1.8 }
 * Wide: { år: 2024, DNB: 1.8, SR-Bank: 2.1 }
 */
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
