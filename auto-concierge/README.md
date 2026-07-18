# MTS Auto Concierge (Phase 1 prototype)

> "Your car problem solved. We find, compare, negotiate and manage."

A mobile-first prototype of the MTS automotive marketplace. MTS is the trusted
middleman between **Customers ↔ Garages ↔ Parts Suppliers ↔ Recovery**. Phase 1
does not need MTS to own a garage — the value is the network and the coordination.

Open `index.html` in a browser (or run the `auto-concierge` preview server). All
data lives in the browser via `localStorage`, so it works as a realistic clickable
MVP with no backend.

The app opens on a **Welcome screen** with three purpose-built entry points so a demo
looks right for whoever is watching:

- **Customer App** — for car owners (clients)
- **Vendor Portal** — for garages, parts suppliers and recovery companies
- **MTS Concierge Desk** — the internal hub

Inside, the header shows **⇄ Portals** (back to the welcome screen) and a **Signed in as**
switcher to jump between any demo identity — all sharing one backend state.

## One platform, four connected portals

| Portal | Who | What they do |
| --- | --- | --- |
| **Customer App** | Ramesh, Fatima | Register vehicles, request repair/service/inspection/used-parts, report emergency breakdown & towing, compare MTS-negotiated options, approve, chat, pay invoices. |
| **MTS Admin** | Johnson (Concierge) | The hub. Review requests, dispatch quote requests to garages, broadcast parts requests to suppliers, build 2–3 transparent options, send to customer, drive the workshop pipeline, dispatch recovery, invoice, close. |
| **Garage Portal** | Al Quoz Star, Deira Auto, Rashidiya German | See quote requests matched to them, send price/time/warranty, then run their assigned jobs through the workshop stages. |
| **Parts Supplier Portal** | Gulf Genuine Parts, Sharjah Used Parts Yard | See broadcast part requests, offer Genuine New / Aftermarket / Used OEM with price, availability and warranty. |
| **Recovery** | Falcon Recovery | Receive tow/breakdown jobs and update status: Assigned → En Route → Collected → Delivered. |

## The concierge flow (what makes MTS the middleman)

1. **Customer** submits a problem (vehicle, category, description, photos, location).
2. **MTS** reviews, dispatches quote requests to relevant **garages**, and broadcasts
   the part to **suppliers**.
3. Garages return labour quotes; suppliers return part offers.
4. **MTS builds 2–3 transparent options** — e.g. Genuine New / Aftermarket / Used OEM
   — each with cost, time and warranty, one marked ⭐ Recommended.
5. **Customer compares and approves** one option (transparency, not just cheapest).
6. Job flows to the assigned **garage** and moves through workshop stages.
7. **MTS** generates the invoice (approved price + concierge fee), collects payment,
   and closes the job.
8. **Emergency / Towing** requests skip straight to **recovery dispatch**.

## Customer home actions

Request Repair · Request Service · Vehicle Inspection · Find Used Parts ·
Emergency Breakdown · Towing · Compare Quotes · My Vehicles · My Invoices · Chat with MTS.

## What's in the complete build

- **Welcome / portal landing** — client, vendor and MTS entry points (above).
- **Printable documents** — professional **Quotation**, **Invoice** and **Inspection
  Report** open in a clean document view with a **Print / Save PDF** button. These are
  the real deliverables MTS hands to customers.
- **Ratings & reviews** — after a job closes, the customer rates the garage (1–5 stars
  + comment). Ratings roll up into each partner's profile.
- **Partner performance** — the Partners tab shows every garage's average rating, jobs
  completed and quotes given; suppliers show offers made; recovery shows tow jobs.
- **Inspection reports** — a 10-point checklist (Engine, Brakes, Tyres, AC, Body…) each
  marked Pass / Attention / Fail with notes, plus summary and recommendation. Completed
  by MTS on the job, shown to the customer, and printable.
- **Notification badges** — each portal's tabs show live counts of things needing action
  (options to approve, unpaid invoices, new quote requests, parts to quote, tow jobs).
- **Vehicle service history** — every vehicle card lists its full job history.
- **Search + filters** on the MTS jobs pipeline; live **collected-revenue** stat.
- **Reset demo data** — button on the Admin dashboard restores the seed scenario for a
  fresh demo run.

## Prototype notes

- **Photos/videos**: only file names are stored in this prototype (no upload backend yet).
- **GPS**: the request wizard can capture the browser location for the job address.
- **WhatsApp**: every job has ready-to-send WhatsApp update links (customer, recovery).
- **Activity feed** (Admin): a running log of every marketplace event — this is exactly
  the event stream a backend would relay to Slack/Zoho in the next phase.
- **Reset demo data**: button on the Admin dashboard restores the seed scenario.

## Next phase (production route)

1. Real backend + auth so each portal is a separate secure login (not a demo switcher).
2. Photo/video upload to storage (WorkDrive / S3) linked to the job.
3. Zoho as system of record: Jobs, Quotes, Parts Offers, Invoices (Books), Partners (CRM).
4. WhatsApp Business API for automated customer + partner notifications.
5. Payments and partner settlement.
