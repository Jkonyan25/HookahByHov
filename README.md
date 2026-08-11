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

### Nothing arriving? Check these in order

1. **Verify the access key.** When you create a key, Web3Forms emails
   Hookahbyhov@gmail.com an activation link. **Until you click it, submissions
   are accepted and silently dropped.** This is by far the most common cause.
   Check the inbox — and the spam folder — for that email.
2. **Check spam.** The first booking notification can land in spam. Open it and
   mark *Not spam*, and ideally add `noreply@web3forms.com` to your contacts.
3. **Make sure the live site actually has the key.** GitHub Pages can serve a
   cached copy for a few minutes after a push. Open the site, view
   `assets/js/config.js` in the browser, and confirm `accessKey` is filled in.
   A hard refresh (Ctrl-Shift-R, or Cmd-Shift-R on a Mac) clears a stale copy.
4. **Add `?debug=1` to the URL** — e.g. `hookahbyhov.com/?debug=1` — and submit a
   test. If the send fails, the confirmation box shows the exact reason
   Web3Forms gave, in plain sight. Customers never see this; it only appears
   with the flag in the URL and only when something actually failed. The same
   detail is also printed to the browser console (Inspect → Console) prefixed
   with `[Hookah By Hov]`.

**Catering and delivery submit through exactly the same code.** There is no
separate path for either, so if one is arriving and the other isn't, the cause
is on the mail side — spam filtering or key verification — not the form.

The site no longer reports a booking as sent unless Web3Forms confirms it was
delivered — if anything goes wrong the customer sees the fallback below instead
of a false confirmation.

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

## Google Maps address autocomplete (optional)

Off by default. Without a key the address fields work as they always have — the
customer types a ZIP and the distance comes from the built-in ZIP table, free
and instant.

Add a key and the address box suggests real addresses as they type. Picking one
fills in the city and ZIP automatically and measures the distance **from the
actual building** rather than the middle of the ZIP code, so the delivery fee is
right even for a big ZIP that straddles two bands.

**Setup**

1. https://console.cloud.google.com → create a project
2. Enable **Places API (New)**
3. Credentials → Create credentials → API key
4. **Restrict the key** — click it, set *Application restrictions* to **Websites**,
   and add `hookahbyhov.com` and `www.hookahbyhov.com`. Then set *API
   restrictions* to the Places API only.
5. Enable billing on the project. Google's monthly free allowance comfortably
   covers a booking form this size, but set a budget alert anyway.
6. Paste the key into `maps.apiKey` in `assets/js/config.js`.

The key sits in the page — unavoidable for browser maps, which is exactly why
step 4 matters. A restricted key is useless to anyone who copies it.

**How it behaves**

- Suggestions are biased toward the service area, requested one per pause in
  typing rather than per keystroke, and only after three characters — so it
  stays cheap.
- Fully keyboard accessible: arrow keys, Enter, Escape.
- Editing the address by hand after picking one discards the exact coordinates
  and falls back to the ZIP, so a fee is never quoted for a building the
  customer has typed away from.
- If the key is wrong, the API is unreachable, or billing lapses, it logs one
  clear console message and falls back to the ZIP lookup. **The form keeps
  working either way.**

---

## Promo codes

The promo box sits at the bottom of the **Contact** step and is always visible.
Until you add codes below, any code entered gets *"There aren't any promo codes
running right now."*

Add your codes to `assets/js/config.js`:

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

Catering also carries the same **travel/destination fee** as delivery (see
below) — free locally, $50 or $100 further out. A catering job past the last
band isn't blocked, unlike delivery; it says the fee will be confirmed by phone,
since a big catering booking is worth a conversation rather than a dead end.

Both are shown as their own line items, and both can apply at once. Holidays are
worked out automatically for any year — fixed dates, floating ones (Thanksgiving,
Memorial Day, Mother's Day…) and Easter — so the list never needs updating. Add
or remove dates in `config.holidays` if you want to tune it.

### Delivery — flat per hookah + travel

**$60 per hookah**, any quantity, plus the travel fee:

| Distance      | Fee |
|---------------|-----|
| Within 25 mi  | Free |
| 25 – 50 mi    | $50 |
| 50 – 100 mi   | $100 |
| Over 100 mi   | Out of range for delivery — the form asks them to call |

Holiday and same-day fees do **not** apply to delivery.

### Your location stays private

Distances are measured from `business.baseZip` in `assets/js/config.js`
(currently **91331**). That value is used for maths only — **it never appears
anywhere the customer can see**, and neither does the mileage.

After someone enters their ZIP, the site tells them only their own city and
whether a fee applies:

> **Long Beach** — a **$50** destination fee applies.
> **Pacoima** — no destination fee. You're inside our standard service area.

The mileage is still included in the booking email to you, so you always know
the real distance. To move the base later, change that one ZIP; nothing else
needs touching. The bundled ZIP table covers 200 miles around the LA area, so
any nearby base works without regenerating data.

### Specialty tobacco

A free-text request field with quick-pick flavour chips. It's deliberately **not**
priced — it appears on the estimate as *“Quoted separately”*, and the site tells
the customer in three places that the cost depends on the amount requested and
the current market price, and that you'll confirm it when you contact them.

---

## How the distance check works

`assets/js/zipdata.js` holds 871 California ZIPs covering roughly 200 miles
around the Los Angeles area, with its official centroid. Distances are straight-line
(great-circle) from the base ZIP's centroid, so a 34-mile reading is 34 miles as
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
assets/js/maps.js          Google Places address autocomplete (optional)
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
