import Papa from 'papaparse';

let state = $state({
  rows: [],
  loading: false,
  error: null
});

export function getDistrictStore() {
  return state;
}

export async function loadDistrictData() {
  if (state.rows.length || state.loading) return;
  state.loading = true;
  state.error = null;

  try {
    const res = await fetch('/data/fingertips-district-data.csv');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    if (errors.length) console.warn('CSV parse warnings:', errors);

    // Cast numeric columns manually
    const numericCols = ['value', 'lower_ci', 'upper_ci', 'count', 'denominator'];
    state.rows = data.map(r => {
      const out = { ...r };
      for (const col of numericCols) {
        const n = parseFloat(r[col]);
        out[col] = isNaN(n) ? null : n;
      }
      return out;
    });

  } catch (e) {
    state.error = e.message;
  } finally {
    state.loading = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function getIndicators(rows) {
  return [...new Set(rows.map(r => r.indicator_label))].filter(Boolean).sort();
}

export function getYears(rows, indicatorLabel) {
  return [...new Set(
    rows
      .filter(r => r.indicator_label === indicatorLabel)
      .map(r => r.year)
  )].sort();
}

export function getLatestYear(rows, indicatorLabel) {
  return getYears(rows, indicatorLabel).at(-1) ?? null;
}

export function getDistrictRows(rows, indicatorLabel, year) {
  return rows.filter(r =>
    r.indicator_label === indicatorLabel &&
    r.year === year &&
    r.area_type === 'district'
  );
}

export function getTrendRows(rows, indicatorLabel, areaCode) {
  return rows
    .filter(r =>
      r.indicator_label === indicatorLabel &&
      r.area_code === areaCode
    )
    .sort((a, b) => a.year.localeCompare(b.year));
}

export function getBenchmarkValue(rows, indicatorLabel, year, areaType) {
  const match = rows.find(r =>
    r.indicator_label === indicatorLabel &&
    r.year === year &&
    r.area_type === areaType
  );
  return match?.value ?? null;
}