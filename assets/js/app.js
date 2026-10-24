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
     Chrome: header, nav
     (scroll reveals and the rest of the decoration live in motion.js)
     ====================================================================== */

  const header = $('.site-header');
  const navToggle = $('.nav-toggle');
  const mobileNav = $('#mobile-nav');

  let lastScroll = -1;
  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const y = window.scrollY;
    if ((y > 12) !== (lastScroll > 12)) header.classList.toggle('is-scrolled', y > 12);
    lastScroll = y;
    updateTotalBar();
  }
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });

  function openNav() {
    mobileNav.hidden = false;
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('is-locked');
    void mobileNav.offsetWidth;            // let it paint closed before animating open
    mobileNav.classList.add('is-open');
  }
  function closeNav() {
    if (mobileNav.hidden) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    mobileNav.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setTimeout(() => { if (!mobileNav.classList.contains('is-open')) mobileNav.hidden = true; }, 400);
  }
  navToggle.addEventListener('click', () => {
    if (navToggle.getAttribute('aria-expanded') === 'true') closeNav();
    else openNav();
  });
  $$('#mobile-nav a').forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 961px)').matches) closeNav();
  });

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
    coords: null,          // set only when an address is picked from Google
    addressPicked: false,
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
  const stepsBox   = $('#steps');
  const steps      = $$('.step', form);
  const stepper    = $('#stepper');
  const stepBtns   = $$('#stepper button');
  const qtyInput   = $('#qty');
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

  /* Every "book" shortcut on the page lands here: set what we already know,
     open the right step, and glide down to the form. */
  function startBooking(opts) {
    if (opts.service) preselectService(opts.service);
    if (opts.quantity) { qtyTouched = true; setQuantity(opts.quantity); }
    goToStep(opts.step || 1, 'force');
  }

  $$('[data-preselect]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      startBooking({ service: link.dataset.preselect, step: 1 });
    });
  });

  $$('[data-open-flavors]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      $('#flavor-disclosure').open = true;
      startBooking({ step: 1 });
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
      `<span class="flag ${f.cls}"><svg width="14" height="14" aria-hidden="true"><use href="#icon-${f.icon}"></use></svg>${f.text}</span>`
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

  const streetInput = $('#addr-street');
  const cityInput   = $('#addr-city');

  /* Typing over a picked address invalidates its coordinates — fall back to
     the ZIP so we never quote a fee for a building they've edited away from. */
  function dropCoords() {
    if (!state.coords) return;
    state.coords = null;
    state.addressPicked = false;
    render();
    renderZip();
  }

  streetInput.addEventListener('input', e => {
    state.street = e.target.value;
    streetInput.classList.remove('is-invalid');
    dropCoords();
  });
  cityInput.addEventListener('input', e => {
    state.city = e.target.value;
    cityInput.classList.remove('is-invalid');
    dropCoords();
  });

  zipInput.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    state.zip = e.target.value;
    zipInput.classList.remove('is-invalid');
    dropCoords();
    renderZip();
    render();
  });

  /* ---------------- Google Places autocomplete (optional) ---------------- */

  const addrHelp = $('#addr-help');

  const autocomplete = window.HBH_MAPS.attach({
    input: streetInput,
    list: $('#addr-suggestions'),

    onSelect(address) {
      state.street = address.street;
      state.city = address.city;
      state.zip = address.zip;
      state.addressPicked = true;
      state.coords = (address.lat != null && address.lng != null)
        ? { lat: address.lat, lng: address.lng, label: address.city || address.formatted }
        : null;

      streetInput.value = address.street;
      cityInput.value = address.city;
      zipInput.value = address.zip;
      [streetInput, cityInput, zipInput].forEach(el => el.classList.remove('is-invalid'));

      addrHelp.textContent = address.formatted || 'Address confirmed.';
      render();
      renderZip();
    },

    onStatus(status) {
      if (status.state === 'unavailable') {
        addrHelp.textContent = 'Street address, apartment or suite number.';
      } else if (status.state === 'resolving') {
        addrHelp.textContent = 'Looking that address up…';
      } else if (status.state === 'error') {
        addrHelp.textContent = "We couldn't read that address — please type it in.";
      }
    }
  });

  if (autocomplete.enabled) {
    streetInput.setAttribute('autocomplete', 'off');
    addrHelp.textContent = 'Start typing and pick your address from the list.';
  }

  /* Tells the customer their own city and whether a travel fee applies —
     nothing about where we're coming from or how far that is. */
  function renderZip() {
    const box = $('#zip-result');
    if (!state.zip && !state.coords) { box.innerHTML = ''; return; }

    const loc = state.coords
      ? P.locateByCoords(state.coords.lat, state.coords.lng, state.coords.label)
      : P.locate(state.zip);
    const where = (state.coords && state.city) || loc.city || 'That address';
    const isDelivery = state.service === 'delivery';
    const feeWord = isDelivery ? 'delivery fee' : 'destination fee';

    const tpl = (cls, icon, html) =>
      `<div class="zip-box ${cls}"><svg width="18" height="18" aria-hidden="true"><use href="#icon-${icon}"></use></svg><div>${html}</div></div>`;

    if (loc.status === 'invalid' || loc.status === 'empty') { box.innerHTML = ''; return; }

    if (loc.status === 'unknown') {
      box.innerHTML = tpl('zip-fee', 'pin',
        `We couldn't place ZIP <b>${escapeHtml(loc.zip)}</b> automatically. Send the request ` +
        `anyway — we'll confirm any ${feeWord} when we call.`);
      return;
    }

    if (loc.status === 'far') {
      box.innerHTML = isDelivery
        ? tpl('zip-bad', 'pin',
            `<b>${escapeHtml(where)}</b> is outside the area we deliver to. Try catering instead, or ` +
            `<a href="tel:${CFG.business.phoneE164}">call ${CFG.business.phone}</a>.`)
        : tpl('zip-fee', 'pin',
            `<b>${escapeHtml(where)}</b> is a longer trip than usual — we'll confirm the ` +
            `destination fee when we call. Everything else in your estimate stands.`);
      return;
    }

    if (loc.fee === 0) {
      box.innerHTML = tpl('zip-ok', 'check',
        `<b>${escapeHtml(where)}</b> — <b>no ${feeWord}.</b> You're inside our standard service area.`);
    } else {
      box.innerHTML = tpl('zip-fee', 'pin',
        `<b>${escapeHtml(where)}</b> — a <b>${P.money(loc.fee)}</b> ${feeWord} applies.`);
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
  const notesInput = $('#notes');

  /* Tracks whether the estimate currently shows a tobacco row, so we only
     redraw when that changes rather than on every keystroke. */
  let tobaccoLineShown = false;

  function countChars(input, counter) {
    const max = Number(input.getAttribute('maxlength'));
    const used = input.value.length;
    counter.textContent = `${used}/${max}`;
    counter.classList.toggle('is-full', used >= max);
  }

  tobaccoInput.addEventListener('input', () => {
    state.tobacco = tobaccoInput.value;
    const lower = tobaccoInput.value.toLowerCase();
    $$('#flavor-chips button').forEach(c => c.classList.toggle('is-on', lower.includes(c.dataset.chip.toLowerCase())));
    countChars(tobaccoInput, $('#tobacco-count'));

    /* Deliberately no render() here. The tobacco line is a fixed "quoted
       separately" row — redrawing the estimate on every keystroke made the
       whole panel flicker while typing. It's refreshed on blur instead. */
    if (Boolean(state.tobacco.trim()) !== tobaccoLineShown) render();
  });
  tobaccoInput.addEventListener('blur', render);

  notesInput.addEventListener('input', () => {
    state.notes = notesInput.value;
    countChars(notesInput, $('#notes-count'));
  });

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

  const promoInput  = $('#promo');
  const promoStatus = $('#promo-status');

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
        `<svg width="15" height="15" aria-hidden="true"><use href="#icon-check"></use></svg>` +
        `<b>${escapeHtml(q.flags.promo.code)}</b> applied — ${escapeHtml(q.flags.promo.label)}, ` +
        `saving ${P.money(q.flags.promo.amount)}.</span>`;
    }
  }

  const promoField = $('#promo-field');
  promoField.addEventListener('toggle', () => {
    if (promoField.open) promoInput.focus({ preventScroll: true });
  });

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

  const STEP_EASE = 'cubic-bezier(.16,1,.3,1)';
  let stepAnims = [];

  /* Forward slides the new step in from the right, back from the left, while
     the card smoothly resizes to fit — no jump in height between steps. */
  function swapSteps(fromEl, toEl, dir) {
    const startH = stepsBox.offsetHeight;
    fromEl.classList.remove('is-active');
    fromEl.classList.add('is-leaving');
    toEl.classList.add('is-active');
    const endH = stepsBox.offsetHeight;

    stepsBox.style.overflow = 'hidden';
    const resize = stepsBox.animate(
      [{ height: startH + 'px' }, { height: endH + 'px' }],
      { duration: 600, easing: STEP_EASE }
    );
    const out = fromEl.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 48}px)` }],
      { duration: 280, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }
    );
    const into = toEl.animate(
      [{ opacity: 0, transform: `translateX(${dir * 48}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 640, delay: 110, easing: STEP_EASE, fill: 'backwards' }
    );
    stepAnims = [resize, out, into];
    resize.onfinish = () => {
      out.cancel();
      fromEl.classList.remove('is-leaving');
      stepsBox.style.overflow = '';
    };
  }

  function stopStepAnims() {
    stepAnims.forEach(a => a.cancel());
    stepAnims = [];
    steps.forEach(s => s.classList.remove('is-leaving'));
    stepsBox.style.overflow = '';
  }

  /* scroll: 'force' always brings the form into view, false never does, and
     the default only scrolls when the top of the form is out of sight. */
  function goToStep(n, scroll) {
    const target = Math.max(1, Math.min(steps.length, n));
    const from = step;
    step = target;

    stopStepAnims();
    const animate = from !== target && !prefersReducedMotion() &&
      typeof stepsBox.animate === 'function' && stepsBox.offsetParent !== null;
    if (animate) {
      swapSteps(steps[from - 1], steps[target - 1], target > from ? 1 : -1);
    } else {
      steps.forEach(s => s.classList.toggle('is-active', Number(s.dataset.step) === step));
    }

    stepper.style.setProperty('--step', step);
    stepBtns.forEach((btn, i) => {
      const index = i + 1;
      btn.classList.toggle('is-done', index < step);
      btn.parentElement.classList.toggle('is-current', index === step);
      if (index === step) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    updateTotalBarCta();

    if (scroll === false) return;
    const offset = header.offsetHeight + 18;
    const formTop = form.getBoundingClientRect().top;
    if (scroll === 'force' || formTop < offset - 4 || formTop > window.innerHeight * 0.6) {
      window.scrollTo({
        top: formTop + window.scrollY - offset,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function flagInvalid(el, message) {
    el.classList.add('is-invalid');
    showError(message, el.closest('.step'));
    shake(el);
    if (el.focus) el.focus({ preventScroll: false });
    return false;
  }

  function shake(el) {
    if (prefersReducedMotion()) return;
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
    el.addEventListener('animationend', () => el.classList.remove('is-shake'), { once: true });
  }

  /* After jumping back to a step that failed validation, put the cursor on
     the field that needs fixing. */
  function focusFirstInvalid() {
    const el = $('.is-invalid', steps[step - 1]);
    if (el && el.focus) el.focus({ preventScroll: true });
  }

  /* One error box, shown just above the buttons of whichever step it's about. */
  function showError(message, stepEl) {
    const box = $('#form-error');
    if (!message) { box.hidden = true; box.textContent = ''; return; }
    const where = stepEl || steps[step - 1];
    const nav = $('.step-nav', where);
    if (nav && box.nextElementSibling !== nav) where.insertBefore(box, nav);
    box.textContent = message;
    box.hidden = false;
  }

  function validateStep(n) {
    showError('');
    if (n === 2) {
      if (!state.date) return flagInvalid(dateInput, 'Pick the date of your event to continue.');
      if (state.date < today) return flagInvalid(dateInput, "That date has already passed — choose today or later.");
      if (!state.time) return flagInvalid(timeInput, 'Add a start time so we know when to be there.');

      /* We can't cater or deliver to a blank address, so neither service gets
         past this step without one. */
      if (state.street.trim().length < 4) {
        return flagInvalid(streetInput, 'Enter the street address for your event.');
      }
      if (!state.city.trim()) {
        return flagInvalid(cityInput, 'Enter the city for your event.');
      }
      if (!/^\d{5}$/.test(state.zip)) {
        return flagInvalid(zipInput, 'Enter a 5-digit ZIP code so we can work out the distance.');
      }
      if (state.service === 'delivery') {
        const loc = state.coords
          ? P.locateByCoords(state.coords.lat, state.coords.lng, state.coords.label)
          : P.locate(state.zip);
        if (loc.status === 'far') {
          return flagInvalid(zipInput, 'That address is outside our 100-mile delivery range. Try catering, or give us a call.');
        }
      }
    }
    if (n === 3) {
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

  /* Once every flagged field has been fixed, the message goes too. */
  ['input', 'change'].forEach(type => form.addEventListener(type, () => {
    if (!$('#form-error').hidden && !$('.is-invalid:not(#promo)', form)) showError('');
  }));

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
      for (let s = step; s < target; s++) {
        if (!validateStep(s)) { goToStep(s); focusFirstInvalid(); return; }
      }
      goToStep(target);
    });
  });

  /* ======================================================================
     Summary rendering
     ====================================================================== */

  /* One place decides how a line item's money reads, so the summary, the
     invoice and the text message can never disagree. */
  function lineValue(line) {
    if (line.amount === null) return 'Quoted separately';
    if (line.amount < 0) return '−' + P.money(-line.amount);
    if (line.amount === 0) return 'Free';
    return P.money(line.amount);
  }

  /* Totals roll to their new value instead of snapping. Each element keeps
     its own in-flight tween so a fast run of changes never stutters. */
  const tweens = new Map();
  function tweenMoney(el, to) {
    const prev = tweens.get(el);
    const from = prev ? prev.current : to;
    if (prev && prev.raf) cancelAnimationFrame(prev.raf);
    const t = { current: from, raf: 0 };
    tweens.set(el, t);

    if (from === to || prefersReducedMotion()) {
      t.current = to;
      el.textContent = P.money(to);
      return;
    }
    const start = performance.now();
    const dur = 700;
    (function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      t.current = from + (to - from) * eased;
      el.textContent = P.money(t.current);
      t.raf = p < 1 ? requestAnimationFrame(tick) : 0;
    })(start);
  }

  let shownLineKeys = new Set();

  function render() {
    const q = P.quote(state);
    lastQuote = q;
    tobaccoLineShown = Boolean(state.tobacco.trim());

    $('#summary-service').textContent = q.service === 'catering'
      ? `Catering · ${CFG.pricing.catering.serviceHours} hrs`
      : 'Delivery';

    /* Only lines that weren't there a moment ago animate in. */
    const lines = $('#summary-lines');
    const keys = new Set();
    lines.innerHTML = q.lines.map(l => {
      keys.add(l.key);
      const cls = (l.type ? ` line-${l.type}` : '') + (shownLineKeys.has(l.key) ? '' : ' is-new');
      return `<div class="line${cls}">
        <dt>${escapeHtml(l.label)}${l.detail ? `<small>${escapeHtml(l.detail)}</small>` : ''}</dt>
        <dd>${lineValue(l)}</dd>
      </div>`;
    }).join('') || '<div class="line line-muted"><dt>No hookahs selected yet</dt><dd>—</dd></div>';
    shownLineKeys = keys;

    tweenMoney($('#summary-total'), q.total);
    const live = $('#summary-total-live');
    const spoken = `Estimated total ${P.money(q.total)}`;
    if (live.textContent !== spoken) live.textContent = spoken;

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

    tweenMoney($('#total-bar-amount'), q.total);
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
      setSheet(false);
      return;
    }
    const rect = builderSection.getBoundingClientRect();
    const visible = rect.top < window.innerHeight * 0.6 && rect.bottom > 160;
    totalBar.hidden = false;
    totalBar.classList.toggle('is-up', visible);
    document.body.classList.toggle('has-bar', visible);
    document.documentElement.style.setProperty('--bar-h', totalBar.offsetHeight + 'px');
    if (!visible) setSheet(false);
  }

  function updateTotalBarCta() {
    const cta = $('#total-bar-cta');
    cta.textContent = step >= steps.length ? 'Send request' : 'Continue';
  }

  $('#total-bar-cta').addEventListener('click', () => {
    setSheet(false);
    if (step >= steps.length) form.requestSubmit();
    else if (validateStep(step)) goToStep(step + 1);
  });

  /* On phones and tablets the estimate is a bottom sheet: tap the total to
     slide it up over the form, tap outside (or the grip) to put it away. */
  const sheetBackdrop = $('#sheet-backdrop');
  const sheetToggle = $('#total-bar-toggle');

  function setSheet(open) {
    if (open && !isMobileLayout()) open = false;
    if (open === summaryEl.classList.contains('is-open')) return;
    summaryEl.classList.toggle('is-open', open);
    sheetToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      sheetBackdrop.hidden = false;
      void sheetBackdrop.offsetWidth;
      sheetBackdrop.classList.add('is-on');
    } else {
      sheetBackdrop.classList.remove('is-on');
      setTimeout(() => { if (!summaryEl.classList.contains('is-open')) sheetBackdrop.hidden = true; }, 450);
    }
  }

  sheetToggle.addEventListener('click', () => setSheet(!summaryEl.classList.contains('is-open')));
  sheetBackdrop.addEventListener('click', () => setSheet(false));
  $('#summary-close').addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSheet(false); });

  window.addEventListener('resize', updateTotalBar);

  /* ======================================================================
     Pricing explorer — try numbers first, then carry them into the booking
     ====================================================================== */

  const explorer = { service: 'catering', quantity: 10 };
  const exQty     = $('#explore-qty');
  const exSeg     = $('#explore-seg');
  const exTiers   = $('#explore-tiers');
  const exMin     = Number(exQty.min);
  const exMax     = Number(exQty.max);

  /* Tier cards come from config, so a rate change there shows up here too. */
  exTiers.innerHTML = CFG.pricing.catering.tiers.map(t => {
    const top = t.to === Infinity ? exMax : t.to;
    const range = t.to === Infinity ? `${t.from}+` : `${t.from}–${t.to}`;
    return `<li class="tier" data-from="${t.from}" data-to="${top}" data-rate="${t.rate}">` +
      `<span class="tier-range">Hookahs ${range}</span>` +
      `<span class="tier-rate">${P.money(t.rate)}<small> each</small></span>` +
      `<span class="tier-bar"><i></i></span>` +
      `<span class="tier-sum">—</span></li>`;
  }).join('');
  const tierEls = $$('.tier', exTiers);

  function renderExplorer() {
    const n = explorer.quantity;
    const isCatering = explorer.service === 'catering';
    const q = P.quote({ service: explorer.service, quantity: n });
    const plural = n === 1 ? '' : 's';

    tweenMoney($('#explore-total'), q.total);
    $('#explore-qty-value').textContent = n;
    exQty.style.setProperty('--fill', ((n - exMin) / (exMax - exMin) * 100).toFixed(2) + '%');
    exQty.setAttribute('aria-valuetext', `${n} hookah${plural}, ${P.money(q.total)}`);

    $('#explore-caption').textContent = isCatering
      ? `${n} hookah${plural} · ${CFG.pricing.catering.serviceHours}-hour service · avg ${P.money(q.meta.rate)} each`
      : `${n} hookah${plural} × ${P.money(CFG.pricing.delivery.perHookah)} · delivered ready to smoke`;

    tierEls.forEach(el => {
      const from = Number(el.dataset.from);
      const to = Number(el.dataset.to);
      const span = to - from + 1;
      const count = Math.max(0, Math.min(n, to) - from + 1);
      $('.tier-bar i', el).style.setProperty('--f', (count / span).toFixed(3));
      $('.tier-sum', el).textContent = count
        ? `${count} × ${P.money(Number(el.dataset.rate))} = ${P.money(count * Number(el.dataset.rate))}`
        : '—';
      el.classList.toggle('is-active', n >= from && n <= to);
    });

    $('#explore-book-label').textContent = `Book ${n} hookah${plural}`;
  }

  function setExplorerService(value) {
    if (explorer.service === value) return;
    explorer.service = value;
    exSeg.dataset.value = value;
    const radio = $(`input[name="explore-service"][value="${value}"]`);
    if (radio) radio.checked = true;
    $$('[data-explore-panel]').forEach(p => { p.hidden = p.dataset.explorePanel !== value; });
    renderExplorer();
  }

  $$('input[name="explore-service"]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) setExplorerService(r.value); });
  });
  exQty.addEventListener('input', () => {
    explorer.quantity = Number(exQty.value);
    renderExplorer();
  });

  /* Service cards' "Pricing" links open the explorer on that service. */
  $$('[data-explore]').forEach(link => {
    link.addEventListener('click', () => setExplorerService(link.dataset.explore));
  });

  /* Their choices are already made, so skip straight to date and address. */
  $('#explore-book').addEventListener('click', e => {
    e.preventDefault();
    startBooking({ service: explorer.service, quantity: explorer.quantity, step: 2 });
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

        /* Owner-only: this never appears in the customer's copy of the quote. */
        if (payload.distanceMiles != null) fields['Distance'] = payload.distanceMiles + ' mi';
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

        /* Web3Forms answers 200 with {"success": false} when it accepts the
           request but refuses to deliver — an unverified or wrong access key
           being the usual cause. Checking res.ok alone reports those as sent. */
        let body = null;
        try { body = await res.json(); } catch (_) { /* non-JSON reply */ }

        if (res.ok && body && body.success === true) return { ok: true };

        const reason = (body && body.message) || `HTTP ${res.status}`;
        console.error('[Hookah By Hov] Web3Forms did not deliver this booking:', reason, body || '');
        return { ok: false, reason };
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
      if (!validateStep(s)) { goToStep(s); focusFirstInvalid(); return; }
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
      : `We couldn't send that automatically. Tap “Email us a copy” below and ` +
        `it'll go through, or call us on ${CFG.business.phone}.`;

    /* Nothing to fall back to when it went through — keep the confirmation clean. */
    $('#success-actions').hidden = delivered;

    /* Add ?debug=1 to the URL to see exactly why a send failed, without
       opening the browser console. Customers never see this. */
    const debugBox = $('#success-debug');
    const debugOn = /[?&]debug=1\b/.test(window.location.search);
    if (debugOn && !delivered) {
      debugBox.textContent = 'Diagnostic: ' +
        (result && result.skipped ? 'no access key configured'
          : (result && result.reason) || 'the request never reached Web3Forms');
      debugBox.hidden = false;
    } else {
      debugBox.hidden = true;
    }

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

    setSheet(false);
    successEl.classList.toggle('is-failed', !delivered);
    successEl.hidden = false;
    document.body.classList.add('is-locked');
    $('#success-close').focus();
    if (delivered && window.HBH_MOTION) window.HBH_MOTION.burst($('#success-mark'));

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
  renderExplorer();
  updateTotalBar();
  updateTotalBarCta();
  onScroll();
})();
