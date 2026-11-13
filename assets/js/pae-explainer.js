/* Animated "How PAE works" explainer (pae.html).
   The picture is the site's own wireframe art (assets/img/pae-plate.webp). Everything that
   moves is drawn on top of it: the catheter follows artery routes traced on that picture, the
   microspheres ride the small branches into each lobe, and the lobes shrink by warping the
   picture itself. A slow camera move frames each of the four steps.
   The four step cards on the page are the script; nothing is restated here.
   It plays once when it scrolls into view and then stops. Tapping a step, or swiping the cards
   on a phone, shows that step. With reduced motion each step shows its end state.
   With scripts off the stage stays hidden and the page shows the four steps as before.
   If the plate is replaced, the routes in the page's SVG must be traced again. */
(function () {
  'use strict';
  var d = document;
  var wrap = d.getElementById('pae-explainer');
  if (!wrap) return;
  var stage = wrap.querySelector('.px-stage');
  var flow = wrap.querySelector('.flow');
  var steps = flow ? [].slice.call(flow.querySelectorAll('.flow-step')) : [];
  var world = stage && stage.querySelector('.px-world');
  var canvas = stage && stage.querySelector('.px-plate');
  var svg = stage && stage.querySelector('.px-over');
  if (!stage || !world || !canvas || !svg || steps.length !== 4) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia('(max-width: 620px)');
  var SIZE = 1024;                                   /* the plate is 1024 x 1024; all coordinates are plate pixels */
  var r1 = [].slice.call(svg.querySelectorAll('.px-r1')), r2 = [].slice.call(svg.querySelectorAll('.px-r2'));
  var route1 = r1[0], route2 = r2[0], low = svg.querySelector('.px-low');
  var tip = svg.querySelector('.px-tip'), tipGlow = svg.querySelector('.px-tipglow');
  var ring = svg.querySelector('.px-ring'), dot = svg.querySelector('.px-dot');
  var twigs = { L: [].slice.call(svg.querySelectorAll('.px-tw.L')), R: [].slice.call(svg.querySelectorAll('.px-tw.R')) };
  var balls = { L: [].slice.call(svg.querySelectorAll('.px-ms.L')), R: [].slice.call(svg.querySelectorAll('.px-ms.R')) };
  var week = stage.querySelector('.px-week b'), again = stage.querySelector('.px-again');
  var len1 = route1.getTotalLength(), len2 = route2.getTotalLength(), lenLow = low.getTotalLength();
  var U1 = lenLow / len1, U2 = lenLow / len2;        /* how far along each route the side branch leaves the main artery */

  /* the two lobes, for the shrink: centre and half-size in plate pixels */
  var LOBES = [[455, 594, 46, 84], [570, 594, 46, 84]];
  var SHRINK = 0.8;                                  /* illustration only: the page states no percentage */
  /* each ball: which small branch it rides and how far along it comes to rest */
  var REST = [[0, 0.5], [1, 0.62], [2, 0.5], [3, 0.92], [0, 0.96], [1, 1], [2, 0.88]];

  /* camera framings, [x0, y0, x1, y1] in plate pixels, all 5:4 like the stage */
  var CAM = {
    wide: [-128, 0, 1152, 1024],
    groin: [-30, 500, 610, 1012],
    path: [41, 340, 809, 954],
    both: [112, 84, 912, 724],
    gland: [192, 356, 832, 868]
  };

  /* ---------- the picture: WebGL when available (needed for the shrink), a plain image otherwise ---------- */
  var gl = null, prog = null, uni = {}, ctx2d = null, img = new Image(), ready = false;
  function initGL() {
    try { gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}');
    var fs = sh(gl.FRAGMENT_SHADER,
      'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float s;uniform vec4 lobe[2];' +
      'void main(){vec2 p=v*1024.;vec2 off=vec2(0.);' +
      'for(int i=0;i<2;i++){vec2 c=lobe[i].xy;float r=length((p-c)/lobe[i].zw);float m=1.-smoothstep(1.,1.7,r);off+=(p-c)*(1./mix(1.,s,m)-1.);}' +
      'gl_FragColor=texture2D(t,(p+off)/1024.);}');
    if (!vs || !fs) { gl = null; return false; }
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    uni.s = gl.getUniformLocation(prog, 's');
    gl.uniform4fv(gl.getUniformLocation(prog, 'lobe'), new Float32Array(LOBES[0].concat(LOBES[1])));
    gl.viewport(0, 0, SIZE, SIZE);
    return true;
  }
  var drawn = '';
  function drawPlate(s) {
    if (!ready) return;
    var key = s.toFixed(4);
    if (key === drawn) return;
    drawn = key;
    if (gl) { gl.uniform1f(uni.s, s); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    else if (ctx2d) ctx2d.drawImage(img, 0, 0, SIZE, SIZE);
  }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; drawn = ''; });

  /* ---------- state, and the four steps as timed changes to it ---------- */
  var S;
  function reset() { S = { cam: CAM.wide, u1: 0, u2: 0, cath: 1, ring: -1, bl: 0, br: 0, s: 1, wk: 0 }; }
  function io(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function out(p) { return 1 - Math.pow(1 - p, 3); }
  function lin(p) { return p; }
  function mix(a, b, p) { return a + (b - a) * p; }
  function camTo(a, b) { return function (p) { S.cam = [mix(a[0], b[0], p), mix(a[1], b[1], p), mix(a[2], b[2], p), mix(a[3], b[3], p)]; }; }
  /* [start ms, length ms, easing, what changes] */
  var TRACK = [null,
    [[0, 1900, io, camTo(CAM.wide, CAM.groin)],
     [700, 2400, lin, function (p) { S.ring = p; }]],
    [[0, 3400, io, camTo(CAM.groin, CAM.path)],
     [0, 1, lin, function () { S.ring = 2; }],
     [500, 3600, io, function (p) { S.u1 = p; }]],
    [[0, 1700, io, camTo(CAM.path, CAM.both)],
     [1300, 2100, lin, function (p) { S.bl = p; }],
     [3500, 800, io, function (p) { S.u1 = mix(1, U1, p); }],           /* draws back to the main artery */
     [4300, 2600, io, function (p) { S.u2 = mix(U2, 1, p); }],          /* then up, over and down the far side */
     [7000, 2100, lin, function (p) { S.br = p; }]],
    [[0, 900, io, function (p) { S.cath = 1 - p; }],
     [0, 2000, io, camTo(CAM.both, CAM.gland)],
     [1500, 3800, io, function (p) { S.s = mix(1, SHRINK, p); }],
     [1500, 3800, lin, function (p) { S.wk = 12 * p; }]]
  ];
  var LENGTH = [0, 3600, 4700, 9600, 6400];         /* how long each step runs when playing through */
  function apply(n, t) {
    TRACK[n].forEach(function (tr) {
      if (t < tr[0]) return;
      tr[3](tr[2](Math.min(1, (t - tr[0]) / tr[1])));
    });
  }

  /* ---------- drawing the state ---------- */
  var k = 1, ks = 1;                                 /* ks: the same, for line and dot sizes, which ease down a little on small stages */
  function fwd(x, y, s) {                            /* where a point of the picture ends up once the lobes have shrunk */
    var ox = 0, oy = 0;
    LOBES.forEach(function (L) {
      var dx = (x - L[0]) / L[2], dy = (y - L[1]) / L[3], r = Math.sqrt(dx * dx + dy * dy);
      var e = (r - 1) / 0.7, m = r <= 1 ? 1 : r >= 1.7 ? 0 : 1 - e * e * (3 - 2 * e);
      var se = 1 + (s - 1) * m;
      ox += (x - L[0]) * (se - 1); oy += (y - L[1]) * (se - 1);
    });
    return [x + ox, y + oy];
  }
  function drawBalls(side, prog) {
    var list = balls[side], n = list.length;
    for (var i = 0; i < n; i++) {
      var start = i / n * 0.6, p = Math.max(0, Math.min(1, (prog - start) / 0.4));
      var path = twigs[side][REST[i][0]], pt = path.getPointAtLength(path.getTotalLength() * REST[i][1] * out(p));
      var q = fwd(pt.x, pt.y, S.s);
      list[i].setAttribute('cx', q[0].toFixed(1)); list[i].setAttribute('cy', q[1].toFixed(1));
      list[i].setAttribute('r', (3.1 / ks).toFixed(2));
      list[i].style.opacity = p > 0 ? 1 : 0;
    }
  }
  function render() {
    var sw = stage.clientWidth || 600;
    k = sw / (S.cam[2] - S.cam[0]);
    world.style.transform = 'translate(' + (-S.cam[0] * k).toFixed(2) + 'px,' + (-S.cam[1] * k).toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
    ks = k / Math.max(0.68, Math.min(1, sw / 600));
    world.style.setProperty('--k', k.toFixed(4));
    world.style.setProperty('--ks', ks.toFixed(4));
    r1.forEach(function (p) { p.style.strokeDashoffset = (1 - S.u1).toFixed(4); p.style.opacity = S.u2 > 0 ? 0 : S.cath; });
    r2.forEach(function (p) { p.style.strokeDashoffset = (1 - S.u2).toFixed(4); p.style.opacity = S.u2 > 0 ? S.cath : 0; });
    var on = S.u2 > 0 ? route2 : route1, u = S.u2 > 0 ? S.u2 : S.u1, show = u > 0.002 && S.cath > 0.02;
    var tp = on.getPointAtLength((S.u2 > 0 ? len2 : len1) * u);
    [tip, tipGlow].forEach(function (c) { c.setAttribute('cx', tp.x.toFixed(1)); c.setAttribute('cy', tp.y.toFixed(1)); c.style.opacity = show ? S.cath : 0; });
    tip.setAttribute('r', (3.2 / ks).toFixed(2)); tipGlow.setAttribute('r', (9 / ks).toFixed(2));
    dot.setAttribute('r', (4 / ks).toFixed(2)); dot.style.opacity = S.ring < 0 ? 0.4 : 1;
    if (S.ring >= 0 && S.ring < 1) {
      var ph = (S.ring * 2) % 1;
      ring.setAttribute('r', ((6 + 26 * ph) / ks).toFixed(2)); ring.style.opacity = (1 - ph).toFixed(3);
    } else ring.style.opacity = 0;
    drawBalls('L', S.bl); drawBalls('R', S.br);
    drawPlate(S.s);
    week.textContent = Math.round(S.wk);
  }

  /* ---------- showing and playing steps ---------- */
  var cur = 0, raf = 0, timers = [], auto = false, played = false;
  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function setState(n, t) {                          /* the picture at t ms into step n */
    reset();
    for (var i = 1; i < n; i++) apply(i, Infinity);
    if (n >= 1) apply(n, t);
    render();
  }
  function show(n, animate) {
    stopAnim();
    n = Math.max(1, Math.min(4, n));
    cur = n;
    stage.setAttribute('data-step', n);
    steps.forEach(function (s, i) {
      s.classList.toggle('on', i === n - 1);
      s.setAttribute('aria-current', i === n - 1 ? 'step' : 'false');
    });
    again.hidden = auto || n !== 4;
    if (!animate || reduce) { setState(n, Infinity); return; }
    var t0 = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;
      setState(n, t);
      raf = t < LENGTH[n] ? requestAnimationFrame(frame) : 0;
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
      if (n < 4) playFrom(n + 1); else { auto = false; again.hidden = false; }
    }, LENGTH[n] + (n < 4 ? 500 : 0)));
  }
  function stopAuto() { if (!auto) return; auto = false; timers.forEach(clearTimeout); timers = []; again.hidden = cur !== 4; }
  function track(name) { try { if (typeof window.plausible === 'function') window.plausible(name); } catch (e) {} }

  steps.forEach(function (s, i) {
    s.setAttribute('role', 'button');
    s.setAttribute('tabindex', '0');
    function pick() { stopAuto(); show(i + 1, true); track('PAE explainer: step ' + (i + 1)); }
    s.addEventListener('click', pick);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  again.addEventListener('click', function () { timers.forEach(clearTimeout); timers = []; playFrom(1); track('PAE explainer: replayed'); });
  ['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { flow.addEventListener(ev, stopAuto, { passive: true }); });
  if ('IntersectionObserver' in window) {
    var cardIO = new IntersectionObserver(function (entries) {    /* phones: the drawing follows the card in view */
      if (!phone.matches || auto) return;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = steps.indexOf(en.target);
        if (i !== -1 && i + 1 !== cur) show(i + 1, true);
      });
    }, { root: flow, threshold: 0.75 });
    steps.forEach(function (s) { cardIO.observe(s); });
  }
  window.addEventListener('resize', function () { if (!raf && S) render(); });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && S) { drawn = ''; render(); } });

  /* used by the capture script to step through the animation frame by frame */
  wrap.__seek = function (n, t) { stopAuto(); stopAnim(); cur = n; stage.setAttribute('data-step', n); setState(n, t); };

  function start() {
    ready = true;
    if (!initGL()) {                                 /* no WebGL: show the plate as it is; the shrink is skipped */
      try { ctx2d = canvas.getContext('2d'); } catch (e) { ctx2d = null; }
      if (!ctx2d) { img.className = 'px-plate'; img.alt = ''; canvas.parentNode.replaceChild(img, canvas); }
    }
    stage.hidden = false;
    wrap.classList.add('px-on');
    steps[0].classList.add('on');
    reset(); render();                               /* the wide view, at rest, until it is seen */
    if (reduce || !('IntersectionObserver' in window)) { show(1, false); return; }
    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || played) return;
      played = true;
      seen.disconnect();
      playFrom(1);
      track('PAE explainer: played');
    }, { threshold: 0.55 });
    seen.observe(stage);
  }
  img.onload = start;
  img.src = canvas.getAttribute('data-src');
})();
