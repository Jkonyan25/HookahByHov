# Hookah By Hov — booking site

A single-page site for hookah **catering**, **delivery** and **events**, with a live
quote builder. A customer picks their service, hookah count and date, gets an
itemised estimate that updates as they type, and sends the request straight to
you. **No payment is ever taken on the site** — it collects the booking and the
numbers, you close the deal.

Built as plain HTML, CSS and JavaScript. No build step, no dependencies, no
server required.

---

## How a booking reaches you

**This is live and needs nothing further.** When a customer hits **Submit**,
the booking is emailed straight to **Hookahbyhov@gmail.com** through Web3Forms,
using the access key already set in `assets/js/config.js`.

The email arrives with everything as separate labelled fields — name, email,
phone, service, hookah count, date and time, address, distance, any promo code,
tobacco request, notes and the estimated total — plus the full itemised invoice
as readable text. **Replying to that email goes straight back to the customer**,
because their address is set as the reply-to.

Email is a **required** field on the form, so you always have a written record
and a second way to reach someone if the phone number is wrong. The customer
sees a confirmation saying you'll call them to confirm.

> **Note:** the booking email goes to **you**, not to the customer — so the site
> never promises them a confirmation email it can't deliver. If you'd like them
> to get an automatic acknowledgement too, turn on **Autoresponder** in your
> Web3Forms dashboard; no code change needed. Otherwise just hit reply on the
> notification and it lands in their inbox.

### If a send ever fails

Bad signal, aeroplane mode, an outage — the customer doesn't lose their work.
The confirmation switches to an apology and shows an **“Email us a copy”**
button that opens their mail app pre-addressed to Hookahbyhov@gmail.com with the
whole invoice already written, plus a **“Copy details”** button. Those buttons
are hidden when the send succeeds, so a normal booking ends on a clean
confirmation.

### Changing the destination address

The Web3Forms key is what routes the mail. To send bookings somewhere else, get
a new key at web3forms.com using that address and replace `accessKey` in
`assets/js/config.js`. Web3Forms access keys are meant to be public — they sit in
the page by design — so there's no harm in it living in the code.

### Other notification options

| `provider`   | What to set                                    | Notes |
|--------------|-----------------------------------------------|-------|
| `web3forms`  | `accessKey`                                    | **In use.** Free, no account, emails you each request. |
| `formspree`  | `endpoint` (e.g. `https://formspree.io/f/xxx`) | Free tier, 50 submissions/month. |
| `custom`     | `endpoint`                                     | Receives a JSON `POST` of the whole booking — use this to wire up a text message (Twilio), a spreadsheet, Zapier, a CRM, etc. |
| `none`       | —                                              | Skips sending; goes straight to the email fallback. |

Want a **text message** instead of an email when a booking comes in? Two easy
routes: point a **Zapier** or **Make.com** webhook at `provider: 'custom'` and
have it send you an SMS, or just turn on email-to-text forwarding in Gmail.

---

## Promo codes

Add a code to `assets/js/config.js` and a **Promo code** box appears on the
booking form automatically. Remove them all and the box disappears again, so
customers never see a field that can't work.

```js
promoCodes: {
  'SUMMER25': { type: 'percent', value: 10, label: '10% off hookahs' },
  'VIP100':   { type: 'amount',  value: 100, label: '$100 off',
                services: ['catering'], minQuantity: 15 },
  'FREEDROP': { type: 'freeDelivery', label: 'Free delivery',
                services: ['delivery'], expires: '2026-12-31' }
},
```

Three kinds of discount:

| `type`         | What it does |
|----------------|--------------|
| `percent`      | Takes `value`% off **the hookahs only** — holiday, same-day and travel fees stay full price |
| `amount`       | Takes `$value` straight off the total |
| `freeDelivery` | Waives the delivery travel fee |

Optional restrictions on any code:

| Setting       | Effect |
|---------------|--------|
| `label`       | What the customer sees on their estimate |
| `services`    | `['catering']` or `['delivery']` — leave it out for both |
| `minQuantity` | Smallest hookah count the code works on |
| `minSubtotal` | Smallest hookah subtotal in dollars |
| `startsOn`    | `'YYYY-MM-DD'` — not valid before this day |
| `expires`     | `'YYYY-MM-DD'` — not valid after this day |

Codes are matched ignoring case and spaces, so `SUMMER25`, `summer25` and
`" summer25 "` are all the same code. A rejected code says exactly why —
*"That code needs at least 15 hookahs — add 5 more"* — instead of a flat "invalid",
which turns a dead end into an upsell. A discount can never take a total below
zero, and the code used is shown on your copy of the booking.

**One thing to know:** these codes live in the page, so someone determined could
read them in the browser's source. That's fine here because **nothing is charged
online** — you see the code on every request and confirm the price yourself
before taking a cent. Treat them as friendly discounts rather than secrets. If
you ever start taking payment on the site, the codes should move to a server
that checks them, and that's a bigger change.

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
assets/js/config.js        ← business details, pricing, promo codes, notifications
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
