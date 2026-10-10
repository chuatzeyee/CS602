// engine.test.ts - node:test suite for the lab engine (ported from site_build/engine_eval snippets.test.ts).
// Run: npx tsx --test tests/engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import solver from 'javascript-lp-solver';
import {
  approxMatchIndex, excelRound, frequency, linearFit, makeCriterion, modeSngl, normSDist,
  parseLooseNumber, percentRankInc, rankEq,
} from '../src/lab/engine/excelMath.ts';
import { buildWorkbook, fill, readCell, readNumber, recalc, setCell } from '../src/lab/engine/workbook.ts';
import { dataTable1, dataTable2, goalSeek, iterateCircular } from '../src/lab/engine/whatIf.ts';
import { solve } from '../src/lab/engine/solverBridge.ts';

const close = (a: number, b: number, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('excelMath: Excel rounding, normal CDF, loose number parsing', () => {
  assert.equal(excelRound(2.345, 2, 'nearest'), 2.35);
  assert.equal(excelRound(1.005, 2, 'nearest'), 1.01);
  assert.equal(excelRound(-2.5, 0, 'nearest'), -3);
  assert.equal(excelRound(1234.567, -2, 'nearest'), 1200);
  assert.equal(excelRound(3.14159, 3, 'up'), 3.142);
  assert.equal(excelRound(-2.1, 0, 'up'), -3);
  assert.equal(excelRound(-2.9, 0, 'down'), -2);
  close(normSDist(1.5), 0.9331927987311419, 1e-13);
  close(normSDist(-3), 0.0013498980316301, 1e-12);
  assert.equal(parseLooseNumber('12%'), 0.12);
  assert.equal(parseLooseNumber('$1,200'), 1200);
  assert.equal(parseLooseNumber('(1,200.50)'), -1200.5);
  assert.equal(parseLooseNumber('1,20'), undefined);
  assert.equal(parseLooseNumber('abc'), undefined);
});

test('excelMath: criteria, ranks, mode, frequency, regression, approximate match', () => {
  assert.equal([3, 7, 1, 9].filter(makeCriterion('>5')).length, 2);
  assert.equal(['North', 'East', 'north', null].filter(makeCriterion('N*')).length, 2);
  assert.equal(['North', 'East', null].filter(makeCriterion('<>North')).length, 2);
  assert.equal([null, '', 'x'].filter(makeCriterion('')).length, 2);
  const data = [3, 7, 1, 9, 5, 7, 2, 8, 6, 4];
  assert.equal(percentRankInc(data, 7), 0.666);
  assert.equal(percentRankInc(data, 7.5), 0.777); // interpolated between ranks of 7 and 8, truncated
  assert.equal(percentRankInc(data, 10), 'NA');
  assert.equal(rankEq(7, data, false), 3);
  assert.equal(rankEq(7, data, true), 7);
  assert.equal(modeSngl(data), 7);
  assert.equal(modeSngl([1, 2, 3]), 'NA');
  assert.deepEqual(frequency(data, [3, 6, 9]), [3, 3, 4, 0]);
  assert.deepEqual(frequency(data, [6, 3]), [3, 3, 4]); // unsorted bins keep their order
  const fit = linearFit([2, 4, 5, 4, 5], [1, 2, 3, 4, 5]);
  assert.ok(fit !== 'DIV0');
  close(fit.slope, 0.6);
  close(fit.intercept, 2.2);
  assert.equal(approxMatchIndex([0, 0.2, 0.5, 0.9], 0.73), 2);
  assert.equal(approxMatchIndex([0, 0.2, 0.5, 0.9], -1), -1);
});

test('workbook: JSON spec, formulas, cross-sheet + named ranges, errors with hints', () => {
  const { hf } = buildWorkbook({
    sheets: {
      Inputs: { A1: 'Rate', B1: 0.05, A2: 'Years', B2: 10, A3: 'Principal', B3: '$250,000' },
      Model: { A1: 'Payment', B1: '=PMT(Inputs!B1/12,Inputs!B2*12,-Principal)', B2: '=B1*12*Inputs!B2', B3: '=VLOOKUP(5,Inputs!B1:B2,1,FALSE)' },
    },
    names: { Principal: '=Inputs!$B$3' },
  });
  assert.equal(readNumber(hf, 'Inputs!B3'), 250000); // "$250,000" in the spec is normalised to a number
  close(readNumber(hf, 'Model!B1'), 2651.6378809768885, 1e-12);
  const err = readCell(hf, 'Model!B3');
  assert.equal(err.kind, 'error');
  if (err.kind === 'error') { assert.equal(err.code, '#N/A'); assert.match(err.hint, /match/i); }
  assert.deepEqual(setCell(hf, 'Model!C1', '=SUM(1,'), { ok: false, message: 'There is a problem with this formula (check brackets, commas and quotes).' });
  assert.deepEqual(setCell(hf, 'Model!C1', '=SUMM(B1)'), { ok: true });
  const name = readCell(hf, 'Model!C1');
  assert.ok(name.kind === 'error' && name.code === '#NAME?');
  setCell(hf, 'Inputs!B3', '$1,200'); // typed input with currency + thousands separator
  assert.equal(readNumber(hf, 'Inputs!B3'), 1200);
  setCell(hf, 'Inputs!C1', '2026-10-10');
  assert.equal(readNumber(hf, 'Inputs!C1'), 46305);
});

test('workbook: fill down/right adjusts relative refs and keeps $ anchors', () => {
  const { hf } = buildWorkbook({ sheets: { S: { B1: 10, C1: 20, D1: 30, A2: 1, A3: 2, A4: 3, B2: '=$A2*B$1+$E$1', E1: 0.5 } } });
  fill(hf, 'S!B2', 'S!B2:D4');
  assert.equal(hf.getCellFormula({ sheet: 0, row: 3, col: 3 }), '=$A4*D$1+$E$1');
  assert.equal(readNumber(hf, 'S!D4'), 90.5);
  assert.equal(readNumber(hf, 'S!C3'), 40.5);
});

test('seeded RAND: reproducible, order-independent, F9 redraws, Excel mode redraws on every edit', () => {
  const spec = { sheets: { Sim: { A1: '=RAND()', A2: '=RAND()', B1: '=IF(RAND()<2,RAND(),0)', C1: '=RANDBETWEEN(1,6)', D1: 5 } }, seed: 2026 };
  const a = buildWorkbook(spec);
  const b = buildWorkbook(spec);
  const snap = (hf: typeof a.hf) => ['Sim!A1', 'Sim!A2', 'Sim!B1', 'Sim!C1'].map((r) => readNumber(hf, r));
  const first = snap(a.hf);
  assert.deepEqual(first, snap(b.hf));                 // same seed -> same numbers
  assert.notEqual(first[0], first[1]);                  // different cells differ
  assert.notEqual(readNumber(a.hf, 'Sim!B1'), first[0]);
  setCell(a.hf, 'Sim!D1', 6);                            // an unrelated edit does not redraw (teaching mode)
  assert.deepEqual(snap(a.hf), first);
  recalc(a);                                             // F9
  const second = snap(a.hf);
  assert.notDeepEqual(second, first);
  recalc(b);
  assert.deepEqual(snap(b.hf), second);                  // still in lock-step after the same operations
  const c = buildWorkbook({ ...spec, excelRedraw: true });
  const c1 = snap(c.hf);
  setCell(c.hf, 'Sim!D1', 7);                            // Excel mode: any recalculation redraws
  assert.notDeepEqual(snap(c.hf), c1);
  // Uniformity sanity check: 20,000 draws, 10 bins, chi-square (9 df) well below 27.9 (p = 0.001)
  const cells: Record<string, string> = {};
  for (let r = 1; r <= 2000; r++) for (let k = 0; k < 10; k++) cells[`${'ABCDEFGHIJ'[k]}${r}`] = '=RAND()';
  const big = buildWorkbook({ sheets: { U: cells }, seed: 7 });
  const values = big.hf.getSheetValues(0).flat() as number[];
  const bins = new Array(10).fill(0);
  values.forEach((v) => { bins[Math.floor(v * 10)] += 1; });
  const chi2 = bins.reduce((s, o) => s + (o - 2000) ** 2 / 2000, 0);
  assert.ok(chi2 < 27.9, `chi2=${chi2}`);
  close(values.reduce((s, v) => s + v, 0) / values.length, 0.5, 0.01);
});

test('what-if: Goal Seek, 1- and 2-variable data tables, iterative circular calculation', () => {
  const lab = buildWorkbook({
    sheets: { M: { A1: 'Price', B1: 30, A2: 'Units', B2: '=1000-20*B1', A3: 'UnitCost', B3: 10, A4: 'Profit', B4: '=(B1-B3)*B2', A5: 'Rate', B5: 0.04, B6: '=PMT(B5/12,60,-30000)' } },
  });
  const { hf } = lab;
  // Price that gives a profit of 6,000 starting from 30 -> the lower root of (p-10)(1000-20p)=6000 is p=20... or 40
  const gs = goalSeek(hf, { setCell: 'M!B4', toValue: 6000, byChanging: 'M!B1' });
  assert.ok(gs.found);
  close(readNumber(hf, 'M!B4'), 6000, 1e-7);
  assert.ok(Math.abs(gs.input - 20) < 1e-6 || Math.abs(gs.input - 40) < 1e-6, String(gs.input));
  // Interest rate that makes the monthly payment 560 (secant on a smooth function)
  const rate = goalSeek(hf, { setCell: 'M!B6', toValue: 560, byChanging: 'M!B5' });
  assert.ok(rate.found);
  close(readNumber(hf, 'M!B6'), 560, 1e-7);
  hf.setCellContents({ sheet: 0, row: 0, col: 1 }, [[30]]);
  const t1 = dataTable1(lab, { inputCell: 'M!B1', values: [20, 25, 30, 35, 40], outputs: ['M!B2', 'M!B4'] });
  assert.deepEqual(t1.map((r) => r[1]), [6000, 7500, 8000, 7500, 6000]);
  assert.equal(readNumber(hf, 'M!B1'), 30); // input restored like Excel's data table
  const t2 = dataTable2(lab, { rowInput: 'M!B1', rowValues: [25, 30], colInput: 'M!B3', colValues: [10, 12], output: 'M!B4' });
  assert.deepEqual(t2, [[7500, 6500], [8000, 7200]]);
  // Circular: bonus = 5% of profit after bonus (Excel needs "Enable iterative calculation")
  const circ = buildWorkbook({ sheets: { C: { A1: 'Profit before bonus', B1: 100000, A2: 'Bonus', B2: '=0.05*B3', A3: 'Profit after bonus', B3: '=B1-B2' } } });
  assert.equal(readCell(circ.hf, 'C!B2').kind, 'error'); // #CYCLE! until iterated
  const it = iterateCircular(circ.hf, ['C!B2', 'C!B3'], { maxChange: 1e-6 });
  assert.ok(it.converged);
  close(readNumber(circ.hf, 'C!B2'), 100000 * 0.05 / 1.05, 1e-8);
});

test('solver bridge: LP, integer, binary via finite differences + javascript-lp-solver', () => {
  const mix = buildWorkbook({ sheets: { P: {
    B2: 0, C2: 0, B3: 30, C3: 40, B4: '=SUMPRODUCT(B3:C3,B2:C2)',
    B6: 2, C6: 3, D6: '=SUMPRODUCT(B6:C6,$B$2:$C$2)', E6: 120,
    B7: 4, C7: 2, D7: '=SUMPRODUCT(B7:C7,$B$2:$C$2)', E7: 160, D8: '=B2', E8: 35,
  } } });
  const r1 = solve(mix.hf, { objective: 'P!B4', sense: 'max', changing: ['P!B2', 'P!C2'],
    constraints: [{ lhs: 'P!D6', relation: '<=', rhs: 'P!E6' }, { lhs: 'P!D7', relation: '<=', rhs: 'P!E7' }, { lhs: 'P!D8', relation: '<=', rhs: 'P!E8' }] });
  assert.equal(r1.status, 'optimal');
  assert.equal(r1.method, 'simplex');
  assert.ok(r1.linear);
  close(r1.objective, 1700, 1e-9);
  close(readNumber(mix.hf, 'P!B2'), 30, 1e-9);
  close(readNumber(mix.hf, 'P!C2'), 20, 1e-9);

  const guests = buildWorkbook({ sheets: { G: {
    B2: 0, C2: 0, B3: 120, C3: 190, B4: '=SUMPRODUCT(B3:C3,B2:C2)',
    B6: 1, C6: 1, D6: '=SUMPRODUCT(B6:C6,$B$2:$C$2)', B7: 1.4, C7: 2.6, D7: '=SUMPRODUCT(B7:C7,$B$2:$C$2)',
    B8: 25, C8: 60, D8: '=SUMPRODUCT(B8:C8,$B$2:$C$2)',
  } } });
  const base = { objective: 'G!B4', sense: 'max' as const, changing: ['G!B2', 'G!C2'],
    constraints: [{ lhs: 'G!D6', relation: '<=' as const, rhs: 60 }, { lhs: 'G!D7', relation: '<=' as const, rhs: 115 }, { lhs: 'G!D8', relation: '<=' as const, rhs: 2500 }] };
  const relaxed = solve(guests.hf, base);
  close(relaxed.objective, 9008.333333333334, 1e-9);
  const r2 = solve(guests.hf, { ...base, integer: ['G!B2', 'G!C2'] });
  assert.equal(r2.method, 'branch-and-cut');
  let bestMix = { profit: 0, s: 0, d: 0 }; // brute force over all integer room mixes
  for (let s = 0; s <= 60; s++) for (let d = 0; d <= 60 - s; d++) {
    if (1.4 * s + 2.6 * d <= 115 + 1e-9 && 25 * s + 60 * d <= 2500 && 120 * s + 190 * d > bestMix.profit) bestMix = { profit: 120 * s + 190 * d, s, d };
  }
  assert.deepEqual([readNumber(guests.hf, 'G!B2'), readNumber(guests.hf, 'G!C2')], [bestMix.s, bestMix.d]); // 32, 27
  close(r2.objective, bestMix.profit, 1e-12); // 8,970 (LP relaxation 9,008.33)

  const w = [12, 5, 3, 2, 4, 9, 10, 6];
  const v = [40, 15, 20, 30, 12, 25, 18, 22];
  const cells: Record<string, number | string> = { F1: '=SUMPRODUCT(B2:B9,D2:D9)', F2: '=SUMPRODUCT(C2:C9,D2:D9)' };
  w.forEach((wi, i) => { cells[`B${i + 2}`] = wi; cells[`C${i + 2}`] = v[i]; cells[`D${i + 2}`] = 0; });
  const van = buildWorkbook({ sheets: { K: cells } });
  const picks = w.map((_, i) => `K!D${i + 2}`);
  const r3 = solve(van.hf, { objective: 'K!F2', sense: 'max', changing: picks, binary: picks, constraints: [{ lhs: 'K!F1', relation: '<=', rhs: 30 }] });
  let best = 0;
  for (let m = 0; m < 256; m++) {
    let tw = 0; let tv = 0;
    for (let i = 0; i < 8; i++) if (m & (1 << i)) { tw += w[i]; tv += v[i]; }
    if (tw <= 30) best = Math.max(best, tv);
  }
  assert.equal(r3.objective, best);
  assert.ok(picks.every((p) => [0, 1].includes(readNumber(van.hf, p))));
  assert.ok(readNumber(van.hf, 'K!F1') <= 30);
  const check = solver.Solve({ optimize: 'v', opType: 'max', constraints: { w: { max: 30 } },
    variables: Object.fromEntries(w.map((wi, i) => [`i${i}`, { w: wi, v: v[i] }])), binaries: Object.fromEntries(w.map((_, i) => [`i${i}`, 1])) }) as { result: number };
  assert.equal(check.result, best);
});

test('solver bridge: non-linear models fall back to Nelder-Mead', () => {
  const price = buildWorkbook({ sheets: { N: { B1: 15, B2: '=1000-20*B1', B3: '=(B1-10)*B2' } } });
  const r = solve(price.hf, { objective: 'N!B3', sense: 'max', changing: ['N!B1'], constraints: [], bounds: { 'N!B1': { lo: 10, hi: 50 } } });
  assert.equal(r.linear, false);
  assert.equal(r.method, 'nelder-mead');
  close(r.values['N!B1'], 30, 1e-4);
  close(r.objective, 8000, 1e-6);
  const two = buildWorkbook({ sheets: { T: { B1: 20, C1: 30, B2: '=500-10*B1', C2: '=400-5*C1', B3: '=B1*B2+C1*C2', B4: '=B2+C2' } } });
  const r2 = solve(two.hf, { objective: 'T!B3', sense: 'max', changing: ['T!B1', 'T!C1'], constraints: [{ lhs: 'T!B4', relation: '<=', rhs: 400 }],
    bounds: { 'T!B1': { lo: 0, hi: 50 }, 'T!C1': { lo: 0, hi: 80 } } });
  assert.equal(r2.status, 'optimal');
  close(r2.objective, 14083.333333, 2e-3);
  close(r2.values['T!B1'], 85 / 3, 2e-2);
  close(r2.values['T!C1'], 130 / 3, 2e-2);
});
