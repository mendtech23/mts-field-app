# MTS AI Organisation — Build Plan

Owner: Johnny (Mendonca Technical Services LLC, Dubai)
Status: approved direction, Phase 0 complete
Last updated: 31 July 2026

Zoho One stays the system of record. This document defines the agent layer that
operates on top of it, and the order in which it gets built.

---

## 1. Principle: employees are records, not users

Zoho One is licensed per **user who logs in**, not per **record stored**. MTS
holds one licence (`info@mendtechservices.com`) and has zero employees in Zoho
today.

Therefore:

- Employee records live in a **Zoho Books custom module** (`Employees`).
- Employee documents live in **WorkDrive** — passports, visas, Emirates ID,
  contracts, certificates.
- Staff **never receive a Zoho login**. They use the MTS Field App only, which
  authenticates against the project's own backend.
- The HR Agent operates on those records under the owner's single licence.

Zoho People is not required at any point.

**Open commercial question:** Zoho One's terms require licensing all employees
who *use* Zoho applications. Field staff using a first-party app are read here
as out of scope, but this must be confirmed **in writing** with the Zoho account
manager before Phase 2 goes live.

**Data residency:** HR records stay in Zoho rather than an offshore database, so
UAE PDPL cross-border transfer questions do not arise for passport, Emirates ID
or salary data. Operational field data (jobs, evidence, readings) may sit
offshore; personal HR data should not.

---

## 2. Approval model: policies, not instances

The owner approves **rules once**, not every action. Each action records the
policy that authorised it, so any decision is auditable back to a rule the owner
personally approved, and any rule can be revoked immediately.

| Tier | Meaning | Examples |
|---|---|---|
| **Green — automatic** | No money, no external commitment | Evidence validation, Delta-T verdicts, document expiry alerts, CV screening, attendance, internal reports |
| **Amber — policy** | Money or commitment inside an owner-set rule | Small quotes, standard follow-ups, POs under a cap, interview scheduling, leave within balance |
| **Red — owner only** | Money, people, or legal exposure | Prices outside band, discounts, offers, payroll, final completion, refunds, anything touching active legal matters |

Amber starts **empty**. Rules are promoted one at a time after the relevant
agent has been observed behaving correctly.

---

## 3. Agent organisation

Agents communicate through a **shared event bus**, not free-form conversation.
Every message is a typed, logged, replayable event. This is what makes agent
behaviour debuggable and keeps model cost bounded.

```
                      ┌──────────── EVENT BUS ────────────┐
                      │  id, type, actor, entity_id,      │
                      │  payload, timestamp               │
                      └───────────────┬───────────────────┘
   ┌──────────┬──────────┬────────────┼────────┬──────────┬──────────┐
 Sales    Marketing  Operations   Dispatch  Technical    QA      Complaints
   │          │          │            │        │         │           │
   └──────────┴──────────┴─── Procurement ── Finance ── HR ─────────┘
                                  │
                          ┌───────▼────────┐
                          │   CEO Agent    │  digests + exceptions
                          └───────┬────────┘
                          ┌───────▼────────┐
                          │ APPROVAL GATE  │  green │ amber │ red
                          └───────┬────────┘
                          ┌───────▼────────┐
                          │   AUDIT LOG    │  append-only
                          └────────────────┘
```

**Model routing (cost control).** A small fast model handles classification,
routing, extraction and validation — roughly 90% of calls. A larger model is
used only for drafting quotes, offers, customer-facing messages and the CEO
digest.

### Approval state machine

Applies to every approvable object — quote, dispatch, completion, purchase,
offer, payroll run:

```
DRAFTED ──agent proposes──▶ PENDING_OWNER
PENDING_OWNER ──owner approves──▶ APPROVED ──executed──▶ EXECUTED
PENDING_OWNER ──owner rejects───▶ REJECTED (reason mandatory)
PENDING_OWNER ──24h no action───▶ ESCALATED (re-notify; never auto-approves)
APPROVED ──sync fails 5x────────▶ SYNC_FAILED (owner-visible, blocks invoicing)
```

Invariants:

1. Every transition writes exactly one append-only audit row with actor and
   before/after state.
2. No path reaches `EXECUTED` without an owner actor on the approving row,
   unless an Amber policy authorised it — in which case the policy ID is
   recorded on that row.
3. Timeouts escalate. They never approve.
4. Agents may only perform `DRAFTED → PENDING_OWNER`. This boundary is enforced
   in the database, not in application code, so a compromised or misled agent
   degrades to noise rather than unauthorised spending.

