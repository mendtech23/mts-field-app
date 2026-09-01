/* ============================================================
   Wealth OS — charts
   Inline SVG only: no libraries, no network, works offline and in both
   themes because every colour comes from a CSS custom property.
   ============================================================ */
"use strict";

const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function donut(segments, size = 148, thickness = 22) {
  const total = sum(segments, (s) => s.value) || 1;
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}"
      stroke-width="${thickness}" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset * C).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"><title>${esc(s.label)} — ${money(s.value)} (${pct(frac)})</title></circle>`;
    offset += frac;
    return el;
  }).join("");
  return `<svg class="chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">${arcs}</svg>`;
}

function ring(scorePct, size = 96, label = "") {
  const t = 9, c = size / 2, r = (size - t) / 2, C = 2 * Math.PI * r;
  const v = clamp(scorePct, 0, 100) / 100;
  const col = v >= 0.8 ? cssVar("--good") : v >= 0.5 ? cssVar("--warn") : cssVar("--bad");
  return `<svg class="chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img"
      aria-label="Score ${Math.round(scorePct)} out of 100">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${cssVar("--surface-3")}" stroke-width="${t}"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${t}"
      stroke-linecap="round" stroke-dasharray="${(v * C).toFixed(2)} ${C.toFixed(2)}"
      transform="rotate(-90 ${c} ${c})"/>
    <text x="${c}" y="${c - 2}" text-anchor="middle" fill="${cssVar("--ink")}"
      font-size="${size * 0.26}" font-weight="700">${Math.round(scorePct)}</text>
    <text x="${c}" y="${c + size * 0.17}" text-anchor="middle" fill="${cssVar("--muted")}"
      font-size="${size * 0.12}" font-weight="700" letter-spacing="1">${esc(label)}</text>
  </svg>`;
}

function areaChart(points, opts = {}) {
  const w = opts.w || 640, h = opts.h || 170, pad = 28;
  if (!points.length) return `<div class="empty">Nothing to plot yet</div>`;
  const ys = points.map((p) => p.y);
  const min = Math.min(0, ...ys), max = Math.max(...ys) * 1.05 || 1;
  const X = (i) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 1.6);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  const area = `${line}L${X(points.length - 1).toFixed(1)},${(h - pad).toFixed(1)}L${X(0).toFixed(1)},${(h - pad).toFixed(1)}Z`;
  const grid = [0, 0.5, 1].map((f) => {
    const y = pad * 0.6 + f * (h - pad * 1.6);
    return `<line x1="${pad}" x2="${w - pad}" y1="${y}" y2="${y}" stroke="${cssVar("--hairline")}" stroke-width="1"/>`;
  }).join("");
  const dots = points.map((p, i) =>
    `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${cssVar("--accent")}">
       <title>${esc(p.label)} — ${money0(p.y)}</title></circle>`).join("");
  const labels = points.map((p, i) =>
    (i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2))
      ? `<text x="${X(i).toFixed(1)}" y="${h - 6}" text-anchor="middle" fill="${cssVar("--muted")}" font-size="10">${esc(p.label)}</text>`
      : "").join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" style="height:${h}px">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cssVar("--accent")}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${cssVar("--accent")}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#ag)"/>
    <path d="${line}" fill="none" stroke="${cssVar("--accent")}" stroke-width="2.2" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

function bars(items, opts = {}) {
  const max = Math.max(...items.map((i) => Math.max(i.a || 0, i.b || 0)), 1);
  return items.map((i) => `
    <div style="margin-bottom:11px">
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;margin-bottom:4px">
        <span>${esc(i.label)}</span>
        <span class="mono muted">${money(i.a)}${i.b != null ? " / " + money(i.b) : ""}</span>
      </div>
      <div class="bar ${i.tone || ""}"><i style="width:${clamp((i.a / max) * 100, 0, 100).toFixed(1)}%"></i></div>
    </div>`).join("");
}

/* ------------------------------------------------------------ heatmap -- */
/* A calendar of daily spending. Colour is quantised into five steps rather
   than a continuous ramp, because the eye reads bands far better than it
   reads shades — and the question is "which days were bad", not "exactly
   how bad". */
