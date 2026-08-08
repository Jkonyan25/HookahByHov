/* ==========================================================================
   Hookah By Hov — holiday calendar
   Works for any year: fixed dates, nth-weekday rules and Easter are all
   calculated on the fly, so the $200 holiday surcharge never goes stale.
   ========================================================================== */

(function () {
  'use strict';

  /* nth weekday of a month. n = 1..4, or -1 for "last".
     weekday: 0 = Sunday … 6 = Saturday */
  function nthWeekday(year, month, weekday, n) {
    if (n > 0) {
      const first = new Date(year, month - 1, 1);
      const offset = (weekday - first.getDay() + 7) % 7;
      return new Date(year, month - 1, 1 + offset + (n - 1) * 7);
    }
    const last = new Date(year, month, 0);
    const back = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, 0 - back);
  }

  /* Anonymous Gregorian algorithm */
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function key(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  const cache = {};

  /* Every recognised holiday for a given year, as { 'YYYY-MM-DD': 'Name' } */
  function forYear(year) {
    if (cache[year]) return cache[year];

    const map = {};
    const add = (date, name) => { map[key(date)] = name; };
    const fixed = (m, d, name) => add(new Date(year, m - 1, d), name);

    fixed(1, 1, "New Year's Day");
    add(nthWeekday(year, 1, 1, 3), 'Martin Luther King Jr. Day');
    fixed(2, 14, "Valentine's Day");
    add(nthWeekday(year, 2, 1, 3), "Presidents' Day");
    fixed(3, 17, "St. Patrick's Day");
    add(easter(year), 'Easter Sunday');
    fixed(5, 5, 'Cinco de Mayo');
    add(nthWeekday(year, 5, 0, 2), "Mother's Day");
    add(nthWeekday(year, 5, 1, -1), 'Memorial Day');
    add(nthWeekday(year, 6, 0, 3), "Father's Day");
    fixed(6, 19, 'Juneteenth');
    fixed(7, 4, 'Independence Day');
    add(nthWeekday(year, 9, 1, 1), 'Labor Day');
    fixed(10, 31, 'Halloween');

    const thanksgiving = nthWeekday(year, 11, 4, 4);
    add(thanksgiving, 'Thanksgiving');
    const blackFriday = new Date(thanksgiving);
    blackFriday.setDate(blackFriday.getDate() + 1);
    add(blackFriday, 'Day After Thanksgiving');

    fixed(12, 24, 'Christmas Eve');
    fixed(12, 25, 'Christmas Day');
    fixed(12, 31, "New Year's Eve");

    const cfg = (window.HBH_CONFIG && window.HBH_CONFIG.holidays) || {};

    (cfg.exclude || []).forEach(name => {
      Object.keys(map).forEach(k => { if (map[k] === name) delete map[k]; });
    });

    Object.entries(cfg.extraDates || {}).forEach(([when, name]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
        if (when.slice(0, 4) === String(year)) map[when] = name;
      } else if (/^\d{2}-\d{2}$/.test(when)) {
        map[year + '-' + when] = name;
      }
    });

    cache[year] = map;
    return map;
  }

  /* Returns the holiday name for 'YYYY-MM-DD', or null. */
  function lookup(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return null;
    return forYear(Number(isoDate.slice(0, 4)))[isoDate] || null;
  }

  /* Upcoming holidays from a given ISO date, for display. */
  function upcoming(fromIso, count) {
    const year = Number(fromIso.slice(0, 4));
    const all = Object.assign({}, forYear(year), forYear(year + 1));
    return Object.keys(all).sort()
      .filter(d => d >= fromIso)
      .slice(0, count || 5)
      .map(d => ({ date: d, name: all[d] }));
  }

  window.HBH_HOLIDAYS = { forYear, lookup, upcoming, nthWeekday, easter };
})();
