# Choosing the Backend for Real Staff Security

MendTech OS currently has no real access control. All data lives in browser storage on each device, so any staff member can read every price, job, and phone number with browser developer tools, regardless of role. Fixing this requires a server that decides what each user is allowed to receive.

This document compares the three realistic options for Mendonca Technical Services.

---

## What "secure" actually has to mean here

The test is not "can we hide the price in the interface". It is **"can the price ever reach a worker's phone"**. Four requirements follow:

1. **Authorization decided server-side.** The server filters data before sending. A worker's device receives zero quote rows, not blurred ones.
2. **Identity tied to a phone, not a dropdown.** Staff prove who they are with an SMS code. No shared master code, no picking a role from a menu.
3. **Instant revocation.** Owner revokes access and the session dies server-side, not on the next app open.
4. **Server-enforced expiry for outsourced staff.** Checked on every request, so an offline phone with a cached copy still cannot act.

Anything that fails these four is theatre.

---

## Option A — Supabase (recommended)

Hosted Postgres with authentication and Row Level Security built in.

**How the security works.** Every table gets policies written in SQL that run inside the database. A worker's app issues the same query as the owner's app, and the database returns different rows. The `quotes` table policy returns nothing at all for a worker, so prices are never transmitted. This is the single most important property: the rule lives with the data, not in the app, so a modified or hacked frontend cannot bypass it.

**Phone OTP** is built in. It connects to Twilio (or MessageBird) for the actual SMS. UAE `+971` numbers are fully supported.

**Approval gate.** A new signup gets an authenticated account with `approval_status = 'pending'`. Policies check that column, so a pending user sees an empty app until the Owner approves them and assigns a role. Exactly the flow in `SECURITY_AND_ROLES.md`.

**Offline field work.** The app keeps a local cache and a write queue, syncing when signal returns — important for basements, plant rooms, and villa compounds. Critically, the cache only ever holds what that user is authorized to see, so a lost phone leaks only one worker's own jobs.

| | |
|---|---|
| **Cost** | Free tier works but pauses after a week idle — not acceptable for a business app. Pro is $25/month. Plus SMS at roughly 10–20 fils each. Realistic total: **under AED 150/month**. |
| **Build time** | Fastest of the three. Auth, storage, and policies are configuration rather than code. |
| **Frontend changes** | Moderate. Swap the localStorage layer for the Supabase client. The interface, screens, and design stay as they are. |
| **You keep** | GitHub Pages hosting still works — no server to maintain or patch. |
| **Data location** | Choose the region at project creation. Nearest options are Frankfurt, Mumbai, or Singapore. **No UAE region.** |
| **Portability** | Strong. It is standard Postgres — `pg_dump` gives a complete copy that restores onto any Postgres anywhere. Auth users export too. Lowest lock-in of the three. |
| **Photo storage** | Built-in object storage with signed expiring URLs, matching the WorkDrive pattern in the spec. |

**Main drawback:** one more vendor alongside Zoho, and no UAE data region.

---

## Option B — Zoho Catalyst

Zoho's own serverless platform, inside the Zoho One subscription you already pay for.

**Appeal.** One vendor. Zoho is already your system of record, billing already exists, and support is a single relationship. Catalyst provides authentication, a datastore, and serverless functions, and it sits natively alongside CRM, Books, and Projects — so the Zoho sync stops being a webhook queue and becomes direct internal calls.

**Reality check.** Catalyst's authorization model is coarser than Postgres Row Level Security. You write permission checks inside your serverless functions rather than declaring them on the data, so correctness depends on every function being written carefully — a worse position than rules that live with the data. Its offline story for progressive web apps is weaker, and the developer tooling and documentation are noticeably thinner. Expect meaningfully more of my time, and more places for a mistake to hide.

| | |
|---|---|
| **Cost** | Possibly nothing extra depending on your Zoho One plan; some Catalyst services are metered. **Needs checking against your actual subscription.** |
| **Build time** | Slowest. More hand-written authorization code and less mature tooling. |
| **Access needed** | Your Zoho admin credentials to provision. |
| **Data location** | Selectable Zoho data centre; Zoho has a UAE presence, so this is the **strongest option for keeping data regionally close**. |
| **Portability** | Weakest. Proprietary datastore and auth. Migrating away later means rewriting the backend. |
| **Best if** | Keeping everything under one vendor, or regional data residency, matters more to you than build speed. |

---

## Option C — Custom Node backend

Extend the `relay-server.js` already in the repository into a real API.

**Appeal.** Total control. No platform limits, no per-seat pricing, and it builds on code you already own. If you later want something unusual — a custom WhatsApp flow, unusual Zoho logic, hardware integration — nothing is in the way.

**Reality check.** You would own security patching, backups, uptime, certificate renewal, and dependency updates permanently. Authentication written from scratch is where small teams get breached: token handling, refresh rotation, OTP rate limiting, and session revocation are each easy to get subtly wrong. You have no in-house developer, which makes this the highest-risk option even though it is technically the most flexible.

| | |
|---|---|
| **Cost** | Hosting $7–15/month (Render or Railway), managed Postgres $7–20/month, plus SMS. Similar to Supabase but **you supply the labour**. |
| **Build time** | Longest by a wide margin. Every piece is hand-written. |
| **Data location** | Any provider and region you choose, including UAE hosting. Fully flexible. |
| **Portability** | Total — it is your code. |
| **Ongoing burden** | Highest. Someone must maintain it for as long as the business runs. |
| **Best if** | You plan to hire a developer, or need something the platforms genuinely cannot do. |

---

## Recommendation

**Supabase**, for three reasons specific to your situation:

1. **Row Level Security is the right tool for your core problem.** Your central rule — workers must never see prices — becomes a database policy that cannot be bypassed by tampering with the app. In the other two options that rule lives in application code, where a single missed check leaks pricing.
2. **You have no developer.** Supabase removes the entire category of server maintenance, patching, and uptime work. Custom Node hands you a permanent obligation; Catalyst hands you more code to get right.
3. **Low lock-in.** Standard Postgres means changing your mind later is a database dump, not a rewrite. That is the cheapest possible insurance on this decision.

**Choose Zoho Catalyst instead if** regional data residency or single-vendor consolidation is a firm requirement — accept slower delivery and higher lock-in as the price.

**Choose custom Node only if** you intend to hire a developer.

---

## What happens next, whichever you pick

**You do (I cannot and should not — these need your name, your payment details, and your ownership of the credentials):**

1. Create the backend account.
2. Create an SMS provider account (Twilio recommended) and add a small credit.
3. Send me the **public/anon key and project URL only**. The secret or service-role key must never enter the app or the repository — it stays in your account.

**I do:**

1. Database schema from `DATA_MODEL.md`.
2. Row-level security policies for all seven roles, with a written test proving a worker query returns zero priced rows.
3. Replace the profile dropdown with real phone OTP login.
4. Owner approval and role assignment, enforced server-side.
5. Device registration, PIN and biometric unlock via passkeys.
6. Append-only audit log and instant session revocation.
7. Offline queue and reconciliation.
8. A migration that moves your existing local data into the database so nothing is lost.

**Order of work.** Phase 1 database, policies, and login. Phase 2 device registration and biometrics. Phase 3 audit log and revocation. Phase 4 offline hardening. The app stays locked to you and fully usable throughout, and staff return only when phase 1 is tested.

**Before staff return,** work through `PRODUCTION_CHECKLIST.md` — particularly the permission test for every role, the backup and restore test, and five controlled real jobs.