function heatmap(series, from, to, cap) {
  const days = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) days.push(d);
  if (!days.length) return `<div class="empty">No days to show yet</div>`;

  const values = days.map((d) => series[d] || 0);
  const peak = Math.max(...values, cap * 2, 1);
  const step = (v) => v === 0 ? 0 : v <= cap ? 1 : v <= peak * 0.25 ? 2 : v <= peak * 0.5 ? 3 : 4;
  const fill = ["var(--surface-2)", "var(--good)", "var(--warn)", "var(--s8)", "var(--bad)"];

  // pad to a Monday so the columns line up as real weeks
  const lead = (parseDate(days[0]).getDay() + 6) % 7;
  const cells = Array(lead).fill(null).concat(days);
  const cols = Math.ceil(cells.length / 7);
  const S = 15, G = 3, W = cols * (S + G), H = 7 * (S + G) + 16;

  let out = "";
  cells.forEach((d, i) => {
    const col = Math.floor(i / 7), row = i % 7;
    if (!d) return;
    const v = series[d] || 0;
    out += `<rect x="${col * (S + G)}" y="${row * (S + G) + 14}" width="${S}" height="${S}" rx="3"
      fill="${fill[step(v)]}" opacity="${v === 0 ? 0.5 : 0.92}"
      stroke="${v === 0 ? cssVar("--hairline-2") : "none"}" stroke-width="1" data-day="${d}" class="hm-cell">
      <title>${longDate(d)} — ${v ? money(v) : "no spending"}</title></rect>`;
  });
  const labels = ["M", "", "W", "", "F", "", "S"].map((l, i) =>
    l ? `<text x="${-4}" y="${i * (S + G) + 14 + S * 0.75}" text-anchor="end"
      fill="${cssVar("--muted")}" font-size="9">${l}</text>` : "").join("");

  return `<div class="scroll-x"><svg class="chart" width="${W + 14}" height="${H}"
      viewBox="-14 0 ${W + 14} ${H}" role="img" aria-label="Daily spending calendar">
    ${labels}${out}
  </svg></div>
  <div class="legend" style="margin-top:8px">
    <span class="li"><span class="sw" style="background:${fill[0]};border:1px solid var(--hairline-2)"></span>no spend</span>
    <span class="li"><span class="sw" style="background:${fill[1]}"></span>within cap</span>
    <span class="li"><span class="sw" style="background:${fill[2]}"></span>over</span>
    <span class="li"><span class="sw" style="background:${fill[4]}"></span>worst days</span>
  </div>`;
}

/* ------------------------------------------------------- forecast line -- */
/* Like areaChart, but it knows about zero: the region below the axis is
   filled in red, because the whole point of the chart is the day you run out. */
function forecastChart(series, opts = {}) {
  const w = opts.w || 680, h = opts.h || 200, padX = 34, padT = 16, padB = 26;
  if (!series.length) return `<div class="empty">Nothing to forecast yet</div>`;
  const ys = series.map((p) => p.balance);
  const max = Math.max(...ys, 0) * 1.08 || 1;
  const min = Math.min(...ys, 0) * 1.15;
  const X = (i) => padX + (i / Math.max(1, series.length - 1)) * (w - padX * 2);
  const Y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
  const zeroY = Y(0);

  const line = series.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.balance).toFixed(1)}`).join("");
  const area = `${line}L${X(series.length - 1).toFixed(1)},${zeroY.toFixed(1)}L${X(0).toFixed(1)},${zeroY.toFixed(1)}Z`;

  const marks = series.map((p, i) => {
    if (!p.events.length) return "";
    const big = p.events.reduce((a, b) => Math.abs(b.amount) > Math.abs(a.amount) ? b : a);
    const col = big.amount > 0 ? cssVar("--good") : cssVar("--bad");
    return `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.balance).toFixed(1)}" r="3.4" fill="${col}"
      stroke="${cssVar("--surface")}" stroke-width="1">
      <title>${longDate(p.date)} — ${big.label} ${signMoney(big.amount)}
