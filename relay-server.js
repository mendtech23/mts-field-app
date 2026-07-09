const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const ZOHO_FLOW_WEBHOOK_URL = process.env.ZOHO_FLOW_WEBHOOK_URL || "";
const DATA_DIR = path.join(__dirname, "relay-data");
const ALERT_LOG = path.join(DATA_DIR, "slack-alerts.jsonl");
const SYNC_LOG = path.join(DATA_DIR, "zoho-sync.jsonl");

fs.mkdirSync(DATA_DIR, { recursive: true });

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function forwardToSlack(payload) {
  if (!SLACK_WEBHOOK_URL) return { forwarded: false, reason: "SLACK_WEBHOOK_URL not set" };
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Slack returned ${response.status}`);
  return { forwarded: true };
}

async function forwardToZoho(record) {
  if (!ZOHO_FLOW_WEBHOOK_URL) return { forwarded: false, reason: "ZOHO_FLOW_WEBHOOK_URL not set; event stored locally" };
  const response = await fetch(ZOHO_FLOW_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error(`Zoho Flow returned ${response.status}`);
  return { forwarded: true };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "mts-relay",
      slackConfigured: Boolean(SLACK_WEBHOOK_URL),
      zohoConfigured: Boolean(ZOHO_FLOW_WEBHOOK_URL)
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/slack/alerts") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const alertPayload = body.alert?.payload || body.payload;
      if (!alertPayload?.text) {
        sendJson(res, 400, { ok: false, error: "Missing Slack alert payload text" });
        return;
      }
      const stored = {
        receivedAt: new Date().toISOString(),
        source: body.source || "mts-field-ops",
        sentBy: body.sentBy || "unknown",
        alert: body.alert || null
      };
      fs.appendFileSync(ALERT_LOG, `${JSON.stringify(stored)}\n`);
      const slack = await forwardToSlack(alertPayload);
      sendJson(res, 200, { ok: true, stored: true, slack });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/zoho/sync") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const event = body.event;
      if (!event || !event.type) {
        sendJson(res, 400, { ok: false, error: "Missing sync event" });
        return;
      }
      const stored = {
        receivedAt: new Date().toISOString(),
        source: body.source || "mts-field-ops",
        sentBy: body.sentBy || "unknown",
        event
      };
      fs.appendFileSync(SYNC_LOG, `${JSON.stringify(stored)}\n`);
      const zoho = await forwardToZoho(stored);
      sendJson(res, 200, { ok: true, stored: true, zoho });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`MTS relay server listening on http://localhost:${PORT}`);
  console.log("Slack endpoint: POST /api/slack/alerts");
});
