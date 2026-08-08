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
    email: '',                     // optional — shown/used only if set
    baseZip: '91405',              // Van Nuys, CA — delivery distances measured from here
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
     is shown their full invoice with one-tap "Text us a copy" and "Copy
     details" buttons, so the request still reaches you.
     ---------------------------------------------------------------------- */
  notify: {
    provider: 'none',
    accessKey: '',                 // web3forms access key
    endpoint: '',                  // formspree / custom endpoint URL
    subject: 'New booking request — Hookah By Hov'
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
