/* Shared behavior for every page: request sheet, phone menu, collapsible
   phone footer, count-up numbers, homepage treatment switcher, and visit
   counting hooks. Everything here is an enhancement: with scripts off, the
   "Request an appointment" links still go to contact.html. */
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  root.classList.add('js');

  var KLARA = 'https://patient.klara.com/#/widget/10acdbe6-eddf-4a75-92f8-9c28e3fbfcf7';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia('(max-width: 620px)');
  var narrow = window.matchMedia('(max-width: 960px)');
  var spanish = (root.lang || 'en').slice(0, 2).toLowerCase() === 'es';
  var onContact = /(^|\/)contact(\.html)?$/.test(location.pathname);
  var canDialog = typeof HTMLDialogElement === 'function';

  /* ---------- visit counting ----------
     Counts named actions (no cookies, no personal data) once an analytics
     script is installed. Until then this does nothing. */
  function track(name) {
    try { if (typeof window.plausible === 'function') window.plausible(name); } catch (e) {}
  }

  /* ---------- office hours, Pacific time ---------- */
  function officeStatus() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hour12: false
      }).formatToParts(new Date());
      var wd = '', hr = 0;
      parts.forEach(function (p) {
        if (p.type === 'weekday') wd = p.value;
        if (p.type === 'hour') hr = parseInt(p.value, 10) % 24;
      });
      var weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(wd) !== -1;
      if (weekday && hr >= 9 && hr < 17) return { open: true, text: 'Open now, until 5 PM' };
      var next = 'tomorrow at 9 AM';
      if (weekday && hr < 9) next = 'today at 9 AM';
      else if (wd === 'Fri' || wd === 'Sat') next = 'Monday at 9 AM';
      return { open: false, text: 'Closed now, opens ' + next };
    } catch (e) {
      return { open: false, text: 'Monday to Friday, 9 AM to 5 PM' };
    }
  }
  d.querySelectorAll('[data-office-status]').forEach(function (el) {
    var s = officeStatus();
    el.textContent = s.text;
    var dot = el.parentNode && el.parentNode.querySelector('.sh-dot');
    if (dot) dot.classList.toggle('open', s.open);
  });

  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function wireDialog(dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();               /* click on the backdrop */
      var c = e.target.closest && e.target.closest('[data-close]');
      if (c) dlg.close();
    });
  }

  /* ---------- request sheet ---------- */
  var sheet = null;
  function buildSheet() {
    var iphone = window.innerWidth <= 768 && !/Android/i.test(navigator.userAgent);
    var textHref = iphone ? KLARA : 'contact.html#klara';
    var textAttrs = iphone ? ' target="_blank" rel="noopener noreferrer"' : '';
    var s = officeStatus();
    sheet = d.createElement('dialog');
    sheet.className = 'sheet';
    sheet.id = 'request-sheet';
    sheet.setAttribute('aria-labelledby', 'rs-title');
    sheet.innerHTML =
      '<div class="sheet-in">' +
        '<div class="sh-grab" aria-hidden="true"></div>' +
        '<div class="sh-head"><h2 id="rs-title">Request an appointment</h2>' +
          '<button type="button" class="sh-x" data-close aria-label="Close">' + X + '</button></div>' +
        '<p class="sh-lede">New patients are welcome, with same-day and next-day visits for urgent concerns. No referral is needed with Medicare or a PPO plan.</p>' +
        '<a class="sh-opt primary" data-act="text" href="' + textHref + '"' + textAttrs + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v11H9.500L5 20v-3.500H4z"/><path d="M8 9.500h8M8 12.500h5"/></svg>' +
          '<span><b>Text the office</b><small>Replies by text, usually the same business day</small></span></a>' +
        '<a class="sh-opt" data-act="call" href="tel:+17149198143">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.500 3.500h3l1.500 4-2 1.500a12 12 0 0 0 6 6l1.500-2 4 1.500v3a2 2 0 0 1-2 2C10.500 19.500 4.500 13.500 4.500 5.500a2 2 0 0 1 2-2z"/></svg>' +
          '<span><b>Call (714) 919-8143</b><small><i class="sh-dot' + (s.open ? ' open' : '') + '" aria-hidden="true"></i><span>' + s.text + '</span></small></span></a>' +
        '<div class="sh-steps"><span class="h-eyebrow">If you text</span><ol>' +
          '<li><span>The message window says <b>Prestige Medical Group</b>. That is the group Dr. Sawkar practices with, so you are in the right place.</span></li>' +
          '<li><span>Klara, its secure messaging service, texts you a code to confirm your cell number.</span></li>' +
          '<li><span>Write one line about what you need. The new patient coordinator replies by text.</span></li>' +
        '</ol></div>' +
        '<p class="sh-foot">Medicare and most PPO plans. Telehealth available. For an emergency, call 911.</p>' +
      '</div>';
    d.body.appendChild(sheet);
    wireDialog(sheet);
    sheet.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-act]');
      if (!a) return;
      track(a.getAttribute('data-act') === 'call' ? 'Sheet: call' : 'Sheet: text the office');
      if (a.getAttribute('data-act') === 'text' && onContact && a.getAttribute('href').indexOf('#klara') !== -1) {
        e.preventDefault();
        sheet.close();
        var box = d.getElementById('klara');
        if (box) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      } else {
        sheet.close();
      }
    });
  }
  function openSheet(from) {
    if (!sheet) buildSheet();
    if (menu && menu.open) menu.close();
    sheet.showModal();
    track('Request sheet opened' + (from ? ': ' + from : ''));
  }

  var REQ = /^\s*request an? (appointment|consultation)\s*$/i;
  function isRequestLink(a) {
    if (a.hasAttribute('data-request')) return true;
    if (a.closest('.callbar') && a.classList.contains('primary')) return true;
    var href = a.getAttribute('href') || '';
    return href === 'contact.html' && REQ.test(a.textContent || '');
  }
  if (canDialog && !spanish) {
    d.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a');
      if (!a || !isRequestLink(a)) return;
      e.preventDefault();
      var where = a.closest('.callbar') ? 'bottom bar' : a.closest('.nav') ? 'header' : a.closest('dialog') ? 'menu' : 'page';
      openSheet(where);
    });
  }
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (a && !a.closest('dialog.sheet')) track('Call tapped');
  });

  /* ---------- phone menu ---------- */
  var menu = null;
  var navRight = d.querySelector('.nav .nav-right');
  if (canDialog && navRight && !spanish) {
    var mb = d.createElement('button');
    mb.type = 'button';
    mb.className = 'nav-menu';
    mb.setAttribute('aria-label', 'Open the menu');
    mb.setAttribute('aria-haspopup', 'dialog');
    mb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    navRight.appendChild(mb);
    mb.addEventListener('click', function () {
      if (!menu) {
        menu = d.createElement('dialog');
        menu.className = 'menu';
        menu.setAttribute('aria-label', 'Menu');
        menu.innerHTML =
          '<div class="menu-in">' +
            '<div class="menu-head"><span>Menu</span><button type="button" class="sh-x" data-close aria-label="Close the menu">' + X + '</button></div>' +
            '<a class="m-link" href="services.html">Treatments</a>' +
            '<a class="m-link" href="bph.html">Enlarged prostate</a>' +
            '<a class="m-link" href="surgeon.html">Dr. Sawkar</a>' +
            '<a class="m-link" href="/#guides" data-close>Patient guides</a>' +
            '<a class="m-link last" href="contact.html">Visit and directions</a>' +
            '<div class="m-acts">' +
              '<a class="btn bone" href="contact.html" data-request>Request an appointment</a>' +
              '<a class="btn ghost-d" href="tel:+17149198143">Call (714) 919-8143</a>' +
            '</div>' +
          '</div>';
        d.body.appendChild(menu);
        wireDialog(menu);
      }
      menu.showModal();
      track('Menu opened');
    });
  }

  /* ---------- phone footer: sections open on tap ---------- */
  d.querySelectorAll('.footer .fcol .fh').forEach(function (h) {
    function sync() {
      if (phone.matches) {
        h.setAttribute('role', 'button');
        h.setAttribute('tabindex', '0');
        h.setAttribute('aria-expanded', h.parentNode.classList.contains('open') ? 'true' : 'false');
      } else {
        h.removeAttribute('role'); h.removeAttribute('tabindex'); h.removeAttribute('aria-expanded');
      }
    }
    function toggle() {
      if (!phone.matches) return;
      h.parentNode.classList.toggle('open');
      sync();
    }
    h.addEventListener('click', toggle);
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    if (phone.addEventListener) phone.addEventListener('change', sync);
    sync();
  });

  /* ---------- phone: card groups fold to their headings ----------
     Add class "fold-m" to a group; each child with an h3 or h4 becomes a row
     that opens on tap. Wide screens are untouched. */
  d.querySelectorAll('.fold-m > *').forEach(function (item) {
    var h = item.querySelector('h3, h4');
    if (!h || h.parentNode !== item) return;
    h.classList.add('fold-h');
    function sync() {
      if (phone.matches) {
        h.setAttribute('role', 'button');
        h.setAttribute('tabindex', '0');
        h.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
      } else {
        h.removeAttribute('role'); h.removeAttribute('tabindex'); h.removeAttribute('aria-expanded');
      }
    }
    function toggle() {
      if (!phone.matches) return;
      item.classList.toggle('open');
      sync();
    }
    h.addEventListener('click', toggle);
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    if (phone.addEventListener) phone.addEventListener('change', sync);
    sync();
  });

  /* ---------- phone: whole sections fold to their heading ----------
     Add class "fold-sec" to a <section>. Its first h2 becomes the row; everything else
     in the section is hidden until the row is tapped. A link to an id inside a folded
     section (from this page or another) opens it first. Wide screens are untouched. */
  var foldSecs = d.querySelectorAll('section.fold-sec');
  foldSecs.forEach(function (sec) {
    var h = sec.querySelector('h2');
    if (!h) { sec.classList.remove('fold-sec'); return; }
    h.classList.add('fold-h2');
    for (var n = h.parentNode; n && n !== sec; n = n.parentNode) n.classList.add('fold-keep');
    function sync() {
      if (phone.matches) {
        h.setAttribute('role', 'button');
        h.setAttribute('tabindex', '0');
        h.setAttribute('aria-expanded', sec.classList.contains('open') ? 'true' : 'false');
      } else {
        h.removeAttribute('role'); h.removeAttribute('tabindex'); h.removeAttribute('aria-expanded');
      }
    }
    sec._foldSync = sync;
    function toggle() {
      if (!phone.matches) return;
      var open = sec.classList.toggle('open');
      sync();
      if (open) track('Section opened: ' + (h.textContent || '').trim().slice(0, 48));
    }
    h.addEventListener('click', toggle);
    h.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    if (phone.addEventListener) phone.addEventListener('change', sync);
    sync();
  });
  var liveFolds = d.querySelectorAll('section.fold-sec');
  if (liveFolds.length) liveFolds[liveFolds.length - 1].classList.add('fold-end');
  function openFoldFor(id, scroll) {
    if (!id || !phone.matches) return;
    var t = null;
    try { t = d.getElementById(decodeURIComponent(id)); } catch (e) {}
    var sec = t && t.closest && t.closest('section.fold-sec');
    if (!sec) return;
    if (!sec.classList.contains('open')) { sec.classList.add('open'); if (sec._foldSync) sec._foldSync(); }
    if (scroll) t.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  if (liveFolds.length) {
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1) openFoldFor(a.getAttribute('href').slice(1), false);
    });
    window.addEventListener('hashchange', function () { openFoldFor(location.hash.slice(1), true); });
    if (location.hash.length > 1) openFoldFor(location.hash.slice(1), true);
  }

  /* ---------- phone: a comparison table becomes one swipe card per column ----------
     Add class "cmp-cards-m" to a table.cmp whose columns are the things compared. */
  d.querySelectorAll('table.cmp.cmp-cards-m').forEach(function (tb) {
    var wrap = tb.closest('.tblwrap');
    var heads = tb.querySelectorAll('thead th');
    var rows = tb.querySelectorAll('tbody tr');
    if (!wrap || heads.length < 3 || !rows.length) return;
    var box = d.createElement('div');
    box.className = 'cmp-cards';
    for (var j = 1; j < heads.length; j++) {
      var html = '<h3>' + heads[j].innerHTML + '</h3><dl>';
      for (var i = 0; i < rows.length; i++) {
        var th = rows[i].querySelector('th'), td = rows[i].querySelectorAll('td')[j - 1];
        if (th && td) html += '<div><dt>' + th.innerHTML + '</dt><dd>' + td.innerHTML + '</dd></div>';
      }
      var card = d.createElement('article');
      card.className = 'bph-card';
      card.innerHTML = html + '</dl>';
      box.appendChild(card);
    }
    wrap.classList.add('has-cards');
    wrap.parentNode.insertBefore(box, wrap.nextSibling);
  });

  /* ---------- numbers count up once, when first seen ---------- */
  var counters = d.querySelectorAll('[data-count]');
  if (counters.length && !reduce && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, end = parseInt(el.getAttribute('data-count'), 10), t0 = null, dur = 1400;
        function step(t) {
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / dur);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        }
        el.textContent = '0';
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- homepage: what Dr. Sawkar treats ----------
     Wide screens: pointing at a row swaps the artwork; a click follows the link.
     Phones and tablets: a tap opens the row in place; the link is inside it. */
  var items = d.querySelectorAll('.tx2-item');
  if (items.length) {
    var arts = d.querySelectorAll('.tx2-art');
    function select(key, allowNone) {
      items.forEach(function (it) {
        var match = it.getAttribute('data-k') === key;
        var on = match && !(allowNone && it.classList.contains('on'));
        it.classList.toggle('on', on);
        var b = it.querySelector('.tx2-btn');
        if (narrow.matches) b.setAttribute('aria-expanded', on ? 'true' : 'false');
        else b.removeAttribute('aria-expanded');
      });
      if (!allowNone) arts.forEach(function (a) { a.classList.toggle('show', a.getAttribute('data-k') === key); });
    }
    items.forEach(function (it) {
      var b = it.querySelector('.tx2-btn'), key = it.getAttribute('data-k');
      b.addEventListener('mouseenter', function () { if (!narrow.matches) select(key); });
      b.addEventListener('focus', function () { if (!narrow.matches) select(key); });
      b.addEventListener('click', function (e) {
        if (!narrow.matches || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        select(key, true);
        track('Home: opened ' + key);
      });
      if (narrow.matches) {
        b.setAttribute('role', 'button');
        b.setAttribute('aria-expanded', it.classList.contains('on') ? 'true' : 'false');
      }
    });
  }
})();
