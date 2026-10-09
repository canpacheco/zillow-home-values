// Shared code for the report page and the dashboard page.
// Loads zillow_metro_home_values.csv in the browser and computes every number there.

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- data ----------

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
            rank: r.size_rank, first: null, last: null, peak: 0, peakMonth: null };
      byMetro.set(r.metro, m);
    }
    if (m.first === null || r.month < m.firstMonth) { m.first = r.home_value; m.firstMonth = r.month; }
    if (m.last === null || r.month > m.lastMonth) { m.last = r.home_value; m.lastMonth = r.month; }
    if (r.home_value > m.peak) { m.peak = r.home_value; m.peakMonth = r.month; }
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

// ---------- counting numbers ----------

const shown = {};
function animateTo(el, target, render, ms) {
  if (target == null || isNaN(target)) { el.textContent = render(null); return; }
  const from = shown[el.id] == null ? 0 : shown[el.id];
  shown[el.id] = target;
  const t0 = performance.now();
  const dur = ms || 700;
  function frame(now) {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = render(from + (target - from) * e);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function writeKpis(k) {
  animateTo(document.getElementById('k_metros'), k.metros, v => Math.round(v).toLocaleString());
  animateTo(document.getElementById('k_value'), k.medianLast, v => v == null ? '--' : fmtMoney(v));
  animateTo(document.getElementById('k_change'), k.medianChange, v => v == null ? '--' : fmtPct(v));
  const count = k.belowCount;
  animateTo(document.getElementById('k_below'), k.belowShare,
    v => v == null ? '--' : v.toFixed(0) + '% (' + Math.round(count * (k.belowShare ? v / k.belowShare : 1)) + ')');
}

// ---------- charts ----------

const charts = {};
const chartDefaults = () => ({ grid: css('--grid'), text: css('--muted') });

function lineChart(id, labels, datasets, opts) {
  opts = opts || {};
  const d = chartDefaults();
  if (charts[id]) charts[id].destroy();
  const money = opts.format !== 'pct';
  charts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: { labels, datasets: datasets.map((s, i) => ({ label: s.label, data: s.data,
            borderColor: s.color || css('--up'), borderWidth: i === 0 ? 2.5 : 1.5,
            borderDash: s.dash ? [5, 4] : [], pointRadius: 0, tension: 0.2 })) },
    options: { responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: datasets.length > 1, labels: { color: d.text, boxWidth: 12 } },
                 tooltip: { callbacks: { label: c => (c.dataset.label ? c.dataset.label + ': ' : '') + (money ? fmtMoney(c.raw) : fmtPct(c.raw)) } } },
      scales: { y: { ticks: { color: d.text, callback: v => money ? '$' + (v / 1000).toFixed(0) + 'k' : v + '%' }, grid: { color: d.grid } },
                x: { ticks: { color: d.text, maxTicksLimit: 8 }, grid: { display: false } } } }
  });
}

function barChart(id, labels, data, opts) {
  opts = opts || {};
  const d = chartDefaults();
  if (charts[id]) charts[id].destroy();
  const value = { ticks: { color: d.text, callback: v => v + '%' }, grid: { color: d.grid } };
  const cat = { ticks: { color: d.text, autoSkip: !opts.allLabels, font: opts.allLabels ? { size: 11 } : undefined }, grid: { display: false } };
  charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? css('--up') : css('--down')),
            borderRadius: 4, barThickness: opts.thickness || 14 }] },
    options: { indexAxis: opts.horizontal === false ? 'x' : 'y', responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { mode: 'index', axis: opts.horizontal === false ? 'x' : 'y', intersect: false },
      onClick: (ev, els) => { if (opts.onClick && els.length) opts.onClick(labels[els[0].index]); },
      onHover: (ev, els) => { ev.native.target.style.cursor = (opts.onClick && els.length) ? 'pointer' : 'default'; },
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: c => fmtPct(c.raw) } } },
      scales: opts.horizontal === false ? { y: value, x: cat } : { x: value, y: cat } }
  });
}

// ---------- page behavior: theme, reveal, progress ----------

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch (e) {}
  const b = document.getElementById('theme');
  if (b) b.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

function initPage(onThemeChange) {
  let theme = 'light';
  try { theme = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) {}
  applyTheme(theme);
  const b = document.getElementById('theme');
  if (b) b.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    if (onThemeChange) onThemeChange();
  });
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  const bar = document.getElementById('progress');
  if (bar) addEventListener('scroll', () => {
    const h = document.documentElement;
    bar.style.width = (100 * h.scrollTop / (h.scrollHeight - h.clientHeight)) + '%';
  });
}
