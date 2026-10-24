/* ==========================================================================
   Hookah By Hov — Google Places address autocomplete
   --------------------------------------------------------------------------
   Entirely optional. With no API key in config.js this file does nothing and
   the address fields behave exactly as they did before, with the distance
   coming from the built-in ZIP table.

   With a key, it suggests real addresses as the customer types and hands back
   exact coordinates, so the delivery fee is measured from the actual building
   rather than the middle of their ZIP code.

   Uses the Places API (New) — AutocompleteSuggestion — and renders our own
   dropdown rather than Google's widget, so it matches the rest of the site and
   stays keyboard accessible. If anything about the API is unavailable, every
   path here fails soft back to the ZIP lookup.
   ========================================================================== */

(function () {
  'use strict';

  const CFG = window.HBH_CONFIG;
  const MAPS = (CFG && CFG.maps) || {};

  const MILES_TO_METRES = 1609.34;
  /* Places caps a location bias circle at 50km; anything larger is rejected. */
  const MAX_BIAS_METRES = 50000;

  let loadPromise = null;
  let placesLib = null;
  let sessionToken = null;

  function isEnabled() {
    return Boolean(MAPS.apiKey && String(MAPS.apiKey).trim());
  }

  /* ---------------- script loading ---------------- */

  function loadApi() {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      if (window.google && window.google.maps) return resolve(window.google.maps);

      const callbackName = '__hbhMapsReady';
      const timer = setTimeout(
        () => reject(new Error('Google Maps timed out')), 12000);

      window[callbackName] = () => {
        clearTimeout(timer);
        resolve(window.google.maps);
      };

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://maps.googleapis.com/maps/api/js' +
        '?key=' + encodeURIComponent(MAPS.apiKey) +
        '&libraries=places&loading=async&callback=' + callbackName;
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Google Maps script blocked or failed to load'));
      };
      document.head.appendChild(script);
    });

    return loadPromise;
  }

  async function places() {
    if (placesLib) return placesLib;
    const maps = await loadApi();
    placesLib = maps.importLibrary ? await maps.importLibrary('places') : maps.places;
    if (!placesLib || !placesLib.AutocompleteSuggestion) {
      throw new Error('Places API (New) is not enabled for this key');
    }
    return placesLib;
  }

  function newSession(lib) {
    sessionToken = lib.AutocompleteSessionToken ? new lib.AutocompleteSessionToken() : undefined;
    return sessionToken;
  }

  /* ---------------- queries ---------------- */

  async function fetchSuggestions(text) {
    const lib = await places();
    if (!sessionToken) newSession(lib);

    const request = {
      input: text,
      sessionToken: sessionToken,
      includedRegionCodes: [(MAPS.country || 'us')]
    };

    /* Nudge results toward the service area — a bias, not a restriction, so
       someone booking from further out can still find their address. */
    const base = window.HBH_PRICING.baseCoords();
    if (base) {
      request.locationBias = {
        center: base,
        radius: Math.min((MAPS.biasRadiusMiles || 100) * MILES_TO_METRES, MAX_BIAS_METRES)
      };
    }

    const response = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
    return (response.suggestions || [])
      .map(s => s.placePrediction)
      .filter(Boolean);
  }

  /* Google's field objects have changed shape across versions; read either. */
  function componentText(component, short) {
    if (!component) return '';
    if (short) return component.shortText || component.short_name || '';
    return component.longText || component.long_name || '';
  }

  async function resolvePrediction(prediction) {
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ['formattedAddress', 'addressComponents', 'location']
    });

    const parts = {};
    (place.addressComponents || []).forEach(component => {
      const types = component.types || [];
      if (types.indexOf('street_number') > -1) parts.streetNumber = componentText(component);
      if (types.indexOf('route') > -1) parts.route = componentText(component);
      if (types.indexOf('locality') > -1) parts.city = componentText(component);
      if (types.indexOf('sublocality') > -1 && !parts.city) parts.city = componentText(component);
      if (types.indexOf('postal_town') > -1 && !parts.city) parts.city = componentText(component);
      if (types.indexOf('postal_code') > -1) parts.zip = componentText(component);
      if (types.indexOf('administrative_area_level_1') > -1) parts.state = componentText(component, true);
    });

    const point = place.location;
    const lat = point && (typeof point.lat === 'function' ? point.lat() : point.lat);
    const lng = point && (typeof point.lng === 'function' ? point.lng() : point.lng);

    /* Fall back to the first line of the formatted address when the components
       don't give us a clean street (rural routes, named venues). */
    const street = [parts.streetNumber, parts.route].filter(Boolean).join(' ') ||
      String(place.formattedAddress || '').split(',')[0];

    /* One session token covers a typing session; start fresh after a pick. */
    sessionToken = null;

    return {
      street: street,
      city: parts.city || '',
      zip: parts.zip || '',
      state: parts.state || '',
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      formatted: place.formattedAddress || ''
    };
  }

  /* ======================================================================
     The dropdown
     ====================================================================== */

  function attach(options) {
    const input = options.input;
    const list = options.list;
    const onSelect = options.onSelect || function () {};
    const onStatus = options.onStatus || function () {};

    if (!isEnabled() || !input || !list) return { enabled: false };

    let items = [];
    let active = -1;
    let debounce = null;
    let sequence = 0;
    let broken = false;

    function close() {
      list.hidden = true;
      list.innerHTML = '';
      items = [];
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function highlight(index) {
      active = index;
      Array.from(list.children).forEach((li, i) => {
        const on = i === index;
        li.classList.toggle('is-active', on);
        li.setAttribute('aria-selected', String(on));
      });
      if (index > -1 && list.children[index]) {
        input.setAttribute('aria-activedescendant', list.children[index].id);
        list.children[index].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function draw(predictions) {
      items = predictions;
      if (!predictions.length) return close();

      list.innerHTML = predictions.map((p, i) => {
        const main = (p.mainText && p.mainText.toString()) ||
          (p.text && p.text.toString()) || '';
        const secondary = (p.secondaryText && p.secondaryText.toString()) || '';
        return `<li id="addr-option-${i}" role="option" aria-selected="false" data-index="${i}">
          <svg width="16" height="16" aria-hidden="true"><use href="#icon-pin"></use></svg>
          <span><b>${escapeHtml(main)}</b>${secondary ? `<small>${escapeHtml(secondary)}</small>` : ''}</span>
        </li>`;
      }).join('');

      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      highlight(-1);
    }

    async function choose(index) {
      const prediction = items[index];
      if (!prediction) return;
      close();
      onStatus({ state: 'resolving' });
      try {
        const address = await resolvePrediction(prediction);
        onSelect(address);
        onStatus({ state: 'selected' });
      } catch (err) {
        console.error('[Hookah By Hov] Could not read that address:', err);
        onStatus({ state: 'error', error: err });
      }
    }

    async function search(text) {
      const mine = ++sequence;
      try {
        const predictions = await fetchSuggestions(text);
        if (mine !== sequence) return;   // a newer keystroke already won
        draw(predictions);
      } catch (err) {
        /* One clear message, then stop trying — the ZIP field still works. */
        if (!broken) {
          broken = true;
          console.error('[Hookah By Hov] Address autocomplete unavailable, ' +
            'falling back to ZIP lookup:', err);
          onStatus({ state: 'unavailable', error: err });
        }
        close();
      }
    }

    input.addEventListener('input', () => {
      if (broken) return;
      const text = input.value.trim();
      clearTimeout(debounce);
      if (text.length < 3) return close();
      /* One request per pause in typing, not per keystroke. */
      debounce = setTimeout(() => search(text), 250);
    });

    input.addEventListener('keydown', e => {
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight((active - 1 + items.length) % items.length); }
      else if (e.key === 'Enter' && active > -1) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { close(); }
    });

    list.addEventListener('mousedown', e => {
      /* mousedown, not click — blur would close the list first. */
      const li = e.target.closest('li[data-index]');
      if (li) { e.preventDefault(); choose(Number(li.dataset.index)); }
    });

    input.addEventListener('blur', () => setTimeout(close, 120));

    return { enabled: true, close: close };
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.HBH_MAPS = { isEnabled, attach, fetchSuggestions, resolvePrediction };
})();
