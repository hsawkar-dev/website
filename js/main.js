/* =============================================
   Dr. Hari Sawkar MD — Main JavaScript
   ============================================= */

// ===== NAV SCROLL BEHAVIOR =====
const nav = document.getElementById('nav');

// If nav doesn't have 'scrolled' class already (home page transparent nav),
// add scroll listener
if (nav && !nav.classList.contains('scrolled')) {
  window.addEventListener('scroll', function () {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

// ===== MOBILE MENU =====
function openMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('overlay');
  if (menu) menu.classList.add('open');
  if (overlay) overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('overlay');
  if (menu) menu.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Close mobile menu on Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMobileMenu();
});

// ===== ACCORDION =====
function toggleAccordion(btn) {
  const item = btn.closest('.accordion-item');
  const isOpen = item.classList.contains('open');

  // Close all other open accordion items
  document.querySelectorAll('.accordion-item.open').forEach(function (openItem) {
    if (openItem !== item) {
      openItem.classList.remove('open');
    }
  });

  // Toggle current item
  item.classList.toggle('open', !isOpen);
}

// ===== SCROLL ANIMATIONS (Intersection Observer) =====
const fadeEls = document.querySelectorAll('.fade-up');

if (fadeEls.length > 0) {
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  fadeEls.forEach(function (el) {
    observer.observe(el);
  });
}

// ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const navHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-height')
      ) || 80;
      const targetY = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  });
});

// ===== CONTACT FORM HANDLER =====
function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const successMsg = document.getElementById('formSuccess');

  // In a real implementation, you would POST to a backend API here.
  // For now, we show a success message.
  if (successMsg) {
    form.style.display = 'none';
    successMsg.style.display = 'block';
  }

  // Scroll to success message
  if (successMsg) {
    successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ===== ACTIVE NAV LINK (highlight current page) =====
(function () {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-menu-links a').forEach(function (link) {
    const href = link.getAttribute('href');
    if (href && href.split('#')[0] === currentPath) {
      link.classList.add('active');
    }
  });
})();

// ===== PHONE NUMBER FORMATTING =====
const phoneInputs = document.querySelectorAll('input[type="tel"]');
phoneInputs.forEach(function (input) {
  input.addEventListener('input', function () {
    let val = input.value.replace(/\D/g, '');
    if (val.length >= 10) {
      val = val.substring(0, 10);
      val = '(' + val.substring(0, 3) + ') ' + val.substring(3, 6) + '-' + val.substring(6);
    }
    input.value = val;
  });
});
