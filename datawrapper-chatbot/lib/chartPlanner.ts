import OpenAI from 'openai';
import { ColumnInfo } from './parseData';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY er ikke satt i miljøvariablene');
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
}

const SYSTEM_PROMPT = `Du er en ekspert på datavisualisering for norske journalister og nyhetsredaksjoner.
Du analyserer datasett og lager chart-planer i JSON-format for Datawrapper.

Tilgjengelige Datawrapper chart-typer og når du bruker dem:
- d3-bars: Stolpediagram (horisontal). Bruk for kategorier, rangeringer, sammenligninger mellom entiteter.
- d3-bars-stacked: Stablet stolpediagram. Bruk for å vise deler av en helhet over kategorier.
- d3-lines: Linjediagram. Bruk ALLTID for tidsserier og trender over tid.
- d3-area: Arealdiagram. Bruk for trender der volumet er viktig.
- d3-scatter-plot: Spredningsdiagram. Bruk for korrelasjon mellom to numeriske variabler.
- tables: Datatabell. Bruk når eksakt data er viktigere enn visualisering.
- d3-maps-choropleth: Koroplettkart. Bruk når du har geografiske data (kommuner, fylker, land) med verdier.

Regler:
1. Velg den beste chart-typen basert på dataens natur OG brukerens eksplisitte ønsker.
2. Tidskolonner (dato, år, kvartal) → linjediagram som standard.
3. Kategorier med én verdi → stolpediagram.
4. Geografiske kolonner med verdier → koroplettkart.
5. Bruk ALLTID norsk tittel og beskrivelse.
6. Tittelen skal være konkret og informativ (ikke generisk).
7. Finn xColumn og yColumn basert på datastrukturen.
8. Returner KUN gyldig JSON uten markdown-formatering.`;

export async function planChart(
  userPrompt: string,
  columns: ColumnInfo[],
  preview: Record<string, unknown>[],
  totalRows: number
): Promise<ChartPlan> {
  const openai = getOpenAI();

  const columnSummary = columns
    .map(
      (c) =>
        `  - "${c.name}" [${c.type}]: ${c.sample
          .filter(Boolean)
          .slice(0, 4)
          .join(', ')}`
    )
    .join('\n');

  const userMessage = `Datasett med ${totalRows} rader.

Kolonner og datatyper:
${columnSummary}

Eksempeldata (3 første rader):
${JSON.stringify(preview.slice(0, 3), null, 2)}

Brukerens instruksjon: "${userPrompt}"

Lag en chart-plan som JSON med følgende felt:
{
  "chartType": "bar|line|area|scatter|table|map",
  "datawrapperType": "d3-bars|d3-lines|d3-area|d3-scatter-plot|tables|d3-maps-choropleth",
  "title": "norsk tittel (konkret og informativ)",
  "description": "norsk undertittel/ingress (1-2 setninger)",
  "source": "kilde hvis nevnt i prompt eller data, ellers tom streng",
  "xColumn": "eksakt kolonnenavn for x-akse/kategori",
  "yColumn": "eksakt kolonnenavn for y-akse/verdi",
  "seriesColumn": null,
  "sort": "descending|ascending|null",
  "reasoning": "1-2 setninger på norsk om hvorfor du valgte denne visualiseringen"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 800,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Ingen respons fra AI');

  let plan: ChartPlan;
  try {
    plan = JSON.parse(content) as ChartPlan;
  } catch {
    throw new Error('AI returnerte ugyldig JSON. Prøv igjen.');
  }

  // Validate required fields
  const columnNames = columns.map((c) => c.name);

  if (!plan.datawrapperType) plan.datawrapperType = 'd3-bars';
  if (!plan.title) plan.title = 'Datawrapper-graf';
  if (!plan.description) plan.description = '';
  if (!plan.source) plan.source = '';
  if (!plan.reasoning) plan.reasoning = '';

  // Validate that referenced columns actually exist
  if (!columnNames.includes(plan.xColumn)) {
    plan.xColumn = columnNames[0] || '';
  }
  if (!columnNames.includes(plan.yColumn)) {
    const numericCol = columns.find((c) => c.type === 'numeric');
    plan.yColumn = numericCol?.name || columnNames[1] || columnNames[0] || '';
  }
  if (plan.seriesColumn && !columnNames.includes(plan.seriesColumn)) {
    plan.seriesColumn = null;
  }

  return plan;
}
