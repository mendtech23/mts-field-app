const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const ZOHO_FLOW_WEBHOOK_URL = process.env.ZOHO_FLOW_WEBHOOK_URL || "";

// Shared secret the Field App must present. Without it the relay refuses to
// start: an open relay forwards anything it is given straight into the company
// Slack channel, which is a ready-made phishing channel.
const RELAY_TOKEN = process.env.RELAY_TOKEN || "";

// Browser origins allowed to call this relay. Comma-separated; no wildcard.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5178")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const DATA_DIR = path.join(__dirname, "relay-data");
const ALERT_LOG = path.join(DATA_DIR, "slack-alerts.jsonl");
const SYNC_LOG = path.join(DATA_DIR, "zoho-sync.jsonl");

if (!RELAY_TOKEN) {
  console.error("RELAY_TOKEN is not set. Refusing to start an unauthenticated relay.");
  console.error("Generate one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

// Event IDs already accepted, so a retried delivery is stored and forwarded
// once. Rebuilt from the log on boot so a restart cannot reintroduce duplicates.
const seenEventIds = new Set();

function loadSeenEventIds() {
  if (!fs.existsSync(SYNC_LOG)) return;
  const lines = fs.readFileSync(SYNC_LOG, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const key = JSON.parse(line).idempotencyKey;
      if (key) seenEventIds.add(key);
    } catch {
      // A truncated trailing line should not stop the relay from starting.
    }
  }
}
loadSeenEventIds();

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Idempotency-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin"
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function sendJson(res, statusCode, body, req) {
  res.writeHead(statusCode, corsHeaders(req || { headers: {} }));
  res.end(JSON.stringify(body));
}

// Constant-time compare so a wrong token cannot be discovered byte by byte.
function tokenValid(req) {
  const header = req.headers.authorization || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(RELAY_TOKEN);
  const actual = Buffer.from(presented);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
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
    sendJson(res, 204, {}, req);
    return;
  }

  // Every endpoint requires the shared secret, including /health — an
  // unauthenticated probe would otherwise confirm the relay's existence and
  // leak which integrations are configured.
  if (!tokenValid(req)) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" }, req);
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "mts-relay",
      slackConfigured: Boolean(SLACK_WEBHOOK_URL),
      zohoConfigured: Boolean(ZOHO_FLOW_WEBHOOK_URL)
    }, req);
    return;
  }

  if (req.method === "POST" && req.url === "/api/slack/alerts") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const alertPayload = body.alert?.payload || body.payload;
      if (!alertPayload?.text) {
        sendJson(res, 400, { ok: false, error: "Missing Slack alert payload text" }, req);
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
      sendJson(res, 200, { ok: true, stored: true, slack }, req);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message }, req);
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/zoho/sync") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const event = body.event;
      if (!event || !event.type) {
        sendJson(res, 400, { ok: false, error: "Missing sync event" }, req);
        return;
      }

      // A retry must not create a second Zoho record.
      const idempotencyKey = req.headers["idempotency-key"] || event.id || null;
      if (idempotencyKey && seenEventIds.has(idempotencyKey)) {
        sendJson(res, 200, { ok: true, stored: true, duplicate: true }, req);
        return;
      }

      const stored = {
        receivedAt: new Date().toISOString(),
        source: body.source || "mts-field-ops",
        sentBy: body.sentBy || "unknown",
        idempotencyKey,
        event
      };

      // Forward first: only record the event as seen once Zoho has actually
      // accepted it, so a failed forward is retried rather than swallowed.
      const zoho = await forwardToZoho(stored);
      fs.appendFileSync(SYNC_LOG, `${JSON.stringify(stored)}\n`);
      if (idempotencyKey) seenEventIds.add(idempotencyKey);

      sendJson(res, 200, { ok: true, stored: true, zoho }, req);
    } catch (error) {
      // 502: the relay is healthy but the downstream forward failed. The Field
      // App keeps the event Pending and can retry with the same key.
      sendJson(res, 502, { ok: false, error: error.message }, req);
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" }, req);
});

server.listen(PORT, () => {
  console.log(`MTS relay server listening on http://localhost:${PORT}`);
  console.log("Slack endpoint: POST /api/slack/alerts");
});
