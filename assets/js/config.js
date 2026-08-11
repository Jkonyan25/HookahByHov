/* ==========================================================================
   Hookah By Hov — site configuration
   Everything you'd realistically want to change lives in this one file.
   ========================================================================== */

window.HBH_CONFIG = {

  /* ----------------------------------------------------------------------
     BUSINESS
     ---------------------------------------------------------------------- */
  business: {
    name: 'Hookah By Hov',
    phone: '818-807-8008',
    phoneE164: '+18188078008',
    email: 'Hookahbyhov@gmail.com',
    /* Travel distances are measured from here. Kept out of every customer-
       facing string on purpose — the site only ever names their own city and
       whether a travel fee applies, never this location or the mileage. */
    baseZip: '91331',
    timezone: 'America/Los_Angeles'
  },

  /* ----------------------------------------------------------------------
     NOTIFICATIONS — how a booking request reaches you
     ----------------------------------------------------------------------
     provider: 'web3forms' | 'formspree' | 'custom' | 'none'

     web3forms  → create a free access key at https://web3forms.com (no account
                  needed, just your email). Paste it into `accessKey` below and
                  every request is emailed to you. Nothing else to deploy.
     formspree  → create a form at https://formspree.io and paste the endpoint
                  URL (e.g. https://formspree.io/f/abcdwxyz) into `endpoint`.
     custom     → set `endpoint` to your own URL. It receives a JSON POST with
                  the full booking payload (see buildPayload() in app.js).
     none       → skips the network call entirely and goes straight to the
                  text-message / copy fallback.

     If a send fails for ANY reason, the site never loses the lead: the customer
     is shown their full invoice with one-tap "Email us a copy" and "Copy
     details" buttons, so the request still reaches you.
     ---------------------------------------------------------------------- */
  notify: {
    provider: 'web3forms',
    accessKey: '4e570307-a509-43fe-b1e5-08a6c06533d3',
    endpoint: '',                  // formspree / custom endpoint URL
    subject: 'New booking request — Hookah By Hov'
  },

  /* ----------------------------------------------------------------------
     GOOGLE MAPS — address autocomplete
     ----------------------------------------------------------------------
     Optional. Leave `apiKey` empty and the address fields work exactly as they
     do now: the customer types a ZIP and the distance comes from the built-in
     ZIP table. No key, no bill, nothing breaks.

     Add a key and the address box starts suggesting real addresses as they
     type. Picking one fills in the city and ZIP automatically and measures the
     distance from the exact rooftop coordinates instead of the ZIP's centre
     point — so the delivery fee is right even for a ZIP that straddles a band.

     To get a key:
       1. https://console.cloud.google.com → create a project
       2. Enable the "Places API (New)" for it
       3. APIs & Services → Credentials → Create credentials → API key
       4. IMPORTANT: click the key → Application restrictions → Websites, and
          add your domains (hookahbyhov.com, www.hookahbyhov.com). A key with
          no restrictions can be lifted off your page and run up your bill.
       5. API restrictions → restrict the key to the Places API
       6. Billing must be enabled on the project. Google includes a monthly
          free allowance that comfortably covers a booking form of this size,
          but set a budget alert so there are no surprises.

     The key sits in the page — that is normal and unavoidable for browser
     maps. The website restriction in step 4 is what protects it.
     ---------------------------------------------------------------------- */
  maps: {
    apiKey: '',                    // ← paste your Google Maps API key here
    country: 'us',
    /* Bias suggestions toward the service area rather than the whole country. */
    biasRadiusMiles: 110
  },

  /* ----------------------------------------------------------------------
     PRICING
     ---------------------------------------------------------------------- */
  pricing: {
    catering: {
      /* Tiered per-hookah rates. Each tier applies only to the hookahs that
         fall inside it, so 20 hookahs = (10 x $100) + (10 x $80) = $1,800. */
      tiers: [
        { from: 1,  to: 10,       rate: 100 },
        { from: 11, to: 20,       rate: 80  },
        { from: 21, to: Infinity, rate: 70  }
      ],
      serviceHours: 4,
      holidayFee: 200,
      sameDayFee: 200
    },
    delivery: {
      perHookah: 60,
      /* Travel fee by straight-line distance from the base ZIP.
         Anything past the last band is out of the service area. */
      bands: [
        { maxMiles: 25,  fee: 0,   label: 'Within 25 miles'  },
        { maxMiles: 50,  fee: 50,  label: '25 – 50 miles'    },
        { maxMiles: 100, fee: 100, label: '50 – 100 miles'   }
      ]
    }
  },

  /* ----------------------------------------------------------------------
     HOLIDAYS
     Recognised holidays are calculated automatically for any year (see
     holidays.js). Use these lists to fine-tune without touching that file.
     ---------------------------------------------------------------------- */
  holidays: {
    /* Extra dates that should trigger the holiday fee. 'YYYY-MM-DD' for a
       one-off, or 'MM-DD' to repeat every year. */
    extraDates: {
      // '07-05': 'July 4th Weekend',
      // '2026-11-27': 'Day After Thanksgiving'
    },
    /* Names from the built-in list to ignore, e.g. ['Juneteenth']. */
    exclude: []
  },

  /* ----------------------------------------------------------------------
     PROMO CODES
     ----------------------------------------------------------------------
     Add a code below and the "Promo code" box appears on the booking form
     automatically. Remove them all and the box disappears again. Codes are
     matched ignoring case and spaces, so SUMMER25 = summer25.

     type: 'percent'      value = % off the hookahs (fees and travel excluded)
           'amount'       value = flat dollars off the total
           'freeDelivery' waives the delivery travel fee

     Optional restrictions on any code:
       label       what the customer sees on their estimate
       services    ['catering'] or ['delivery'] — omit for both
       minQuantity smallest hookah count the code works on
       minSubtotal smallest hookah subtotal (dollars) the code works on
       startsOn    'YYYY-MM-DD' — not valid before this day
       expires     'YYYY-MM-DD' — not valid after this day (based on the day
                   they book, not their event date)

     Heads up: these codes live in the page, so a determined person could read
     them in the browser's source. That's fine here because nothing is charged
     online — you see the code on every request and confirm the price yourself
     before taking a cent. Treat them as friendly discounts, not secrets.

     To switch a code on, delete the two slashes at the start of its line.
     ---------------------------------------------------------------------- */
  promoCodes: {
    // 'SUMMER25': { type: 'percent', value: 10, label: '10% off hookahs' },
    // 'VIP100':   { type: 'amount', value: 100, label: '$100 off', services: ['catering'], minQuantity: 15 },
    // 'FREEDROP': { type: 'freeDelivery', label: 'Free delivery', services: ['delivery'], expires: '2026-12-31' },
  },

  /* ----------------------------------------------------------------------
     BOOKING DEFAULTS
     ---------------------------------------------------------------------- */
  booking: {
    minQuantity: 1,
    maxQuantity: 200,
    defaultQuantity: { catering: 10, delivery: 4 },
    defaultTime: '19:00',
    maxMonthsAhead: 18
  }
};
