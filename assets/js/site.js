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

  /* ---------- words for the request sheet and menu (English, and Spanish on the lang="es" pages) ---------- */
  var L = spanish ? {
    openUntil: 'Abierto ahora, hasta las 5 PM', closed: 'Cerrado ahora, abre ', today: 'hoy a las 9 AM', tomorrow: 'ma\u00f1ana a las 9 AM',
    monday: 'el lunes a las 9 AM', hours: 'Lunes a viernes, de 9 AM a 5 PM',
    title: 'Solicite una cita', close: 'Cerrar',
    lede: 'Aceptamos pacientes nuevos, con citas el mismo d\u00eda o al d\u00eda siguiente para casos urgentes. No necesita referido con Medicare o un plan PPO.',
    text: 'Env\u00ede un mensaje de texto', textSub: 'Respuesta por texto, normalmente el mismo d\u00eda h\u00e1bil',
    call: 'Llame al (714) 919-8143', ifText: 'Si env\u00eda un mensaje',
    s1: 'La ventana de mensajes dice <b>Prestige Medical Group</b>. Es el grupo m\u00e9dico del Dr. Sawkar; est\u00e1 en el lugar correcto.',
    s2: 'Klara, su servicio de mensajes seguros, le env\u00eda un c\u00f3digo por texto para confirmar su n\u00famero de celular.',
    s3: 'Escriba una l\u00ednea sobre lo que necesita. La oficina cuenta con personal que habla espa\u00f1ol.',
    foot: 'Medicare y la mayor\u00eda de los planes PPO. Telemedicina disponible. En una emergencia, llame al 911.',
    menu: 'Men\u00fa', openMenu: 'Abrir el men\u00fa', closeMenu: 'Cerrar el men\u00fa',
    links: [['agrandamiento-de-prostata.html', 'Pr\u00f3stata agrandada'], ['embolizacion-de-la-prostata.html', 'Embolizaci\u00f3n (PAE)'],
            ['services.html', 'Tratamientos'], ['surgeon.html', 'Dr. Sawkar'], ['contact.html', 'Visita y direcciones']],
    request: 'Solicite una cita', callBtn: 'Llamar al (714) 919-8143'
  } : {
    openUntil: 'Open now, until 5 PM', closed: 'Closed now, opens ', today: 'today at 9 AM', tomorrow: 'tomorrow at 9 AM',
    monday: 'Monday at 9 AM', hours: 'Monday to Friday, 9 AM to 5 PM',
    title: 'Request an appointment', close: 'Close',
    lede: 'New patients are welcome, with same-day and next-day visits for urgent concerns. No referral is needed with Medicare or a PPO plan.',
    text: 'Text the office', textSub: 'Replies by text, usually the same business day',
    call: 'Call (714) 919-8143', ifText: 'If you text',
    s1: 'The message window says <b>Prestige Medical Group</b>. That is the group Dr. Sawkar practices with, so you are in the right place.',
    s2: 'Klara, its secure messaging service, texts you a code to confirm your cell number.',
    s3: 'Write one line about what you need. The new patient coordinator replies by text.',
    foot: 'Medicare and most PPO plans. Telehealth available. For an emergency, call 911.',
    menu: 'Menu', openMenu: 'Open the menu', closeMenu: 'Close the menu',
    links: [['services.html', 'Treatments'], ['bph.html', 'Enlarged prostate'], ['surgeon.html', 'Dr. Sawkar'],
            ['/#guides', 'Patient guides'], ['contact.html', 'Visit and directions']],
    request: 'Request an appointment', callBtn: 'Call (714) 919-8143'
  };

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
      if (weekday && hr >= 9 && hr < 17) return { open: true, text: L.openUntil };
      var next = L.tomorrow;
      if (weekday && hr < 9) next = L.today;
      else if (wd === 'Fri' || wd === 'Sat') next = L.monday;
      return { open: false, text: L.closed + next };
    } catch (e) {
      return { open: false, text: L.hours };
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
        '<div class="sh-head"><h2 id="rs-title">' + L.title + '</h2>' +
          '<button type="button" class="sh-x" data-close aria-label="' + L.close + '">' + X + '</button></div>' +
        '<p class="sh-lede">' + L.lede + '</p>' +
        '<a class="sh-opt primary" data-act="text" href="' + textHref + '"' + textAttrs + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v11H9.500L5 20v-3.500H4z"/><path d="M8 9.500h8M8 12.500h5"/></svg>' +
          '<span><b>' + L.text + '</b><small>' + L.textSub + '</small></span></a>' +
        '<a class="sh-opt" data-act="call" href="tel:+17149198143">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.500 3.500h3l1.500 4-2 1.500a12 12 0 0 0 6 6l1.500-2 4 1.500v3a2 2 0 0 1-2 2C10.500 19.500 4.500 13.500 4.500 5.500a2 2 0 0 1 2-2z"/></svg>' +
          '<span><b>' + L.call + '</b><small><i class="sh-dot' + (s.open ? ' open' : '') + '" aria-hidden="true"></i><span>' + s.text + '</span></small></span></a>' +
        '<div class="sh-steps"><span class="h-eyebrow">' + L.ifText + '</span><ol>' +
          '<li><span>' + L.s1 + '</span></li>' +
          '<li><span>' + L.s2 + '</span></li>' +
          '<li><span>' + L.s3 + '</span></li>' +
        '</ol></div>' +
        '<p class="sh-foot">' + L.foot + '</p>' +
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

  var REQ = spanish ? /^\s*solicite una cita\s*$/i : /^\s*request an? (appointment|consultation)\s*$/i;
  function isRequestLink(a) {
    if (a.hasAttribute('data-request')) return true;
    if (a.closest('.callbar') && a.classList.contains('primary')) return true;
    var href = a.getAttribute('href') || '';
    return href === 'contact.html' && REQ.test(a.textContent || '');
  }
  if (canDialog) {
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
  if (canDialog && navRight) {
    var mb = d.createElement('button');
    mb.type = 'button';
    mb.className = 'nav-menu';
    mb.setAttribute('aria-label', L.openMenu);
    mb.setAttribute('aria-haspopup', 'dialog');
    mb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    navRight.appendChild(mb);
    mb.addEventListener('click', function () {
      if (!menu) {
        menu = d.createElement('dialog');
        menu.className = 'menu';
        menu.setAttribute('aria-label', L.menu);
        var mlinks = '';
        L.links.forEach(function (ln, i) {
          mlinks += '<a class="m-link' + (i === L.links.length - 1 ? ' last' : '') + '" href="' + ln[0] + '"' +
            (ln[0].indexOf('#') !== -1 ? ' data-close' : '') + '>' + ln[1] + '</a>';
        });
        menu.innerHTML =
          '<div class="menu-in">' +
            '<div class="menu-head"><span>' + L.menu + '</span><button type="button" class="sh-x" data-close aria-label="' + L.closeMenu + '">' + X + '</button></div>' +
            mlinks +
            '<div class="m-acts">' +
              '<a class="btn bone" href="contact.html" data-request>' + L.request + '</a>' +
              '<a class="btn ghost-d" href="tel:+17149198143">' + L.callBtn + '</a>' +
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

  /* ---------- phone: a comparison table becomes swipe cards ----------
     On a table.cmp add "cmp-cards-m" when the columns are the things compared (one card
     per column), or "cmp-rows-m" when the rows are (one card per row). */
  d.querySelectorAll('table.cmp.cmp-cards-m, table.cmp.cmp-rows-m').forEach(function (tb) {
    var wrap = tb.closest('.tblwrap');
    var heads = tb.querySelectorAll('thead th');
    var rows = tb.querySelectorAll('tbody tr');
    if (!wrap || heads.length < 2 || !rows.length) return;
    var byRow = tb.classList.contains('cmp-rows-m');
    var box = d.createElement('div');
    box.className = 'cmp-cards';
    function add(html) {
      var card = d.createElement('article');
      card.className = 'bph-card';
      card.innerHTML = html + '</dl>';
      box.appendChild(card);
    }
    var i, j, cells, html;
    if (byRow) {
      for (i = 0; i < rows.length; i++) {
        cells = rows[i].children;
        if (!cells.length) continue;
        html = '<div class="bph-tag">' + heads[0].innerHTML + '</div><h3>' + cells[0].innerHTML + '</h3><dl>';
        for (j = 1; j < cells.length && j < heads.length; j++) {
          html += '<div><dt>' + heads[j].innerHTML + '</dt><dd>' + cells[j].innerHTML + '</dd></div>';
        }
        add(html);
      }
    } else {
      for (j = 1; j < heads.length; j++) {
        html = '<h3>' + heads[j].innerHTML + '</h3><dl>';
        for (i = 0; i < rows.length; i++) {
          cells = rows[i].children;
          if (cells.length > j) html += '<div><dt>' + cells[0].innerHTML + '</dt><dd>' + cells[j].innerHTML + '</dd></div>';
        }
        add(html);
      }
    }
    if (!box.children.length) return;
    wrap.classList.add('has-cards');
    wrap.parentNode.insertBefore(box, wrap.nextSibling);
  });

  /* ---------- phone: a table whose rows are the things described stacks into blocks ----------
     Add class "stack-m" to a table.cmp. Each cell is labeled with its column name so the
     stylesheet can show one block per row on phones. Wide screens keep the table. */
  d.querySelectorAll('table.cmp.stack-m').forEach(function (tb) {
    var heads = tb.querySelectorAll('thead th');
    if (!heads.length) return;
    tb.querySelectorAll('tbody tr').forEach(function (tr) {
      for (var j = 0; j < tr.children.length && j < heads.length; j++) {
        var label = (heads[j].textContent || '').replace(/\s+/g, ' ').trim();
        if (label) tr.children[j].setAttribute('data-label', label);
      }
    });
    tb.classList.add('stacked');
    var w = tb.closest('.tblwrap');
    if (w) w.classList.add('has-stack');
  });

  /* ---------- symptom score: one question at a time, answers written out ----------
     Works on any form.quiz whose questions are 0-5 radio rows (.opts.num). The words come
     from each input's aria-label. A tap moves to the next question; keyboard users get a
     Next button. The page's own script still does the scoring when its button is pressed. */
  d.querySelectorAll('form.quiz').forEach(function (form) {
    var sets = [].slice.call(form.querySelectorAll('fieldset')).filter(function (f) { return f.querySelector('.opts.num'); });
    var act = form.querySelector('.quiz-act');
    var go = act && act.querySelector('button');
    var res = form.querySelector('.quiz-res');
    if (sets.length < 3 || !go) return;
    form.classList.add('qz');
    sets.forEach(function (f) {
      f.querySelectorAll('.opt').forEach(function (o) {
        var inp = o.querySelector('input'), w = inp && inp.getAttribute('aria-label');
        if (w && !o.querySelector('em')) { var em = d.createElement('em'); em.textContent = w; o.appendChild(em); }
      });
    });
    var bar = d.createElement('div');
    bar.className = 'qz-bar';
    bar.innerHTML = '<span class="qz-count" aria-live="polite"></span><span class="qz-track" aria-hidden="true"><i></i></span>';
    form.insertBefore(bar, sets[0]);
    var nav = d.createElement('div');
    nav.className = 'qz-nav';
    nav.innerHTML = '<button type="button" class="qz-back">\u2190 ' + (spanish ? 'Anterior' : 'Previous question') + '</button>' +
      '<button type="button" class="qz-next">' + (spanish ? 'Siguiente' : 'Next question') + ' \u2192</button>';
    act.parentNode.insertBefore(nav, act);
    var back = nav.firstChild, next = nav.lastChild, cur = 0;
    function answered(i) { return !!sets[i].querySelector('input:checked'); }
    function show(i) {
      cur = Math.max(0, Math.min(sets.length - 1, i));
      sets.forEach(function (f, k) { f.hidden = k !== cur; });
      bar.firstChild.textContent = (spanish ? 'Pregunta ' : 'Question ') + (cur + 1) + (spanish ? ' de ' : ' of ') + sets.length;
      bar.querySelector('i').style.width = ((cur + 1) / sets.length * 100) + '%';
      back.hidden = cur === 0;
      next.hidden = cur === sets.length - 1;
      next.disabled = !answered(cur);
      act.hidden = cur !== sets.length - 1;
      nav.hidden = back.hidden && next.hidden;
    }
    form.addEventListener('change', function (e) {
      if (e.target.closest && sets.indexOf(e.target.closest('fieldset')) !== -1) {
        next.disabled = !answered(cur);
        if (res) res.classList.remove('show');
      }
    });
    form.addEventListener('click', function (e) {
      /* a real tap lands on the label, never on the hidden input; arrow keys land on the input */
      var o = e.target.closest && e.target.closest('.opt');
      if (!o || e.target.tagName === 'INPUT') return;
      var i = sets.indexOf(o.closest('fieldset'));
      if (i !== cur) return;
      setTimeout(function () {
        if (!answered(i) || cur !== i) return;
        if (i < sets.length - 1) show(i + 1); else go.click();
      }, reduce ? 0 : 280);
    });
    back.addEventListener('click', function () { show(cur - 1); });
    next.addEventListener('click', function () { if (answered(cur)) show(cur + 1); });
    go.addEventListener('click', function () { track('Symptom score calculated'); });
    show(0);
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
