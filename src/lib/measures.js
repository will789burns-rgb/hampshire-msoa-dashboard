// src/lib/measures.js
// One object per measure. To add an indicator going forward:
//   1. Copy a block below.
//   2. Fill in the EXACT strings (Fingertips label from /districts dropdown;
//      MSOA indicator from a Ctrl+F in msoa-summary.csv — verbatim, never approximate).
//   3. Set the shape flags (hasHeadline / hasTrend / allowVariation).
//   4. (Optional) give it a custom `intro(name, headBySex)` sentence.
// Nothing in the page needs to change.

import { fmt1, vsEngland } from '$lib/charts.svelte.js';

export const MEASURES = [
  {
    key: 'life-expectancy',
    title: 'Life expectancy at birth',
    fingertipsIndicator: 'Life expectancy at birth',
    sexes: ['Female', 'Male'],
    hasHeadline: true,
    hasTrend: true,
    allowVariation: true,
    msoaIndicator: 'Life expectancy at birth (2018 to 2022)',
    unit: 'years',
    // Bespoke lede. Receives the district name and the per-sex headline objects
    // ({ Female: {district, hampshire, england, year}, Male: {...} }).
    intro: (name, h) => {
      const f = h.Female, m = h.Male;
      let s = `In ${name}, life expectancy at birth is <strong>${fmt1(f?.district)}</strong> ` +
              `years for females and <strong>${fmt1(m?.district)}</strong> years for males`;
      if (f?.district != null && f?.england != null) {
        s += `. Females are ${vsEngland(f.district, f.england)}`;
      }
      return s + '.';
    },
    variationNote:
      'Each dot is one MSOA. This is a combined male and female figure, so it is ' +
      'not directly comparable to the sex-specific values above. ' +
      'Source: Hampshire Public Health Intelligence Team (2018 to 2022).'
  },
  {
    key: 'healthy-life-expectancy',
    title: 'Healthy life expectancy at birth',
    fingertipsIndicator: '',     // not published in Fingertips at district level
    sexes: ['Female', 'Male'],
    hasHeadline: false,          // variation-only
    hasTrend: false,
    allowVariation: true,
    msoaIndicator: 'Healthy life expectancy at birth (2018 to 2022)',
    unit: 'years',
    intro: null,                 // no headline → no bespoke lede
    variationNote:
      'Each dot is one MSOA — the average number of years a person would expect to ' +
      'live in good health (a combined male and female figure). ' +
      'Source: Hampshire Public Health Intelligence Team (2018 to 2022).'
  }
];