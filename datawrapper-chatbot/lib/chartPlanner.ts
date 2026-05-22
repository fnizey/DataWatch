import OpenAI from 'openai';
import { ColumnInfo } from './parseData';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY er ikke satt');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export interface ChartPlan {
  chartType: 'bar' | 'line' | 'area' | 'scatter' | 'table' | 'map';
  datawrapperType: string;
  title: string;
  description: string;
  source: string;
  xColumn: string;
  yColumn: string;
  seriesColumn: string | null;
  sort: 'ascending' | 'descending' | null;
  reasoning: string;
  yAxisMin: number | null;
  yAxisMax: number | null;
  valueFormat: string | null;
  action: 'create' | 'update';
}

const SYSTEM_PROMPT = `Du er en ekspert på datavisualisering for norske journalister.
Du lager chart-planer i JSON-format for Datawrapper.

Chart-typer:
- d3-bars: Stolpediagram – kategorier/rangeringer
- d3-bars-stacked: Stablet stolpediagram
- d3-lines: Linjediagram – ALLTID for tidsserier og trender
- d3-area: Arealdiagram
- d3-scatter-plot: Spredningsdiagram
- tables: Datatabell
- d3-maps-choropleth: Koroplettkart

Flerserier (seriesColumn):
- Hvis data er i "lang" format (én rad per kategori+verdi, f.eks. år/bank/verdi):
  sett seriesColumn til kolonnen som skiller seriene (f.eks. "bank"),
  xColumn til tidsdimensjonen, yColumn til verdien.
  Backend vil pivotere automatisk til bredt format.
- Hvis data allerede er "bredt" (én kolonne per serie): sett seriesColumn til null,
  xColumn til første kolonne, yColumn til primær verdikolonne.

Y-akse og format:
- "y-akse fra X til Y" / "start på X" → yAxisMin, yAxisMax
- "to desimaler" → "0.00", "én desimal" → "0.0", "ingen desimaler" → "0"

Action-felt:
- Hvis brukeren ber om å endre/justere/oppdatere et eksisterende chart → action: "update"
- Hvis brukeren ber om noe nytt eller bruker "lag", "vis et nytt" → action: "create"
- Hvis ingen tidligere chart eksisterer → action: "create"

Returner KUN gyldig JSON, ingen markdown.`;

export async function planChart(
  userPrompt: string,
  columns: ColumnInfo[],
  preview: Record<string, unknown>[],
  totalRows: number,
  context?: { previousPlan?: ChartPlan; previousChartId?: string }
): Promise<ChartPlan> {
  const openai = getOpenAI();

  const columnSummary = columns
    .map(c => `  - "${c.name}" [${c.type}]: ${c.sample.filter(Boolean).slice(0, 3).join(', ')}`)
    .join('\n');

  const contextBlock = context?.previousPlan
    ? `\nTidligere chart (ID: ${context.previousChartId ?? 'ukjent'}):\n${JSON.stringify(context.previousPlan, null, 2)}\n`
    : '';

  const userMessage = `Datasett: ${totalRows} rader.
Kolonner:
${columnSummary}

Eksempeldata:
${JSON.stringify(preview.slice(0, 3), null, 2)}
${contextBlock}
Brukerens instruksjon: "${userPrompt}"

Returner JSON:
{
  "chartType": "bar|line|area|scatter|table|map",
  "datawrapperType": "...",
  "title": "norsk tittel",
  "description": "norsk ingress",
  "source": "",
  "xColumn": "...",
  "yColumn": "...",
  "seriesColumn": null,
  "sort": null,
  "reasoning": "...",
  "yAxisMin": null,
  "yAxisMax": null,
  "valueFormat": null,
  "action": "create|update"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 900,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Ingen respons fra AI');

  let plan: ChartPlan;
  try { plan = JSON.parse(content) as ChartPlan; }
  catch { throw new Error('AI returnerte ugyldig JSON. Prøv igjen.'); }

  const columnNames = columns.map(c => c.name);
  if (!plan.datawrapperType) plan.datawrapperType = 'd3-bars';
  if (!plan.title) plan.title = 'Graf';
  if (plan.yAxisMin === undefined) plan.yAxisMin = null;
  if (plan.yAxisMax === undefined) plan.yAxisMax = null;
  if (plan.valueFormat === undefined) plan.valueFormat = null;
  if (!plan.action) plan.action = context?.previousPlan ? 'update' : 'create';
  if (!columnNames.includes(plan.xColumn)) plan.xColumn = columnNames[0] || '';
  if (!columnNames.includes(plan.yColumn)) {
    const num = columns.find(c => c.type === 'numeric');
    plan.yColumn = num?.name || columnNames[1] || columnNames[0] || '';
  }
  if (plan.seriesColumn && !columnNames.includes(plan.seriesColumn)) plan.seriesColumn = null;

  return plan;
}
