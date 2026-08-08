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
    return {
      status: 'far', zip: clean, city, miles, fee: null,
      band: 'Outside the ' + bands[bands.length - 1].maxMiles + '-mile service area'
    };
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

    /* --- delivery travel --- */
    let location = null;
    if (service === 'delivery') {
      location = locate(state.zip);
      flags.location = location;

      if (location.status === 'ok') {
        lines.push({
          key: 'travel',
          label: 'Delivery',
          detail: `${location.miles.toFixed(1)} mi · ${location.band}`,
          amount: location.fee,
          type: location.fee === 0 ? 'free' : 'fee'
        });
        total += location.fee;
      } else if (location.status === 'far') {
        blocked = true;
        blockReason = `${location.zip}${location.city ? ' (' + location.city + ')' : ''} is about ` +
          `${Math.round(location.miles)} miles from our Van Nuys base — past our ` +
          `${CFG.pricing.delivery.bands[CFG.pricing.delivery.bands.length - 1].maxMiles}-mile ` +
          `delivery range. Give us a call and we'll see what we can do.`;
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
    quote, locate, cateringTiers, effectiveRate, haversine,
    money, todayIso, addDaysIso, parseIso, formatDate, formatTime, endTime
  };
})();
