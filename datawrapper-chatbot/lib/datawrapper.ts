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
    try {
      errText = await res.text();
    } catch {
      errText = res.statusText;
    }
    throw new Error(`${label} feilet (HTTP ${res.status}): ${errText}`);
  }
  // Some endpoints return empty body on success
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export interface CreatedChart {
  id: string;
  title: string;
  type: string;
  publicUrl?: string;
}

export interface PublishResult {
  chartId: string;
  publicUrl: string;
  embedCode: string;
}

/**
 * Step 1 – Create an empty chart
 */
export async function createChart(type: string, title: string): Promise<CreatedChart> {
  const res = await fetch(`${DW_BASE}/charts`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ type, title }),
  });

  const data = (await handleResponse(res, 'Opprett chart')) as Record<string, unknown>;
  return {
    id: String(data.id),
    title: String(data.title || title),
    type: String(data.type || type),
    publicUrl: data.publicUrl as string | undefined,
  };
}

/**
 * Step 2 – Upload CSV data to the chart
 */
export async function uploadData(chartId: string, csvData: string): Promise<void> {
  const res = await fetch(`${DW_BASE}/charts/${chartId}/data`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'text/csv',
    },
    body: csvData,
  });

  await handleResponse(res, 'Last opp data');
}

/**
 * Step 3 – Update chart metadata (title, description, source, etc.)
 */
export async function updateChartMetadata(
  chartId: string,
  opts: {
    title: string;
    description?: string;
    source?: string;
    byline?: string;
    sort?: 'ascending' | 'descending' | null;
  }
): Promise<void> {
  const body: Record<string, unknown> = {
    title: opts.title,
    metadata: {
      describe: {
        intro: opts.description || '',
        'source-name': opts.source || '',
        'source-url': '',
        byline: opts.byline || '',
        'aria-description': opts.description || '',
      },
    },
  };

  const res = await fetch(`${DW_BASE}/charts/${chartId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

  await handleResponse(res, 'Oppdater metadata');
}

/**
 * Step 4 – Publish the chart and return the public URL
 */
export async function publishChart(chartId: string): Promise<PublishResult> {
  const res = await fetch(`${DW_BASE}/charts/${chartId}/publish`, {
    method: 'POST',
    headers: jsonHeaders(),
  });

  await handleResponse(res, 'Publiser chart');

  // Construct predictable public URL (Datawrapper CDN pattern)
  const publicUrl = `https://datawrapper.dwcdn.net/${chartId}/1/`;
  const datawrapperUrl = `https://app.datawrapper.de/chart/${chartId}/publish`;

  const embedCode = buildEmbedCode(chartId, publicUrl);

  return { chartId, publicUrl: datawrapperUrl, embedCode };
}

/**
 * Build standard Datawrapper responsive iframe embed code
 */
function buildEmbedCode(chartId: string, cdnUrl: string): string {
  return `<iframe title="Datawrapper-graf" aria-label="Graf" id="datawrapper-chart-${chartId}" src="${cdnUrl}" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="400" data-external="1"></iframe>
<script type="text/javascript">
  !function(){"use strict";window.addEventListener("message",(function(a){if(void 0!==a.data["datawrapper-height"]){var e=document.querySelectorAll("iframe");for(var t in a.data["datawrapper-height"])for(var r=0;r<e.length;r++)if(e[r].contentWindow===a.source){var i=a.data["datawrapper-height"][t]+"px";e[r].style.height=i}}}))}();
</script>`;
}
