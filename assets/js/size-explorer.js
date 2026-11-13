/* Prostate size explorer (prostate-size-chart.html).
   A slider from 15 to 300 cc. The drawing is to scale (the gland drawn as a ball of the same
   volume), and the words beside it are read from the chart table on the same page, so the
   table stays the single source: edit a table row and the explorer follows.
   With scripts off the explorer stays hidden and the table is the chart. */
(function () {
  'use strict';
  var d = document;
  var box = d.getElementById('explorer');
  var sec = box && box.closest('section');
  var table = sec && sec.querySelector('table.cmp');
  if (!box || !table) return;

  /* rows of the chart, in order; LIMITS are the upper edges of the first four rows */
  var LIMITS = [25, 40, 80, 150];
  var rows = [].slice.call(table.querySelectorAll('tbody tr')).map(function (tr) {
    var c = tr.children;
    return {
      range: (c[0].textContent || '').trim(),
      like: (c[1].textContent || '').trim(),
      means: (c[2].textContent || '').trim(),
      fit: (c[3].textContent || '').trim()
    };
  });
  if (rows.length !== LIMITS.length + 1) return;

  var MIN = 15, MAX = 300, STEPS = 1000;
  var PX_PER_CM = 36;        /* drawing units per cm: the 5 cm bar is 180 of the 400 units */
  var SHAPE_W = 0.9616;      /* the outline path is this wide at scale 1, measured in the browser */
  var range = d.getElementById('xp-range'), num = d.getElementById('xp-in');
  var vOut = d.getElementById('xp-v'), sub = d.getElementById('xp-sub'), like = d.getElementById('xp-like');
  var band = d.getElementById('xp-band'), means = d.getElementById('xp-means'), fit = d.getElementById('xp-fit');
  var gland = box.querySelector('.xp-gland'), bladder = box.querySelector('.xp-bladder');
  var chips = [].slice.call(box.querySelectorAll('.xp-chip'));
  var ticks = box.querySelector('.xp-ticks');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toPos(v) { return Math.round(STEPS * Math.log(v / MIN) / Math.log(MAX / MIN)); }
  function toVol(p) { return Math.round(MIN * Math.pow(MAX / MIN, p / STEPS)); }
  function across(v) { return Math.pow(6 * v / Math.PI, 1 / 3); }           /* cm, ball of volume v */
  function rowFor(v) { for (var i = 0; i < LIMITS.length; i++) if (v < LIMITS[i]) return i; return LIMITS.length; }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function likeText(s) {                       /* "A golf ball to an apricot" reads better as a range */
    var parts = s.split(' to ');
    if (parts.length === 2) return 'Between ' + lowerFirst(parts[0]) + ' and ' + parts[1];
    return 'About the size of ' + lowerFirst(s);
  }

  /* tick marks under the slider at the chart's own boundaries */
  [MIN].concat(LIMITS, [MAX]).forEach(function (v) {
    var s = d.createElement('span');
    s.textContent = v;
    s.style.left = (toPos(v) / STEPS * 100) + '%';
    ticks.appendChild(s);
  });

  var used = false, lastRow = -1;
  function render(v, from) {
    v = Math.max(MIN, Math.min(MAX, Math.round(v)));
    var cm = across(v), i = rowFor(v), r = rows[i];
    vOut.textContent = v;
    sub.textContent = 'About ' + v + ' grams · roughly ' + cm.toFixed(1) + ' cm (' + (cm / 2.54).toFixed(1) + ' in) across';
    if (from !== 'range') range.value = toPos(v);
    if (from !== 'num') num.value = v;
    range.style.setProperty('--pf', (range.value / STEPS).toFixed(4));
    range.setAttribute('aria-valuetext', v + ' cc, ' + lowerFirst(likeText(r.like)));
    var s = cm * PX_PER_CM / SHAPE_W;
    gland.style.transform = 'translate(200px,200px) scale(' + s.toFixed(2) + ')';
    if (bladder) bladder.style.transform = 'translate(0,' + (-0.42 * s).toFixed(1) + 'px)';
    if (i !== lastRow) {
      lastRow = i;
      like.textContent = likeText(r.like);
      band.textContent = r.range;
      means.textContent = r.means;
      fit.textContent = r.fit;
      var text = r.fit.toLowerCase();
      chips.forEach(function (c) { c.classList.toggle('on', text.indexOf(c.getAttribute('data-t')) !== -1); });
      box.setAttribute('data-row', i);
    }
    if (from && !used) {
      used = true;
      try { if (typeof window.plausible === 'function') window.plausible('Size explorer used'); } catch (e) {}
    }
  }

  range.min = 0; range.max = STEPS; range.step = 1;
  range.addEventListener('input', function () { render(toVol(parseInt(range.value, 10)), 'range'); });
  num.addEventListener('input', function () {
    var v = parseFloat(num.value);
    if (v >= MIN && v <= MAX) render(v, 'num');
  });
  num.addEventListener('change', function () {
    var v = parseFloat(num.value);
    render(v > 0 ? v : 50);
  });

  /* phones: the full table sits behind a button, since the explorer says the same thing */
  var more = d.getElementById('xp-more');
  if (more) {
    more.addEventListener('click', function () {
      var open = sec.classList.toggle('xp-table-open');
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      more.firstChild.textContent = open ? 'Hide the full chart ' : 'See the full chart ';
    });
  }

  if (reduce) box.classList.add('xp-still');
  box.hidden = false;
  sec.classList.add('xp-on');
  render(50);
})();
