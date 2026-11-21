/*!
 * Sauna Heater Size Calculator — sizing logic
 * (c) 2026 DIVELUX Inc. MIT License. https://diveluxsaunahat.com
 *
 * Pure functions, no DOM. Works in the browser (window.SaunaHeater) and in
 * Node (require('./heater.js')).
 *
 * WHERE THE NUMBERS COME FROM
 * Every figure below is taken from a heater manufacturer's own published
 * sizing guidance. Nothing here is measured or invented by us.
 *
 * 1. Power per volume. "An average of 1 kW of heater power is required for
 *    each cubic meter of sauna volume (1 m³ = 1 kW)." Harvia support,
 *    "How do I select the correct heater power?". HUUM says the same:
 *    "One calculated cubic meter presumes one kilowatt of the heater's power."
 * 2. Uninsulated surfaces. Harvia: one square meter of stone, glass or a
 *    similar non-insulated surface counts like 1.2 m³ of extra room volume
 *    (support article and heater manuals, e.g. the L30 manual: "Add 1,2 m³
 *    to the volume of the sauna for each non-insulated wall square meter").
 *    HUUM uses 1 m³ per m² (huum.eu sizing article and the DROP manual).
 *    A North American "Sizing Your HUUM" sheet uses 4.92 cu ft per sq ft,
 *    which is 1.5 m³ per m². We calculate with Harvia's 1.2 and show the
 *    other two next to it.
 * 3. Log walls. Harvia: "If the sauna room has log walls, multiply the
 *    sauna's volume by 1,5" (L30 manual; same factor in the support articles).
 * 4. The lower end of the power range. Harvia's own worked example sizes a
 *    room with a calculated volume of about 8.5 m³ at "a minimum output of
 *    6 kW", which is 0.71 kW per m³. That is the same ratio as the shortcut
 *    many North American retailers quote, 1 kW per 50 cubic feet
 *    (50 cu ft = 1.416 m³). So the range shown is:
 *      low  = calculated volume / 1.416   (1 kW per 50 cu ft)
 *      high = calculated volume x 1       (1 kW per m³)
 * 5. Wood-burning stoves are sold by the room volume they suit (a min-max
 *    range in m³), not by electrical kW. Harvia's guide for wood stoves uses
 *    the same calculated volume (1.2 per m², log x 1.5), so for a wood stove
 *    we return the volume only.
 *
 * A calculator cannot see your room. Always confirm the size with the heater
 * manufacturer and have a licensed electrician check the circuit.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SaunaHeater = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var M_PER_FT = 0.3048;
  var CUFT_PER_M3 = 35.3147;
  var SQFT_PER_M2 = 10.7639;

  var KW_PER_M3 = 1;            // Harvia, HUUM: 1 m³ = 1 kW
  var CUFT_PER_KW_LOOSE = 50;   // retail shortcut; equals Harvia's 8.5 m³ -> min 6 kW example
  var LOG_FACTOR = 1.5;         // Harvia: log walls, multiply the volume by 1.5
  var SURFACE_M3_PER_M2 = {     // extra volume per m² of uninsulated surface
    harvia: 1.2,
    huum: 1.0,
    huumNA: 1.5
  };

  /* Accepted input, in meters. Outside this the tool asks you to check the number. */
  var LIMITS = {
    side: { min: 0.9, max: 6 },      // length and width: 3 ft to about 19 ft 8 in
    height: { min: 1.7, max: 3 },    // 5 ft 7 in to 9 ft 10 in
    area: { min: 0, max: 40 }        // m² of glass or masonry
  };
  var DEFAULTS = {
    unit: 'ft', length: 1.8288, width: 1.524, height: 2.1336, // 6 ft x 5 ft x 7 ft
    glass: 1.1148,                                             // 12 sq ft: a 2 ft x 6 ft glass door
    masonry: 0, log: false, heater: 'electric'
  };

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function round(v, digits) {
    var p = Math.pow(10, digits || 0);
    return Math.round(v * p) / p;
  }
  function ftInToM(ft, inches) { return (num(ft) || 0) * M_PER_FT + (num(inches) || 0) * M_PER_FT / 12; }
  function mToFtIn(m) {
    var total = Math.round(m / M_PER_FT * 12); // whole inches
    return { ft: Math.floor(total / 12), in: total % 12 };
  }
  function sqftToM2(a) { return num(a) / SQFT_PER_M2; }
  function m2ToSqft(a) { return a * SQFT_PER_M2; }
  function m3ToCuft(v) { return v * CUFT_PER_M3; }

  /*
   * input, all lengths in meters and areas in m²:
   *   { length, width, height, glass, masonry, log: boolean, heater: 'electric' | 'wood' }
   * Returns { ok: false, errors: {field: message} } or the full result.
   */
  function calc(input) {
    input = input || {};
    var errors = {};
    var L = num(input.length), W = num(input.width), H = num(input.height);
    var glass = input.glass === '' || input.glass == null ? 0 : num(input.glass);
    var masonry = input.masonry === '' || input.masonry == null ? 0 : num(input.masonry);
    var log = !!input.log;
    var heater = input.heater === 'wood' ? 'wood' : 'electric';

    function side(v, key, label) {
      if (isNaN(v)) errors[key] = 'Enter the ' + label + '.';
      else if (v < LIMITS.side.min - 1e-9 || v > LIMITS.side.max + 1e-9) errors[key] = 'Check the ' + label + ': this tool covers rooms from 3 ft to 19 ft 8 in (0.9 to 6 m) a side.';
    }
    side(L, 'length', 'length');
    side(W, 'width', 'width');
    if (isNaN(H)) errors.height = 'Enter the height.';
    else if (H < LIMITS.height.min - 1e-9 || H > LIMITS.height.max + 1e-9) errors.height = 'Check the height: this tool covers ceilings from 5 ft 7 in to 9 ft 10 in (1.7 to 3 m).';
    if (isNaN(glass) || glass < 0 || glass > LIMITS.area.max) errors.glass = 'Check the glass area.';
    if (isNaN(masonry) || masonry < 0 || masonry > LIMITS.area.max) errors.masonry = 'Check the stone, tile or brick area.';

    if (!errors.length && !errors.width && !errors.height && !errors.glass && !errors.masonry) {
      // All six faces of the room: nothing can be more uninsulated than that.
      var faces = 2 * (L * W + L * H + W * H);
      if (glass + masonry > faces + 1e-9) {
        errors.glass = 'Glass plus stone is more than the whole surface of this room. Check the areas.';
      }
    }
    for (var k in errors) { if (Object.prototype.hasOwnProperty.call(errors, k)) return { ok: false, errors: errors }; }

    var volume = L * W * H;
    var surface = glass + masonry;
    var base = volume * (log ? LOG_FACTOR : 1);
    var calcVolume = base + surface * SURFACE_M3_PER_M2.harvia;

    var byRule = {
      harvia: calcVolume,
      // HUUM counts log walls as uninsulated surface by area, not with a factor,
      // so we do not guess a HUUM figure for a log room.
      huum: log ? null : volume + surface * SURFACE_M3_PER_M2.huum,
      huumNA: log ? null : volume + surface * SURFACE_M3_PER_M2.huumNA
    };

    var kwHigh = calcVolume * KW_PER_M3;
    var kwLow = m3ToCuft(calcVolume) / CUFT_PER_KW_LOOSE;

    var notes = [];
    if (surface > 0 && surface * SURFACE_M3_PER_M2.harvia / calcVolume >= 0.3) {
      notes.push('Glass and stone make up ' + Math.round(surface * SURFACE_M3_PER_M2.harvia / calcVolume * 100) +
        '% of the calculated volume. With this much uninsulated surface, ask the manufacturer before you buy.');
    }
    if (log) notes.push('Bare log walls soak up heat, so the room volume is multiplied by 1.5 (Harvia).');
    if (H > 2.3 + 1e-9) notes.push('A tall ceiling adds air to heat. Every extra foot of height adds ' +
      round(m3ToCuft(L * W * M_PER_FT), 0) + ' cu ft to this room.');

    return {
      ok: true,
      input: { length: L, width: W, height: H, glass: glass, masonry: masonry, log: log, heater: heater },
      volumeM3: round(volume, 2),
      volumeCuFt: round(m3ToCuft(volume), 0),
      surfaceM2: round(surface, 2),
      surfaceSqFt: round(m2ToSqft(surface), 1),
      logFactor: log ? LOG_FACTOR : 1,
      extraM3: round(surface * SURFACE_M3_PER_M2.harvia, 1),
      extraCuFt: round(m3ToCuft(surface * SURFACE_M3_PER_M2.harvia), 0),
      calcVolumeM3: round(calcVolume, 1),
      calcVolumeCuFt: round(m3ToCuft(calcVolume), 0),
      byRule: {
        harvia: round(byRule.harvia, 1),
        huum: byRule.huum == null ? null : round(byRule.huum, 1),
        huumNA: byRule.huumNA == null ? null : round(byRule.huumNA, 1)
      },
      byRuleCuFt: {
        harvia: round(m3ToCuft(byRule.harvia), 0),
        huum: byRule.huum == null ? null : round(m3ToCuft(byRule.huum), 0),
        huumNA: byRule.huumNA == null ? null : round(m3ToCuft(byRule.huumNA), 0)
      },
      // Power is only meaningful for electric heaters; wood stoves are chosen by volume.
      kw: heater === 'electric' ? { low: round(kwLow, 1), high: round(kwHigh, 1) } : null,
      notes: notes
    };
  }

  /* Shareable address: lengths in meters with 4 decimals so feet and inches survive the round trip. */
  function toQuery(o) {
    var r4 = function (v) { return String(round(num(v) || 0, 4)); };
    return 'u=' + (o.unit === 'm' ? 'm' : 'ft') + '&l=' + r4(o.length) + '&w=' + r4(o.width) + '&h=' + r4(o.height) +
      '&glass=' + r4(o.glass) + '&stone=' + r4(o.masonry) + '&log=' + (o.log ? 1 : 0) +
      '&heater=' + (o.heater === 'wood' ? 'wood' : 'electric');
  }
  function fromQuery(search) {
    var out = {};
    String(search || '').replace(/^[?#]/, '').split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i < 1) return;
      var k = pair.slice(0, i), v;
      try { v = decodeURIComponent(pair.slice(i + 1)); } catch (e) { return; }
      if (k === 'u') out.unit = v === 'm' ? 'm' : 'ft';
      else if (k === 'l' && isFinite(num(v))) out.length = num(v);
      else if (k === 'w' && isFinite(num(v))) out.width = num(v);
      else if (k === 'h' && isFinite(num(v))) out.height = num(v);
      else if (k === 'glass' && isFinite(num(v))) out.glass = Math.max(0, num(v));
      else if (k === 'stone' && isFinite(num(v))) out.masonry = Math.max(0, num(v));
      else if (k === 'log') out.log = v === '1';
      else if (k === 'heater') out.heater = v === 'wood' ? 'wood' : 'electric';
    });
    return out;
  }

  return {
    M_PER_FT: M_PER_FT, CUFT_PER_M3: CUFT_PER_M3, SQFT_PER_M2: SQFT_PER_M2,
    KW_PER_M3: KW_PER_M3, CUFT_PER_KW_LOOSE: CUFT_PER_KW_LOOSE, LOG_FACTOR: LOG_FACTOR,
    SURFACE_M3_PER_M2: SURFACE_M3_PER_M2, LIMITS: LIMITS, DEFAULTS: DEFAULTS,
    num: num, round: round, ftInToM: ftInToM, mToFtIn: mToFtIn,
    sqftToM2: sqftToM2, m2ToSqft: m2ToSqft, m3ToCuft: m3ToCuft,
    calc: calc, toQuery: toQuery, fromQuery: fromQuery
  };
});
