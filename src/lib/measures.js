// src/lib/measures.js
// One object per measure. To add an indicator going forward:
//   1. Copy a block below.
//   2. Fill in the EXACT strings (Fingertips label from /districts dropdown;
//      MSOA indicator from a Ctrl+F in msoa-summary.csv — verbatim, never approximate).
//   3. Set the shape flags (hasHeadline / hasTrend / allowVariation).
//   4. (Optional) give it a custom `intro(name, headBySex)` sentence.
// Nothing in the page needs to change.

import { fmt1, fmtVal, vsEngland, compareToEngland } from '$lib/charts.svelte.js';



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

  ,{
    key: 'reception-overweight',
    title: 'Reception: overweight (including obesity)',
    fingertipsIndicator: 'Reception prevalence of overweight (including obesity)',
    sexes: ['Persons'],
    hasHeadline: true,
    hasTrend: true,
    allowVariation: true,
    msoaIndicator: 'Overweight (including obesity) in reception age children (2021/22 - 2023/24)',
    unit: '%',
    decimals: 1,
    higherIsBad: true,
    intro: (name, h) => {
      const p = h.Persons;
      if (p?.district == null) return '';
      let s = `In ${name}, <strong>${fmtVal(p.district, '%', 1)}</strong> of reception-age ` +
              `children (aged 4–5) are overweight or living with obesity`;
      if (p.england != null) {
        s += `, ${compareToEngland(p.district, p.england, { unit: '%', decimals: 1 })}`;
      }
      return s + '.';
    },
    variationNote:
      'Each dot is one MSOA — the percentage of reception-age children classified as ' +
      'overweight or living with obesity. Source: Fingertips / OHID via Hampshire ' +
      'Public Health Intelligence Team (2021/22–2023/24).'
  },
  {
    key: 'year6-overweight',
    title: 'Year 6: overweight (including obesity)',
    fingertipsIndicator: 'Year 6 prevalence of overweight (including obesity)',
    sexes: ['Persons'],
    hasHeadline: true,
    hasTrend: true,
    allowVariation: true,
    msoaIndicator: 'Overweight (including obesity) in year 6 children (2021/22 - 2023/24)',
    unit: '%',
    decimals: 1,
    higherIsBad: true,
    intro: (name, h) => {
      const p = h.Persons;
      if (p?.district == null) return '';
      let s = `In ${name}, <strong>${fmtVal(p.district, '%', 1)}</strong> of Year 6 ` +
              `children (aged 10–11) are overweight or living with obesity`;
      if (p.england != null) {
        s += `, ${compareToEngland(p.district, p.england, { unit: '%', decimals: 1 })}`;
      }
      return s + '.';
    },
    variationNote:
      'Each dot is one MSOA — the percentage of Year 6 children classified as ' +
      'overweight or living with obesity. Source: Fingertips / OHID via Hampshire ' +
      'Public Health Intelligence Team (2021/22–2023/24).'
  }
];