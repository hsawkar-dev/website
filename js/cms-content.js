/* cms-content.js — loads editable content from data/ JSON files */
(async function () {
  try {
    const [pr, dr] = await Promise.all([
      fetch('data/practice.json').then(r => r.json()),
      fetch('data/doctor.json').then(r => r.json())
    ]);

    /* ── Phone number (display only) ─────────────────────────── */
    document.querySelectorAll('[data-cms="phone"]').forEach(el => {
      el.textContent = pr.phone;
    });

    /* ── Phone links (href + display text) ───────────────────── */
    document.querySelectorAll('[data-cms="phone-link"]').forEach(el => {
      el.textContent = pr.phone;
      el.href = 'tel:' + pr.phone.replace(/\D/g, '');
    });

    /* ── Address block in footers ─────────────────────────────── */
    document.querySelectorAll('[data-cms="address"]').forEach(el => {
      el.innerHTML =
        pr.address_line1 + '<br>' + pr.address_line2 + '<br>' + pr.city;
    });

    /* ── Contact page: address detail line ───────────────────── */
    const addrDetail = document.querySelector('[data-cms="address-detail"]');
    if (addrDetail) {
      addrDetail.innerHTML =
        pr.address_line1 + ', ' + pr.address_line2 + '<br>' + pr.city;
    }

    /* ── Contact page: office hours ──────────────────────────── */
    const hoursEl = document.querySelector('[data-cms="hours"]');
    if (hoursEl) hoursEl.textContent = pr.hours;

    const hoursNoteEl = document.querySelector('[data-cms="hours-note"]');
    if (hoursNoteEl) hoursNoteEl.textContent = pr.hours_note;

    /* ── Doctor photo ─────────────────────────────────────────── */
    if (dr.photo) {
      document.querySelectorAll('[data-cms="doctor-photo"]').forEach(img => {
        img.src = dr.photo;
        img.alt = dr.photo_alt || 'Dr. Hari Sawkar, MD';
        img.style.display = 'block';
      });
      document.querySelectorAll('[data-cms="doctor-photo-placeholder"]')
        .forEach(el => { el.style.display = 'none'; });
    }

  } catch (e) {
    /* Fail silently — page content stays as-is if fetch fails */
    console.warn('CMS content loader:', e);
  }
})();
