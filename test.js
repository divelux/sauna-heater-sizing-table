/* Checks that the published table and data match heater.js. Run: node test.js */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./heater.js');
const B = require('./build.js');

let checks = 0; const failures = [];
function ok(c, m) { checks++; if (!c) failures.push(m); }
const dir = __dirname;

/* 1. heater.js is the calculator's file, unchanged (when the sibling folder is there). */
const sib = path.join(dir, '..', 'sauna-heater-calculator', 'heater.js');
if (fs.existsSync(sib)) ok(fs.readFileSync(sib, 'utf8') === fs.readFileSync(path.join(dir, 'heater.js'), 'utf8'), 'heater.js differs from the calculator copy');
ok(H.KW_PER_M3 === 1 && H.SURFACE_M3_PER_M2.harvia === 1.2 && H.SURFACE_M3_PER_M2.huum === 1 && H.SURFACE_M3_PER_M2.huumNA === 1.5 && H.LOG_FACTOR === 1.5 && H.CUFT_PER_KW_LOOSE === 50, 'published constants');

/* 2. The JSON and CSV are exactly what build.js computes now. */
const fresh = B.rows();
const json = JSON.parse(fs.readFileSync(path.join(dir, 'sauna_heater_sizing.json'), 'utf8'));
ok(JSON.stringify(json.rows) === JSON.stringify(fresh), 'JSON rows are stale: run node build.js');
ok(fs.readFileSync(path.join(dir, 'sauna_heater_sizing.csv'), 'utf8') === B.csv(fresh), 'CSV is stale: run node build.js');
ok(fresh.length === 28 * 5 * 2, 'row count ' + fresh.length);
ok(json.columns.map((c) => c.name).join() === Object.keys(fresh[0]).join(), 'column list matches row keys');

/* 3. Independent arithmetic: every row by hand from the published rules. */
const r1 = (v) => Math.round(v * 10) / 10;
for (const r of fresh) {
  const calc = r.room_volume_m3 * (r.log_walls ? 1.5 : 1) + 1.2 * r.uninsulated_area_m2;
  ok(r.harvia_calc_volume_m3 === r1(calc), 'harvia volume ' + JSON.stringify(r));
  ok(r.kw_high === r1(calc * 1), 'kw_high ' + r.room_volume_m3 + '/' + r.uninsulated_area_m2);
  ok(r.kw_low === r1(calc * 35.3147 / 50), 'kw_low ' + r.room_volume_m3 + '/' + r.uninsulated_area_m2);
  ok(r.kw_low < r.kw_high, 'low below high');
  ok(r.room_volume_cuft === Math.round(r.room_volume_m3 * 35.3147), 'cu ft');
  if (r.log_walls) ok(r.huum_kw === null && r.huum_na_kw === null, 'no HUUM figure for log rooms');
  else {
    ok(r.huum_kw === r1(r.room_volume_m3 + r.uninsulated_area_m2), 'huum ' + r.room_volume_m3);
    ok(r.huum_na_kw === r1(r.room_volume_m3 + 1.5 * r.uninsulated_area_m2), 'huum NA ' + r.room_volume_m3);
  }
  if (r.uninsulated_area_m2 === 0 && !r.log_walls) ok(r.huum_kw === r.kw_high && r.huum_na_kw === r.kw_high, 'rules agree with no glass');
}

/* 4. Spot values from the calculator's own tests and Harvia's examples. */
const at = (v, a, log) => fresh.find((r) => r.room_volume_m3 === v && r.uninsulated_area_m2 === a && r.log_walls === log);
ok(at(10, 0, true).harvia_calc_volume_m3 === 15, 'Harvia: 10 m3 log room ~ 15 m3');
ok(at(10, 2, false).harvia_calc_volume_m3 === 12.4, '10 m3 + 2 m2 glass = 12.4 m3');
ok(at(6, 0, false).kw_low === 4.2 && at(6, 0, false).kw_high === 6, '6 m3: 4.2-6.0 kW');

/* 5. The printed tables in index.html show the same cells. */
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
for (const log of [false, true]) {
  const name = log ? 'log' : 'main';
  const block = html.split('<!--TABLE:' + name + '-->')[1].split('<!--/TABLE:' + name + '-->')[0];
  const trs = block.split('\n').filter((l) => l.startsWith('<tr><th scope="row">'));
  ok(trs.length === 28, name + ' table has ' + trs.length + ' rows');
  trs.forEach((tr, i) => {
    const v = 3 + i;
    const cells = tr.match(/<td>([^<]*)<\/td>/g).map((c) => c.slice(4, -5));
    ok(cells[0] === String(at(v, 0, log).room_volume_cuft), name + ' cu ft ' + v);
    B.AREAS.forEach((a, j) => { const r = at(v, a, log); ok(cells[j + 1] === fmt(r.kw_low) + '–' + fmt(r.kw_high), name + ' cell ' + v + '/' + a); });
  });
}
ok((html.match(/<h1[\s>]/g) || []).length === 1, 'one h1');
for (const u of ['support.harvia.com', 'huum.eu/how-to-dimension', 'Sizing-Your-HUUM', 'saunaplace.com']) ok(html.includes(u), 'source ' + u);
ok(html.includes('https://diveluxsaunahat.com/pages/sauna-tools'), 'tools hub link');

if (failures.length) { console.error(failures.length + ' of ' + checks + ' checks failed:\n' + failures.slice(0, 20).join('\n')); process.exit(1); }
console.log('All ' + checks + ' checks passed.');
