/**
 * Admin Approval Queue & Student -> Warden -> Student End-to-End Verification Script
 * Usage: npm run test:admin
 */

import assert from "node:assert/strict";

const FRONTEND_API = process.env.ADMIN_TEST_API_BASE || "http://localhost:3000/api";
const BACKEND_API = "http://127.0.0.1:8000/api";

async function resolveWorkingBase() {
  for (const base of [FRONTEND_API, BACKEND_API]) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return base;
    } catch {
      // try next
    }
  }
  throw new Error(`Neither ${FRONTEND_API} nor ${BACKEND_API} responded healthy.`);
}

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function extractCookiePair(setCookies, name) {
  for (const raw of setCookies) {
    if (raw.startsWith(`${name}=`)) {
      return raw.split(";")[0];
    }
  }
  return null;
}

function futureIsoDate(offsetDays) {
  const base = new Date("2028-06-01T00:00:00Z");
  const jitter = Math.floor(Date.now() / 1000) % 360;
  const dt = new Date(base.getTime() + (jitter + offsetDays) * 86400000);
  return dt.toISOString().slice(0, 10);
}

async function login(apiBase, email, password) {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, remember_me: false }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  const cookies = getSetCookies(res);
  const session = extractCookiePair(cookies, "campvion_session");
  assert.ok(session, `Missing campvion_session cookie for ${email}`);
  const data = await res.json();
  return { cookie: session, user: data.user };
}

