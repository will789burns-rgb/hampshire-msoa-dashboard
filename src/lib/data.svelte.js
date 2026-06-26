import Papa from 'papaparse';

// Shared, reactive data store — exported via a getter so it works with SSR.
const _store = $state({
  rows: [],
  geo: null,
  loading: true,
  error: ''
});

export function getStore() {
  return _store;
}

let started = false;

export async function loadData() {
  if (started) return;
  started = true;

  try {
    const nameLookup = new Map();
    try {
      const nameRes = await fetch('/data/msoa-names.csv');
      if (nameRes.ok) {
        let nameText = (await nameRes.text()).replace(/^\uFEFF/, '');
        const nameParsed = Papa.parse(nameText, { header: true, skipEmptyLines: true });
        for (const n of nameParsed.data) {
          const code = (n['msoa21cd'] ?? '').trim();
          const friendly = (n['msoa21hclnm'] ?? '').trim();
          if (code) nameLookup.set(code, friendly);
        }
      }
    } catch (e) {}

    const res = await fetch('/data/msoa-summary.csv');
    if (!res.ok) throw new Error('Could not find /data/msoa-summary.csv');
    let text = (await res.text()).replace(/^\uFEFF/, '');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    _store.rows = parsed.data.map((r) => {
      const code = (r['MSOACD21'] ?? '').trim();
      return {
        district: (r['District'] ?? '').trim(),
        msoaName: nameLookup.get(code) || (r['MSOA21'] ?? '').trim(),
        msoaCode: code,
        topic: (r['Topic'] ?? '').trim(),
        indicator: (r['Indicator'] ?? '').trim(),
        measure: (r['Measure'] ?? '').trim(),
        source: (r['Source'] ?? '').trim(),
        value: r['Value'],
        lowerCI: r['Lower CI'],
        upperCI: r['Upper CI']
      };
    });

    try {
      const geoRes = await fetch('/data/msoa-boundaries.geojson');
      if (geoRes.ok) _store.geo = await geoRes.json();
    } catch (e) {}
  } catch (e) {
    _store.error = e.message;
  } finally {
    _store.loading = false;
  }
}