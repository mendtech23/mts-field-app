# MTS Field Ops Production Plan

## Goal

Give MTS one operational tool for site transparency when the owner is not present:

- Job assignment and status.
- Sub-job assignment under bigger jobs.
- Worker acceptance confirmation for assigned work.
- Worker hours.
- Before, progress, and after photos.
- Worker-to-supervisor communication during work.
- Slack alerts for owner, supervisors, office, material, and transport visibility.
- Material requests.
- Transport and driver movement.
- Worker, driver, and outsourced temporary worker information.
- Revoke temporary access when outsource work is finished.
- Owner and supervisor visibility.
- Zoho updates as the business system of record.

## Roles

- Owner: full access to all jobs, workers, drivers, costs, materials, time, photos, transport, and Zoho sync.
- Admin: office-level access for job coordination, data entry, and reports.
- HR: workforce access for employee/temp worker records, expiry dates, and access revoke/restore.
- 2 Supervisors: access to assigned jobs, assigned teams, site updates, approvals, and reports.
- Workers: only assigned jobs/sub-jobs, acceptance confirmation, check-in/out, photos, progress notes, material requests, supervisor issue messages, and GPS check-ins.
- Driver: assigned trips, pickup/drop, worker list, job locations, route notes, and trip check-ins.
- Temporary outsourced workers: limited worker access with expiry date and manual revoke/restore.

## Core Screens

- Today Board: all active jobs with status, priority, supervisor, driver, and assigned workers.
- Job Detail: scope, customer/site, sub-jobs, assignment confirmations, issues, photos, notes, materials, transport, time logs, and GPS.
- Team View: worker/driver/temp profiles, phone numbers, skills, access status, assigned jobs, last check-in.
- Owner Dashboard: urgent blockers, pending acceptances, pending material approvals, late jobs, unsubmitted photos, temporary access, pending Zoho sync.
- Zoho Sync Queue: every app event prepared for Zoho.
- Slack Alerts: every operational event prepared for the right Slack channel.

## Zoho Data Model

Recommended modules:

- Jobs
  - Customer
  - Service Type
  - Site Location
  - Status
  - Priority
  - Supervisor
  - Driver
  - Linked Quote/Invoice
- Job Updates
  - Job lookup
  - Update type
  - Worker/supervisor
  - Notes
  - Timestamp
- Sub Jobs
  - Parent Job lookup
  - Title
  - Trade
  - Supervisor
  - Assigned workers
  - Status
  - Due time/date
  - Instructions
- Assignment Confirmations
  - Parent Job lookup
  - Sub Job lookup
  - Worker
  - Confirmation status: Pending, Accepted, Rejected
  - Timestamp
- Issues
  - Parent Job lookup
  - Raised by
  - Issue type
  - Message
  - Status: Open, Resolved
  - Resolved by
  - Resolution timestamp
- Job Photos
  - Job lookup
  - Photo type: Before, Progress, After, Material
  - Caption
  - Uploaded by
  - Attachment or WorkDrive link
- Time Logs
  - Job lookup
  - Worker
  - Start time
  - End time
  - Total hours
- Material Requests
  - Job lookup
  - Item
  - Quantity
  - Urgency
  - Approval status
  - Purchased from
  - Cost
- Transport Trips
  - Job lookup
  - Driver
  - Vehicle
  - Pickup
  - Drop
  - Workers carried
  - Trip time
  - GPS check-in
- Workers
  - Name
  - Phone
  - Skills
  - Documents
  - Active/inactive
- Temporary Workers
  - Name
  - Phone
  - Skill
  - Supplier/source
  - Access status
  - Access expiry date
  - Created by
  - Revoked by
- Drivers
  - Name
  - Phone
  - Vehicle
  - License/document fields

## WhatsApp Approach

Use WhatsApp for alerts and simple adoption, but do not make WhatsApp the main database.

Best use cases:

- Send worker job assignment message.
- Give supervisors one-tap WhatsApp assignment messages for every sub-job worker.
- Give workers one-tap WhatsApp access to their supervisor during the job.
- Ask worker to accept or reject the assigned sub-job.
- Send driver pickup/drop plan.
- Share owner-ready daily update.
- Notify supervisor for urgent material request.
- Notify supervisor when a worker raises an issue.
- Send Slack alerts for job events, worker issues, materials, transport, photos, GPS check-ins, and temporary access changes.
- Send customer-friendly progress update when approved.

The app should still store all official records and push them into Zoho.

## Live Location Options

Option 1: GPS check-ins

- Workers tap `GPS Check-In` when they arrive, leave, or hit key job stages.
- Works in browser/PWA.
- Lowest privacy and battery risk.
- Best first version.

Option 2: periodic tracking while on duty

- App requests location every few minutes during active job hours.
- Better transparency.
- Needs clear worker consent and phone permission.
- Browser background tracking is limited.

Option 3: native mobile app tracking

- Android/iOS app or wrapped PWA.
- Most reliable for live location.
- Highest build cost.
- Best after the field workflow is proven.

Recommended start: GPS check-ins plus driver trip check-ins. Add continuous live tracking only after workers are trained and the policy is clear.

## Build Phases

Phase 1: MVP

- Mobile PWA.
- Owner/supervisor/worker/driver login.
- Jobs, photos, time logs, materials, transport, GPS check-ins.
- Sub-jobs, worker acceptance confirmation, issue messages, and temporary worker access.
- Zoho sync queue.
- WhatsApp share messages.

Phase 2: Zoho Integration

- Create Zoho custom modules.
- Connect app backend to Zoho API.
- Push job updates, photos, time logs, materials, and transport.
- Push sub-jobs, acceptances, issues, and temporary access changes.
- Pull customer/job/invoice references from Zoho.

Phase 3: Automation

- WhatsApp templates for assignments and urgent requests.
- Owner dashboard reports.
- Daily job summary.
- Late job and no-photo alerts.

Phase 4: Mobile Hardening

- Proper Android/iOS install.
- Camera compression.
- Offline sync retry.
- Continuous location if approved.
- Supervisor approval workflow.

## Production Tech Recommendation

- Frontend: PWA for workers and supervisors.
- Backend: small API service for auth, file upload, permissions, and Zoho sync.
- Storage: cloud database for app state and offline retry.
- Files: Zoho WorkDrive or cloud object storage with links pushed into Zoho.
- Zoho: CRM custom modules plus Books/Invoices integration.
- WhatsApp: approved WhatsApp Business API provider or Zoho-compatible WhatsApp integration.
