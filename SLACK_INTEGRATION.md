# MTS Slack Integration

## Purpose

Slack should be the fast alert layer for MTS operations:

- Owner gets urgent visibility.
- Supervisors see field issues quickly.
- Office team sees job movement without opening Zoho all day.
- Workers continue using the field app, not Slack as the main system.

Zoho remains the system of record. Slack is for fast awareness and response.

## Recommended Channels

- `#mts-field-updates`: all job status, sub-job, photo, GPS, material, and transport updates.
- `#mts-urgent`: blockers, rejected assignments, customer issues, and safety issues.
- `#mts-transport`: driver pickup/drop and route changes.
- `#mts-materials`: urgent materials and approval-needed items.

For the first rollout, one channel is enough: `#mts-field-updates`.

Created Slack channel:

- Channel name: `#mts-field-updates`
- Channel ID: `C0BFZLRJ8AX`
- Setup message: https://mendtech.slack.com/archives/C0BFZLRJ8AX/p1783580402579839

## Alert Types Built In

The app now prepares Slack alerts for:

- New job created.
- Sub-job created and worker alerted.
- Worker accepted or rejected a sub-job.
- Worker issue raised.
- Issue resolved.
- Material request.
- Transport request.
- Photo added.
- GPS check-in.
- Temporary worker added.
- Worker access revoked or restored.
- Job status updates.

## Production Architecture

Do not put a raw Slack webhook in the worker browser app.

Best production flow:

1. Worker updates the MTS app.
2. App sends event to MTS backend.
3. Backend validates the worker and job permission.
4. Backend writes the official record to database and Zoho.
5. Backend posts the safe Slack message to the correct channel.

This keeps Slack credentials private and prevents a worker phone from exposing company webhook access.

## Slack Message Shape

Each alert is prepared like this:

```json
{
  "channel": "#mts-field-updates",
  "text": "*MTS Field Alert*\\nType: Worker Issue Raised\\nRef: JOB-1001\\nSite: Palm Villa - Painting and AC service\\nLocation: Palm Jumeirah Villa 22\\nBy: Worker 1",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*MTS Field Alert*\\n..."
      }
    }
  ]
}
```

## Next Real Integration Step

Connect either:

- Slack plugin access in Codex, if you want me to inspect/create real workspace/channel flows.
- A secure backend relay URL, if you want the app to post alerts automatically in production.

## Local Relay Included

I added `relay-server.js` as a no-dependency Node relay.

Run it with the bundled or system Node:

```powershell
node relay-server.js
```

Then use this in the app Slack settings:

```text
http://localhost:8787/api/slack/alerts
```

Without a real Slack webhook, it safely stores alerts in `relay-data/slack-alerts.jsonl`.

With a real Slack webhook, start the relay with `SLACK_WEBHOOK_URL` set on the server. The webhook must stay server-side, never inside the worker app.

The app also stores `channel_id: C0BFZLRJ8AX` in every Slack payload so a production backend can post to the exact channel through Slack API.
