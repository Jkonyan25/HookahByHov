/* ==========================================================================
   Hookah By Hov — quote engine
   Pure calculation: give it the booking state, get back itemised lines and a
   total. No DOM access lives in here, which keeps the numbers easy to verify.
   ========================================================================== */

(function () {
  'use strict';

  const CFG = window.HBH_CONFIG;
  const ZIPS = window.HBH_ZIP_DATA || {};

  /* ---------------- money ---------------- */
  const money = n => '$' + Math.round(n).toLocaleString('en-US');

  /* ---------------- dates ---------------- */

  /* Today in the shop's timezone, as 'YYYY-MM-DD' — not the visitor's. */
  function todayIso() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CFG.business.timezone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function addDaysIso(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  /* Parse as a local date so no timezone shifts the calendar day. */
  function parseIso(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDate(iso) {
    const dt = parseIso(iso);
    if (!dt) return '';
    return dt.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function formatTime(hhmm) {
    if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return '';
    let [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  /* Catering end time, e.g. 7:00 PM → 11:00 PM */
  function endTime(hhmm, hours) {
    if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const total = (h + hours) % 24;
    return formatTime(String(total).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
  }

  /* ---------------- distance ---------------- */

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.7613; // miles
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* Look up a ZIP and measure it against the base ZIP.
     → { status, zip, city, miles, fee, band } where status is one of
       'empty' | 'invalid' | 'unknown' | 'ok' | 'far' */
  function locate(zip) {
    const clean = String(zip || '').trim().slice(0, 5);
    if (!clean) return { status: 'empty', zip: '' };
    if (!/^\d{5}$/.test(clean)) return { status: 'invalid', zip: clean };

    const base = ZIPS[CFG.business.baseZip];
    const point = ZIPS[clean];
    if (!base || !point) return { status: 'unknown', zip: clean };

    const miles = haversine(base[0], base[1], point[0], point[1]);
    const city = point[2] || '';
    const bands = CFG.pricing.delivery.bands;

    for (const band of bands) {
      if (miles <= band.maxMiles) {
        return { status: 'ok', zip: clean, city, miles, fee: band.fee, band: band.label };
      }
    }
    return { status: 'far', zip: clean, city, miles, fee: null, band: 'Outside the service area' };
  }

  /* ---------------- hookah subtotal ---------------- */

  /* Tiered catering pricing. Each tier is charged only on the hookahs that
     land inside it: 20 → (10 x $100) + (10 x $80) = $1,800. */
  function cateringTiers(qty) {
    const out = [];
    for (const tier of CFG.pricing.catering.tiers) {
      if (qty < tier.from) break;
      const count = Math.min(qty, tier.to) - tier.from + 1;
      if (count > 0) {
        out.push({
          from: tier.from,
          to: Math.min(qty, tier.to),
          count,
          rate: tier.rate,
          amount: count * tier.rate
        });
      }
    }
    return out;
  }

  /* Blended per-hookah rate, for display only. */
  function effectiveRate(service, qty) {
    if (qty < 1) return 0;
    if (service === 'delivery') return CFG.pricing.delivery.perHookah;
    return cateringTiers(qty).reduce((s, t) => s + t.amount, 0) / qty;
  }

  /* Same answer as locate(), but measured from exact coordinates instead of a
     ZIP centroid — used when Google Maps hands back a real address. */
  function locateByCoords(lat, lng, label) {
    const base = ZIPS[CFG.business.baseZip];
    if (!base || typeof lat !== 'number' || typeof lng !== 'number') {
      return { status: 'unknown', zip: '', exact: true };
    }
    const miles = haversine(base[0], base[1], lat, lng);
    const bands = CFG.pricing.delivery.bands;

    for (const band of bands) {
      if (miles <= band.maxMiles) {
        return {
          status: 'ok', zip: '', city: label || '', miles,
          fee: band.fee, band: band.label, exact: true
        };
      }
    }
    return {
      status: 'far', zip: '', city: label || '', miles, fee: null, exact: true,
      band: 'Outside the service area'
    };
  }

  /* Origin coordinates, handy for biasing map searches to the service area. */
  function baseCoords() {
    const base = ZIPS[CFG.business.baseZip];
    return base ? { lat: base[0], lng: base[1] } : null;
  }

  /* ---------------- promo codes ---------------- */

  /* Codes are matched case-insensitively and ignore surrounding spaces, so
     "  summer25 " finds SUMMER25. */
  function findPromo(code) {
    const codes = CFG.promoCodes || {};
    const wanted = String(code || '').trim().toUpperCase();
    if (!wanted) return null;
    const match = Object.keys(codes).find(k => k.trim().toUpperCase() === wanted);
    return match ? Object.assign({ code: match.trim().toUpperCase() }, codes[match]) : null;
  }

  function anyPromoCodes() {
    return Object.keys(CFG.promoCodes || {}).length > 0;
  }

  function serviceName(s) {
    return s === 'delivery' ? 'delivery' : 'catering';
  }

  /* ctx = { service, quantity, hookahSubtotal }
     → { ok:true, def } | { ok:false, reason } */
  function validatePromo(code, ctx) {
    const def = findPromo(code);
    if (!def) {
      return {
        ok: false,
        reason: anyPromoCodes()
          ? "That code isn't valid — double-check the spelling."
          : "There aren't any promo codes running right now."
      };
    }

    const today = todayIso();
    if (def.startsOn && today < def.startsOn) {
      return { ok: false, reason: `That code isn't active until ${formatDate(def.startsOn)}.` };
    }
    if (def.expires && today > def.expires) {
      return { ok: false, reason: `That code expired on ${formatDate(def.expires)}.` };
    }
    if (def.services && def.services.length && def.services.indexOf(ctx.service) === -1) {
      return { ok: false, reason: `That code only applies to ${def.services.map(serviceName).join(' or ')} bookings.` };
    }
    if (def.minQuantity && ctx.quantity < def.minQuantity) {
      const short = def.minQuantity - ctx.quantity;
      return { ok: false, reason: `That code needs at least ${def.minQuantity} hookahs — add ${short} more.` };
    }
    if (def.minSubtotal && ctx.hookahSubtotal < def.minSubtotal) {
      return { ok: false, reason: `That code applies to bookings of ${money(def.minSubtotal)} or more.` };
    }
    return { ok: true, def };
  }

  /* What a validated code is worth against this booking.
     percent      → off the hookahs only (not fees or travel)
     amount       → off the running total
     freeDelivery → waives the travel fee */
  function promoDiscount(def, amounts) {
    let value = 0;
    if (def.type === 'percent') {
      value = amounts.hookahSubtotal * (def.value / 100);
    } else if (def.type === 'amount') {
      value = def.value;
    } else if (def.type === 'freeDelivery') {
      value = amounts.travelFee;
    }
    /* never discount past zero */
    return Math.max(0, Math.min(Math.round(value), amounts.runningTotal));
  }

  /* Human-readable summary of a code, used on the estimate line. */
  function promoLabel(def) {
    if (def.label) return def.label;
    if (def.type === 'percent') return `${def.value}% off`;
    if (def.type === 'amount') return `${money(def.value)} off`;
    if (def.type === 'freeDelivery') return 'Free delivery';
    return 'Discount';
  }

  /* ---------------- the quote ---------------- */

  /**
   * state = { service, quantity, date, time, zip, tobacco }
   * → { lines[], total, flags{}, blocked, blockReason, meta{} }
   */
  function quote(state) {
    const service = state.service === 'delivery' ? 'delivery' : 'catering';
    const qty = Math.max(0, Math.min(
      parseInt(state.quantity, 10) || 0,
      CFG.booking.maxQuantity
    ));
    const date = state.date || '';
    const lines = [];
    const flags = {};
    let total = 0;
    let blocked = false;
    let blockReason = '';

    /* Tracked separately so a promo can target just the hookahs or just the
       travel fee rather than the whole bill. */
    let hookahSubtotal = 0;
    let travelFee = 0;

    /* --- hookahs --- */
    if (service === 'catering') {
      cateringTiers(qty).forEach(t => {
        const label = t.from === t.to
          ? `Hookah ${t.from}`
          : `Hookahs ${t.from}–${t.to}`;
        lines.push({
          key: 'tier-' + t.from,
          label,
          detail: `${t.count} × ${money(t.rate)}`,
          amount: t.amount
        });
        total += t.amount;
        hookahSubtotal += t.amount;
      });
    } else {
      const amount = qty * CFG.pricing.delivery.perHookah;
      if (qty > 0) {
        lines.push({
          key: 'hookahs',
          label: qty === 1 ? '1 hookah' : `${qty} hookahs`,
          detail: `${qty} × ${money(CFG.pricing.delivery.perHookah)}`,
          amount
        });
      }
      total += amount;
      hookahSubtotal += amount;
    }

    /* --- catering-only surcharges --- */
    if (service === 'catering' && date) {
      const holiday = window.HBH_HOLIDAYS.lookup(date);
      if (holiday) {
        flags.holiday = holiday;
        lines.push({
          key: 'holiday',
          label: 'Holiday surcharge',
          detail: holiday,
          amount: CFG.pricing.catering.holidayFee,
          type: 'fee'
        });
        total += CFG.pricing.catering.holidayFee;
      }

      if (date === todayIso()) {
        flags.sameDay = true;
        lines.push({
          key: 'sameday',
          label: 'Same-day booking fee',
          detail: 'Booked for today',
          amount: CFG.pricing.catering.sameDayFee,
          type: 'fee'
        });
        total += CFG.pricing.catering.sameDayFee;
      }
    } else if (service === 'delivery' && date) {
      /* Surfaced for information only — no delivery surcharge applies. */
      const holiday = window.HBH_HOLIDAYS.lookup(date);
      if (holiday) flags.holidayInfo = holiday;
      if (date === todayIso()) flags.sameDayInfo = true;
    }

    /* --- travel / destination fee (both services) --- */
    let location = null;
    if (state.zip || state.coords) {
      /* Exact coordinates from a picked address beat the ZIP centroid. */
      location = state.coords
        ? locateByCoords(state.coords.lat, state.coords.lng, state.coords.label)
        : locate(state.zip);
      flags.location = location;

      const where = (state.coords && state.city) || location.city || '';

      if (location.status === 'ok') {
        lines.push({
          key: 'travel',
          label: service === 'delivery' ? 'Delivery' : 'Destination fee',
          detail: where || 'Travel',
          amount: location.fee,
          type: location.fee === 0 ? 'free' : 'fee'
        });
        total += location.fee;
        travelFee = location.fee;
      } else if (location.status === 'far') {
        if (service === 'delivery') {
          blocked = true;
          blockReason = `${where || 'That address'} is outside the area we deliver to. ` +
            `Give us a call and we'll see what we can do.`;
        } else {
          /* Catering travels further than delivery does, so a long trip is a
             conversation rather than a dead end — quoted on the phone. */
          flags.travelTBC = true;
        }
      }
    }

    /* --- promo code --- */
    if (state.promo && String(state.promo).trim()) {
      const check = validatePromo(state.promo, {
        service, quantity: qty, hookahSubtotal
      });

      if (check.ok) {
        const amount = promoDiscount(check.def, {
          hookahSubtotal, travelFee, runningTotal: total
        });
        const label = promoLabel(check.def);
        flags.promo = { code: check.def.code, label, amount };
        if (amount > 0) {
          lines.push({
            key: 'promo',
            label: `Promo ${check.def.code}`,
            detail: label,
            amount: -amount,
            type: 'discount'
          });
          total -= amount;
        } else {
          /* Valid, but worth nothing here — e.g. free delivery inside the
             free zone. Say so instead of showing a silent $0 line. */
          flags.promoNote = `${check.def.code} applied — no discount to take off this booking.`;
        }
      } else {
        flags.promoError = check.reason;
      }
    }

    /* --- tobacco request (priced separately) --- */
    if (state.tobacco && state.tobacco.trim()) {
      lines.push({
        key: 'tobacco',
        label: 'Specialty tobacco request',
        detail: 'Varies by amount & market price',
        amount: null,
        type: 'muted'
      });
    }

    return {
      service,
      quantity: qty,
      lines,
      total,
      flags,
      blocked,
      blockReason,
      meta: {
        rate: effectiveRate(service, qty),
        serviceHours: service === 'catering' ? CFG.pricing.catering.serviceHours : null,
        location
      }
    };
  }

  window.HBH_PRICING = {
    quote, locate, locateByCoords, baseCoords, cateringTiers, effectiveRate, haversine,
    findPromo, anyPromoCodes, validatePromo, promoDiscount, promoLabel,
    money, todayIso, addDaysIso, parseIso, formatDate, formatTime, endTime
  };
})();