---

## 4. HR Agent scope

| Function | Behaviour | Authority |
|---|---|---|
| Hiring | Drafts JD, posts, screens CVs against scorecard, ranks, drafts interview questions | Green |
| Interview scheduling | Reads calendar, proposes slots, sends invites | Green (within working hours) |
| Offer | Drafts offer letter from template and approved salary band | **Red** |
| Onboarding | Creates employee record, document checklist, WorkDrive folder, Field App invite | Green (after hire approved) |
| Document expiry | Watches visa / Emirates ID / labour card / insurance / trade licence; escalates at 90/60/30/7 days | Green (alerts only) |
| Attendance | Derived from Field App check-in/out events | Green |
| Leave | Checks balance and job-coverage conflicts, recommends | **Red** |
| Payroll preparation | Assembles hours, overtime, deductions into a payable sheet | **Red, always** |
| Performance | Completion rates, QA rejections, rework, customer ratings | Green (reports only) |
| Offboarding | Final settlement, asset return, access revocation across systems | **Red** |

---

## 5. System of record map

| Data | System |
|---|---|
| Leads, customers, properties | Zoho CRM |
| Quotes, invoices, VAT, payments, items | Zoho Books |
| Projects, tasks, timesheets | Zoho Projects |
| Complaints / tickets | Zoho Desk |
| All documents, photos, HR files | Zoho WorkDrive |
| **Employee records** | **Zoho Books custom module** |
| Field jobs, check-ins, evidence, AC readings | App backend |
| Event bus, agent state, policies, audit log | App backend |

---

## 6. Phases

### Phase 0 — Trust repairs — **COMPLETE**

Four defects that made every downstream claim unreliable:

1. **Sync no longer reports false success.** `mode: "no-cors"` returned an
   opaque response that resolved even on HTTP 500 or a dead endpoint, and the
   queue marked those events `Synced`. Sync now uses a readable CORS response
   and only records `Synced` on a confirmed 2xx.
2. **Relay authenticated.** It refuses to start without `RELAY_TOKEN`, requires
   a bearer token on every endpoint including `/health`, restricts CORS to an
   explicit origin list, and de-duplicates events by idempotency key across
   restarts. A failed forward returns 502 and stays retryable.
3. **Device wipe scoped.** `localStorage.clear()` erased the whole origin,
   destroying Finance OS and Auto Concierge data. Now removes only this app's
   key and caches.
4. **Zoho status honest.** Service pills previously turned green when the
   settings field was merely non-empty. They now require a verified relay
   handshake via **Test Connection**, and go stale after 15 minutes.

Also added: `tests/relay.test.js` — 8 contract tests, the first in the repo.

### Phase 1 — Backend and real authentication (weeks 2–4)

Real staff auth (owner-issued invite code + PIN, no SMS cost), event bus tables,
append-only audit log, policy table, row-level authorization tests. Exit
criterion: `OWNER_ONLY_MODE = false` with genuine server-side authorization
behind it, so staff can use the app at all.

### Phase 2 — HR Agent (weeks 5–7)

`Employees` custom module in Books, WorkDrive folder structure, document expiry
watcher, onboarding flow, attendance derived from field events. Blocked on the
Zoho licensing answer.

### Phase 3 — Bus and first agents (weeks 8–10)

Technical, QA, Commercial, CEO digest. All Green tier. Two weeks of observation
with no approvals granted.

### Phase 4 — Policies and remaining agents (weeks 11–13)

First Amber rules promoted. Operations, Dispatch, Procurement, Finance, Sales,
Marketing, Complaints added as the bus proves stable.

---

## 7. Launch criteria

All must hold before real customer work runs through the system:

- No company data readable without a server-issued session.
- 30 consecutive days with no `SYNC_FAILED` older than one hour unresolved.
- Restore drill performed: delete a job, restore from backup, audit trail intact.
- Every `EXECUTED` money action traceable to an owner approval row or a named
  Amber policy.
- One full job lifecycle completed by a technician not trained by the owner.

---

## 8. Open decisions

1. Zoho licensing confirmation in writing (blocks Phase 2 go-live).
2. Headcount over the next 90 days; employees vs subcontractors.
3. Salary bands per role (blocks offer drafting).
4. First three Amber policies.
5. Approval to create the `Employees` custom module in the live Books org.
