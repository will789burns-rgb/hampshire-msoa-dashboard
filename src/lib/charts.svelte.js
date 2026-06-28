// src/lib/charts.svelte.js
// Shared chart + formatting helpers for the Area Report.
// Pure functions only — no runes, no Svelte state — so they're safe to import anywhere.

// ── Formatters ──────────────────────────────────────────────────────────────
export function fmtInt(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
  
  export function fmt1(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 });
  }
  
  export function vsEngland(districtVal, englandVal) {
    if (districtVal == null || englandVal == null) return '';
    const diff = districtVal - englandVal;
    const absR = Math.abs(diff).toFixed(1);
    if (Math.abs(diff) < 0.3) return 'broadly in line with England';
    return diff > 0 ? `about ${absR} years above England` : `about ${absR} years below England`;
  }
  
  export function yearKey(label) {
    const m = String(label).match(/\d{4}/);
    return m ? parseInt(m[0], 10) : 0;
  }
  
  // ── Unit-aware formatting & comparison ───────────────────────────────────────
  // fmtVal(22.34, '%', 1)     -> "22.3%"
  // fmtVal(83.27, 'years', 1) -> "83.3 years"
  export function fmtVal(v, unit = '', decimals = 1) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    const n = Number(v).toLocaleString('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    if (unit === '%') return `${n}%`;
    if (unit) return `${n} ${unit}`;
    return n;
  }
  
  // Unit-aware "above/below/in line with England" phrasing.
  export function compareToEngland(districtVal, englandVal, opts = {}) {
    const { unit = 'years', decimals = 1, nearThreshold = unit === '%' ? 1.0 : 0.3 } = opts;
    if (districtVal == null || englandVal == null) return '';
    const diff = districtVal - englandVal;
    const mag = Math.abs(diff);
    const unitWord = unit === '%' ? 'percentage points' : unit;
    const amount = `${mag.toFixed(decimals)} ${unitWord}`;
    if (mag < nearThreshold) return 'broadly in line with England';
    return diff > 0 ? `about ${amount} above England` : `about ${amount} below England`;
  }
  
  // ── Trend line chart (SVG) ───────────────────────────────────────────────────
  export function buildLineChart(series, width = 640, height = 280) {
    if (!series.length) return '';
    const pad = { top: 20, right: 130, bottom: 44, left: 56 };
    const W = width - pad.left - pad.right;
    const H = height - pad.top - pad.bottom;
    const allYears = [...new Set(series.flatMap((s) => s.points.map((p) => p.year)))]
      .sort((a, b) => yearKey(a) - yearKey(b));
    const allVals = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v != null);
    if (!allVals.length || allYears.length < 2) return '';
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const rangeV = maxV - minV || 1;
    const xScale = (y) => (allYears.indexOf(y) / Math.max(allYears.length - 1, 1)) * W;
    const yScale = (v) => H - ((v - minV) / rangeV) * H;
    const ticks = 5;
    const yTicks = Array.from({ length: ticks }, (_, i) => minV + (rangeV / (ticks - 1)) * i);
    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:'Open Sans',Arial,sans-serif">`;
    svg += `<g transform="translate(${pad.left},${pad.top})">`;
    for (const t of yTicks) {
      const y = yScale(t);
      svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
      svg += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="11" fill="#707070">${fmt1(t)}</text>`;
    }
    const longestLabel = Math.max(...allYears.map((y) => String(y).length));
    const approxLabelPx = longestLabel * 6.5;
    const maxLabels = Math.max(3, Math.min(7, Math.floor(W / (approxLabelPx + 16))));
    const lastIdx = allYears.length - 1;
    const stepEvery = Math.max(1, Math.round(lastIdx / (maxLabels - 1)));
    const shownIdx = new Set();
    for (let i = 0; i <= lastIdx; i += stepEvery) shownIdx.add(i);
    shownIdx.add(lastIdx);
    const secondLast = lastIdx - stepEvery;
    if (lastIdx - secondLast < stepEvery * 0.6) shownIdx.delete(secondLast);
    [...shownIdx].sort((a, b) => a - b).forEach((i) => {
      const yr = allYears[i];
      const xPos = xScale(yr);
      let anchor = 'middle';
      if (i === 0) anchor = 'start';
      else if (i === lastIdx) anchor = 'end';
      svg += `<text x="${xPos}" y="${H + 22}" text-anchor="${anchor}" font-size="10" fill="#707070">${yr}</text>`;
    });
    const labels = [];
    for (const s of series) {
      const pts = s.points.filter((p) => p.value != null);
      if (pts.length < 2) continue;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.year)},${yScale(p.value)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" stroke-dasharray="${s.dash ?? ''}" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = pts.at(-1);
      svg += `<circle cx="${xScale(last.year)}" cy="${yScale(last.value)}" r="4" fill="${s.color}"/>`;
      labels.push({ y: yScale(last.value), color: s.color, bold: s.bold, label: s.label });
    }
    labels.sort((a, b) => a.y - b.y);
    const minGap = 14;
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < minGap) labels[i].y = labels[i - 1].y + minGap;
    }
    for (const lab of labels) {
      lab.y = Math.max(8, Math.min(H, lab.y));
      svg += `<text x="${W + 16}" y="${lab.y + 4}" font-size="11" fill="${lab.color}" font-weight="${lab.bold ? '700' : '400'}">${lab.label}</text>`;
    }
    svg += `</g></svg>`;
    return svg;
  }
  
  // ── MSOA variation strip plot (SVG) ──────────────────────────────────────────
  export function buildStripPlot(stats, rows) {
    const s = stats;
    if (!s || !rows.length) return '';
    const width = 640, height = 110;
    const pad = { left: 20, right: 20, top: 28, bottom: 34 };
    const W = width - pad.left - pad.right;
    const axisY = 50;
    const lo = Math.floor(s.min - 1);
    const hi = Math.ceil(s.max + 1);
    const x = (v) => ((v - lo) / (hi - lo)) * W;
    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:'Open Sans',Arial,sans-serif">`;
    svg += `<g transform="translate(${pad.left},0)">`;
    svg += `<line x1="0" y1="${axisY}" x2="${W}" y2="${axisY}" stroke="#ccc" stroke-width="1"/>`;
    [lo, Math.round((lo + hi) / 2), hi].forEach((t) => {
      svg += `<line x1="${x(t)}" y1="${axisY - 4}" x2="${x(t)}" y2="${axisY + 4}" stroke="#999"/>`;
      svg += `<text x="${x(t)}" y="${axisY + 20}" text-anchor="middle" font-size="11" fill="#707070">${t}</text>`;
    });
    for (const r of rows) {
      svg += `<circle cx="${x(r.value)}" cy="${axisY}" r="5" fill="#206095" fill-opacity="0.5" stroke="#206095" stroke-width="1"><title>${r.name}: ${fmt1(r.value)}</title></circle>`;
    }
    svg += `</g></svg>`;
    return svg;
  }