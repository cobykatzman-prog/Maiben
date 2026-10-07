/* Aventis — header, modals, sliders, counters, fleet filter, cursor */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header */
  const header = $('#main-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 60);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const nav = $('#site-nav'), toggle = $('#nav-toggle');
  const setNav = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setNav(false)));

  /* Current-section nav highlight */
  const links = $$('#site-nav a');
  const secs = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  secs.forEach((s) => {
    new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle('current', a.getAttribute('href') === '#' + s.id));
    }), { rootMargin: '-45% 0px -50% 0px' }).observe(s);
  });

  /* Modals: focus trap, Escape, restore focus */
  let lastFocus = null, openModal = null, openedAt = 0;
  const focusable = (m) => $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', m).filter((el) => el.offsetParent !== null);
  const open = (id) => {
    const m = document.getElementById(id);
    if (!m) return;
    if (openModal && openModal !== m) close(true);
    lastFocus = document.activeElement;
    m.hidden = false; openModal = m; openedAt = performance.now();
    document.body.classList.add('modal-open');
    setTimeout(() => (focusable(m).find((el) => !el.matches('.modal-close')) || focusable(m)[0])?.focus(), 30);
  };
  const close = (keepFocus) => {
    if (!openModal) return;
    openModal.hidden = true; openModal = null;
    document.body.classList.remove('modal-open');
    if (!keepFocus) lastFocus?.focus?.();
  };
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); open(o.dataset.open); return; }
    if (e.target.closest('[data-close]') || (openModal && e.target === openModal && performance.now() - openedAt > 400)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (!openModal) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusable(openModal);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('#search-open').addEventListener('click', () => open('search-modal'));

  /* Search */
  const INDEX = [
    ['Mustard herring', 'Tangy, light and our bestseller', '#flavours', 'mustard tangy bestseller'],
    ['Chilli herring', 'Spicy, aromatic and flavourful', '#flavours', 'chilli spicy hot'],
    ['Schmaltz herring', 'Traditional, classic and the original', '#flavours', 'schmaltz traditional onion classic'],
    ['7 Spiced herring', 'A unique blend of 7 aromatic spices', '#flavours', 'spiced seven spices'],
    ['Sizes and pricing', '250g $15 · 500g $28 · 750g $40 · 1kg $50', '#pricing', 'price size cost 250 500 750 1kg'],
    ['Bulk and catering', 'Shuls, events, caterers', '#contact', 'bulk catering shul event kiddush simcha'],
  ];
  const sIn = $('#search-input'), sOut = $('#search-results');
  const runSearch = (q) => {
    q = q.trim().toLowerCase(); sOut.innerHTML = '';
    if (!q) return;
    const words = q.replace(/[+]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    const hits = INDEX.filter(([n, , , k]) => words.some((w) => (n + ' ' + k).toLowerCase().includes(w)));
    if (!hits.length) { sOut.textContent = 'No matches. Try “Bahamas” or “catamaran”, or ask a broker.'; return; }
    hits.forEach(([n, d, h]) => { const a = document.createElement('a'); a.href = h; a.innerHTML = '<strong></strong><span></span>'; a.firstChild.textContent = n; a.lastChild.textContent = d; a.addEventListener('click', () => close(true)); sOut.append(a); });
  };
  sIn.addEventListener('input', () => runSearch(sIn.value));
  $$('.chips button').forEach((b) => b.addEventListener('click', () => { sIn.value = b.dataset.q; runSearch(b.dataset.q); sIn.focus(); }));

  /* ---- Orders: nothing is saved until Stripe confirms payment (see supabase/functions) ---- */
  const CFG = window.MAIBEN || {};
  const PRICE = { 250: 15, 500: 28, 750: 40, 1000: 50 }, DELIVERY = 5;
  const sizeLabel = (g) => (g >= 1000 ? '1kg' : g + 'g');
  const bkForm = $('#booking-form');
  const emailOk = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const fail = (el, msg) => { el.textContent = msg; el.classList.add('err'); };
  const callLine = () => `Or call Benj on ${CFG.phone || '0422 601 402'}.`;
  const fn = (name, body) => fetch(`${CFG.supabaseUrl}/functions/v1/${name}`, {
    method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  // Enquiries are not payments, so they are saved straight away.
  const save = async (table, row) => {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error('save failed ' + r.status);
  };

  const totalFor = () => {
    const q = Math.max(1, Math.min(99, +$('#bk-qty').value || 1)), g = +$('#bk-size').value, d = $('#bk-how').value === 'delivery';
    return { q, g, d, total: PRICE[g] * q + (d ? DELIVERY : 0) };
  };
  const updateTotal = () => {
    const { q, g, d, total } = totalFor();
    $('#bk-total').textContent = `${q} × ${sizeLabel(g)} ${$('#bk-flavour').value}${d ? ' + $5 delivery' : ''} = $${total}`;
  };
  ['#bk-flavour', '#bk-size', '#bk-qty', '#bk-how'].forEach((s) => $(s).addEventListener('input', updateTotal));
  $$('.stepper button').forEach((b) => b.addEventListener('click', () => setTimeout(updateTotal, 0)));
  $('#bk-how').addEventListener('change', () => {
    const d = $('#bk-how').value === 'delivery';
    $('#bk-addr-wrap').hidden = !d; $('#bk-addr').required = d; updateTotal();
  });
  updateTotal();

  const btnLabel = 'Continue to Payment ';
  bkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#bk-msg'); msg.classList.remove('err'); msg.textContent = '';
    const fd = new FormData(bkForm);
    const name = (fd.get('name') || '').trim(), phone = (fd.get('phone') || '').trim(), email = (fd.get('email') || '').trim();
    const how = fd.get('fulfilment'), addr = (fd.get('address') || '').trim();
    if (!name) return fail(msg, 'Please add your name.');
    if (phone.replace(/\D/g, '').length < 6) return fail(msg, 'Please add a mobile number we can reach you on.');
    if (!emailOk(email)) return fail(msg, 'That email address does not look right.');
    if (how === 'delivery' && addr.length < 5) return fail(msg, 'Please add your delivery address.');
    const btn = $('#bk-submit'); btn.disabled = true; btn.firstChild.textContent = 'Taking you to secure payment… ';
    try {
      const r = await fn('create-checkout', {
        flavour: fd.get('flavour'), size_g: +fd.get('size_g'), quantity: Math.max(1, Math.min(99, +fd.get('quantity') || 1)),
        fulfilment: how, name, phone, email, address: how === 'delivery' ? addr : '', notes: (fd.get('notes') || '').trim(), website: fd.get('website') || '',
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 503) throw new Error('payments off');
      if (!r.ok || !data.url) throw new Error('checkout failed');
      window.location.href = data.url;          // the only link that leaves the site
    } catch (err) {
      btn.disabled = false; btn.firstChild.textContent = btnLabel;
      fail(msg, err.message === 'payments off'
        ? `Online payment is not switched on yet. ${callLine()}`
        : `We could not start your payment just now. Nothing has been charged. Please try again. ${callLine()}`);
    }
  });
  // Reopening the sheet starts a fresh order
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open="booking-modal"],.ab-order')) {
      $('#bk-submit').disabled = false; $('#bk-submit').firstChild.textContent = btnLabel; $('#bk-msg').textContent = ''; updateTotal();
    }
    if (e.target.closest('[data-open="enquiry-modal"]')) { $('#eq-done').hidden = true; $('#enquiry-form').hidden = false; $('#eq-msg').textContent = ''; }
  }, true);

  // Coming back from Stripe
  const qs = new URLSearchParams(location.search);
  if (qs.has('paid') || qs.has('cancelled')) {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => {
      if (qs.has('paid')) open('paid-modal');
      else { open('booking-modal'); const m2 = $('#bk-msg'); m2.classList.remove('err'); m2.textContent = 'Payment cancelled. Nothing was charged or saved.'; }
    }, 600);
  }

  const eqForm = $('#enquiry-form');
  eqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#eq-msg'); msg.classList.remove('err'); msg.textContent = '';
    const fd = new FormData(eqForm);
    if (fd.get('website')) { $('#eq-done').hidden = false; eqForm.hidden = true; return; }
    const name = (fd.get('name') || '').trim(), phone = (fd.get('phone') || '').trim(), email = (fd.get('email') || '').trim(), details = (fd.get('details') || '').trim();
    if (!name) return fail(msg, 'Please add your name.');
    if (phone.replace(/\D/g, '').length < 6) return fail(msg, 'Please add a mobile number we can reach you on.');
    if (!emailOk(email)) return fail(msg, 'That email address does not look right.');
    if (!details) return fail(msg, 'Tell us roughly what you need.');
    const btn = $('#eq-submit'); btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
    try {
      await save('enquiries', { id: crypto.randomUUID(), name, phone, email: email || null, occasion: fd.get('occasion'), needed_by: (fd.get('needed_by') || '').trim() || null, details });
      $('#eq-done').hidden = false; eqForm.hidden = true; eqForm.reset();
    } catch (err) {
      fail(msg, `We could not send that just now. Please try again. ${callLine()}`);
    }
    btn.disabled = false; btn.firstChild.textContent = 'Send Enquiry ';
  });
  $('#newsletter')?.addEventListener('submit', (e) => e.preventDefault());

  /* Flavour filter + details modal */
  const FLAV = {
    mustard: { tag: 'Tangy · our bestseller', name: 'Mustard', img: 'images/mustard.jpg', desc: 'Light herring in a tangy mustard sauce. The one most people start with.', serve: 'On rye or challah, or straight from the tub.' },
    chilli: { tag: 'Spicy · aromatic', name: 'Chilli', img: 'images/chilli.jpg', desc: 'Herring with a spicy, aromatic kick that builds without taking over.', serve: 'With fresh bread and something cold to drink.' },
    schmaltz: { tag: 'Traditional · the original', name: 'Schmaltz', img: 'images/schmaltz.jpg', desc: 'The traditional shul-table herring, sliced with onion and made the way it always has been.', serve: 'With kichel, crackers or warm challah.' },
    spiced: { tag: 'A blend of 7 spices', name: '7 Spiced', img: 'images/7spiced.jpg', desc: 'Our own blend of seven aromatic spices. Warm, layered and a bit different.', serve: 'On its own, or with pickles and rye.' },
  };
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
    $$('.yacht-card').forEach((c) => { c.hidden = !(t.dataset.filter === 'all' || c.dataset.cat === t.dataset.filter); });
  }));
  $$('.yacht-card').forEach((c) => c.addEventListener('click', () => {
    const y = FLAV[c.dataset.yacht];
    $('#ym-img').src = y.img; $('#ym-img').alt = y.name + ' herring tub';
    $('#ym-tag').textContent = y.tag; $('#ym-title').textContent = y.name + ' herring'; $('#ym-desc').textContent = y.desc;
    $('#ym-rate').textContent = y.serve;
    open('yacht-modal');
  }));
  // Pre-select a flavour when "Choose size" is pressed
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-flavour]'); if (!b) return;
    const sel = $('#bk-flavour'); if (sel) sel.value = b.dataset.flavour;
  }, true);

  /* Stat counters (1800ms) */
  const counters = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    counters.unobserve(e.target);
    const el = e.target, target = +el.dataset.target, dur = reduced ? 1 : 1800, t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('.stat-number').forEach((n) => counters.observe(n));

  /* AOS */
  if (window.AOS) AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 60, disable: reduced });

  /* Occasions slider (Swiper 11) */
  if (window.Swiper && $('#destinations-slider')) {
    new Swiper('#destinations-slider', {
      speed: 800, slidesPerView: 1.08, spaceBetween: 16, grabCursor: true, watchOverflow: true,
      navigation: { prevEl: '.dest-prev-btn', nextEl: '.dest-next-btn' },
      breakpoints: { 481: { slidesPerView: 1.25, spaceBetween: 20 }, 769: { slidesPerView: 2.2, spaceBetween: 24 }, 1280: { slidesPerView: 2.8, spaceBetween: 32 } },
    });
  }

  /* Custom trailing cursor */
  if (matchMedia('(pointer:fine)').matches && !reduced) {
    const dot = $('#cursor-dot'), ring = $('#cursor-ring');
    let mx = 0, my = 0, rx = 0, ry = 0, seen = false;
    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px)`;
      if (!seen) { seen = true; rx = mx; ry = my; document.body.classList.add('has-cursor'); }
    }, { passive: true });
    document.addEventListener('mouseover', (e) => ring.classList.toggle('hover', !!e.target.closest('a,button,.destination-card,.yacht-card')));
    const loop = () => { rx += (mx - rx) * 0.15; ry += (my - ry) * 0.15; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); };
    loop();
  }

  /* ---- Touch refinements ---- */
  const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
  document.addEventListener('click', (e) => { if (e.target.closest('.btn-gold,.tab,.hud-num,.yc-go,.ab-order,.ab-call')) buzz(); });

  // Quantity stepper
  $$('.stepper button').forEach((b) => b.addEventListener('click', () => {
    const i = $('#bk-qty'); i.value = Math.min(99, Math.max(1, (+i.value || 1) + +b.dataset.step));
  }));

  // Flavour row: dots follow the scroll-snap position
  const row = $('#fleet-grid'), dots = $$('#row-dots i');
  if (row && dots.length) {
    const sync = () => {
      const cards = $$('.yacht-card:not([hidden])', row);
      const mid = row.scrollLeft + row.clientWidth / 2;
      let best = 0, d = 1e9;
      cards.forEach((c, i) => { const dd = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (dd < d) { d = dd; best = i; } });
      dots.forEach((x, i) => { x.classList.toggle('on', i === best); x.hidden = i >= cards.length; });
    };
    row.addEventListener('scroll', sync, { passive: true });
    $$('.tab').forEach((t) => t.addEventListener('click', () => { row.scrollTo({ left: 0 }); setTimeout(sync, 30); }));
    sync();
  }

  // Bottom sheets: drag the grabber down to dismiss
  $$('.modal .dialog').forEach((dlg) => {
    const grab = $('.grab', dlg); if (!grab) return;
    let y0 = null, dy = 0;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; dlg.style.transition = 'none'; grab.setPointerCapture?.(e.pointerId); });
    grab.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); dlg.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (y0 == null) return; y0 = null; dlg.style.transition = 'transform .25s ease';
      if (dy > 100) { dlg.style.transform = 'translateY(100%)'; setTimeout(() => { close(); dlg.style.transform = ''; dlg.style.transition = ''; }, 200); }
      else { dlg.style.transform = ''; setTimeout(() => { dlg.style.transition = ''; }, 260); }
    };
    grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
  });
})();
