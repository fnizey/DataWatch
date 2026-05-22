const DW_BASE = 'https://api.datawrapper.de/v3';

function getToken(): string {
  const token = process.env.DATAWRAPPER_API_KEY;
  if (!token) throw new Error('DATAWRAPPER_API_KEY er ikke satt i miljøvariablene');
  return token;
}

function jsonHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function handleResponse(res: Response, label: string): Promise<unknown> {
  if (!res.ok) {
    let errText = '';
    try { errText = await res.text(); } catch { errText = res.statusText; }
    throw new Error(`${label} feilet (HTTP ${res.status}): ${errText}`);
  }
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export interface CreatedChart {
  id: string;
  title: string;
  type: string;
}

export interface PublishResult {
  chartId: string;
  publicUrl: string;
  embedCode: string;
}

export async function createChart(type: string, title: string): Promise<CreatedChart> {
  const res = await fetch(`${DW_BASE}/charts`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ type, title }),
  });
  const data = (await handleResponse(res, 'Opprett chart')) as Record<string, unknown>;
  return { id: String(data.id), title: String(data.title || title), type: String(data.type || type) };
}

export async function uploadData(chartId: string, csvData: string): Promise<void> {
  const res = await fetch(`${DW_BASE}/charts/${chartId}/data`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'text/csv' },
    body: csvData,
  });
  await handleResponse(res, 'Last opp data');
}

export interface UpdateChartOpts {
  title: string;
  description?: string;
  source?: string;
  byline?: string;
  yAxisMin?: number | null;
  yAxisMax?: number | null;
  valueFormat?: string | null;
  yColumn?: string;
}

export async function updateChartMetadata(chartId: string, opts: UpdateChartOpts): Promise<void> {
  const visualize: Record<string, unknown> = {};

  // Y-axis custom range
  if (opts.yAxisMin !== null && opts.yAxisMin !== undefined &&
      opts.yAxisMax !== null && opts.yAxisMax !== undefined) {
    visualize['custom-range-y'] = true;
    visualize['custom-range'] = [opts.yAxisMin, opts.yAxisMax];
  }

  // Number format per column
  const columnFormat: Record<string, unknown> = {};
  if (opts.valueFormat && opts.yColumn) {
    columnFormat[opts.yColumn] = {
      type: 'auto',
      'number-format': opts.valueFormat,
      'number-divisor': 0,
      'number-append': '',
      'number-prepend': '',
    };
  }

  const body: Record<string, unknown> = {
    title: opts.title,
    metadata: {
      describe: {
        intro: opts.description || '',
        'source-name': opts.source || '',
        'source-url': '',
        byline: opts.byline || '',
      },
      ...(Object.keys(visualize).length > 0 ? { visualize } : {}),
      ...(Object.keys(columnFormat).length > 0 ? { data: { 'column-format': columnFormat } } : {}),
    },
  };

  const res = await fetch(`${DW_BASE}/charts/${chartId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  await handleResponse(res, 'Oppdater metadata');
}

export async function publishChart(chartId: string): Promise<PublishResult> {
  const res = await fetch(`${DW_BASE}/charts/${chartId}/publish`, {
    method: 'POST',
    headers: jsonHeaders(),
  });
  await handleResponse(res, 'Publiser chart');

  const publicUrl = `https://app.datawrapper.de/chart/${chartId}/publish`;
  const cdnUrl = `https://datawrapper.dwcdn.net/${chartId}/1/`;
  const embedCode = buildEmbedCode(chartId, cdnUrl);
  return { chartId, publicUrl, embedCode };
}

function buildEmbedCode(chartId: string, cdnUrl: string): string {
  return `<iframe title="Datawrapper-graf" aria-label="Graf" id="datawrapper-chart-${chartId}" src="${cdnUrl}" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="400" data-external="1"></iframe>
<script type="text/javascript">
  !function(){"use strict";window.addEventListener("message",(function(a){if(void 0!==a.data["datawrapper-height"]){var e=document.querySelectorAll("iframe");for(var t in a.data["datawrapper-height"])for(var r=0;r<e.length;r++)if(e[r].contentWindow===a.source){var i=a.data["datawrapper-height"][t]+"px";e[r].style.height=i}}}))}();
</script>`;
}
