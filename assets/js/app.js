/* ==========================================================================
   Hookah By Hov — interface controller
   ========================================================================== */

(function () {
  'use strict';

  const CFG = window.HBH_CONFIG;
  const P = window.HBH_PRICING;

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ======================================================================
     Chrome: header, nav, reveals
     ====================================================================== */

  const header = $('.site-header');
  const navToggle = $('.nav-toggle');
  const mobileNav = $('#mobile-nav');

  let lastScroll = -1;
  function onScroll() {
    const y = window.scrollY;
    if ((y > 12) !== (lastScroll > 12)) header.classList.toggle('is-scrolled', y > 12);
    lastScroll = y;
    updateTotalBar();
  }
  window.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });

  function closeNav() {
    navToggle.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
    document.body.classList.remove('is-locked');
  }
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });
  $$('#mobile-nav a').forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
  }

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ======================================================================
     Booking state
     ====================================================================== */

  const state = {
    service: 'catering',
    quantity: CFG.booking.defaultQuantity.catering,
    date: '',
    time: CFG.booking.defaultTime,
    street: '', city: '', zip: '',
    tobacco: '', notes: '',
    name: '', phone: '', email: '',
    contactPref: 'Text',
    promo: '',
    age: false
  };
  let qtyTouched = false;
  let step = 1;
  let lastQuote = null;

  const form       = $('#booking-form');
  const steps      = $$('.step', form);
  const stepBtns   = $$('#stepper button');
  const qtyInput   = $('#qty');
  const qtyRange   = $('#qty-range');
  const dateInput  = $('#event-date');
  const timeInput  = $('#event-time');
  const zipInput   = $('#addr-zip');
  const summaryEl  = $('#summary');
  const totalBar   = $('#total-bar');

  /* ---------------- service-specific visibility ---------------- */
  function applyServiceVisibility() {
    $$('[data-service]').forEach(el => {
      if (el.matches('input')) return;
      el.hidden = el.dataset.service !== state.service;
    });
  }

  /* ---------------- quantity ---------------- */
  function setQuantity(value, source) {
    const min = CFG.booking.minQuantity;
    const max = CFG.booking.maxQuantity;
    let n = parseInt(value, 10);
    if (isNaN(n)) n = min;
    n = Math.max(min, Math.min(max, n));
    state.quantity = n;

    if (source !== 'input') qtyInput.value = n;
    if (source !== 'range') qtyRange.value = Math.min(n, Number(qtyRange.max));
    $$('.qty-presets button').forEach(b => b.classList.toggle('is-on', Number(b.dataset.qty) === n));
    renderQtyHelp();
    render();
  }

  function renderQtyHelp() {
    const help = $('#qty-help');
    const qty = state.quantity;
    if (state.service === 'delivery') {
      help.textContent = `${qty} × $60 — flat rate, delivered ready to smoke.`;
      return;
    }
    const rate = P.effectiveRate('catering', qty);
    let msg = `Averages ${P.money(rate)} per hookah at this size.`;

    /* The next tier begins at its `from` count, so that's how many hookahs
       it takes to start paying the better rate. */
    const next = CFG.pricing.catering.tiers.find(t => t.from > qty);
    if (next) {
      const needed = next.from - qty;
      msg += ` Add ${needed} more to unlock the ${P.money(next.rate)} tier.`;
    } else {
      msg += ' Best rate unlocked.';
    }
    help.textContent = msg;
  }

  $('#qty-minus').addEventListener('click', () => { qtyTouched = true; setQuantity(state.quantity - 1); });
  $('#qty-plus').addEventListener('click',  () => { qtyTouched = true; setQuantity(state.quantity + 1); });
  qtyInput.addEventListener('input',  () => { qtyTouched = true; setQuantity(qtyInput.value, 'input'); });
  qtyInput.addEventListener('blur',   () => setQuantity(qtyInput.value));
  qtyRange.addEventListener('input',  () => { qtyTouched = true; setQuantity(qtyRange.value, 'range'); });
  $$('.qty-presets button').forEach(btn => {
    btn.addEventListener('click', () => { qtyTouched = true; setQuantity(btn.dataset.qty); });
  });

  /* ---------------- service choice ---------------- */
  $$('input[name="service"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.service = radio.value;
      if (!qtyTouched) setQuantity(CFG.booking.defaultQuantity[state.service]);
      applyServiceVisibility();
      renderQtyHelp();
      renderDateFlags();
      renderZip();
      render();
    });
  });

  function preselectService(value) {
    const radio = $(`input[name="service"][value="${value}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  $$('[data-preselect]').forEach(link => {
    link.addEventListener('click', () => {
      preselectService(link.dataset.preselect);
      goToStep(1);
    });
  });

  /* ---------------- date & time ---------------- */
  const today = P.todayIso();
  dateInput.min = today;
  dateInput.max = P.addDaysIso(today, Math.round(CFG.booking.maxMonthsAhead * 30.44));
  timeInput.value = state.time;

  function renderDateFlags() {
    const box = $('#date-flags');
    const help = $('#date-help');
    box.innerHTML = '';

    if (!state.date) {
      help.textContent = 'Pick the date of your event.';
      return;
    }

    const pretty = P.formatDate(state.date);
    if (state.service === 'catering' && state.time) {
      help.textContent = `${pretty} · service runs ${P.formatTime(state.time)} – ${P.endTime(state.time, CFG.pricing.catering.serviceHours)}.`;
    } else {
      help.textContent = pretty;
    }

    const flags = [];
    const holiday = window.HBH_HOLIDAYS.lookup(state.date);
    const isToday = state.date === today;
    const isCatering = state.service === 'catering';

    if (holiday) {
      flags.push(isCatering
        ? { cls: 'flag-warn', icon: 'spark', text: `${holiday} · +${P.money(CFG.pricing.catering.holidayFee)} holiday fee` }
        : { cls: 'flag-info', icon: 'spark', text: `${holiday} · no holiday fee on delivery` });
    }
    if (isToday) {
      flags.push(isCatering
        ? { cls: 'flag-warn', icon: 'clock', text: `Same-day booking · +${P.money(CFG.pricing.catering.sameDayFee)}` }
        : { cls: 'flag-info', icon: 'clock', text: 'Same-day delivery · no extra fee' });
    }
    if (!holiday && !isToday && isCatering) {
      flags.push({ cls: 'flag-ok', icon: 'check', text: 'Standard rate — no surcharges' });
    }
    if (isCatering) {
      flags.push({ cls: 'flag-info', icon: 'clock', text: `${CFG.pricing.catering.serviceHours}-hour service included` });
    }

    box.innerHTML = flags.map(f =>
      `<span class="flag ${f.cls}"><svg aria-hidden="true"><use href="#icon-${f.icon}"></use></svg>${f.text}</span>`
    ).join('');
  }

  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    dateInput.classList.remove('is-invalid');
    renderDateFlags();
    render();
  });
  dateInput.addEventListener('input', () => {
    state.date = dateInput.value;
    renderDateFlags();
    render();
  });
  timeInput.addEventListener('input', () => {
    state.time = timeInput.value;
    renderDateFlags();
  });

  /* ---------------- address ---------------- */
  $('#addr-street').addEventListener('input', e => { state.street = e.target.value; });
  $('#addr-city').addEventListener('input', e => { state.city = e.target.value; });

  zipInput.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    state.zip = e.target.value;
    zipInput.classList.remove('is-invalid');
    renderZip();
    render();
  });

  function renderZip() {
    const box = $('#zip-result');
    if (state.service !== 'delivery' || !state.zip) { box.innerHTML = ''; return; }

    const loc = P.locate(state.zip);
    const tpl = (cls, icon, html) =>
      `<div class="zip-box ${cls}"><svg aria-hidden="true"><use href="#icon-${icon}"></use></svg><div>${html}</div></div>`;

    if (loc.status === 'invalid' || (loc.status === 'empty')) { box.innerHTML = ''; return; }

    if (loc.status === 'unknown') {
      box.innerHTML = tpl('zip-fee', 'pin',
        `We couldn't match ZIP <b>${loc.zip}</b> to our delivery map. Send the request anyway — ` +
        `we'll confirm the distance and any travel fee when we call.`);
      return;
    }
    if (loc.status === 'far') {
      box.innerHTML = tpl('zip-bad', 'pin',
        `<b>${loc.city || loc.zip}</b> is about <b>${Math.round(loc.miles)} miles</b> out — beyond our ` +
        `100-mile delivery range. Try catering instead, or ` +
        `<a href="tel:${CFG.business.phoneE164}">call ${CFG.business.phone}</a>.`);
      return;
    }
    if (loc.fee === 0) {
      box.innerHTML = tpl('zip-ok', 'check',
        `<b>${loc.city || loc.zip}</b> is <b>${loc.miles.toFixed(1)} miles</b> from our Van Nuys base — ` +
        `inside the free delivery zone. <b>No travel fee.</b>`);
    } else {
      box.innerHTML = tpl('zip-fee', 'pin',
        `<b>${loc.city || loc.zip}</b> is <b>${loc.miles.toFixed(1)} miles</b> out (${loc.band}) — ` +
        `a <b>${P.money(loc.fee)}</b> delivery fee applies.`);
    }
  }

  /* ---------------- flavors & notes ---------------- */
  const tobaccoInput = $('#tobacco');
  $$('#flavor-chips button').forEach(chip => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.chip;
      const parts = tobaccoInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const at = parts.findIndex(p => p.toLowerCase() === value.toLowerCase());
      if (at > -1) { parts.splice(at, 1); chip.classList.remove('is-on'); }
      else { parts.push(value); chip.classList.add('is-on'); }
      tobaccoInput.value = parts.join(', ');
      state.tobacco = tobaccoInput.value;
      render();
    });
  });
  tobaccoInput.addEventListener('input', () => {
    state.tobacco = tobaccoInput.value;
    const lower = tobaccoInput.value.toLowerCase();
    $$('#flavor-chips button').forEach(c => c.classList.toggle('is-on', lower.includes(c.dataset.chip.toLowerCase())));
    render();
  });
  $('#notes').addEventListener('input', e => { state.notes = e.target.value; });

  /* ---------------- contact ---------------- */
  ['name', 'phone', 'email'].forEach(id => {
    const el = $('#' + id);
    el.addEventListener('input', () => {
      state[id] = el.value;
      el.classList.remove('is-invalid');
    });
  });
  $$('input[name="contactPref"]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) state.contactPref = r.value; });
  });
  /* ---------------- promo code ---------------- */

  const promoField  = $('#promo-field');
  const promoInput  = $('#promo');
  const promoStatus = $('#promo-status');

  /* No codes configured means nothing to type — don't tease an empty box. */
  promoField.hidden = !P.anyPromoCodes();

  function applyPromo() {
    state.promo = promoInput.value.trim();
    render();
  }

  function renderPromoStatus() {
    if (!state.promo) {
      promoStatus.innerHTML = '';
      promoInput.classList.remove('is-invalid');
      return;
    }
    const q = lastQuote || P.quote(state);

    if (q.flags.promoError) {
      promoInput.classList.add('is-invalid');
      promoStatus.innerHTML =
        `<span class="promo-msg promo-bad">${escapeHtml(q.flags.promoError)}</span>`;
      return;
    }

    promoInput.classList.remove('is-invalid');
    if (q.flags.promoNote) {
      promoStatus.innerHTML = `<span class="promo-msg promo-warn">${escapeHtml(q.flags.promoNote)}</span>`;
      return;
    }
    if (q.flags.promo) {
      promoStatus.innerHTML =
        `<span class="promo-msg promo-good">` +
        `<svg aria-hidden="true"><use href="#icon-check"></use></svg>` +
        `<b>${escapeHtml(q.flags.promo.code)}</b> applied — ${escapeHtml(q.flags.promo.label)}, ` +
        `saving ${P.money(q.flags.promo.amount)}.</span>`;
    }
  }

  $('#promo-apply').addEventListener('click', applyPromo);
  promoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
  });
  promoInput.addEventListener('input', () => {
    /* Clear a stale verdict while they retype, but don't re-judge every key. */
    if (!promoInput.value.trim()) { state.promo = ''; render(); }
    promoStatus.innerHTML = '';
    promoInput.classList.remove('is-invalid');
  });
  promoInput.addEventListener('blur', applyPromo);

  const ageCheck = $('#age-check');
  ageCheck.addEventListener('change', () => {
    state.age = ageCheck.checked;
    ageCheck.classList.remove('is-invalid');
  });

  /* ======================================================================
     Steps
     ====================================================================== */

  function goToStep(n, scroll) {
    step = Math.max(1, Math.min(steps.length, n));
    steps.forEach(s => s.classList.toggle('is-active', Number(s.dataset.step) === step));
    stepBtns.forEach((btn, i) => {
      const index = i + 1;
      btn.classList.toggle('is-done', index < step);
      if (index === step) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    updateTotalBarCta();
    if (scroll !== false) {
      const top = form.getBoundingClientRect().top + window.scrollY - (header.offsetHeight + 18);
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function flagInvalid(el, message) {
    el.classList.add('is-invalid');
    showError(message);
    if (el.focus) el.focus({ preventScroll: false });
    return false;
  }

  function showError(message) {
    const box = $('#form-error');
    if (!message) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = message;
    box.hidden = false;
  }

  function validateStep(n) {
    showError('');
    if (n === 2) {
      if (!state.date) return flagInvalid(dateInput, 'Pick the date of your event to continue.');
      if (state.date < today) return flagInvalid(dateInput, "That date has already passed — choose today or later.");
      if (!state.time) return flagInvalid(timeInput, 'Add a start time so we know when to be there.');
      if (state.service === 'delivery') {
        if (!/^\d{5}$/.test(state.zip)) return flagInvalid(zipInput, 'Enter a 5-digit ZIP code so we can check the delivery distance.');
        if (P.locate(state.zip).status === 'far') {
          return flagInvalid(zipInput, 'That address is outside our 100-mile delivery range. Try catering, or give us a call.');
        }
      }
    }
    if (n === 4) {
      if (!state.name.trim()) return flagInvalid($('#name'), 'We need a name for the booking.');
      if (state.phone.replace(/\D/g, '').length < 10) return flagInvalid($('#phone'), 'Add a 10-digit phone number so we can reach you.');
      if (!state.email.trim()) return flagInvalid($('#email'), 'We need an email address to confirm your booking.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) {
        return flagInvalid($('#email'), 'That email address looks incomplete.');
      }
      if (!state.age) return flagInvalid(ageCheck, 'Please confirm everyone using the hookahs is 21 or older.');
    }
    return true;
  }

  $$('[data-next]', form).forEach(btn => {
    btn.addEventListener('click', () => { if (validateStep(step)) goToStep(step + 1); });
  });
  $$('[data-prev]', form).forEach(btn => {
    btn.addEventListener('click', () => { showError(''); goToStep(step - 1); });
  });
  stepBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const target = i + 1;
      if (target <= step) { showError(''); goToStep(target); return; }
      for (let s = step; s < target; s++) if (!validateStep(s)) { goToStep(s); return; }
      goToStep(target);
    });
  });

  /* ======================================================================
     Summary rendering
     ====================================================================== */

  let lastTotal = null;

  /* One place decides how a line item's money reads, so the summary, the
     invoice and the text message can never disagree. */
  function lineValue(line) {
    if (line.amount === null) return 'Quoted separately';
    if (line.amount < 0) return '−' + P.money(-line.amount);
    if (line.amount === 0) return 'Free';
    return P.money(line.amount);
  }

  function render() {
    const q = P.quote(state);
    lastQuote = q;

    $('#summary-service').textContent = q.service === 'catering'
      ? `Catering · ${CFG.pricing.catering.serviceHours} hrs`
      : 'Delivery';

    const lines = $('#summary-lines');
    lines.innerHTML = q.lines.map(l => {
      const cls = l.type ? ` line-${l.type}` : '';
      return `<div class="line${cls}">
        <dt>${escapeHtml(l.label)}${l.detail ? `<small>${escapeHtml(l.detail)}</small>` : ''}</dt>
        <dd>${lineValue(l)}</dd>
      </div>`;
    }).join('') || '<div class="line line-muted"><dt>No hookahs selected yet</dt><dd>—</dd></div>';

    const totalEl = $('#summary-total');
    totalEl.textContent = P.money(q.total);
    if (lastTotal !== null && lastTotal !== q.total && !prefersReducedMotion()) {
      totalEl.classList.remove('is-bump');
      void totalEl.offsetWidth;
      totalEl.classList.add('is-bump');
    }
    lastTotal = q.total;

    const foot = $('#summary-foot');
    if (q.blocked) {
      foot.textContent = q.blockReason;
    } else if (q.service === 'catering') {
      foot.textContent = `Includes ${CFG.pricing.catering.serviceHours} hours of on-site service. ` +
        `Specialty tobacco requests are quoted separately. No payment is taken online.`;
    } else {
      foot.textContent = 'Delivered ready to smoke. Specialty tobacco requests are quoted separately. ' +
        'No payment is taken online.';
    }

    $('#total-bar-amount').textContent = P.money(q.total);
    $('#total-bar-label').textContent =
      `${q.service === 'catering' ? 'Catering' : 'Delivery'} · ${q.quantity} hookah${q.quantity === 1 ? '' : 's'}`;

    renderPromoStatus();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ======================================================================
     Mobile total bar
     ====================================================================== */

  const builderSection = $('#builder');

  function isMobileLayout() { return window.matchMedia('(max-width: 1060px)').matches; }

  function updateTotalBar() {
    if (!isMobileLayout()) {
      totalBar.classList.remove('is-up');
      totalBar.hidden = true;
      document.body.classList.remove('has-bar');
      return;
    }
    const rect = builderSection.getBoundingClientRect();
    const visible = rect.top < window.innerHeight * 0.6 && rect.bottom > 160;
    totalBar.hidden = false;
    totalBar.classList.toggle('is-up', visible);
    document.body.classList.toggle('has-bar', visible);
  }

  function updateTotalBarCta() {
    const cta = $('#total-bar-cta');
    cta.textContent = step >= steps.length ? 'Submit' : 'Continue';
  }

  $('#total-bar-cta').addEventListener('click', () => {
    if (step >= steps.length) form.requestSubmit();
    else if (validateStep(step)) goToStep(step + 1);
  });

  $('#total-bar-toggle').addEventListener('click', () => {
    const collapsed = summaryEl.classList.toggle('is-collapsed');
    $('#total-bar-toggle').setAttribute('aria-expanded', String(!collapsed));
    if (!collapsed) {
      summaryEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  });

  window.addEventListener('resize', () => {
    updateTotalBar();
    if (!isMobileLayout()) summaryEl.classList.remove('is-collapsed');
  });

  /* ======================================================================
     Submission
     ====================================================================== */

  function reference() {
    const d = new Date();
    const stamp = String(d.getFullYear()).slice(2) +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `HBH-${stamp}-${rand}`;
  }

  function addressLine() {
    const parts = [state.street, state.city, state.zip ? 'CA ' + state.zip : ''].filter(Boolean);
    return parts.join(', ');
  }

  function buildInvoiceText(q, ref) {
    const L = [];
    L.push('HOOKAH BY HOV — BOOKING REQUEST');
    L.push('Reference: ' + ref);
    L.push('');
    L.push('SERVICE: ' + (q.service === 'catering'
      ? `Catering (${CFG.pricing.catering.serviceHours}-hour service)`
      : 'Delivery'));
    L.push('HOOKAHS: ' + q.quantity);
    L.push('DATE: ' + P.formatDate(state.date) + (state.time ? ' at ' + P.formatTime(state.time) : ''));
    if (q.service === 'catering' && state.time) {
      L.push('WINDOW: ' + P.formatTime(state.time) + ' – ' + P.endTime(state.time, CFG.pricing.catering.serviceHours));
    }
    if (addressLine()) L.push('ADDRESS: ' + addressLine());
    if (q.meta.location && q.meta.location.status === 'ok') {
      L.push('DISTANCE: ' + q.meta.location.miles.toFixed(1) + ' mi from 91405');
    }
    L.push('');
    L.push('ESTIMATE');
    q.lines.forEach(l => {
      L.push('  ' + l.label + (l.detail ? ' (' + l.detail + ')' : '') + ' — ' + lineValue(l));
    });
    L.push('  TOTAL: ' + P.money(q.total));
    if (q.flags.promo) {
      L.push('  (promo ' + q.flags.promo.code + ' applied — ' +
        q.flags.promo.label + ', ' + P.money(q.flags.promo.amount) + ' off)');
    }
    L.push('');
    if (state.tobacco.trim()) L.push('TOBACCO REQUEST: ' + state.tobacco.trim());
    if (state.notes.trim()) L.push('NOTES: ' + state.notes.trim());
    L.push('');
    L.push('CUSTOMER: ' + state.name);
    L.push('PHONE: ' + state.phone);
    if (state.email) L.push('EMAIL: ' + state.email);
    L.push('PREFERRED CONTACT: ' + state.contactPref);
    L.push('');
    L.push('Estimate only — no payment taken online.');
    return L.join('\n');
  }

  function buildPayload(q, ref) {
    return {
      reference: ref,
      submittedAt: new Date().toISOString(),
      service: q.service,
      quantity: q.quantity,
      date: state.date,
      dateFormatted: P.formatDate(state.date),
      time: state.time,
      timeFormatted: P.formatTime(state.time),
      serviceWindow: q.service === 'catering' && state.time
        ? P.formatTime(state.time) + ' – ' + P.endTime(state.time, CFG.pricing.catering.serviceHours)
        : null,
      address: { street: state.street, city: state.city, zip: state.zip, state: 'CA' },
      distanceMiles: q.meta.location && q.meta.location.miles != null
        ? Number(q.meta.location.miles.toFixed(1)) : null,
      holiday: q.flags.holiday || q.flags.holidayInfo || null,
      sameDay: Boolean(q.flags.sameDay || q.flags.sameDayInfo),
      lineItems: q.lines.map(l => ({ label: l.label, detail: l.detail || '', amount: l.amount })),
      promo: q.flags.promo || null,
      total: q.total,
      tobaccoRequest: state.tobacco.trim(),
      notes: state.notes.trim(),
      customer: {
        name: state.name,
        phone: state.phone,
        email: state.email,
        preferredContact: state.contactPref
      },
      invoiceText: buildInvoiceText(q, ref)
    };
  }

  async function sendNotification(payload) {
    const n = CFG.notify;
    if (!n || n.provider === 'none') return { ok: false, skipped: true };

    try {
      if (n.provider === 'web3forms') {
        if (!n.accessKey) return { ok: false, skipped: true };

        /* Web3Forms puts every field it receives into the email, so these are
           sent as separate readable fields rather than one blob. `name` and
           `email` are its own conventions — `email` becomes the reply-to, so
           replying to the notification goes straight back to the customer. */
        const fields = {
          access_key: n.accessKey,
          subject: `${n.subject} — ${payload.reference}`,
          from_name: 'Hookah By Hov website',
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone,
          message: payload.invoiceText,

          'Reference': payload.reference,
          'Service': payload.service === 'catering'
            ? `Catering (${CFG.pricing.catering.serviceHours}-hour service)`
            : 'Delivery',
          'Hookahs': String(payload.quantity),
          'Event date': payload.dateFormatted,
          'Time': payload.serviceWindow || payload.timeFormatted,
          'Address': addressLine() || '—',
          'Estimated total': P.money(payload.total),
          'Preferred contact': payload.customer.preferredContact
        };

        if (payload.distanceMiles != null) fields['Distance from 91405'] = payload.distanceMiles + ' mi';
        if (payload.holiday) fields['Holiday'] = payload.holiday;
        if (payload.sameDay) fields['Same-day booking'] = 'Yes';
        if (payload.promo) {
          fields['Promo code'] = `${payload.promo.code} (${payload.promo.label}, ${P.money(payload.promo.amount)} off)`;
        }
        if (payload.tobaccoRequest) fields['Tobacco request'] = payload.tobaccoRequest;
        if (payload.notes) fields['Notes'] = payload.notes;

        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(fields)
        });
        return { ok: res.ok };
      }

      if (n.provider === 'formspree') {
        if (!n.endpoint) return { ok: false, skipped: true };
        const res = await fetch(n.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.assign({ _subject: `${n.subject} — ${payload.reference}` }, payload))
        });
        return { ok: res.ok };
      }

      if (n.provider === 'custom') {
        if (!n.endpoint) return { ok: false, skipped: true };
        const res = await fetch(n.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return { ok: res.ok };
      }
    } catch (err) {
      return { ok: false, error: err };
    }
    return { ok: false, skipped: true };
  }

  const submitBtn = $('#submit-btn');
  let sending = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;

    /* honeypot — bots fill hidden fields, people don't */
    if (form.querySelector('[name="botcheck"]').value) return;

    for (let s = 1; s <= steps.length; s++) {
      if (!validateStep(s)) { goToStep(s); return; }
    }

    const q = P.quote(state);
    if (q.blocked) { goToStep(2); showError(q.blockReason); return; }

    sending = true;
    submitBtn.classList.add('is-busy');
    submitBtn.disabled = true;

    const ref = reference();
    const payload = buildPayload(q, ref);
    const result = await sendNotification(payload);

    sending = false;
    submitBtn.classList.remove('is-busy');
    submitBtn.disabled = false;

    showSuccess(q, payload, result);
  });

  /* ======================================================================
     Success overlay
     ====================================================================== */

  const successEl = $('#success');

  function showSuccess(q, payload, result) {
    const delivered = result && result.ok;

    $('#success-title').textContent = delivered ? 'Request sent' : 'Almost there';
    $('#success-sub').textContent = delivered
      ? `We've got your booking${state.name ? ', ' + state.name.trim().split(/\s+/)[0] : ''}. ` +
        `We'll call you at ${state.phone} shortly to confirm the details and lock in your date.`
      : `We couldn't send that automatically — your connection may have dropped. ` +
        `Tap “Email us a copy” below and it'll go through, or call us on ${CFG.business.phone}.`;

    /* Nothing to fall back to when it went through — keep the confirmation clean. */
    $('#success-actions').hidden = delivered;

    $('#success-ref').textContent = payload.reference;

    const rows = q.lines.map(l => {
      const cls = l.type === 'discount' ? ' line-discount' : '';
      return `<div class="line${cls}"><span>${escapeHtml(l.label)}${l.detail ? ' · ' + escapeHtml(l.detail) : ''}</span><span>${lineValue(l)}</span></div>`;
    }).join('');

    const header = [
      `<div class="line"><span>Service</span><span>${q.service === 'catering' ? 'Catering · ' + CFG.pricing.catering.serviceHours + ' hrs' : 'Delivery'}</span></div>`,
      `<div class="line"><span>Date</span><span>${escapeHtml(P.formatDate(state.date))}</span></div>`,
      state.time ? `<div class="line"><span>${q.service === 'catering' ? 'Service window' : 'Drop-off'}</span><span>${escapeHtml(
        q.service === 'catering'
          ? P.formatTime(state.time) + ' – ' + P.endTime(state.time, CFG.pricing.catering.serviceHours)
          : P.formatTime(state.time)
      )}</span></div>` : ''
    ].join('');

    $('#invoice').innerHTML =
      `<h4>Estimate ${escapeHtml(payload.reference)}</h4>${header}${rows}` +
      `<div class="line line-total"><span>Estimated total</span><span>${P.money(q.total)}</span></div>` +
      (state.tobacco.trim()
        ? `<p class="invoice-note"><strong>Tobacco request:</strong> ${escapeHtml(state.tobacco.trim())} — priced separately based on the amount requested and current market price. We'll confirm the cost when we contact you.</p>`
        : '') +
      `<p class="invoice-note">No payment has been taken. We'll confirm every detail before anything is charged.</p>`;

    /* Opens their mail app with everything already written — the reliable
       fallback when the automatic send didn't go through. */
    const emailBtn = $('#success-email');
    if (CFG.business.email) {
      emailBtn.hidden = false;
      emailBtn.setAttribute('href',
        `mailto:${CFG.business.email}` +
        `?subject=${encodeURIComponent('Booking request ' + payload.reference + ' — ' + (state.name || 'Website'))}` +
        `&body=${encodeURIComponent(payload.invoiceText)}`);
    } else {
      emailBtn.hidden = true;
    }

    successEl.hidden = false;
    document.body.classList.add('is-locked');
    $('#success-close').focus();

    window.__hbhLastPayload = payload;
  }

  function closeSuccess() {
    successEl.hidden = true;
    document.body.classList.remove('is-locked');
  }
  $('#success-close').addEventListener('click', closeSuccess);
  successEl.addEventListener('click', e => { if (e.target === successEl) closeSuccess(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !successEl.hidden) closeSuccess(); });

  $('#success-copy').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const text = (window.__hbhLastPayload || {}).invoiceText || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    const original = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = original; }, 1900);
  });

  /* ======================================================================
     Boot
     ====================================================================== */

  applyServiceVisibility();
  setQuantity(state.quantity);
  renderDateFlags();
  renderZip();
  render();
  updateTotalBar();
  updateTotalBarCta();
  if (isMobileLayout()) summaryEl.classList.add('is-collapsed');
  onScroll();
})();
