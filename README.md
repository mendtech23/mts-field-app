# MTS Field Ops Prototype

This is a mobile-first prototype for Mendonca Technical Services field operations.

Open `index.html` in a browser to try it. It stores data in the browser using `localStorage`, so it works as a realistic clickable MVP without a backend.

## Live Links

- Field app (PWA, phone-installable): https://mendtech23.github.io/mts-field-app/
- Marketing website: https://mendtech23.github.io/mts-field-app/website/ (see `website/README.md` for the custom-domain and Zoho lead-form steps)

Both deploy automatically from the `main` branch via GitHub Pages.

## What It Covers

- Owner, 1 admin, 1 HR, and 2 supervisor access profiles.
- Worker and driver profiles.
- Scalable workforce model for employees and outsourced temporary workers.
- Owner-only approval workflow: any new team member (worker, driver, supervisor, admin, HR — permanent or temporary) added by a non-owner stays locked until the Owner approves them in the Team tab.
- Slack and Zoho tabs restricted to supervisory level and above (Owner, Admin, HR, Supervisors).
- Backend sync endpoint for Zoho: the relay stores every event and forwards to a Zoho Flow webhook when configured.
- Job board with service, location, priority, status, supervisor, driver, and workers.
- Sub-jobs under each main job, so large villa/office jobs can be split by trade or room.
- Assignment alerts with worker acceptance or rejection confirmation.
- Worker-to-supervisor issue messages for site problems, materials, safety, customer notes, and transport.
- Before, progress, after, and material photo uploads.
- Worker time start/stop logs.
- Material requests.
- Transport requests for drivers and vehicles.
- GPS check-in using browser location permission.
- WhatsApp-ready job update message.
- WhatsApp team contact panel for supervisor, driver, and assigned workers.
- WhatsApp assignment messages for each sub-job worker.
- Slack-ready alert feed for assignments, accept/reject, issues, materials, photos, GPS, transport, and temp access.
- Zoho sync queue and JSON export.
- Temporary worker access creation, expiry date, and revoke/restore controls.

## Important Location Note

The prototype supports GPS check-ins. True live location tracking is possible, but it should be implemented carefully:

- Workers must explicitly allow location permission.
- A normal browser can capture check-ins, but background tracking is limited.
- Reliable continuous tracking usually needs a mobile app wrapper, Android/iOS app, or a worker-side WhatsApp live location process.
- The app should show workers when tracking is active for trust and legal compliance.

## Zoho Integration Plan

Recommended Zoho structure:

- `Jobs` custom module or Zoho Projects project/task.
- `Sub Jobs` child module linked to Jobs.
- `Assignment Confirmations` child module for pending, accepted, and rejected worker responses.
- `Issues` child module for worker-to-supervisor communication and resolution tracking.
- `Job Updates` custom module linked to Jobs.
- `Job Photos` as CRM attachments or WorkDrive files linked back to the job.
- `Time Logs` custom module linked to worker and job.
- `Material Requests` custom module, with approval status.
- `Transport Trips` custom module linked to driver, workers, and job.
- `Workers`, `Drivers`, and `Temporary Workers` as CRM custom modules or Zoho People records with access status.

## Slack Integration

The app includes a Slack tab that prepares channel alerts for important work events.

For production, send these alerts through a secure backend relay. Do not store a raw Slack webhook inside the worker browser app.

See `SLACK_INTEGRATION.md`.

Current Slack destination:

- `#mts-field-updates`
- Channel ID: `C0BFZLRJ8AX`

## PWA Install

The app now includes a web manifest and service worker. On supported phones/browsers, workers can install it to the home screen and keep using the core screens even if the network drops briefly.

## Local Slack Relay

`relay-server.js` is included as a safe backend starting point.

Run it, then set the app Slack relay URL to:

```text
http://localhost:8787/api/slack/alerts
```

The sync queue in the app is the exact set of events that a backend should send to Zoho through API calls or Zoho Flow.

## Best Production Route

For MTS, the strongest version is:

1. Field app as a PWA/mobile app for workers and drivers.
2. Owner/supervisor dashboard for all jobs, sub-jobs, confirmations, photos, materials, transport, and GPS check-ins.
3. Backend API that validates users and pushes events into Zoho.
4. WhatsApp notifications for job assignment, customer-ready updates, and urgent material/transport requests.
5. Zoho CRM/Books/Projects remains the business system of record.
