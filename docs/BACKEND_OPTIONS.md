# Choosing the Backend for Real Staff Security

> **Decision (July 2026): build on the free path.** Johnson asked for zero running cost.
> The plan below is achievable on Supabase's free tier at **AED 0/month**, with one design
> change: **no SMS**. See "The free path" immediately below — it supersedes the cost figures
> quoted later in this document.

---

## The free path — AED 0/month

### The fact that decides it

**Phone/SMS login is not free anywhere.** Firebase moved SMS verification behind its paid Blaze
plan in September 2024. Supabase has no SMS of its own — you must attach a paid Twilio or
MessageBird account. There is no free tier for A2P SMS to UAE numbers from any serious provider.

So the free plan drops SMS entirely. Nothing else needs to change, because the replacement is
better suited to how Mendonca already works.

### Owner-issued codes over WhatsApp

This is Johnson's own idea, and it removes the only paid component:

1. Owner adds a person in Team and picks their role, skill, and expiry.
2. The server generates a **single-use invite code** (e.g. `MTS-7K2M-9QX4`) bound to that person
   and role.
3. Owner sends it by **WhatsApp** — free, one tap, and already built into the app.
4. Staff enter the code once and choose a PIN.
5. The server validates the code, creates the account with the **pre-assigned role**, and marks
   the code used. It cannot be redeemed twice.
6. Afterwards they sign in with their PIN on that registered device.

WhatsApp is the out-of-band channel that SMS would otherwise provide, and Johnson already uses it
with every worker daily. The code proves the owner invited them; the PIN proves they are the one
holding the phone; the **server** is what makes both stick.

Security is unchanged from the paid design, because the protection was never coming from SMS — it
comes from the server deciding what each person receives.

### Why Supabase free, not Firebase free

Firebase's free tier never pauses, which is genuinely nicer. But the deciding factor is the core
rule: **workers must never receive prices.**

Postgres can hide a single column from a role. Firestore cannot hide a field inside a document —
you would have to split quotes into two parallel collections and secure them separately, which is
more moving parts and more ways to leak a price. The rule belongs in one place.

Supabase also keeps the SQL schema in `DATA_MODEL.md` intact and stays portable via `pg_dump`.

### The free-tier limits, and whether they bite

| Limit (free plan) | Allowance | Realistic for Mendonca? |
|---|---|---|
| Database storage | 500 MB | Yes, comfortably. Jobs, quotes, readings and audit rows are text — thousands of jobs is a few MB. |
| File storage | 1 GB | **Only if photos go elsewhere** — see below. |
| Monthly active users | 50,000 | Yes. The team is around ten people. |
| Outbound bandwidth | 5 GB/month | Yes, once photos are not served from here. |
| Active projects | 2 | Yes, one is needed. |
| **Auto-pause** | After 7 days with no database request | **Solvable, free** — see below. |

**Photos → Zoho WorkDrive.** Field photos would exhaust 1 GB in a few months. They should go to
WorkDrive, which is already included in the Zoho One subscription and is already the designated
master for photos in `ZOHO_INTEGRATION.md`. Supabase then holds only structured records and stays
inside the free tier indefinitely. This is the architecture the spec already called for.

**The 7-day pause.** A free project pauses if it receives no database request for seven
consecutive days, and must be manually unpaused from the dashboard. Daily field use means it would
never trigger — but it should not depend on that. A scheduled GitHub Actions workflow pinging the
database once a day prevents it permanently, and GitHub Actions is free and unlimited on public
repositories, which `mendtech23/mts-field-app` already is.

### What it costs

| Item | Cost |
|---|---|
| Supabase free plan | AED 0 |
| GitHub Pages hosting | AED 0 (already in use) |
| GitHub Actions keep-alive | AED 0 |
| WhatsApp code delivery | AED 0 (manual, already in use) |
| Photo storage in Zoho WorkDrive | AED 0 extra (already subscribed) |
| **Total** | **AED 0/month** |

### What is given up versus the paid plan

- **No SMS login.** Enrolment depends on the owner sending a code by WhatsApp. This is manual, and
  fine at ten staff; it would become tedious at fifty.
- **No automatic phone-number verification.** The owner vouching for the number replaces it.
- **Smaller performance headroom.** Free-tier compute is shared. Irrelevant at this size.
- **Upgrade path stays open.** If the business grows, $25/month adds SMS-capable infrastructure,
  daily backups, and more storage without rebuilding anything.

### Also worth checking: Zoho Catalyst

Johnson already pays for Zoho One, so if Catalyst is included in his plan it is "free" in the sense
of already-purchased. It is worth a look at the subscription. The reservations in the Catalyst
section below still stand — weaker authorization model, slower to build, highest lock-in — so
Supabase free remains the recommendation unless regional data residency becomes a firm requirement.

---


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

**You do (I cannot and should not — these need your name and your ownership of the credentials):**

1. Create a free Supabase account at supabase.com — sign in with GitHub, no card required.
2. Create one project. Choose the region nearest the UAE (Frankfurt or Mumbai) and save the
   database password it generates somewhere safe.
3. From Project Settings → API, send me the **Project URL** and the **anon/public key** only.
   The `service_role` key must never enter the app or the repository — it stays in your account.

No SMS provider and no payment method are needed on the free path.

**I do:**

1. Database schema from `DATA_MODEL.md`.
2. Row-level security policies for all seven roles, with a written test proving a worker query
   returns zero priced rows.
3. Replace the profile dropdown with invite-code enrolment and PIN login.
4. Code generation, WhatsApp send, single-use redemption, and revocation — all server-validated.
5. Owner approval and role assignment, enforced server-side.
6. Device registration and biometric unlock via passkeys.
7. Append-only audit log and instant session revocation.
8. Photo upload routed to Zoho WorkDrive rather than Supabase storage.
9. GitHub Actions keep-alive so the free project never pauses.
10. Offline queue and reconciliation.
11. A migration that moves your existing local data into the database so nothing is lost.

**Order of work.** Phase 1 database, policies, and login. Phase 2 device registration and biometrics. Phase 3 audit log and revocation. Phase 4 offline hardening. The app stays locked to you and fully usable throughout, and staff return only when phase 1 is tested.

**Before staff return,** work through `PRODUCTION_CHECKLIST.md` — particularly the permission test for every role, the backup and restore test, and five controlled real jobs.
