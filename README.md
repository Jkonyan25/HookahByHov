# Hookah By Hov — booking site

A single-page site for hookah **catering**, **delivery** and **events**, with a live
quote builder. A customer picks their service, hookah count and date, gets an
itemised estimate that updates as they type, and sends the request straight to
you. **No payment is ever taken on the site** — it collects the booking and the
numbers, you close the deal.

Built as plain HTML, CSS and JavaScript. No build step, no dependencies, no
server required.

---

## ⚠️ One step before you go live

The booking form is fully working, but it needs **your** notification address
before requests can be emailed to you. It takes about two minutes:

1. Go to **https://web3forms.com** and enter your email. They give you an
   *access key* — no account, no password, free.
2. Open `assets/js/config.js` and fill in the `notify` block:

   ```js
   notify: {
     provider: 'web3forms',
     accessKey: 'paste-your-access-key-here',
     endpoint: '',
     subject: 'New booking request — Hookah By Hov'
   },
   ```

3. Save, upload, done. Every booking now arrives in your inbox with the full
   invoice.

**Until you do that**, nothing breaks and no lead is lost — the customer still
sees their finished estimate and gets a **“Text us a copy”** button that opens
their messaging app with the whole invoice pre-written and addressed to
818-807-8008. They just hit send. That same fallback also catches any request
that fails to send because of a bad connection.

### Other notification options

| `provider`   | What to set                                    | Notes |
|--------------|-----------------------------------------------|-------|
| `web3forms`  | `accessKey`                                    | Easiest. Emails you each request. |
| `formspree`  | `endpoint` (e.g. `https://formspree.io/f/xxx`) | Free tier available. |
| `custom`     | `endpoint`                                     | Receives a JSON `POST` of the whole booking — use this to wire up SMS (Twilio), a spreadsheet, Zapier, a CRM, etc. |
| `none`       | —                                              | Skips sending; goes straight to the text/copy fallback. |

---

## Running it

It's a static site, so anything that serves files works.

```bash
# look at it locally
npx http-server -p 8080 .
# → http://localhost:8080
```

To publish: drag the folder onto **Netlify Drop**, or push to GitHub and turn on
**GitHub Pages**, or upload to any web host. There is nothing to compile.

---

## Pricing, and where it lives

Every number below is set in `assets/js/config.js` — change it there and the
whole site follows, including the pricing tables and the FAQ examples stay
accurate because they quote the same figures.

### Catering — tiered per hookah

Each tier applies only to the hookahs that fall inside it:

| Hookahs | Rate each |
|---------|-----------|
| 1 – 10  | $100 |
| 11 – 20 | $80  |
| 21 +    | $70  |

So 10 hookahs is **$1,000**, 20 hookahs is **$1,000 + $800 = $1,800**, and
25 hookahs is **$1,000 + $800 + $350 = $2,150**.

Catering includes **4 hours** of on-site service, stated on the service card,
the pricing table, the booking form, the estimate and the FAQ.

**Catering-only surcharges:**
- **+$200** if the event date is a holiday
- **+$200** for a same-day booking

Both are shown as their own line items, and both can apply at once. Holidays are
worked out automatically for any year — fixed dates, floating ones (Thanksgiving,
Memorial Day, Mother's Day…) and Easter — so the list never needs updating. Add
or remove dates in `config.holidays` if you want to tune it.

### Delivery — flat per hookah + travel

**$60 per hookah**, any quantity, plus a travel fee measured from **91405**
(Van Nuys):

| Distance      | Fee |
|---------------|-----|
| Within 25 mi  | Free |
| 25 – 50 mi    | $50 |
| 50 – 100 mi   | $100 |
| Over 100 mi   | Out of range — the form asks them to call |

The customer types a ZIP and the site immediately tells them the distance and
what it costs, or that they're too far out. Holiday and same-day fees do **not**
apply to delivery.

### Specialty tobacco

A free-text request field with quick-pick flavour chips. It's deliberately **not**
priced — it appears on the estimate as *“Quoted separately”*, and the site tells
the customer in three places that the cost depends on the amount requested and
the current market price, and that you'll confirm it when you contact them.

---

## How the distance check works

`assets/js/zipdata.js` holds every California ZIP within 200 miles of 91405 —
871 of them — with its official centroid. Distances are straight-line
(great-circle) from the 91405 centroid, so a 34.2-mile reading is 34.2 miles as
the crow flies, not driving miles. It's instant, works offline, costs nothing,
and needs no API key or billing account.

Coordinates come from the **U.S. Census Bureau's ZCTA internal points**, joined
with USPS city names. If a customer enters a ZIP that isn't in the file (a
PO-box-only ZIP, or one out of state), the site doesn't block them — it says it
couldn't verify the distance and lets the request through for you to confirm.

---

## Files

```
index.html                 the whole page
assets/css/styles.css      theme, layout, responsive rules
assets/js/config.js        ← business details, pricing, notifications
assets/js/zipdata.js       ZIP centroids for the delivery radius
assets/js/holidays.js      holiday calendar (any year, calculated)
assets/js/pricing.js       quote engine — pure maths, no DOM
assets/js/app.js           form, steps, validation, sending
assets/img/                logo badge + favicon (SVG)
```

## Swapping in your real logo

The badge is currently a hand-built SVG recreation, which keeps the page fast
and lets it scale to any size without going blurry. To use your original
artwork instead, drop the file in as `assets/img/logo-badge.png` and replace the
three `<svg class="…"><use href="#icon-badge"></use></svg>` tags in `index.html`
(header, hero, footer) with `<img src="assets/img/logo-badge.png" alt="Hookah By Hov">`.

Brand colours live at the top of `styles.css` as `--gold-100` through
`--gold-700`, pulled from the logo's champagne-to-antique-gold gradient.

---

## Details worth knowing

- **Mobile.** Checked from 320px up. The estimate follows the customer in a
  sticky bottom bar as they fill the form, tap targets are 44px+, and the number,
  date, time and phone fields open the right keyboard on a phone.
- **Dates.** "Today" is computed in **America/Los_Angeles**, so a visitor in
  another timezone can't accidentally dodge — or trigger — the same-day fee.
- **Accessibility.** Keyboard navigable throughout, visible focus rings, live
  regions announce the total as it changes, and all animation stops for anyone
  who has "reduce motion" turned on.
- **Age gate.** The form requires confirmation that everyone using the hookahs
  is 21+, and the footer carries a health notice.
- **Spam.** A hidden honeypot field silently drops bot submissions.
