/*
 * Sauna Heater Size Table — generator
 * (c) 2026 DIVELUX Inc. Code: MIT. Data it writes: CC BY 4.0.
 *
 * Builds the dataset and the printable tables from heater.js, the sizing
 * logic of the Sauna Heater Size Calculator
 * (https://divelux.github.io/sauna-heater-calculator/). No rule is added here:
 * every number is heater.js calc() output.
 *
 * Run: node build.js   (writes the CSV, the JSON and the tables in index.html)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./heater.js');

const VOLUMES = [];
for (let v = 3; v <= 30; v++) VOLUMES.push(v);
const AREAS = [0, 1, 2, 3, 4];          // m² of uninsulated glass, stone, tile or brick
const HEIGHT = 2.1;                     // m; any height works, the volume is what counts

/* A square room of the given volume. heater.js only needs L x W x H. */
function room(volume, area, log) {
  const side = Math.sqrt(volume / HEIGHT);
  return H.calc({ length: side, width: side, height: HEIGHT, glass: area, masonry: 0, log: log, heater: 'electric' });
}

function rows() {
  const out = [];
  for (const log of [false, true]) for (const v of VOLUMES) for (const a of AREAS) {
    const r = room(v, a, log);
    if (!r.ok) throw new Error('heater.js refused ' + v + ' m3, ' + a + ' m2: ' + JSON.stringify(r.errors));
    out.push({
      room_volume_m3: r.volumeM3,
      room_volume_cuft: r.volumeCuFt,
      uninsulated_area_m2: a,
      uninsulated_area_sqft: H.round(H.m2ToSqft(a), 1),
      log_walls: log,
      harvia_calc_volume_m3: r.byRule.harvia,
      harvia_calc_volume_cuft: r.byRuleCuFt.harvia,
      kw_low: r.kw.low,
      kw_high: r.kw.high,
      huum_calc_volume_m3: r.byRule.huum,
      huum_kw: r.byRule.huum == null ? null : H.round(r.byRule.huum * H.KW_PER_M3, 1),
      huum_na_calc_volume_m3: r.byRule.huumNA,
      huum_na_kw: r.byRule.huumNA == null ? null : H.round(r.byRule.huumNA * H.KW_PER_M3, 1)
    });
  }
  return out;
}

const COLUMNS = [
  ['room_volume_m3', 'number', 'Room volume, length x width x height inside, in m³. Rows run 3 to 30.'],
  ['room_volume_cuft', 'integer', 'The same volume in cubic feet (1 m³ = 35.3147 cu ft), rounded.'],
  ['uninsulated_area_m2', 'number', 'Area of glass, stone, tile, brick or concrete with no insulation behind it, m²: 0, 1, 2, 3 or 4.'],
  ['uninsulated_area_sqft', 'number', 'The same area in square feet (1 m² = 10.7639 sq ft).'],
  ['log_walls', 'boolean', 'true if the inside walls are bare log (Harvia: room volume x 1.5).'],
  ['harvia_calc_volume_m3', 'number', 'Calculated volume by Harvia: room volume (x 1.5 for log) + 1.2 m³ per m² of uninsulated area.'],
  ['harvia_calc_volume_cuft', 'integer', 'The same in cubic feet.'],
  ['kw_low', 'number', 'Low end of the electric heater power: 1 kW per 50 cu ft of Harvia calculated volume (retail shortcut, matches Harvia\'s 8.5 m³ example).'],
  ['kw_high', 'number', 'High end: 1 kW per m³ of Harvia calculated volume (Harvia and HUUM average).'],
  ['huum_calc_volume_m3', 'number or null', 'Calculated volume by HUUM: room volume + 1 m³ per m² of uninsulated area. Null for log walls (HUUM uses area, not a factor).'],
  ['huum_kw', 'number or null', 'HUUM rule: 1 kW per calculated m³.'],
  ['huum_na_calc_volume_m3', 'number or null', 'Calculated volume by the North American "Sizing Your HUUM" sheet: 4.92 cu ft per sq ft (1.5 m³ per m²). Null for log walls.'],
  ['huum_na_kw', 'number or null', 'The same at 1 kW per calculated m³.']
];

function csv(data) {
  const head = COLUMNS.map((c) => c[0]);
  const cell = (v) => (v == null ? '' : String(v));
  return [head.join(',')].concat(data.map((r) => head.map((k) => cell(r[k])).join(','))).join('\n') + '\n';
}

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* One printable table: rows are volumes, columns are glass areas. */
function tableHtml(data, log, caption) {
  const head = '<tr><th scope="col">Room</th><th scope="col">cu ft</th>' + AREAS.map((a) => '<th scope="col">' +
    (a === 0 ? 'No glass or stone' : a + ' m² <span>(' + Math.round(H.m2ToSqft(a)) + ' sq ft)</span>') + '</th>').join('') + '</tr>';
  const body = VOLUMES.map((v) => {
    const cells = AREAS.map((a) => {
      const r = data.find((x) => x.room_volume_m3 === v && x.uninsulated_area_m2 === a && x.log_walls === log);
      return '<td>' + fmt(r.kw_low) + '–' + fmt(r.kw_high) + '</td>';
    }).join('');
    const r0 = data.find((x) => x.room_volume_m3 === v && x.uninsulated_area_m2 === 0 && x.log_walls === log);
    return '<tr><th scope="row">' + v + ' m³</th><td>' + r0.room_volume_cuft + '</td>' + cells + '</tr>';
  }).join('\n');
  return '<table class="shs-t">\n<caption>' + caption + '</caption>\n<thead>' + head + '</thead>\n<tbody>\n' + body + '\n</tbody>\n</table>';
}

function inject(html, name, fragment) {
  const re = new RegExp('(<!--TABLE:' + name + '-->)[\\s\\S]*?(<!--/TABLE:' + name + '-->)');
  if (!re.test(html)) throw new Error('marker ' + name + ' missing');
  return html.replace(re, '$1\n' + fragment + '\n$2');
}

if (require.main === module) {
  const data = rows();
  const dir = __dirname;
  fs.writeFileSync(path.join(dir, 'sauna_heater_sizing.csv'), csv(data));
  fs.writeFileSync(path.join(dir, 'sauna_heater_sizing.json'), JSON.stringify({
    name: 'Sauna Heater Size Table',
    version: '1.0',
    publisher: 'DIVELUX Inc.',
    url: 'https://diveluxsaunahat.com/pages/sauna-tools',
    license: 'CC-BY-4.0',
    generated_by: 'build.js from heater.js (Sauna Heater Size Calculator, MIT)',
    caution: 'Rule-of-thumb sizing from heater makers\' published rules. Always confirm with the heater manufacturer and a licensed electrician.',
    columns: COLUMNS.map((c) => ({ name: c[0], type: c[1], description: c[2] })),
    rows: data
  }, null, 1) + '\n');
  const p = path.join(dir, 'index.html');
  let html = fs.readFileSync(p, 'utf8');
  html = inject(html, 'main', tableHtml(data, false, 'Electric heater power in kW, low to high, for insulated walls. Columns add uninsulated glass, stone, tile or brick (Harvia rule, 1.2 m³ per m²).'));
  html = inject(html, 'log', tableHtml(data, true, 'The same for bare log walls: room volume × 1.5 (Harvia), plus the glass and stone.'));
  fs.writeFileSync(p, html);
  console.log('wrote ' + data.length + ' rows, 2 tables');
}

module.exports = { VOLUMES, AREAS, HEIGHT, COLUMNS, rows, room, csv };
