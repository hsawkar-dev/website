/* Animated "How it works" explainers for Aquablation, UroLift and Rezum
   (aquablation.html, urolift.html, rezum.html; the page names which one in data-explainer).
   All three use one picture, the site's wireframe art of an enlarged prostate seen from the front
   (assets/img/bph-plate.webp). Everything that moves is drawn on top of it, a slow camera move frames
   each step, and the lobes move by warping the picture itself. Aquablation also has a second picture,
   the same view after treatment (assets/img/bph-plate-cleared.webp, which carries its own mask): it shows
   above the waterjet as the jet travels, so the cleared tissue is real art and not a dark fill.
   The four step cards on the page are the script; nothing is restated here.
   Each explainer plays once when it scrolls into view and then stops. Tapping a step, or swiping the
   cards on a phone, shows that step. With reduced motion each step shows its end state.
   With scripts off the stage stays hidden and the page shows the four steps as before.
   The numbers of implants and bursts, and the size of every movement, are illustrative.
   If a plate is replaced, the geometry below (midline, edge of the cleared space) must be measured again.
   The PAE page has its own script (pae-explainer.js); the two share the .px- styles. */
(function () {
  'use strict';
  var d = document;
  var wrap = d.getElementById('explainer');
  if (!wrap) return;
  var stage = wrap.querySelector('.px-stage');
  var flow = wrap.querySelector('.flow');
  var steps = flow ? [].slice.call(flow.querySelectorAll('.flow-step')) : [];
  var world = stage && stage.querySelector('.px-world');
  var canvas = stage && stage.querySelector('.px-plate');
  var svg = stage && stage.querySelector('.px-over');
  var again = stage && stage.querySelector('.px-again');
  if (!stage || !world || !canvas || !svg || !again) return;

  /* ---------- small helpers ---------- */
  function io(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function out(p) { return 1 - Math.pow(1 - p, 3); }
  function lin(p) { return p; }
  function mix(a, b, p) { return a + (b - a) * p; }
  function seg(p, a, b) { return Math.max(0, Math.min(1, (p - a) / (b - a))); }      /* the part of 0..1 that falls between a and b */
  function camTo(a, b) { return function (S, p) { S.cam = a.map(function (v, i) { return v + (b[i] - v) * p; }); }; }

  /* ---------- the front-view plate: its geometry, and the parts all three share ----------
     All coordinates are plate pixels (the plate is 1024 x 1024). The urethra runs down x = 512. */
  var CAM = { wide: [-128, 0, 1152, 1024], mid: [112, 170, 912, 810], close: [152, 232, 872, 808] };   /* [x0, y0, x1, y1], all 5:4 like the stage */
  /* opens a channel along the urethra: extra half-width on the left and on the right */
  function spread(aL, aR) { return { kind: 'spread', x: 512, y: 545, w: 250, h: 240, h0: 8, a: aL, aR: aR }; }
  /* a slim scope coming up the urethra; tipY is where its tip sits */
  var SCOPE_SVG = '<g class="ex-scope"><line stroke="#8FD6FF" stroke-opacity=".55" stroke-width="20" filter="url(#ex-soft)"/>' +
    '<line stroke="#CFE9FF" stroke-width="10"/><line stroke="#fff" stroke-width="2.4"/></g>';
  function drawScope(api, tipY, on) {
    api.q('.ex-scope').style.opacity = on ? 1 : 0;
    api.qa('.ex-scope line').forEach(function (l, i) {
      var x = 512 + (i === 2 ? -2.2 : 0);
      api.set(l, { x1: x, x2: x, y1: 1060, y2: tipY });
    });
  }
  /* the opened channel reads as a darker passage, like the urethra below the prostate */
  var LUMEN_SVG = '<path class="ex-lumen" fill="#050B22" filter="url(#ex-softer)"/>';
  function drawLumen(api, open) {
    var L = [], R = [], y;
    for (y = 356; y <= 760; y += 28) {
      var a = api.fwd(503, y)[0] + 12, b = api.fwd(521, y)[0] - 12;
      if (a > 510) a = 510; if (b < 514) b = 514;
      L.push(a.toFixed(1) + ' ' + y); R.unshift(b.toFixed(1) + ' ' + y);
    }
    var el = api.q('.ex-lumen');
    el.setAttribute('d', 'M512 340L' + L.join('L') + 'L512 776L' + R.join('L') + 'Z');
    el.style.opacity = Math.max(0, Math.min(0.7, (open - 6) / 28 * 0.7)).toFixed(3);
  }
  /* the pulsing ring that marks the squeezed spot in step 1 */
  var RING_SVG = '<circle class="ex-ring" cx="512" cy="540" stroke="#fff"/>';
  function drawRing(api, p) {
    var r = api.q('.ex-ring');
    if (p > 0 && p < 1) { var ph = (p * 2) % 1; api.set(r, { r: api.px(8 + 34 * ph), 'stroke-width': api.px(1.6) }); r.style.opacity = (1 - ph).toFixed(3); }
    else r.style.opacity = 0;
  }
  var BASE_LABELS = [
    { t: 'Bladder', x: 512, y: 165 },
    { t: 'Prostate', x: 512, y: 838 },
    { t: 'Squeezed urethra', x: 478, y: 540, side: 'r', on: function (S, n) { return n === 1; } }
  ];

  /* ---------- the three procedures ----------
     Each gives: what is drawn over the plate (svg), its labels, a starting state, the four steps as timed
     changes to that state ([start ms, length ms, easing, what changes]), and how to draw a state. */
  var MAKE = {

    /* Aquablation: the handpiece goes up the urethra, the tissue to remove is outlined, then one waterjet clears it
       from the bladder neck down. The rectal ultrasound probe and the catheter are left out of the drawing. */
    aquablation: function () {
      /* the edge of the cleared space on the second plate: [height, left x, right x] */
      var RIM = [[318, 451, 570], [330, 452, 570], [342, 445, 577], [354, 422, 600], [366, 395, 628], [378, 375, 647], [390, 363, 660], [402, 354, 669],
        [414, 348, 675], [426, 344, 678], [438, 342, 681], [450, 340, 682], [462, 340, 683], [474, 339, 683], [486, 341, 682], [498, 343, 680],
        [510, 345, 678], [522, 348, 674], [534, 353, 670], [546, 357, 666], [558, 363, 660], [570, 369, 654], [582, 376, 647], [594, 383, 639],
        [606, 392, 631], [618, 401, 622], [630, 410, 612], [642, 420, 603], [654, 429, 593], [666, 439, 583], [678, 447, 575], [690, 456, 567],
        [702, 462, 560], [714, 468, 555], [726, 472, 551], [738, 474, 549], [750, 477, 545], [762, 479, 541], [774, 479, 543]];
      function rim(y) {                         /* left and right edge of the cleared space at a height */
        var i = Math.max(0, Math.min(RIM.length - 2, Math.floor((y - 318) / 12))), a = RIM[i], b = RIM[i + 1];
        var t = Math.max(0, Math.min(1, (y - a[0]) / 12));
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
      var TOP = 342, BOT = 750;                 /* the outline runs from the bladder neck to just short of the tip of the prostate */
      var NZ0 = 322, NZ1 = 760;                 /* how far the nozzle travels */
      var TIP = 296;                            /* the handpiece's tip rests just inside the bladder */
      /* the tissue to remove, as one smooth closed outline: down the left edge, back up the right */
      var corners = [];
      RIM.forEach(function (r) { if (r[0] >= TOP && r[0] <= BOT) corners.push([r[1], r[0]]); });
      RIM.slice().reverse().forEach(function (r) { if (r[0] >= TOP && r[0] <= BOT) corners.push([r[2], r[0]]); });
      var mids = corners.map(function (p, i) { var q = corners[(i + 1) % corners.length]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
      var last = mids[mids.length - 1];
      var dPath = 'M' + last[0].toFixed(1) + ' ' + last[1].toFixed(1) +
        corners.map(function (c, i) { return 'Q' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ' ' + mids[i][0].toFixed(1) + ' ' + mids[i][1].toFixed(1); }).join('') + 'Z';
      var NODES = 14, BITS = 12, DASHES = 12, i, nodeAt = null, over =
        '<defs><linearGradient id="ex-scan-fade" gradientUnits="userSpaceOnUse" x1="226" y1="0" x2="798" y2="0">' +
        '<stop offset="0" stop-color="#9BE7FF" stop-opacity="0"/><stop offset=".2" stop-color="#9BE7FF"/><stop offset=".8" stop-color="#9BE7FF"/><stop offset="1" stop-color="#9BE7FF" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="ex-ahead"><rect class="ex-ahead" x="0" y="0" width="1024" height="1024"/></clipPath></defs>' +
        '<g class="ex-scan"><line x1="226" x2="798" stroke="url(#ex-scan-fade)" stroke-opacity=".8" stroke-width="22" filter="url(#ex-softer)"/>' +
        '<line x1="226" x2="798" stroke="url(#ex-scan-fade)" stroke-width="2.6"/></g>' +
        '<path class="ex-planfill" d="' + dPath + '" fill="#7FE3FF"/>' +
        '<g clip-path="url(#ex-ahead)"><path class="ex-contour" pathLength="1" d="' + dPath + '" stroke="#7FE3FF" stroke-opacity=".7" stroke-width="7" stroke-dasharray="1" stroke-dashoffset="1" filter="url(#ex-soft)"/>' +
        '<path class="ex-contour" pathLength="1" d="' + dPath + '" stroke="#D9F8FF" stroke-width="2.4" stroke-dasharray="1" stroke-dashoffset="1"/>';
      for (i = 0; i < NODES; i++) over += '<circle class="ex-node" fill="#fff" stroke="#7FE3FF"/>';
      over += '</g>';
      for (i = 0; i < BITS; i++) over += '<circle class="ex-bit" fill="#DDF6FF"/>';
      over += '<g class="ex-jet"><line stroke="#8FD6FF" stroke-opacity=".85" stroke-width="9" filter="url(#ex-soft)"/><line stroke="#fff" stroke-width="2.4"/>' +
        '<circle fill="#DDF6FF" filter="url(#ex-soft)"/></g>';
      for (i = 0; i < DASHES; i++) over += '<line class="ex-flow" stroke="#CFEFFF" stroke-width="3"/>';
      over += SCOPE_SVG + '<circle class="ex-nozzle" cx="512" fill="#fff" stroke="#8FD6FF" stroke-opacity=".7"/>' + RING_SVG;
      return {
        name: 'Aquablation', svg: over,
        plate2: [280, 289, 465, 518],           /* where the second picture sits on the plate: x, y, width, height */
        labels: BASE_LABELS.concat([
          { t: 'Handpiece', x: 532, y: 266, side: 'l', on: function (S, n) { return (n === 2 && S.hand > 0.7) || n === 3; } },
          { t: 'Tissue to remove', x: 176, y: 772, side: 'l', on: function (S, n) { return n === 2 && S.map > 0.3; } },
          { t: 'Waterjet', x: 176, y: 772, side: 'l', on: function (S, n) { return n === 3 && S.jet > 0.5; } },
          { t: 'Open channel', x: 512, y: 452, on: function (S, n) { return n === 4 && S.hand < 0.25; } }
        ]),
        state: function () { return { cam: CAM.wide, ring: 0, hand: 0, tip: 1060, scan: 0, map: 0, plan: 1, jet: 0, cut: 0, clock: 0, flow: 0 }; },
        steps: [
          { len: 3400, tracks: [
            [0, 1900, io, camTo(CAM.wide, CAM.mid)],
            [700, 2400, lin, function (S, p) { S.ring = p; }]] },
          { len: 6200, tracks: [
            [0, 1, lin, function (S) { S.ring = 1; }],
            [0, 2400, io, camTo(CAM.mid, CAM.close)],
            [300, 2300, io, function (S, p) { S.hand = p; S.tip = mix(1060, TIP, p); }],
            [2700, 2700, io, function (S, p) { S.scan = p; }],
            [3100, 2700, io, function (S, p) { S.map = p; }]] },
          { len: 8400, tracks: [
            [0, 500, io, function (S, p) { S.jet = p; S.plan = mix(1, 0.6, p); }],
            [0, 8000, lin, function (S, p) { S.clock = p; }],
            [500, 6800, lin, function (S, p) { S.cut = p; }],
            [7300, 500, io, function (S, p) { S.jet = 1 - p; S.plan = 0.6 * (1 - p); }]] },
          { len: 5600, tracks: [
            [0, 1900, io, function (S, p) { S.hand = 1 - p; S.tip = mix(TIP, 1060, p); }],
            [300, 2300, io, camTo(CAM.close, CAM.mid)],
            [1700, 3700, lin, function (S, p) { S.flow = p; }]] }
        ],
        count: function (S, n) { return n === 2 && S.scan > 0 ? 'Mapping' : n === 3 ? 'Heat-free waterjet' : ''; },
        /* the handpiece parts the lobes a little, until the tissue around it is gone */
        warps: function (S) { var a = 3 * S.hand * (1 - S.cut); return [spread(a, a)]; },
        /* everything above this line shows the treated plate; it leads the nozzle a little more as the pass goes on,
           so the pass starts with nothing cleared and ends with the whole space open */
        reveal: function (S) { return S.cut > 0 ? { y: mix(NZ0, NZ1, S.cut) + mix(-24, 44, S.cut), soft: 12 } : null; },
        draw: function (S, api) {
          drawRing(api, S.ring);
          /* mapping: a scan line passes down the gland while the outline draws itself */
          var sy = mix(312, 752, S.scan);
          api.qa('.ex-scan line').forEach(function (l) { api.set(l, { y1: sy, y2: sy }); });
          api.q('.ex-scan').style.opacity = S.scan > 0 && S.scan < 1 ? Math.pow(Math.sin(Math.PI * S.scan), 0.5).toFixed(3) : 0;
          var contours = api.qa('.ex-contour');
          contours.forEach(function (c) { c.style.strokeDashoffset = (1 - S.map).toFixed(4); c.style.opacity = S.plan; });
          /* once the outline closes, the tissue inside it is tinted; the tint goes as the jet starts */
          api.q('.ex-planfill').style.opacity = (0.24 * seg(S.map, 0.8, 1) * (1 - S.jet) * (S.cut > 0 ? 0 : 1)).toFixed(3);
          if (!nodeAt) { nodeAt = []; for (var k = 0; k < NODES; k++) nodeAt.push(api.at(contours[1], (k + 0.5) / NODES)); }
          api.qa('.ex-node').forEach(function (c, k) {
            api.set(c, { cx: nodeAt[k].x, cy: nodeAt[k].y, r: api.px(3.2), 'stroke-width': api.px(1.6) });
            c.style.opacity = S.map > (k + 0.5) / NODES ? S.plan : 0;
          });
          /* the waterjet: one jet from the nozzle, sweeping from one side of the outline to the other as the nozzle travels down */
          var ny = mix(NZ0, NZ1, S.cut), edge = rim(ny), cutting = S.jet > 0.02 && S.cut > 0 && S.cut < 1;
          api.q('.ex-ahead').setAttribute('y', S.cut > 0 ? (ny + 4).toFixed(1) : 0);      /* the outline shows only where tissue is still to go */
          var sw = Math.sin(S.clock * Math.PI * 2 * 17), reach = sw < 0 ? (512 - edge[0]) : (edge[1] - 512);
          var ex = 512 + sw * (reach - 3), sx = 512 + (sw < 0 ? -6 : 6);
          api.qa('.ex-jet line').forEach(function (l) { api.set(l, { x1: sx, y1: ny, x2: ex, y2: ny }); });
          api.set(api.q('.ex-jet circle'), { cx: ex, cy: ny, r: api.px(6) * (0.4 + 0.6 * Math.abs(sw)) });
          api.q('.ex-jet').style.opacity = cutting ? S.jet : 0;
          /* loosened tissue is carried from the cut edge back to the handpiece */
          api.qa('.ex-bit').forEach(function (c, k) {
            var a = (k * 0.618) % 1, b = (k * 0.377 + 0.2) % 1, ph = (S.clock * 7 + a) % 1, side = k % 2 ? 1 : -1;
            var x0 = 512 + side * ((side < 0 ? 512 - edge[0] : edge[1] - 512) * (0.5 + 0.5 * b)), y0 = ny - 2 - 26 * a;
            var u = Math.pow(ph, 1.4), x = mix(x0, 512 + side * 8, u), y = mix(y0, ny - 4, u) - Math.sin(Math.PI * ph) * 16 * (b - 0.35);
            api.set(c, { cx: x, cy: y, r: api.px(1.3 + 1.5 * b) });
            c.style.opacity = cutting ? (0.9 * S.jet * Math.sin(Math.PI * ph)).toFixed(3) : 0;
          });
          /* handpiece, with the nozzle marked on it */
          drawScope(api, S.tip, S.hand > 0.001);
          var nozzle = api.q('.ex-nozzle');
          api.set(nozzle, { cy: ny, r: api.px(4.2), 'stroke-width': api.px(3) });
          nozzle.style.opacity = S.hand > 0.98 || (S.cut > 0 && S.cut < 1) ? 1 : 0;
          /* afterwards: flow runs through the cleared space, wide where it is wide */
          function lane(y, j) {
            if (y < 318 || y > 774) return 512 + j * 9;
            var e = rim(y); return 512 + j * Math.max(9, Math.min(84, (e[1] - e[0]) * 0.27));
          }
          api.qa('.ex-flow').forEach(function (l, k) {
            var ph = (S.flow * 2.4 + k / DASHES) % 1, y = 300 + ph * 690, j = k % 3 - 1, fade = Math.sin(Math.PI * S.flow) * Math.sin(Math.PI * ph);
            api.set(l, { x1: lane(y, j), y1: y, x2: lane(y + 26, j), y2: y + 26 });
            l.style.opacity = (S.flow > 0 && S.flow < 1 ? 0.75 * fade : 0).toFixed(3);
          });
        }
      };
    },

    /* UroLift: a scope goes up the urethra, four implants (two a side) pull the lobes aside, the channel stays open */
    urolift: function () {
      /* each implant: side (-1 left, 1 right), height, and where the capsule is at that height */
      var IMP = [{ s: -1, y: 455, xc: 204 }, { s: 1, y: 455, xc: 820 }, { s: -1, y: 602, xc: 233 }, { s: 1, y: 602, xc: 791 }];
      var OPEN = 21;                            /* how far each implant opens its side, in plate pixels */
      var DASHES = 7, f, over = LUMEN_SVG + SCOPE_SVG + RING_SVG;
      IMP.forEach(function () {
        over += '<g class="ex-imp"><line class="ex-needle" stroke="#fff" stroke-width="2.2"/><line class="ex-suture" stroke="#9BE7FF" stroke-width="2"/>' +
          '<line class="ex-tab" stroke="#fff" stroke-width="4.5"/><line class="ex-end" stroke="#fff" stroke-width="4.5"/></g>';
      });
      for (f = 0; f < DASHES; f++) over += '<line class="ex-flow" stroke="#CFEFFF" stroke-width="3"/>';
      function implant(i, t0) { return [t0, 1900, lin, function (S, p) { S.imp[i] = p; }]; }      /* one implant's stretch of step 3 */
      return {
        name: 'UroLift', svg: over,
        labels: BASE_LABELS.concat([
          { t: 'Implant', x: 300, y: 418, on: function (S, n) { return n >= 3 && S.imp[0] > 0.5; } },
          { t: 'Open channel', x: 512, y: 700, on: function (S, n) { return n === 4 && S.scope < 0.2; } }
        ]),
        state: function () { return { cam: CAM.wide, ring: 0, scope: 0, tip: 470, imp: [0, 0, 0, 0], flow: 0 }; },
        steps: [
          { len: 3400, tracks: [
            [0, 1900, io, camTo(CAM.wide, CAM.mid)],
            [700, 2400, lin, function (S, p) { S.ring = p; }]] },
          { len: 3600, tracks: [
            [0, 1, lin, function (S) { S.ring = 1; }],
            [0, 2400, io, camTo(CAM.mid, CAM.close)],
            [300, 2700, io, function (S, p) { S.scope = p; S.tip = mix(1060, 440, p); }]] },
          { len: 9200, tracks: [
            implant(0, 500), implant(1, 2500),
            [4400, 500, io, function (S, p) { S.tip = mix(440, 588, p); }],
            implant(2, 5000), implant(3, 7000)] },
          { len: 5200, tracks: [
            [0, 1700, io, function (S, p) { S.scope = 1 - p; S.tip = mix(588, 1060, p); }],
            [300, 2200, io, camTo(CAM.close, CAM.mid)],
            [1500, 3500, lin, function (S, p) { S.flow = p; }]] }
        ],
        count: function (S, n) {
          if (n !== 3) return '';
          var done = 0; S.imp.forEach(function (p) { if (p > 0.02) done++; });
          return done ? 'Implant <b>' + done + '</b> of 4' : '';
        },
        warps: function (S) {
          /* each implant opens its own side once its needle is drawing back (from 50% to 85% of its stretch) */
          var aL = 0, aR = 0;
          IMP.forEach(function (m, i) { var o = OPEN * io(seg(S.imp[i], 0.5, 0.85)); if (m.s < 0) aL += o; else aR += o; });
          var nudge = 3 * S.scope;              /* the scope itself parts the lobes a little */
          S.open = (aL + aR) / 2 + nudge;
          return [spread(aL + nudge, aR + nudge)];
        },
        draw: function (S, api) {
          drawRing(api, S.ring);
          drawLumen(api, S.open || 0);
          drawScope(api, S.tip, S.scope > 0.001);
          api.qa('.ex-imp').forEach(function (g, i) {
            var m = IMP[i], p = S.imp[i];
            var needle = g.querySelector('.ex-needle'), suture = g.querySelector('.ex-suture'), tab = g.querySelector('.ex-tab'), end = g.querySelector('.ex-end');
            var x0 = 512 + m.s * 7;             /* the needle leaves the side of the scope */
            var ext = p < 0.35 ? out(p / 0.35) : p < 0.5 ? 1 : 1 - io(seg(p, 0.5, 0.85));
            var cap = api.fwd(m.xc, m.y), wall = api.fwd(512 + m.s * 11, m.y);
            api.set(needle, { x1: x0, y1: m.y, x2: mix(x0, cap[0], ext), y2: m.y }); needle.style.opacity = p > 0 && p < 0.86 ? 1 : 0;
            api.set(tab, { x1: cap[0], x2: cap[0], y1: m.y - 9, y2: m.y + 9 }); tab.style.opacity = p >= 0.35 ? 1 : 0;
            api.set(suture, { x1: cap[0], y1: m.y, x2: wall[0], y2: m.y }); suture.style.opacity = p >= 0.5 ? 1 : 0;
            api.set(end, { x1: wall[0], x2: wall[0], y1: m.y - 8, y2: m.y + 8 }); end.style.opacity = p >= 0.85 ? 1 : 0;
          });
          api.qa('.ex-flow').forEach(function (l, i) {
            var ph = (S.flow * 2.4 + i / DASHES) % 1, y = 330 + ph * 660, fade = Math.sin(Math.PI * S.flow) * Math.sin(Math.PI * ph);
            api.set(l, { x1: 512 + (i % 3 - 1) * 9, x2: 512 + (i % 3 - 1) * 9, y1: y, y2: y + 26 });
            l.style.opacity = (S.flow > 0 && S.flow < 1 ? 0.75 * fade : 0).toFixed(3);
          });
        }
      };
    },

    /* Rezum: the device goes up the urethra, four short bursts of water vapor (two a side), then months of healing */
    rezum: function () {
      /* each burst: side, height, and the centre and size of the vapor cloud inside the lobe */
      var B = [{ s: -1, y: 452, cx: 418, r: 92 }, { s: 1, y: 452, cx: 606, r: 92 }, { s: -1, y: 612, cx: 432, r: 74 }, { s: 1, y: 612, cx: 592, r: 74 }];
      var over = '';
      B.forEach(function () {
        over += '<g class="ex-burst" style="mix-blend-mode:screen"><circle class="ex-zone" fill="#BFEBFF" filter="url(#ex-softer)"/>' +
          '<circle class="ex-cloud" fill="#fff" filter="url(#ex-softer)"/><circle class="ex-cloud" fill="#D9F5FF" filter="url(#ex-softer)"/><circle class="ex-cloud" fill="#fff" filter="url(#ex-softer)"/>' +
          '<line class="ex-needle" stroke="#fff" stroke-width="2.6"/></g>';
      });
      over = LUMEN_SVG + over + SCOPE_SVG + RING_SVG;
      function burst(i, t0) { return [t0, 2000, lin, function (S, p) { S.b[i] = p; }]; }
      return {
        name: 'Rezum', svg: over,
        labels: BASE_LABELS.concat([
          { t: 'Water vapor', x: 330, y: 352, on: function (S, n) { return n === 3 && S.b[0] > 0.15; } },
          { t: 'Treated tissue is reabsorbed', x: 512, y: 700, on: function (S, n) { return n === 4 && S.heal > 0.05; } }
        ]),
        state: function () { return { cam: CAM.wide, ring: 0, scope: 0, tip: 470, b: [0, 0, 0, 0], heal: 0 }; },
        steps: [
          { len: 3400, tracks: [
            [0, 1900, io, camTo(CAM.wide, CAM.mid)],
            [700, 2400, lin, function (S, p) { S.ring = p; }]] },
          { len: 3600, tracks: [
            [0, 1, lin, function (S) { S.ring = 1; }],
            [0, 2400, io, camTo(CAM.mid, CAM.close)],
            [300, 2700, io, function (S, p) { S.scope = p; S.tip = mix(1060, 436, p); }]] },
          { len: 9600, tracks: [
            burst(0, 500), burst(1, 2600),
            [4600, 500, io, function (S, p) { S.tip = mix(436, 596, p); }],
            burst(2, 5200), burst(3, 7300)] },
          { len: 6600, tracks: [
            [0, 1700, io, function (S, p) { S.scope = 1 - p; S.tip = mix(596, 1060, p); }],
            [1700, 4200, io, function (S, p) { S.heal = p; }]] }
        ],
        count: function (S, n) {
          if (n === 3) { var k = 0; S.b.forEach(function (p) { if (p > 0.02) k++; }); return k ? 'Burst <b>' + k + '</b> of 4 &middot; 9 seconds each' : ''; }
          if (n === 4 && S.heal > 0) return 'Month <b>' + Math.round(6 * S.heal) + '</b> of 6';
          return '';
        },
        warps: function (S) { var a = 3 * S.scope + 34 * S.heal; S.open = a; return [spread(a, a)]; },
        draw: function (S, api) {
          drawRing(api, S.ring);
          drawLumen(api, S.open || 0);
          drawScope(api, S.tip, S.scope > 0.001);
          api.qa('.ex-burst').forEach(function (g, i) {
            var b = B[i], p = S.b[i], x0 = 512 + b.s * 7, xt = 512 + b.s * 44;      /* the needle only goes a short way into the lobe */
            var ext = p < 0.15 ? out(p / 0.15) : p < 0.72 ? 1 : 1 - io(seg(p, 0.72, 0.88));
            var needle = g.querySelector('.ex-needle');
            api.set(needle, { x1: x0, y1: b.y, x2: mix(x0, xt, ext), y2: b.y }); needle.style.opacity = p > 0 && p < 0.9 ? 1 : 0;
            var grow = out(seg(p, 0.15, 0.7)), fade = 1 - seg(p, 0.7, 1);
            var c = api.fwd(b.cx, b.y);
            [].forEach.call(g.querySelectorAll('.ex-cloud'), function (cl, j) {
              var wob = Math.sin(p * 18 + j * 2.1) * 6;
              api.set(cl, { cx: c[0] + (j - 1) * b.r * 0.32 * grow + b.s * -8, cy: c[1] + (j === 1 ? -1 : 1) * b.r * 0.22 * grow + wob, r: Math.max(0.1, b.r * (0.5 + 0.18 * j) * grow) });
              cl.style.opacity = (p > 0.15 ? (0.85 - 0.14 * j) * fade : 0).toFixed(3);
            });
            var zone = g.querySelector('.ex-zone');
            api.set(zone, { cx: c[0], cy: c[1], r: b.r * 0.82 });
            zone.style.opacity = (0.34 * seg(p, 0.6, 1) * (1 - S.heal)).toFixed(3);
          });
        }
      };
    }
  };

  var make = MAKE[wrap.getAttribute('data-explainer')];
  if (!make) return;
  var cfg = make(), N = cfg.steps.length;
  if (steps.length !== N) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia('(max-width: 620px)');
  var SIZE = 1024;

  /* ---------- what sits on the plate: the drawing, the labels, and the counter in the corner ---------- */
  svg.innerHTML = '<defs><filter id="ex-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2"/></filter>' +
    '<filter id="ex-softer" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter></defs>' + cfg.svg;
  var labEls = cfg.labels.map(function (l) {
    var s = d.createElement('span');
    s.className = 'px-lab' + (l.on ? ' px-t' : '') + (l.side === 'l' ? ' px-lw' : l.side === 'r' ? ' px-lr' : '');
    s.setAttribute('aria-hidden', 'true');
    s.style.left = l.x + 'px'; s.style.top = l.y + 'px';
    s.textContent = l.t;
    world.appendChild(s);
    return s;
  });
  var count = d.createElement('span');
  count.className = 'px-count'; count.setAttribute('aria-hidden', 'true'); count.hidden = true;
  stage.insertBefore(count, again);

  /* ---------- the picture: WebGL when available (needed to move the lobes), a plain image otherwise ---------- */
  var gl = null, uni = {}, ctx2d = null, img = new Image(), ready = false, drawn = '', warps = [], reveal = null;
  var src2 = cfg.plate2 && canvas.getAttribute('data-src2'), img2 = src2 ? new Image() : null;
  function initGL() {
    try { gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}');
    /* warp slots: wa = (cx, cy, rx, ry), wb = (kind, amount, extra, last). kind 1 shrinks toward the centre; kind 2 opens a channel
       along the vertical line x = cx (amount = extra half-width on the left, extra = starting half-width, last = extra half-width on the right).
       rv = (height of the reveal line, its softness, on/off): above that line the second picture, which sits at r2 = (x, y, width, height),
       shows through its own alpha mask. */
    var fs = sh(gl.FRAGMENT_SHADER,
      '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
      'varying vec2 v;uniform sampler2D t;uniform sampler2D t2;uniform vec4 rv;uniform vec4 r2;uniform vec4 wa[4];uniform vec4 wb[4];' +
      'void main(){vec2 p=v*1024.;vec2 off=vec2(0.);' +
      'for(int i=0;i<4;i++){vec4 A=wa[i];vec4 B=wb[i];' +
      'if(B.x>.5&&B.x<1.5){float r=length((p-A.xy)/A.zw);float m=1.-smoothstep(1.,1.7,r);off+=(p-A.xy)*(1./mix(1.,B.y,m)-1.);}' +
      'else if(B.x>1.5){float pr=1.-smoothstep(.55,1.,abs(p.y-A.y)/A.w);float dx=p.x-A.x;float dd=abs(dx);float h0=B.z;float h1=h0+(dx<0.?B.y:B.w)*pr;' +
      'if(dd<A.z){float f=dd<h1?dd*h0/h1:h0+(dd-h1)*(A.z-h0)/(A.z-h1);off.x+=sign(dx)*(f-dd);}}}' +
      'vec3 c=texture2D(t,(p+off)/1024.).rgb;' +
      'if(rv.z>.5){vec4 b=texture2D(t2,(p-r2.xy)/r2.zw);c=mix(c,b.rgb,b.a*(1.-smoothstep(rv.x-rv.y,rv.x+rv.y,p.y)));}' +
      'gl_FragColor=vec4(c,1.);}');
    if (!vs || !fs) { gl = null; return false; }
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    function texture(unit, fmt, picture) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, picture);
    }
    texture(0, gl.RGB, img);
    if (img2) texture(1, gl.RGBA, img2);
    gl.uniform1i(gl.getUniformLocation(prog, 't'), 0); gl.uniform1i(gl.getUniformLocation(prog, 't2'), img2 ? 1 : 0);
    gl.uniform4fv(gl.getUniformLocation(prog, 'r2'), new Float32Array(cfg.plate2 || [0, 0, SIZE, SIZE]));
    uni.wa = gl.getUniformLocation(prog, 'wa'); uni.wb = gl.getUniformLocation(prog, 'wb'); uni.rv = gl.getUniformLocation(prog, 'rv');
    gl.viewport(0, 0, SIZE, SIZE);
    return true;
  }
  function drawPlate() {
    if (!ready) return;
    var wa = [], wb = [], i, w;
    for (i = 0; i < 4; i++) {
      w = warps[i];
      if (!w) { wa.push(0, 0, 1, 1); wb.push(0, 0, 0, 0); }
      else if (w.kind === 'shrink') { wa.push(w.c[0], w.c[1], w.r[0], w.r[1]); wb.push(1, w.s, 0, 0); }
      else { wa.push(w.x, w.y, w.w, w.h); wb.push(2, w.a, w.h0, w.aR == null ? w.a : w.aR); }
    }
    var rv = reveal && img2 ? [reveal.y, reveal.soft || 12, 1, 0] : [0, 1, 0, 0];
    var key = wa.join(',') + '|' + wb.join(',') + '|' + rv.join(',');
    if (key === drawn) return;
    drawn = key;
    if (gl) {
      gl.uniform4fv(uni.wa, new Float32Array(wa)); gl.uniform4fv(uni.wb, new Float32Array(wb)); gl.uniform4fv(uni.rv, new Float32Array(rv));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (ctx2d) {                                /* no WebGL: the lobes stay put, but the cleared space still shows */
      ctx2d.drawImage(img, 0, 0, SIZE, SIZE);
      if (rv[2]) {
        var q = cfg.plate2;
        ctx2d.save(); ctx2d.beginPath(); ctx2d.rect(0, 0, SIZE, rv[0]); ctx2d.clip(); ctx2d.drawImage(img2, q[0], q[1], q[2], q[3]); ctx2d.restore();
      }
    }
  }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; drawn = ''; });
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function fwd(x, y) {                                 /* where a point of the plate ends up after the current warps */
    var ox = 0, oy = 0;
    warps.forEach(function (w) {
      if (!w) return;
      if (w.kind === 'shrink') {
        var dx = (x - w.c[0]) / w.r[0], dy = (y - w.c[1]) / w.r[1], m = 1 - sstep(1, 1.7, Math.sqrt(dx * dx + dy * dy)), se = 1 + (w.s - 1) * m;
        ox += (x - w.c[0]) * (se - 1); oy += (y - w.c[1]) * (se - 1);
      } else {
        var q = x - w.x, dd = Math.abs(q), pr = 1 - sstep(0.55, 1, Math.abs(y - w.y) / w.h), h1 = w.h0 + (q < 0 || w.aR == null ? w.a : w.aR) * pr;
        if (dd < w.w) { var g = dd < w.h0 ? dd * h1 / w.h0 : h1 + (dd - w.h0) * (w.w - h1) / (w.w - w.h0); ox += (q < 0 ? -1 : 1) * (g - dd); }
      }
    });
    return [x + ox, y + oy];
  }

  /* ---------- state: the picture at t ms into step n, worked out from scratch each time ---------- */
  var S, k = 1, ks = 1, counted = '';                                /* ks: the same as k, for line and dot sizes, which ease down a little on small stages */
  var api = {
    q: function (sel) { return svg.querySelector(sel); },
    qa: function (sel) { return [].slice.call(svg.querySelectorAll(sel)); },
    fwd: fwd,
    px: function (v) { return v / ks; },
    set: function (el, attrs) { for (var a in attrs) el.setAttribute(a, typeof attrs[a] === 'number' ? attrs[a].toFixed(2) : attrs[a]); },
    at: function (path, u) { return path.getPointAtLength(path.getTotalLength() * Math.max(0, Math.min(1, u))); }
  };
  function render(n) {
    var sw = stage.clientWidth || 600;
    k = sw / (S.cam[2] - S.cam[0]);
    ks = k / Math.max(0.68, Math.min(1, sw / 600));
    world.style.transform = 'translate(' + (-S.cam[0] * k).toFixed(2) + 'px,' + (-S.cam[1] * k).toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
    world.style.setProperty('--k', k.toFixed(4)); world.style.setProperty('--ks', ks.toFixed(4));
    warps = cfg.warps ? cfg.warps(S) : [];
    reveal = cfg.reveal ? cfg.reveal(S) : null;
    drawPlate();
    cfg.draw(S, api);
    cfg.labels.forEach(function (l, i) { if (l.on) labEls[i].classList.toggle('on', !!l.on(S, n)); });
    var c = cfg.count ? cfg.count(S, n) : '';
    count.hidden = !c;
    if (c && c !== counted) { count.innerHTML = c; counted = c; }
  }
  function setState(n, t) {
    S = cfg.state();
    for (var i = 1; i <= n; i++) {
      var tt = i < n ? Infinity : t;
      cfg.steps[i - 1].tracks.forEach(function (tr) {
        if (tt < tr[0]) return;
        tr[3](S, tr[2](Math.min(1, (tt - tr[0]) / tr[1])));
      });
    }
    render(n);
  }

  /* ---------- showing and playing steps ---------- */
  var cur = 0, raf = 0, timers = [], auto = false, played = false;
  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function show(n, animate) {
    stopAnim();
    cur = n = Math.max(1, Math.min(N, n));
    stage.setAttribute('data-step', n);
    steps.forEach(function (s, i) {
      s.classList.toggle('on', i === n - 1);
      s.setAttribute('aria-current', i === n - 1 ? 'step' : 'false');
    });
    again.hidden = auto || n !== N;
    if (!animate || reduce) { setState(n, Infinity); return; }
    var t0 = null, len = cfg.steps[n - 1].len;
    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;
      setState(n, t);
      raf = t < len ? requestAnimationFrame(frame) : 0;
    }
    setState(n, 0);
    raf = requestAnimationFrame(frame);
  }
  function bringCard(n) {
    if (!phone.matches) return;
    flow.scrollTo({ left: steps[n - 1].offsetLeft - 20, behavior: reduce ? 'auto' : 'smooth' });
  }
  function playFrom(n) {
    auto = true;
    show(n, true);
    bringCard(n);
    timers.push(setTimeout(function () {
      if (!auto) return;
      if (n < N) playFrom(n + 1); else { auto = false; again.hidden = false; }
    }, cfg.steps[n - 1].len + (n < N ? 500 : 0)));
  }
  function stopAuto() { if (!auto) return; auto = false; timers.forEach(clearTimeout); timers = []; again.hidden = cur !== N; }
  function track(what) { try { if (typeof window.plausible === 'function') window.plausible(cfg.name + ' explainer: ' + what); } catch (e) {} }

  steps.forEach(function (s, i) {
    s.setAttribute('role', 'button');
    s.setAttribute('tabindex', '0');
    function pick() { stopAuto(); show(i + 1, true); track('step ' + (i + 1)); }
    s.addEventListener('click', pick);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  again.addEventListener('click', function () { timers.forEach(clearTimeout); timers = []; playFrom(1); track('replayed'); });
  ['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { flow.addEventListener(ev, stopAuto, { passive: true }); });
  if ('IntersectionObserver' in window) {
    var cardIO = new IntersectionObserver(function (entries) {      /* phones: the drawing follows the card in view */
      if (!phone.matches || auto) return;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = steps.indexOf(en.target);
        if (i !== -1 && i + 1 !== cur) show(i + 1, true);
      });
    }, { root: flow, threshold: 0.75 });
    steps.forEach(function (s) { cardIO.observe(s); });
  }
  window.addEventListener('resize', function () { if (!raf && S) render(cur); });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && S) { drawn = ''; render(cur); } });

  /* used by the capture script to step through the animation frame by frame */
  wrap.__seek = function (n, t) { stopAuto(); stopAnim(); cur = n; stage.setAttribute('data-step', n); setState(n, t); };
  wrap.__lengths = cfg.steps.map(function (s) { return s.len; });

  var waiting = img2 ? 2 : 1;
  function start() {
    if (--waiting) return;
    ready = true;
    if (!initGL()) {                                   /* no WebGL: show the plate as it is; the lobes do not move */
      try { ctx2d = canvas.getContext('2d'); } catch (e) { ctx2d = null; }
      if (!ctx2d) { img.className = 'px-plate'; img.alt = ''; canvas.parentNode.replaceChild(img, canvas); }
    }
    stage.hidden = false;
    wrap.classList.add('px-on');
    steps[0].classList.add('on');
    setState(0, 0);                                    /* the wide view, at rest, until it is seen */
    if (reduce || !('IntersectionObserver' in window)) { show(1, false); return; }
    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || played) return;
      played = true;
      seen.disconnect();
      playFrom(1);
      track('played');
    }, { threshold: 0.55 });
    seen.observe(stage);
  }
  img.onload = start;
  if (img2) {
    img2.onload = start;
    img2.onerror = function () { img2 = null; start(); };          /* without the second picture the cleared space is simply not shown */
    img2.src = src2;
  }
  img.src = canvas.getAttribute('data-src');
})();
