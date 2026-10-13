/**
 * Matka 220 Patti (Panel) Engine
 * Standard mathematical calculation and lookup for Satta Matka
 * Total 220 Pattis: 120 Single Patti (SP), 90 Double Patti (DP), 10 Triple Patti (TP)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PattiEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Digit ordering standard in Matka: 1, 2, 3, 4, 5, 6, 7, 8, 9, 0 (0 is placed last)
  const DIGIT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  function digitRank(ch) {
    const idx = DIGIT_ORDER.indexOf(ch);
    return idx === -1 ? 99 : idx;
  }

  // Calculate Single Ank from 3 digits (d1 + d2 + d3) % 10
  function calculateAnk(patti) {
    if (!patti || patti.length !== 3) return null;
    const d1 = parseInt(patti[0], 10);
    const d2 = parseInt(patti[1], 10);
    const d3 = parseInt(patti[2], 10);
    if (isNaN(d1) || isNaN(d2) || isNaN(d3)) return null;
    return ((d1 + d2 + d3) % 10).toString();
  }

  // Normalize/sort 3 digits in Matka ascending order (e.g., '821' -> '128', '029' -> '290', '010' -> '100')
  function normalizePatti(input) {
    if (!input || input.length !== 3) return input;
    const chars = input.split('');
    chars.sort((a, b) => digitRank(a) - digitRank(b));
    return chars.join('');
  }

  // Determine type of Patti: SP (Single Patti), DP (Double Patti), TP (Triple Patti)
  function getPattiType(patti) {
    if (!patti || patti.length !== 3) return 'INVALID';
    const [a, b, c] = patti.split('');
    if (a === b && b === c) return 'TP'; // Triple Patti
    if (a === b || b === c || a === c) return 'DP'; // Double Patti
    return 'SP'; // Single Patti
  }

  // Generate full 220 Patti table
  function generateAllPattis() {
    const all = [];
    const len = DIGIT_ORDER.length;

    for (let i = 0; i < len; i++) {
      for (let j = i; j < len; j++) {
        for (let k = j; k < len; k++) {
          const p = DIGIT_ORDER[i] + DIGIT_ORDER[j] + DIGIT_ORDER[k];
          const ank = calculateAnk(p);
          const type = getPattiType(p);
          all.push({
            patti: p,
            ank: ank,
            type: type,
            typeName: type === 'SP' ? 'Single Patti' : type === 'DP' ? 'Double Patti' : 'Triple Patti'
          });
        }
      }
    }
    return all;
  }

  const ALL_PATTIS = generateAllPattis();
  const PATTI_MAP = {};
  ALL_PATTIS.forEach(item => {
    PATTI_MAP[item.patti] = item;
  });

  // Group by Ank (0-9)
  const PATTIS_BY_ANK = {};
  for (let d = 0; d <= 9; d++) {
    PATTIS_BY_ANK[d.toString()] = ALL_PATTIS.filter(p => p.ank === d.toString());
  }

  return {
    DIGIT_ORDER,
    ALL_PATTIS,
    PATTI_MAP,
    PATTIS_BY_ANK,
    calculateAnk,
    normalizePatti,
    getPattiType,
    isValidPatti: function (patti) {
      if (!patti || patti.length !== 3) return false;
      const norm = normalizePatti(patti);
      return Boolean(PATTI_MAP[norm]);
    },
    // Formats result string standard: e.g. "234-94-149" or "234-9*" (if only open declared)
    formatResult: function (openPana, closePana) {
      const openAnk = openPana ? calculateAnk(openPana) : '*';
      const closeAnk = closePana ? calculateAnk(closePana) : '*';
      const openP = openPana || '***';
      const closeP = closePana || '***';
      return `${openP}-${openAnk}${closeAnk}-${closeP}`;
    }
  };
}));
