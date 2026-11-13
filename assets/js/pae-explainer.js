/* Animated "How PAE works" explainer (pae.html).
   One drawing, four states, matched to the four step cards already on the page (their text is
   the script; nothing is restated here). It plays once when it scrolls into view and then
   stops. Tapping a step, or swiping the cards on a phone, shows that step. Nothing loops,
   and with reduced motion each step simply shows its end state.
   With scripts off the stage stays hidden and the page shows the four steps as before. */
(function () {
  'use strict';
  var d = document;
  var wrap = d.getElementById('pae-explainer');
  if (!wrap) return;
  var stage = wrap.querySelector('.px-stage');
  var flow = wrap.querySelector('.flow');
  var steps = flow ? [].slice.call(flow.querySelectorAll('.flow-step')) : [];
  var svg = stage && stage.querySelector('svg');
  if (!stage || !svg || steps.length !== 4) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia('(max-width: 620px)');
  var week = stage.querySelector('.px-week b');
  var again = stage.querySelector('.px-again');
  var twigs = { L: [].slice.call(svg.querySelectorAll('.px-tw.L')), R: [].slice.call(svg.querySelectorAll('.px-tw.R')) };
  var balls = { L: [].slice.call(svg.querySelectorAll('.px-ms.L')), R: [].slice.call(svg.querySelectorAll('.px-ms.R')) };
  var HOLD = [0, 3400, 4200, 6400, 5600];        /* ms each step stays up while playing through */
  var cur = 0, timers = [], raf = 0, auto = false, played = false;

  function track(n) { try { if (typeof window.plausible === 'function') window.plausible(n); } catch (e) {} }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearAll() { timers.forEach(clearTimeout); timers = []; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function ease(p) { return 1 - Math.pow(1 - p, 3); }

  /* where each microsphere comes to rest: a fraction of the way along its vessel */
  var REST = [0.58, 0.66, 0.6, 0.8, 0.97, 0.9, 1];     /* balls 0,3,6 share vessel 0; 1,4 vessel 1; 2,5 vessel 2 */
  function rest(side, i) { return REST[i % REST.length]; }
  function place(side, i, p) {
    var path = twigs[side][i % twigs[side].length], b = balls[side][i];
    var pt = path.getPointAtLength(path.getTotalLength() * rest(side, i) * p);
    b.setAttribute('cx', pt.x.toFixed(1)); b.setAttribute('cy', pt.y.toFixed(1));
    b.style.opacity = p > 0 ? 1 : 0;
  }
  function ballsAt(p) { ['L', 'R'].forEach(function (s) { balls[s].forEach(function (b, i) { place(s, i, p); }); }); }
  function flyBalls(side, startAfter) {
    var t0 = null, n = balls[side].length, DUR = 1100, GAP = 170;
    function frame(t) {
      if (t0 === null) t0 = t + startAfter;
      var done = true;
      for (var i = 0; i < n; i++) {
        var p = (t - t0 - i * GAP) / DUR;
        if (p < 1) done = false;
        place(side, i, p <= 0 ? 0 : ease(Math.min(1, p)));
      }
      if (!done) raf = requestAnimationFrame(frame);
      else if (side === 'L') flyBalls('R', 1500);       /* the right side follows once its catheter is in */
    }
    raf = requestAnimationFrame(frame);
  }
  function countWeeks() {
    var t0 = null, DUR = 3600;
    function frame(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / DUR);
      week.textContent = Math.round(12 * p);
      if (p < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  /* show step n (1-4). animate=false jumps straight to its end state. */
  function show(n, animate) {
    clearAll();
    n = Math.max(1, Math.min(4, n));
    animate = animate && !reduce;
    /* start from the end of the step before, without transitions */
    stage.classList.add('px-jump');
    stage.setAttribute('data-step', n - 1);
    ballsAt(n - 1 >= 3 ? 1 : 0);
    week.textContent = n - 1 >= 4 ? '12' : '0';
    void stage.offsetWidth;                              /* flush, so the next change animates */
    if (animate) stage.classList.remove('px-jump');
    stage.setAttribute('data-step', n);
    if (n === 3) { if (animate) flyBalls('L', 250); else ballsAt(1); }
    if (n === 4) { ballsAt(1); if (animate) countWeeks(); else week.textContent = '12'; }
    if (!animate) { void stage.offsetWidth; stage.classList.remove('px-jump'); }
    cur = n;
    steps.forEach(function (s, i) {
      s.classList.toggle('on', i === n - 1);
      s.setAttribute('aria-current', i === n - 1 ? 'step' : 'false');
    });
    again.hidden = auto || n !== 4;
  }

  function bringCard(n) {
    if (!phone.matches) return;
    var card = steps[n - 1];
    flow.scrollTo({ left: card.offsetLeft - 20, behavior: reduce ? 'auto' : 'smooth' });
  }
  function playFrom(n) {
    auto = true;
    show(n, true);
    bringCard(n);
    if (n < 4) later(function () { if (auto) playFrom(n + 1); }, HOLD[n]);
    else later(function () { auto = false; again.hidden = false; }, HOLD[4]);
  }
  function stopAuto() { if (!auto) return; auto = false; timers.forEach(clearTimeout); timers = []; again.hidden = cur !== 4; }

  steps.forEach(function (s, i) {
    s.setAttribute('role', 'button');
    s.setAttribute('tabindex', '0');
    function pick() { stopAuto(); show(i + 1, true); track('PAE explainer: step ' + (i + 1)); }
    s.addEventListener('click', pick);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  again.addEventListener('click', function () { playFrom(1); track('PAE explainer: replayed'); });
  ['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) {
    flow.addEventListener(ev, stopAuto, { passive: true });
  });

  /* phones: the step cards swipe sideways; the drawing follows the card in view */
  if ('IntersectionObserver' in window) {
    var cardIO = new IntersectionObserver(function (entries) {
      if (!phone.matches || auto) return;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = steps.indexOf(en.target);
        if (i !== -1 && i + 1 !== cur) show(i + 1, true);
      });
    }, { root: flow, threshold: 0.75 });
    steps.forEach(function (s) { cardIO.observe(s); });
  }

  stage.hidden = false;
  wrap.classList.add('px-on');
  show(1, false);
  stage.setAttribute('data-step', 0);                    /* rest state until it is seen */

  if (reduce || !('IntersectionObserver' in window)) { show(1, false); return; }
  var seen = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting || played) return;
    played = true;
    seen.disconnect();
    playFrom(1);
    track('PAE explainer: played');
  }, { threshold: 0.55 });
  seen.observe(stage);
})();
