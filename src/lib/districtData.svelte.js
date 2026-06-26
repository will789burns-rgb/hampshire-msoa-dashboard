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

// ── Time sorting ───────────────────────────────────────────────────────────
// Fingertips year labels vary: "2021", "2020/21", "2018 - 20", "2019 Q4".
// Pull the FIRST 4-digit number out as the sort key so they order correctly.
export function yearKey(label) {
  const m = String(label).match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 0;
}

function sortByYear(a, b) {
  return yearKey(a.year) - yearKey(b.year);
}

// ── Sex / Age options ──────────────────────────────────────────────────────
export function getSexes(rows, indicatorLabel) {
  return [...new Set(
    rows.filter(r => r.indicator_label === indicatorLabel).map(r => r.sex)
  )].filter(Boolean).sort();
}

export function getAges(rows, indicatorLabel, sex) {
  return [...new Set(
    rows
      .filter(r => r.indicator_label === indicatorLabel && (!sex || r.sex === sex))
      .map(r => r.age)
  )].filter(Boolean).sort();
}

// Sensible default sex: prefer "Persons", else first available
export function defaultSex(sexes) {
  return sexes.find(s => /person/i.test(s)) ?? sexes[0] ?? '';
}

// ── Helpers (all now sex/age aware) ────────────────────────────────────────

export function getIndicators(rows) {
  return [...new Set(rows.map(r => r.indicator_label))].filter(Boolean).sort();
}

export function getLatestYear(rows, indicatorLabel, sex, age) {
  const years = [...new Set(
    rows
      .filter(r =>
        r.indicator_label === indicatorLabel &&
        (!sex || r.sex === sex) &&
        (!age || r.age === age)
      )
      .map(r => r.year)
  )];
  years.sort((a, b) => yearKey(a) - yearKey(b));
  return years.at(-1) ?? null;
}

export function getDistrictRows(rows, indicatorLabel, year, sex, age) {
  return rows.filter(r =>
    r.indicator_label === indicatorLabel &&
    r.year === year &&
    r.area_type === 'district' &&
    (!sex || r.sex === sex) &&
    (!age || r.age === age)
  );
}

export function getTrendRows(rows, indicatorLabel, areaCode, sex, age) {
  return rows
    .filter(r =>
      r.indicator_label === indicatorLabel &&
      r.area_code === areaCode &&
      (!sex || r.sex === sex) &&
      (!age || r.age === age)
    )
    .sort(sortByYear);
}

export function getTrendByType(rows, indicatorLabel, areaType, sex, age) {
  return rows
    .filter(r =>
      r.indicator_label === indicatorLabel &&
      r.area_type === areaType &&
      (!sex || r.sex === sex) &&
      (!age || r.age === age)
    )
    .sort(sortByYear);
}

export function getBenchmarkValue(rows, indicatorLabel, year, areaType, sex, age) {
  const match = rows.find(r =>
    r.indicator_label === indicatorLabel &&
    r.year === year &&
    r.area_type === areaType &&
    (!sex || r.sex === sex) &&
    (!age || r.age === age)
  );
  return match?.value ?? null;
}