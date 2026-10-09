// Shared code for the report page and the dashboard page.
// Loads zillow_metro_home_values.csv in the browser and computes every number there.

const UP = '#2a78d6';
const DOWN = '#e34948';

function parseCSV(text) {
  const out = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { q = false; }
      else { field += c; }
    } else if (c === '"') { q = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
    else if (c !== '\r') { field += c; }
  }
  if (field.length || row.length) { row.push(field); out.push(row); }
  return out;
}

function loadRows() {
  return fetch('zillow_metro_home_values.csv').then(r => r.text()).then(text => {
    const parsed = parseCSV(text);
    const head = parsed[0];
    const ix = Object.fromEntries(head.map((h, i) => [h, i]));
    return parsed.slice(1).filter(r => r.length === head.length).map(r => ({
      metro: r[ix.metro], state: r[ix.state], census_region: r[ix.census_region],
      size_rank: +r[ix.size_rank], size_tier: r[ix.size_tier], month: r[ix.month],
      home_value: +r[ix.home_value] }));
  });
}

function median(values) {
  const v = values.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const fmtMoney = x => x == null ? '--' : '$' + Math.round(x).toLocaleString();
const fmtPct = x => x == null ? '--' : (x >= 0 ? '+' : '') + x.toFixed(1) + '%';
const monthLabel = m => new Date(m + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

// One record per metro for the rows in view: first and last value inside the range,
// the peak inside the range, the change over the range, and the distance from the peak.
function summarize(view) {
  const byMetro = new Map();
  const byMonth = new Map();
  for (const r of view) {
    let m = byMetro.get(r.metro);
    if (!m) {
      m = { metro: r.metro, state: r.state, region: r.census_region, tier: r.size_tier,
            rank: r.size_rank, first: null, last: null, peak: 0 };
      byMetro.set(r.metro, m);
    }
    if (m.first === null || r.month < m.firstMonth) { m.first = r.home_value; m.firstMonth = r.month; }
    if (m.last === null || r.month > m.lastMonth) { m.last = r.home_value; m.lastMonth = r.month; }
    if (r.home_value > m.peak) m.peak = r.home_value;
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month).push(r.home_value);
  }
  const metros = [...byMetro.values()].map(m => ({ ...m, change: (m.last / m.first - 1) * 100,
                                                    fromPeak: (m.last / m.peak - 1) * 100 }));
  metros.sort((a, b) => b.change - a.change);
  const months = [...byMonth.keys()].sort();
  const lastMonth = months[months.length - 1];
  const below = metros.filter(m => m.fromPeak < -5).length;
  return {
    metros, months, byMonth,
    kpis: {
      metros: metros.length,
      medianLast: lastMonth ? median(byMonth.get(lastMonth)) : null,
      medianChange: median(metros.map(m => m.change)),
      belowShare: metros.length ? 100 * below / metros.length : null,
      belowCount: below
    }
  };
}

function writeKpis(k) {
  document.getElementById('k_metros').textContent = k.metros.toLocaleString();
  document.getElementById('k_value').textContent = fmtMoney(k.medianLast);
  document.getElementById('k_change').textContent = fmtPct(k.medianChange);
  document.getElementById('k_below').textContent =
    k.belowShare == null ? '--' : k.belowShare.toFixed(0) + '% (' + k.belowCount + ')';
}

const charts = {};

function lineChart(id, labels, data) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: UP, borderWidth: 2, pointRadius: 0, tension: 0.2 }] },
    options: { responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMoney(c.raw) } } },
      scales: { y: { ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: '#eeede9' } },
                x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } } } }
  });
}

function barChart(id, labels, data, opts) {
  opts = opts || {};
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? UP : DOWN),
            borderRadius: 4, barThickness: opts.thickness || 14 }] },
    options: { indexAxis: opts.horizontal === false ? 'x' : 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: c => fmtPct(c.raw) } } },
      scales: { x: { ticks: { callback: v => v + '%' }, grid: { color: '#eeede9' } },
                y: { grid: { display: false } } } }
  });
}
