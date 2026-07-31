/**
 * Relay contract tests.
 *
 * These lock in the behaviours that protect the audit trail:
 *   - the relay never runs unauthenticated
 *   - an event is only recorded once
 *   - a failed forward is reported as a failure, never as success
 *
 * Run with:  node --test tests/
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TOKEN = "test-token-do-not-use-in-production";
const ORIGIN = "http://localhost:5178";
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "relay-data");

let child;
let baseUrl;

function startRelay(port, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["relay-server.js"], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), RELAY_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN, ...env }
    });
    let settled = false;
    proc.stdout.on("data", (chunk) => {
      if (!settled && String(chunk).includes("listening")) {
        settled = true;
        resolve(proc);
      }
    });
    proc.on("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`relay exited early with code ${code}`));
      }
    });
    setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("relay did not start in time")); }
    }, 5000);
  });
}

function stop(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null) return resolve();
    proc.on("exit", () => resolve());
    proc.kill();
  });
}

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

before(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  child = await startRelay(8791);
  baseUrl = "http://127.0.0.1:8791";
});

after(async () => {
  await stop(child);
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test("refuses to start without RELAY_TOKEN", async () => {
  await assert.rejects(
    () => startRelay(8792, { RELAY_TOKEN: "" }),
    /exited early/,
    "an unauthenticated relay must not boot"
  );
});

test("rejects a request with no token", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 401);
});

test("rejects a request with a wrong token", async () => {
  const res = await fetch(`${baseUrl}/health`, { headers: { Authorization: "Bearer nope" } });
  assert.strictEqual(res.status, 401);
});

test("accepts a request with the correct token", async () => {
  const res = await fetch(`${baseUrl}/health`, { headers: auth });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).ok, true);
});

test("echoes CORS only for an allowed origin", async () => {
  const good = await fetch(`${baseUrl}/health`, { headers: { ...auth, Origin: ORIGIN } });
  assert.strictEqual(good.headers.get("access-control-allow-origin"), ORIGIN);

  const bad = await fetch(`${baseUrl}/health`, { headers: { ...auth, Origin: "https://evil.example" } });
  assert.strictEqual(bad.headers.get("access-control-allow-origin"), null);
});

test("stores an event once and treats a replay as a duplicate", async () => {
  const body = JSON.stringify({ event: { id: "evt-1", type: "job.completed" } });
  const headers = { ...auth, "Idempotency-Key": "evt-1" };

  const first = await fetch(`${baseUrl}/api/zoho/sync`, { method: "POST", headers, body });
  assert.strictEqual(first.status, 200);
  assert.strictEqual((await first.json()).duplicate, undefined);

  const second = await fetch(`${baseUrl}/api/zoho/sync`, { method: "POST", headers, body });
  assert.strictEqual((await second.json()).duplicate, true);

  const lines = fs.readFileSync(path.join(DATA_DIR, "zoho-sync.jsonl"), "utf8").split("\n").filter(Boolean);
  assert.strictEqual(lines.filter((l) => l.includes("evt-1")).length, 1, "event must be written exactly once");
});

test("rejects an event with no type", async () => {
  const res = await fetch(`${baseUrl}/api/zoho/sync`, {
    method: "POST", headers: auth, body: JSON.stringify({ event: {} })
  });
  assert.strictEqual(res.status, 400);
});

test("reports a failed downstream forward as a failure, and keeps it retryable", async () => {
  const failing = await startRelay(8793, { ZOHO_FLOW_WEBHOOK_URL: "http://127.0.0.1:9/dead" });
  try {
    const res = await fetch("http://127.0.0.1:8793/api/zoho/sync", {
      method: "POST",
      headers: { ...auth, "Idempotency-Key": "evt-fail" },
      body: JSON.stringify({ event: { id: "evt-fail", type: "job.completed" } })
    });

    // The single most important assertion in this file: a forward that did not
    // reach Zoho must never be reported to the Field App as success.
    assert.strictEqual(res.status, 502);
    assert.strictEqual((await res.json()).ok, false);

    const log = fs.existsSync(path.join(DATA_DIR, "zoho-sync.jsonl"))
      ? fs.readFileSync(path.join(DATA_DIR, "zoho-sync.jsonl"), "utf8")
      : "";
    assert.ok(!log.includes("evt-fail"), "a failed event must stay unrecorded so it can be retried");
  } finally {
    await stop(failing);
  }
});