async function openSseListener(apiBase, cookieHeader) {
  const controller = new AbortController();
  const res = await fetch(`${apiBase}/events`, {
    method: "GET",
    headers: { Cookie: cookieHeader, Accept: "text/event-stream" },
    signal: controller.signal,
  });
  assert.equal(res.status, 200, "Authenticated GET /api/events must return 200");
  assert.ok(res.body, "SSE stream body must exist");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  let connected = false;

  const readerLoop = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawBlock = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!rawBlock.trim() || rawBlock.startsWith(":")) continue;
          const lines = rawBlock.split(/\r?\n/);
          let eventType = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (eventType === "connected") connected = true;
          if (dataLine) {
            try {
              events.push({ eventType, payload: JSON.parse(dataLine), receivedAt: Date.now() });
            } catch {
              // ignore non-json comments
            }
          }
        }
      }
    } catch {
      // closed
    }
  })();

  const waitUntilConnected = async () => {
    const start = Date.now();
    while (!connected && Date.now() - start < 4000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(connected, "SSE client did not receive connected frame within 4s");
  };

  const waitForEvent = async (predicate, timeoutMs = 3000) => {
    const start = Date.now();
    while (Date.now() - start <= timeoutMs) {
      const match = events.find(predicate);
      if (match) return match;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timed out waiting for SSE event after ${timeoutMs}ms`);
  };

  return {
    waitUntilConnected,
    waitForEvent,
    close: () => {
      controller.abort();
      reader.cancel().catch(() => {});
      return readerLoop;
    },
  };
}

async function run() {
  const apiBase = await resolveWorkingBase();
  console.log(`[test:admin] Testing Admin Approval Queue & E2E flow against ${apiBase}`);

  // 1. Log in as Admin & Student
  const admin = await login(apiBase, "admin@campvion.edu", "Admin@CampVion2026");
  const student = await login(apiBase, "alice@lpu.edu", "CampVion@2026");
  console.log("  PASS 1: Logged in as admin@campvion.edu & alice@lpu.edu");

  // 2. Hit every Admin Approval Queue, Stats, Filter, Type, and Notifications endpoint cleanly (no 307 redirects)
  const endpoints = [
    "/requests?status=pending&sort=oldest",
    "/requests?status=PENDING_APPROVAL&sort=oldest",
    "/requests?status=approved&sort=newest",
    "/requests?status=rejected&sort=newest",
    "/requests?status=all&sort=newest",
    "/requests?status=pending&type=all&sort=oldest",
    "/requests?status=pending&request_type=leave&sort=oldest",
    "/requests?status=pending&request_type=library_room&sort=oldest",
    "/requests?status=pending&request_type=hostel_allocation&sort=oldest",
    "/requests?status=pending&request_type=certificate&sort=oldest",
    "/requests/stats",
    "/notifications?limit=30",
    "/agent/pending-approvals",
    "/students",
    "/tools",
    "/policies",
  ];
  for (const ep of endpoints) {
    const res = await fetch(`${apiBase}${ep}`, {
      headers: { Cookie: admin.cookie },
      redirect: "manual",
    });
    assert.equal(res.status, 200, `Expected 200 for GET ${ep}, got ${res.status}`);
  }

  const pendingJson = await (
    await fetch(`${apiBase}/requests?status=pending&sort=oldest`, {
      headers: { Cookie: admin.cookie },
    })
  ).json();
  const sampleTypes = new Set(pendingJson.items.map((r) => r.request_type));
  assert.ok(
    sampleTypes.has("library_room") &&
      sampleTypes.has("hostel_allocation") &&
      sampleTypes.has("certificate"),
    `Expected seeded pending multi-type requests, got: ${Array.from(sampleTypes).join(", ")}`
  );
  console.log("  PASS 2: All 16 admin queue, stats, filter, type, and notifications endpoints returned 200 (0 redirects)");

  // Connect live SSE streams for both Student and Admin
  const studentSse = await openSseListener(apiBase, student.cookie);
  const adminSse = await openSseListener(apiBase, admin.cookie);
  await Promise.all([studentSse.waitUntilConnected(), adminSse.waitUntilConnected()]);

  // 3. Student submits a leave request via chat endpoint
  const d1 = futureIsoDate(10);
  const chat1 = await fetch(`${apiBase}/conversations/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      student_id: student.user.student_id,
      message: `Apply for 2 days personal leave starting ${d1} because of sister wedding ceremony`,
    }),
  });
  assert.equal(chat1.status, 200);
  const chat1Json = await chat1.json();
  assert.equal(chat1Json.status, "awaiting_confirmation");

  const conf1 = await fetch(
    `${apiBase}/conversations/${encodeURIComponent(chat1Json.conversation_id)}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: student.cookie },
      body: JSON.stringify({ action: "confirm" }),
    }
  );
  assert.equal(conf1.status, 200);
  const conf1Json = await conf1.json();
  const leave1 = conf1Json.latest_reply?.metadata?.leave_request;
  assert.ok(leave1 && leave1.id, "Leave request created from chat confirm");
  assert.equal(leave1.status, "PENDING_APPROVAL");
  console.log(`  PASS 3: Student submitted ${leave1.leave_code} via chat (${d1}) -> PENDING_APPROVAL`);

  // 4. Request now appears in Admin queue + Admin SSE received request.created
  const queueAfter = await (
    await fetch(`${apiBase}/requests?status=pending&sort=oldest`, {
      headers: { Cookie: admin.cookie },
    })
  ).json();
  assert.ok(
    queueAfter.items.some((r) => r.id === leave1.id),
    "Submitted leave must appear in admin pending queue"
  );
  await adminSse.waitForEvent(
    (e) => e.eventType === "request.created" && e.payload?.data?.request?.id === leave1.id,
    3000
  );
  console.log(`  PASS 4: ${leave1.leave_code} visible in Admin queue & pushed via SSE`);

  // 5. Admin approves request -> Student gets notification + status card SSE event
  const appRes = await fetch(`${apiBase}/requests/${leave1.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ comment: "Approved for family ceremony", version: leave1.version }),
  });
  assert.equal(appRes.status, 200);
  const appJson = await appRes.json();
  assert.equal(appJson.request.status, "APPROVED");

  const stuUpdatedEvt = await studentSse.waitForEvent(
    (e) => e.eventType === "request.updated" && e.payload?.data?.request?.id === leave1.id,
    3000
  );
  assert.equal(stuUpdatedEvt.payload.data.request.status, "APPROVED");

  const stuNotifs = await (
    await fetch(`${apiBase}/notifications?limit=20`, {
      headers: { Cookie: student.cookie },
    })
  ).json();
  assert.ok(
    stuNotifs.items.some((n) => n.leave_request_id === leave1.id && /approved/i.test(n.title)),
    "Student notification inbox must contain approval alert"
  );
  console.log(`  PASS 5: Admin approved ${leave1.leave_code}; student notified + live status card SSE event verified`);

  // 6. Reject a second request with reason -> student gets reason + Warden contact details
  const d2 = futureIsoDate(30);
  const chat2 = await fetch(`${apiBase}/conversations/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      student_id: student.user.student_id,
      message: `Apply for 2 days personal leave starting ${d2} because of weekend trip`,
    }),
  });
  const chat2Json = await chat2.json();
  const conf2 = await fetch(
    `${apiBase}/conversations/${encodeURIComponent(chat2Json.conversation_id)}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: student.cookie },
      body: JSON.stringify({ action: "confirm" }),
    }
  );
  const leave2 = (await conf2.json()).latest_reply?.metadata?.leave_request;
  assert.ok(leave2 && leave2.id);

  const reasonText = "End-term practical exams conflict with requested absence dates.";
  const rejRes = await fetch(`${apiBase}/requests/${leave2.id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ reason: reasonText, version: leave2.version }),
  });
  assert.equal(rejRes.status, 200);

  const stuRejEvt = await studentSse.waitForEvent(
    (e) => e.eventType === "request.updated" && e.payload?.data?.request?.id === leave2.id,
    3000
  );
  const rejCard = stuRejEvt.payload.data.request;
  assert.equal(rejCard.status, "REJECTED");
  assert.equal(rejCard.rejection_reason, reasonText);
  assert.ok(rejCard.authority_contact?.email, "Authority email missing on rejected request");
  assert.ok(rejCard.authority_contact?.phone, "Authority phone missing on rejected request");
  assert.ok(rejCard.authority_contact?.office, "Authority office missing on rejected request");
  console.log(`  PASS 6: ${leave2.leave_code} rejected; reason & Warden contact (${rejCard.authority_contact.email}) delivered live`);

  await Promise.all([studentSse.close(), adminSse.close()]);
  console.log("[test:admin] ALL 6 ADMIN APPROVAL QUEUE ASSERTIONS PASSED.");
}

run().catch((err) => {
  console.error("[test:admin] FAILED:", err);
  process.exit(1);
});
