/* "Which option fits me?" guide (bph.html).
   Five plain questions. Each answer adds a reason for or against each of the four BPH
   options, and every reason is a statement the site already makes on the BPH, size chart,
   PAE and Aquablation pages. If a claim changes on those pages, change it here too.
   The guide starts a conversation; it does not diagnose, and it says so. */
(function () {
  'use strict';
  var d = document;
  var root = d.getElementById('guide-tool');
  if (!root) return;

  var KEYS = ['pae', 'urolift', 'rezum', 'aqua'];
  var NAME = { pae: 'PAE', urolift: 'UroLift', rezum: 'Rezūm', aqua: 'Aquablation' };
  var HREF = { pae: 'pae.html', urolift: 'urolift.html', rezum: 'rezum.html', aqua: 'aquablation.html' };
  var LIMIT = 'Above roughly 80 cc the office procedures reach their design limits.';
  var ASK = 'Ask at your visit whether your blood thinner would need to be paused.';

  /* effect: [score, reason]. 1 = a reason for, -1 = a reason against, 0 = worth knowing.
     size: true marks a reason against that comes from prostate size, which outweighs preferences. */
  var Q = [
    { id: 'size', label: 'Prostate size', q: 'Do you know your prostate size?',
      hint: 'The number is on an ultrasound or MRI report, in cc or grams.',
      a: [
        { t: 'Under 40 cc', e: {
            urolift: [1, 'Office procedures like UroLift do well at this size.'],
            rezum: [1, 'Office procedures like Rezūm do well at this size.'],
            pae: [0, 'Does its best work from about 40 cc up.'],
            aqua: [0, 'Proven from 30 to 150 cc.'] },
          note: 'Under 40 cc, medication or watchful waiting is often fine, if treatment is needed at all.' },
        { t: '40 to 80 cc', e: {
            pae: [1, 'All four options do their best work between 40 and 80 cc.'],
            urolift: [1, 'All four options do their best work between 40 and 80 cc.'],
            rezum: [1, 'All four options do their best work between 40 and 80 cc.'],
            aqua: [1, 'All four options do their best work between 40 and 80 cc.'] } },
        { t: '80 to 150 cc', e: {
            pae: [1, 'Above 80 to 100 cc, PAE and Aquablation take over.'],
            aqua: [1, 'Above 80 to 100 cc, PAE and Aquablation take over. Aquablation is proven up to 150 cc.'],
            urolift: [-1, LIMIT, true],
            rezum: [-1, LIMIT, true] } },
        { t: 'Over 150 cc', e: {
            pae: [1, 'PAE has no practical upper size limit.'],
            aqua: [-1, 'Proven up to about 150 cc. Beyond that, men usually look at PAE instead.', true],
            urolift: [-1, LIMIT, true],
            rezum: [-1, LIMIT, true] },
          note: 'Above 150 cc the menu is usually PAE, HoLEP, or open surgery. The right answer depends on your anatomy and priorities.' },
        { t: 'I do not know yet', s: 'not measured yet', e: {},
          note: 'Your size is measured with a quick in-office ultrasound. It narrows the menu before preferences do.' }
      ] },
    { id: 'goal', label: 'Matters most', q: 'What matters most to you?', hint: 'Pick the one that matters most.',
      a: [
        { t: 'Getting back to normal fast', e: {
            pae: [1, 'Back to routine in about a day.'],
            urolift: [1, 'Back to routine within days, the fastest office recovery.'],
            rezum: [0, 'Back to routine in a few days, with a temporary catheter.'],
            aqua: [-1, 'Recovery takes one to two weeks.'] } },
        { t: 'No hospital stay', e: {
            pae: [1, 'Outpatient: home the same day.'],
            urolift: [1, 'Done in the office.'],
            rezum: [1, 'Done in the office.'],
            aqua: [-1, 'Done in the hospital, usually with one night’s stay.'] } },
        { t: 'No catheter afterward', e: {
            pae: [1, 'Usually no catheter afterward.'],
            urolift: [1, 'Usually no catheter afterward.'],
            rezum: [-1, 'A temporary catheter for a few days.'],
            aqua: [-1, 'A catheter for one to two days.'] } },
        { t: 'Protecting ejaculation', e: {
            pae: [1, 'Preserves ejaculation in the large majority of men.'],
            urolift: [1, 'Preserves ejaculation in the large majority of men.'],
            rezum: [1, 'Ejaculation is preserved in most men.'],
            aqua: [1, 'Designed to spare ejaculation.'] } },
        { t: 'The most thorough fix', e: {
            aqua: [1, 'Removes the tissue robotically for a surgical-grade result.'],
            rezum: [0, 'No implants, with durable five-year data.'],
            pae: [0, 'Shrinks the prostate over 4 to 12 weeks.'],
            urolift: [0, 'Holds the channel open with implants; no tissue is removed.'] } }
      ] },
    { id: 'thin', label: 'Blood thinner', q: 'Do you take a blood thinner?', hint: 'Such as warfarin, Eliquis, Xarelto or Plavix.',
      a: [
        { t: 'Yes, and I cannot stop it', s: 'yes, cannot stop it', e: {
            pae: [1, 'Most men do not need to stop blood thinners for PAE.'],
            aqua: [-1, 'Men who cannot pause blood thinners usually look at PAE instead.'],
            urolift: [0, ASK],
            rezum: [0, ASK] } },
        { t: 'Yes, but I can pause it', s: 'yes, can pause it', e: {} },
        { t: 'No', s: 'no', e: {} }
      ] },
    { id: 'cath', label: 'Catheter now, or unable to urinate', q: 'Do you have a catheter now, or have you been unable to urinate?', hint: '',
      a: [
        { t: 'Yes', s: 'yes', e: {
            pae: [1, 'Offers a path back to natural voiding, without surgery.'],
            aqua: [1, 'Offers a path back to natural voiding.'] },
          note: 'Getting off a catheter calls for decisive relief of the blockage. Size and overall health decide between PAE and Aquablation.' },
        { t: 'No', s: 'no', e: {} }
      ] },
    { id: 'anes', label: 'Anesthesia', q: 'How do you feel about anesthesia?', hint: '',
      a: [
        { t: 'I would rather stay awake or lightly sedated', s: 'prefer to stay awake or lightly sedated', e: {
            pae: [1, 'Light sedation; no general anesthesia.'],
            urolift: [1, 'Local anesthesia, in the office.'],
            rezum: [1, 'Local anesthesia with light sedation, in the office.'],
            aqua: [-1, 'Uses spinal or general anesthesia.'] } },
        { t: 'Spinal or general anesthesia is fine', s: 'spinal or general is fine', e: {} },
        { t: 'Not sure', s: 'not sure', e: {} }
      ] }
  ];
  var TIER = {
    fit: 'Fits what you told us', ok: 'Still on the menu',
    mid: 'Possible, with a trade-off', low: 'Less likely for you'
  };
  var ORDER = { fit: 0, ok: 1, mid: 2, low: 3 };

  var ans = [], cur = 0, started = false;
  var strip = root.querySelector('.og-strip'), body = root.querySelector('.og-body');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function track(n) { try { if (typeof window.plausible === 'function') window.plausible(n); } catch (e) {} }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function standing(k) {
    var plus = 0, minus = 0, sizeMinus = false, reasons = [];
    for (var i = 0; i < Q.length; i++) {
      if (ans[i] == null) continue;
      var e = Q[i].a[ans[i]].e[k];
      if (!e) continue;
      if (e[0] > 0) plus++; else if (e[0] < 0) { minus++; if (e[2]) sizeMinus = true; }
      reasons.push(e);
    }
    var tier = (sizeMinus || minus >= 2) ? 'low' : minus === 1 ? 'mid' : plus > 0 ? 'fit' : 'ok';
    return { key: k, plus: plus, minus: minus, tier: tier, reasons: reasons };
  }
  function answered() { var n = 0; for (var i = 0; i < Q.length; i++) if (ans[i] != null) n++; return n; }

  function drawStrip() {
    var any = answered() > 0, html = '';
    KEYS.forEach(function (k) {
      var st = standing(k);
      html += '<span class="og-pill' + (any ? ' ' + st.tier : '') + '">' + NAME[k] + '</span>';
    });
    strip.innerHTML = html;
  }

  function drawQuestion(focus) {
    var q = Q[cur], html = '';
    html += '<div class="og-prog"><span>Question ' + (cur + 1) + ' of ' + Q.length + '</span><span class="og-track" aria-hidden="true"><i style="width:' + ((cur + 1) / Q.length * 100) + '%"></i></span></div>';
    html += '<h3 class="og-q" tabindex="-1">' + esc(q.q) + '</h3>';
    if (q.hint) html += '<p class="og-hint">' + esc(q.hint) + (q.id === 'size' ? ' <a href="prostate-size-chart.html">What the number means</a>' : '') + '</p>';
    html += '<div class="og-opts">';
    q.a.forEach(function (a, i) {
      html += '<button type="button" class="og-opt' + (ans[cur] === i ? ' on' : '') + '" data-i="' + i + '">' + esc(a.t) + '</button>';
    });
    html += '</div><div class="og-nav">';
    if (cur > 0) html += '<button type="button" class="og-link" data-go="back">← Previous question</button>';
    if (ans[cur] != null) html += '<button type="button" class="og-link og-next" data-go="next">' + (cur === Q.length - 1 ? 'See what fits' : 'Next question') + ' →</button>';
    html += '</div>';
    body.innerHTML = html;
    if (focus) body.querySelector('.og-q').focus({ preventScroll: true });
  }

  function summaryText(sts) {
    var lines = ['My answers to the BPH option guide on drsawkar.com:'];
    Q.forEach(function (q, i) { var a = q.a[ans[i]]; lines.push('- ' + q.label + ': ' + (a.s || a.t.toLowerCase())); });
    function names(t) { return sts.filter(function (s) { return s.tier === t; }).map(function (s) { return NAME[s.key]; }).join(', '); }
    if (names('fit')) lines.push('Fits what I said: ' + names('fit'));
    if (names('ok')) lines.push('Still on the menu: ' + names('ok'));
    if (names('mid')) lines.push('Possible, with a trade-off: ' + names('mid'));
    if (names('low')) lines.push('Less likely: ' + names('low'));
    return lines.join('\n');
  }

  function drawResults() {
    var sts = KEYS.map(standing).sort(function (a, b) {
      return ORDER[a.tier] - ORDER[b.tier] || b.plus - a.plus || KEYS.indexOf(a.key) - KEYS.indexOf(b.key);
    });
    var fits = sts.filter(function (s) { return s.tier === 'fit'; }).map(function (s) { return NAME[s.key]; });
    var head = fits.length === 4 ? 'All four fit what you told us' :
      fits.length ? fits.join(fits.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1') + (fits.length === 1 ? ' fits' : ' fit') + ' what you told us' :
      'Nothing is ruled in or out yet';
    var html = '<h3 class="og-q og-head" tabindex="-1">' + esc(head) + '</h3>';
    html += '<p class="og-hint">' + (fits.length === 4 ? 'When every option fits, anatomy and recovery preferences break the tie. ' : '') +
      'This is a starting point for the visit, not a diagnosis. Dr. Sawkar confirms what fits with an exam, your symptom score and imaging.</p>';
    html += '<div class="og-cards">';
    sts.forEach(function (s) {
      html += '<article class="og-card ' + s.tier + '"><span class="og-tag">' + TIER[s.tier] + '</span><h4>' + NAME[s.key] + '</h4>';
      if (s.reasons.length) {
        html += '<ul>';
        s.reasons.forEach(function (r) { html += '<li class="' + (r[0] > 0 ? 'p' : r[0] < 0 ? 'm' : 'n') + '">' + esc(r[1]) + '</li>'; });
        html += '</ul>';
      } else {
        html += '<p class="og-none">Nothing you told us points for or against it.</p>';
      }
      html += '<a href="' + HREF[s.key] + '">Read about ' + NAME[s.key] + ' <span aria-hidden="true">→</span></a></article>';
    });
    html += '</div>';
    var notes = [];
    Q.forEach(function (q, i) { var a = q.a[ans[i]]; if (a && a.note) notes.push(a.note); });
    if (notes.length) { html += '<ul class="og-notes">'; notes.forEach(function (n) { html += '<li>' + esc(n) + '</li>'; }); html += '</ul>'; }
    var text = summaryText(sts);
    html += '<div class="og-sum"><span class="h-eyebrow">Bring this to your visit, or paste it into your message</span><pre id="og-text">' + esc(text) + '</pre>' +
      '<div class="og-acts"><a class="btn ink" href="contact.html" data-request>Request an appointment</a>' +
      '<button type="button" class="btn ghost" data-go="copy">Copy my answers</button>' +
      '<button type="button" class="og-link" data-go="restart">Start over</button></div></div>';
    body.innerHTML = html;
    root.classList.add('done');
    body.querySelector('.og-head').focus({ preventScroll: true });
    var top = root.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    track('Option guide finished');
  }

  function go(to) {
    if (to >= Q.length) { drawStrip(); drawResults(); return; }
    cur = Math.max(0, to);
    root.classList.remove('done');
    drawStrip();
    drawQuestion(true);
  }

  body.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('.og-opt');
    if (o) {
      ans[cur] = parseInt(o.getAttribute('data-i'), 10);
      if (!started) { started = true; track('Option guide started'); }
      [].forEach.call(body.querySelectorAll('.og-opt'), function (b) { b.classList.toggle('on', b === o); });
      drawStrip();
      var at = cur;
      setTimeout(function () { if (cur === at && !root.classList.contains('done')) go(at + 1); }, reduce ? 0 : 320);
      return;
    }
    var b = e.target.closest && e.target.closest('[data-go]');
    if (!b) return;
    var what = b.getAttribute('data-go');
    if (what === 'back') go(cur - 1);
    else if (what === 'next') go(cur + 1);
    else if (what === 'restart') { ans = []; go(0); }
    else if (what === 'copy') {
      var text = d.getElementById('og-text').textContent;
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy my answers'; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { selectText(); });
      } else selectText();
      track('Option guide: copied answers');
    }
  });
  function selectText() {
    var pre = d.getElementById('og-text'), r = d.createRange();
    r.selectNodeContents(pre);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  root.hidden = false;
  drawStrip();
  drawQuestion(false);
})();