balance ${money(p.balance)}</title></circle>`;
  }).join("");

  const ticks = [0, Math.floor(series.length / 2), series.length - 1].map((i) =>
    `<text x="${X(i).toFixed(1)}" y="${h - 6}" text-anchor="middle"
      fill="${cssVar("--muted")}" font-size="10">${shortDate(series[i].date)}</text>`).join("");

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
      style="height:${h}px" aria-label="Projected cash balance">
    <defs>
      <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${cssVar("--accent")}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${cssVar("--accent")}" stop-opacity="0.02"/>
      </linearGradient>
      <clipPath id="below"><rect x="0" y="${zeroY}" width="${w}" height="${Math.max(0, h - zeroY)}"/></clipPath>
    </defs>
    <path d="${area}" fill="url(#fg)"/>
    <path d="${area}" fill="${cssVar("--bad")}" opacity="0.3" clip-path="url(#below)"/>
    <line x1="${padX}" x2="${w - padX}" y1="${zeroY}" y2="${zeroY}"
      stroke="${cssVar("--bad")}" stroke-width="1" stroke-dasharray="4 4" opacity="0.8"/>
    <text x="${padX - 4}" y="${zeroY - 3}" text-anchor="end" fill="${cssVar("--bad")}" font-size="9">0</text>
    <path d="${line}" fill="none" stroke="${cssVar("--accent")}" stroke-width="2.2" stroke-linejoin="round"/>
    ${marks}${ticks}
  </svg>`;
}

/* --------------------------------------------------------- column pair -- */
function columns(rows, opts = {}) {
  const w = opts.w || 660, h = opts.h || 180, padB = 24, padT = 10;
  if (!rows.length) return `<div class="empty">Not enough months yet</div>`;
  const max = Math.max(...rows.flatMap((r) => [r.a || 0, r.b || 0]), 1);
  const slot = (w - 20) / rows.length, bw = Math.min(20, slot / 2.6);
  const Y = (v) => padT + (1 - v / max) * (h - padT - padB);

  const bars = rows.map((r, i) => {
    const x = 10 + i * slot + slot / 2;
    const ya = Y(r.a || 0), yb = Y(r.b || 0);
    return `
      <rect x="${(x - bw - 2).toFixed(1)}" y="${ya.toFixed(1)}" width="${bw}"
        height="${Math.max(1, h - padB - ya).toFixed(1)}" rx="3" fill="${cssVar("--s2")}">
        <title>${esc(r.label)} — ${esc(opts.labelA || "in")} ${money(r.a || 0)}</title></rect>
      <rect x="${(x + 2).toFixed(1)}" y="${yb.toFixed(1)}" width="${bw}"
        height="${Math.max(1, h - padB - yb).toFixed(1)}" rx="3" fill="${cssVar("--s8")}">
        <title>${esc(r.label)} — ${esc(opts.labelB || "out")} ${money(r.b || 0)}</title></rect>
      <text x="${x.toFixed(1)}" y="${h - 8}" text-anchor="middle"
        fill="${cssVar("--muted")}" font-size="9.5">${esc(r.label)}</text>`;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
      style="height:${h}px">
    <line x1="6" x2="${w - 6}" y1="${h - padB}" y2="${h - padB}" stroke="${cssVar("--hairline")}"/>
    ${bars}
  </svg>
  <div class="legend">
    <span class="li"><span class="sw" style="background:var(--s2)"></span>${esc(opts.labelA || "in")}</span>
    <span class="li"><span class="sw" style="background:var(--s8)"></span>${esc(opts.labelB || "out")}</span>
  </div>`;
}

/* ----------------------------------------------------------- sparkline -- */
function sparkline(values, w = 110, h = 30) {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const X = (i) => (i / (values.length - 1)) * w;
  const Y = (v) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  const d = values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const up = values[values.length - 1] >= values[0];
  return `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
    <path d="${d}" fill="none" stroke="${up ? cssVar("--good") : cssVar("--bad")}"
      stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* --------------------------------------------------------- progress arc -- */
function miniBar(value, target, tone) {
  const p = target ? clamp((value / target) * 100, 0, 100) : 0;
  return `<div class="bar ${tone || ""}"><i style="width:${p.toFixed(0)}%"></i></div>`;
}
