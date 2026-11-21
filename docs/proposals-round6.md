# Round 6 investigations (21.11.2026)

Two items from round 6 were "investigate only": #7 player portal with Stack Team App, and #25 team shop.
Neither is built. This is what I found and what I'd recommend.

## #7 Player portal connected to Stack Team App

**What Stack Team App offers (as far as public information goes)**

- Members can sync team events into their phone calendar (calendar subscription, set up in the device's
  calendar settings, per member).
- I found no public API, no webhooks and no developer documentation. Schedules and PDFs are uploaded through
  the Team App web dashboard.

**What that means for "automated, nothing manual"**

- A login area ("portal") needs a server and accounts. GitHub Pages only serves static files, so a portal
  means adding a hosted service (e.g. a small database and auth provider) and keeping member data there
  under GDPR. That is a real step up in cost, upkeep and responsibility.
- Without an API, the only automatic link to Team App would be reading a member's calendar subscription
  link. That link shows private team dates (trainings, etc.). Pulling it into the public website would
  publish internal information, and putting it behind a login brings us back to the server problem.

**Recommendation**

1. Keep Team App as the members' tool (training dates, RSVPs, chat). It already does this well.
2. Use what the website now publishes automatically on the members' side: the game calendar feed
   (`/calendar/muskrats.ics`, updated every night from WEHV). In Team App, the admins can link to it, and
   players can subscribe to it on their phones next to the Team App calendar.
3. Personal stats are already "the portal": every player has an automatic profile page.
4. Revisit only if Team App publishes an API, or if the club wants to pay for a hosted members' area.

**Open question for you:** does your Team App admin dashboard show any "export", "API" or "integrations"
menu? If it does, a screenshot would settle whether more automation is possible.

## #25 Team shop (several suppliers, one checkout)

The colleague's idea: one storefront that takes orders and payment, stores them in a database, and
automatically forwards each item to the right supplier.

**Reality check**

- Payment and orders need a server or a hosted shop; GitHub Pages can only link out to one.
- Automatic forwarding only works for suppliers with an ordering API (print-on-demand services do; most
  team-wear and hockey-jersey suppliers take orders by email or their own web form). For those, someone
  still places the order by hand, so "fully automatic" isn't realistic.
- Selling to the public in Austria brings legal duties: full trader details in the Impressum, terms,
  withdrawal rights (Widerrufsbelehrung), invoices and possibly VAT. Running it in a private person's name
  (the Impressum is currently Christopher Bright) is worth clearing with the club first.

**Recommendation, in stages**

1. **Team order windows** (members only, simplest): twice a season, an order form with sizes and a
   payment link (e.g. a SumUp/Stripe payment link or bank transfer). At the deadline, one export, grouped
   per supplier, and one order per supplier. Low cost, no stock, no public sales duties.
2. **Fan merch** (public): a print-on-demand shop (e.g. Spreadshirt or Shopify + a print-on-demand app)
   with the official logo. They handle payment, printing, shipping and returns automatically; the website
   just links to it from the "Mitspielen"/"Über uns" page.
3. **One checkout for everything** (the colleague's full idea) only if volume justifies a hosted shop
   (Shopify or WooCommerce) with per-supplier fulfilment. Expect monthly fees and someone who looks after it.

**Note:** the shop mockup HTML files weren't attached to the conversation, so I haven't looked at them.

Sources: [Team App support: adding and removing team calendars](https://support.teamapp.com/en/knowledgebase/5-general-faqs/docs/95-adding-and-removing-team-calendar),
[Stack Team App on the App Store](https://apps.apple.com/us/app/stack-team-app/id625607532),
[Stack Team App reviews (Capterra)](https://www.capterra.com/p/172000/Team-App/reviews/),
[Klubraum: club app comparison](https://klubraum.com/blog/the-17-best-apps-for-your-team-comparison/).
