/**
 * Matka 220 Patti (Panel) Engine for Server
 * Standard mathematical calculation and lookup for Satta Matka
 * Total 220 Pattis: 120 Single Patti (SP), 90 Double Patti (DP), 10 Triple Patti (TP)
 */

'use strict';

const DIGIT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function digitRank(ch) {
  const idx = DIGIT_ORDER.indexOf(ch);
  return idx === -1 ? 99 : idx;
}

function calculateAnk(patti) {
  if (!patti || patti.length !== 3) return null;
  const d1 = parseInt(patti[0], 10);
  const d2 = parseInt(patti[1], 10);
  const d3 = parseInt(patti[2], 10);
  if (isNaN(d1) || isNaN(d2) || isNaN(d3)) return null;
  return ((d1 + d2 + d3) % 10).toString();
}

function normalizePatti(input) {
  if (!input || input.length !== 3) return input;
  const chars = input.split('');
  chars.sort((a, b) => digitRank(a) - digitRank(b));
  return chars.join('');
}

function getPattiType(patti) {
  if (!patti || patti.length !== 3) return 'INVALID';
  const [a, b, c] = patti.split('');
  if (a === b && b === c) return 'TP'; // Triple Patti
  if (a === b || b === c || a === c) return 'DP'; // Double Patti
  return 'SP'; // Single Patti
}

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

module.exports = {
  DIGIT_ORDER,
  ALL_PATTIS,
  PATTI_MAP,
  calculateAnk,
  normalizePatti,
  getPattiType,
  isValidPatti: function (patti) {
    if (!patti || patti.length !== 3) return false;
    const norm = normalizePatti(patti);
    return Boolean(PATTI_MAP[norm]);
  },
  formatResult: function (openPana, closePana) {
    const openAnk = openPana ? calculateAnk(openPana) : '*';
    const closeAnk = closePana ? calculateAnk(closePana) : '*';
    const openP = openPana || '***';
    const closeP = closePana || '***';
    return `${openP}-${openAnk}${closeAnk}-${closeP}`;
  },

  // -------------------------------------------------------------
  // ADVANCED COMBINATORIC & MOTOR PERMUTATION ENGINES
  // -------------------------------------------------------------

  /**
   * SP Motor (Single Patti Motor)
   * Generates all C(N, 3) Single Pattis from 4 to 8 unique digits
   */
  generateSPMotor: function (digitsInput) {
    const raw = typeof digitsInput === 'string' ? digitsInput.split('') : digitsInput;
    // Filter to valid unique digits in Matka rank order
    const seen = new Set();
    const sortedDigits = [];
    DIGIT_ORDER.forEach(d => {
      if (raw.includes(d) && !seen.has(d)) {
        seen.add(d);
        sortedDigits.push(d);
      }
    });

    if (sortedDigits.length < 3) return [];

    const result = [];
    const n = sortedDigits.length;
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        for (let k = j + 1; k < n; k++) {
          const patti = sortedDigits[i] + sortedDigits[j] + sortedDigits[k];
          const ank = calculateAnk(patti);
          result.push({
            patti,
            ank,
            gameType: 'Single Patti',
            type: 'SP'
          });
        }
      }
    }
    return result;
  },

  /**
   * DP Motor (Double Patti Motor)
   * Generates all Double Pattis from selected digits: N * (N - 1)
   */
  generateDPMotor: function (digitsInput) {
    const raw = typeof digitsInput === 'string' ? digitsInput.split('') : digitsInput;
    const seen = new Set();
    const sortedDigits = [];
    DIGIT_ORDER.forEach(d => {
      if (raw.includes(d) && !seen.has(d)) {
        seen.add(d);
        sortedDigits.push(d);
      }
    });

    if (sortedDigits.length < 2) return [];

    const pattisMap = new Map();
    for (let i = 0; i < sortedDigits.length; i++) {
      const dDouble = sortedDigits[i];
      for (let j = 0; j < sortedDigits.length; j++) {
        if (i === j) continue;
        const dOther = sortedDigits[j];
        const rawPatti = dDouble + dDouble + dOther;
        const normalized = normalizePatti(rawPatti);
        if (!pattisMap.has(normalized)) {
          pattisMap.set(normalized, {
            patti: normalized,
            ank: calculateAnk(normalized),
            gameType: 'Double Patti',
            type: 'DP'
          });
        }
      }
    }

    // Sort generated pattis in standard Matka order
    const list = Array.from(pattisMap.values());
    list.sort((a, b) => {
      const rA = ALL_PATTIS.findIndex(p => p.patti === a.patti);
      const rB = ALL_PATTIS.findIndex(p => p.patti === b.patti);
      return rA - rB;
    });
    return list;
  },

  /**
   * Family Jodi Generator (Cut Jodi)
   * In Matka, each digit has a Cut (d + 5 % 10).
   * Generates direct, half-cut, full-cut, and their reversals (4 to 8 Jodis).
   */
  generateFamilyJodi: function (jodiInput) {
    let str = jodiInput.toString().trim();
    if (str.length === 1) str = '0' + str;
    if (str.length !== 2 || !/^[0-9]{2}$/.test(str)) return [];

    const d1 = str[0];
    const d2 = str[1];

    const cut = (d) => ((parseInt(d, 10) + 5) % 10).toString();
    const c1 = cut(d1);
    const c2 = cut(d2);

    const set1 = [d1, c1];
    const set2 = [d2, c2];

    const uniqueJodis = new Set();

    // 4 Direct & Cut variations
    set1.forEach(a => {
      set2.forEach(b => {
        uniqueJodis.add(a + b);
        // Also reverse / Ulta
        uniqueJodis.add(b + a);
      });
    });

    const result = Array.from(uniqueJodis).map(jodi => ({
      jodi,
      gameType: 'Jodi',
      isRed: jodi[0] === jodi[1] || cut(jodi[0]) === jodi[1]
    }));

    result.sort((a, b) => parseInt(a.jodi, 10) - parseInt(b.jodi, 10));
    return result;
  },

  /**
   * Cross Jodi Generator
   * Crosses Group A digits with Group B digits (or Self-Crossing).
   */
  generateCrossing: function (digitsA, digitsB = '', includeDoubles = true) {
    const rawA = (typeof digitsA === 'string' ? digitsA.split('') : digitsA).filter(d => /^[0-9]$/.test(d));
    const setA = Array.from(new Set(rawA));

    let setB = [];
    if (digitsB && digitsB.length > 0) {
      const rawB = (typeof digitsB === 'string' ? digitsB.split('') : digitsB).filter(d => /^[0-9]$/.test(d));
      setB = Array.from(new Set(rawB));
    } else {
      setB = [...setA]; // Self crossing
    }

    if (setA.length === 0 || setB.length === 0) return [];

    const unique = new Set();
    setA.forEach(a => {
      setB.forEach(b => {
        if (!includeDoubles && a === b) return;
        unique.add(a + b);
      });
    });

    const result = Array.from(unique).map(jodi => ({
      jodi,
      gameType: 'Jodi',
      isDouble: jodi[0] === jodi[1]
    }));

    result.sort((a, b) => parseInt(a.jodi, 10) - parseInt(b.jodi, 10));
    return result;
  }
};

