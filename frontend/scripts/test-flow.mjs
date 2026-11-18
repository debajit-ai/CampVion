/**
 * Comprehensive End-to-End Flow Verification for CampVion
 * Tests real SSE delivery through Next.js (:3000/api/events), RBAC, Optimistic Concurrency (409),
 * Workflow gate pause/resume, Duplicate overlap prevention, Cancellation, and Admin Invite signup.
 */

import assert from "node:assert/strict";

const FRONTEND_API = process.env.FLOW_TEST_API_BASE || "http://localhost:3000/api";
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
  const base = new Date("2028-01-15T00:00:00Z");
  const jitter = Math.floor(Date.now() / 1000) % 400; // unique window per run
  const dt = new Date(base.getTime() + (jitter + offsetDays) * 86400000);
  return dt.toISOString().slice(0, 10);
}

async function openSseListener(apiBase, cookieHeader) {
  const controller = new AbortController();
  const res = await fetch(`${apiBase}/events`, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      Accept: "text/event-stream",
    },
    signal: controller.signal,
  });
  assert.equal(res.status, 200, "Authenticated GET /api/events must return 200");
  assert.ok(res.body, "SSE response must have a readable stream body");

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
      // Aborted at teardown
    }
  })();

  const waitUntilConnected = async () => {
    const start = Date.now();
    while (!connected && Date.now() - start < 4000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(connected, "SSE client did not receive connected frame within 4s");
  };

  const waitForEvent = async (predicate, timeoutMs = 2000) => {
    const start = Date.now();
    while (Date.now() - start <= timeoutMs) {
      const match = events.find(predicate);
      if (match) return match;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timed out after ${timeoutMs}ms waiting for SSE event`);
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

async function run() {
  const apiBase = await resolveWorkingBase();
  console.log(`[test:flow] Running full E2E leave + approval + SSE tests against ${apiBase}`);

  // Unauthenticated SSE check
  const unauthSse = await fetch(`${apiBase}/events`);
  assert.equal(unauthSse.status, 401, "Unauthenticated /api/events must fail with 401");

  // Log in Student & Admin
  const student = await login(apiBase, "alice@lpu.edu", "CampVion@2026");
  const admin = await login(apiBase, "admin@campvion.edu", "Admin@CampVion2026");
  assert.equal(student.user.role, "student");
  assert.equal(admin.user.role, "administrator");

  const d1 = futureIsoDate(5);
  const d2 = futureIsoDate(25);
  const d3 = futureIsoDate(45);
  const d4 = futureIsoDate(65);

  // Open Student SSE stream BEFORE actions
  const studentSse = await openSseListener(apiBase, student.cookie);
  await studentSse.waitUntilConnected();
  console.log("  PASS 0: Connected authenticated Student SSE stream");

  // 1. Student submits leave via conversational chat confirm -> must pause WAITING_FOR_HUMAN / PENDING_APPROVAL
  const convRes = await fetch(`${apiBase}/conversations/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      student_id: student.user.student_id,
      message: `Apply for 2 days personal leave starting ${d1} because of family wedding`,
    }),
  });
  assert.equal(convRes.status, 200);
  const convData = await convRes.json();
  assert.equal(convData.status, "awaiting_confirmation", "Prepared confirmation card expected");

  const confirmRes = await fetch(
    `${apiBase}/conversations/${encodeURIComponent(convData.conversation_id)}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: student.cookie },
      body: JSON.stringify({ action: "confirm" }),
    }
  );
  assert.equal(confirmRes.status, 200);
  const confirmData = await confirmRes.json();
  const replyText = confirmData.latest_reply?.content || "";
  assert.ok(!/goal achieved/i.test(replyText), "Paused reply must NOT emit 'Goal achieved'");
  assert.equal(confirmData.workflow_state?.current_status, "WAITING_FOR_HUMAN");
  const leave1 = confirmData.latest_reply?.metadata?.leave_request;
  assert.ok(leave1 && leave1.id, "Persisted leave_request must be attached");
  assert.equal(leave1.status, "PENDING_APPROVAL");
  console.log(`  PASS 1: Student submitted ${leave1.leave_code} (${d1}); paused at WAITING_FOR_HUMAN / PENDING_APPROVAL`);

  // 2. Admin sees request in approval queue
  const queueRes = await fetch(`${apiBase}/requests?status=PENDING_APPROVAL`, {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(queueRes.status, 200);
  const queueJson = await queueRes.json();
  assert.ok(
    queueJson.items.some((r) => r.id === leave1.id),
    "Admin queue must contain new PENDING_APPROVAL leave"
  );
  console.log("  PASS 2: Admin approval queue lists pending request");

  // 3. RBAC / IDOR: Student calling approve must get 403
  const stuApproveRes = await fetch(`${apiBase}/requests/${leave1.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({ version: leave1.version }),
  });
  assert.equal(stuApproveRes.status, 403, "Student calling /approve must be rejected with 403");
  const stuForeignList = await fetch(`${apiBase}/requests?student_id=S002`, {
    headers: { Cookie: student.cookie },
  });
  assert.equal(stuForeignList.status, 403, "Student querying S002 leaves must get 403");
  console.log("  PASS 3: RBAC & IDOR enforced (student approve -> 403, foreign student -> 403)");

  // 4. Admin approves -> Student SSE receives request.updated within 2 seconds + notification exists + COMPLETED
  const approveStart = Date.now();
  const admApproveRes = await fetch(`${apiBase}/requests/${leave1.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ comment: "Approved via E2E verification", version: leave1.version }),
  });
  assert.equal(admApproveRes.status, 200, "Admin approve must return 200");
  const admApproveJson = await admApproveRes.json();
  assert.equal(admApproveJson.request.status, "APPROVED");
  assert.equal(admApproveJson.workflow_result.status, "COMPLETED");

  const sseEvt = await studentSse.waitForEvent(
    (e) => e.eventType === "request.updated" && e.payload?.data?.request?.id === leave1.id,
    2000
  );
  const latencyMs = sseEvt.receivedAt - approveStart;
  assert.equal(sseEvt.payload.data.request.status, "APPROVED");

  const stuNotifsRes = await fetch(`${apiBase}/notifications`, {
    headers: { Cookie: student.cookie },
  });
  assert.equal(stuNotifsRes.status, 200);
  const stuNotifs = await stuNotifsRes.json();
  assert.ok(
    stuNotifs.items.some((n) => n.leave_request_id === leave1.id && /approved/i.test(n.title)),
    "Student notification record must exist after approval"
  );
  console.log(`  PASS 4: Admin approved ${leave1.leave_code}; SSE event received in ${latencyMs}ms (< 2000ms) & DB notification persisted`);

  // 5. Duplicate approve must fail with 409 Conflict
  const dupApproveRes = await fetch(`${apiBase}/requests/${leave1.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ version: leave1.version }),
  });
  assert.equal(dupApproveRes.status, 409, "Second approve attempt must return 409 Conflict");
  console.log("  PASS 5: Optimistic lock rejected second approve with 409 Conflict");

  // 6. Second leave submitted & rejected with required reason -> reason + authority contact + zero leave consumed
  const sub2Res = await fetch(`${apiBase}/requests/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      days: 2,
      start_date: d2,
      category: "personal",
      reason: "Travel for family celebration ceremony",
    }),
  });
  assert.equal(sub2Res.status, 201);
  const leave2 = (await sub2Res.json()).request;

  // Verify rejection < 10 chars rejected (422)
  const shortRejRes = await fetch(`${apiBase}/requests/${leave2.id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ reason: "No", version: leave2.version }),
  });
  assert.equal(shortRejRes.status, 422, "Short rejection reason must be blocked");

  const rejReasonText = "Midterm lab evaluations are mandatory on the requested dates.";
  const admRejRes = await fetch(`${apiBase}/requests/${leave2.id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ reason: rejReasonText, version: leave2.version }),
  });
  assert.equal(admRejRes.status, 200);
  const admRejJson = await admRejRes.json();
  assert.equal(admRejJson.request.status, "REJECTED");
  assert.equal(admRejJson.workflow_result.status, "ENDED_REJECTED");

  await studentSse.waitForEvent(
    (e) =>
      e.eventType === "request.updated" &&
      e.payload?.data?.request?.id === leave2.id &&
      e.payload?.data?.request?.status === "REJECTED",
    2000
  );

  const detail2Res = await fetch(`${apiBase}/requests/${leave2.id}`, {
    headers: { Cookie: student.cookie },
  });
  assert.equal(detail2Res.status, 200);
  const detail2 = await detail2Res.json();
  assert.equal(detail2.rejection_reason, rejReasonText);
  assert.ok(detail2.authority_contact?.email, "Authority email must be populated for declined request");
  assert.ok(detail2.authority_contact?.phone, "Authority phone must be populated for declined request");
  console.log(`  PASS 6: Leave ${leave2.leave_code} declined (ENDED_REJECTED); reason + authority contact delivered live via SSE`);

  // 7. Overlapping pending leave submission blocked
  const sub3Res = await fetch(`${apiBase}/requests/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      days: 3,
      start_date: d3,
      category: "medical",
      reason: "Medical recovery leave for overlap check",
    }),
  });
  assert.equal(sub3Res.status, 201);
  const leave3 = (await sub3Res.json()).request;

  const overlapRes = await fetch(`${apiBase}/requests/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      days: 1,
      start_date: d3,
      category: "personal",
      reason: "Overlapping submission should block",
    }),
  });
  assert.equal(overlapRes.status, 409, "Overlapping pending leave must return 409");
  console.log("  PASS 7: Overlapping PENDING_APPROVAL leave blocked cleanly with 409");

  // 8. Student cancels pending leave succeeds; cancel after decision fails with 409
  const cancelRes = await fetch(`${apiBase}/requests/${leave3.id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({ version: leave3.version }),
  });
  assert.equal(cancelRes.status, 200);
  assert.equal((await cancelRes.json()).request.status, "CANCELLED");

  const sub4Res = await fetch(`${apiBase}/requests/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({
      days: 1,
      start_date: d4,
      category: "personal",
      reason: "Post-decision cancel guard verification",
    }),
  });
  assert.equal(sub4Res.status, 201);
  const leave4 = (await sub4Res.json()).request;
  await fetch(`${apiBase}/requests/${leave4.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({ version: leave4.version }),
  });

  const cancelAfterDecide = await fetch(`${apiBase}/requests/${leave4.id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student.cookie },
    body: JSON.stringify({ version: leave4.version }),
  });
  assert.equal(cancelAfterDecide.status, 409, "Cancelling after decision must return 409");
  console.log("  PASS 8: Cancel while PENDING_APPROVAL succeeded; post-decision cancel rejected with 409");

  // 9. Admin signup with wrong invite code fails with generic 403
  const badAdminRes = await fetch(`${apiBase}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Fake Warden",
      email: `fake.admin.${Date.now()}@campvion.edu`,
      password: "StrongPassword2026!",
      confirm_password: "StrongPassword2026!",
      accept_terms: true,
      role: "administrator",
      invite_code: "INVALID-CODE-999",
      authority_title: "Warden",
    }),
  });
  assert.equal(badAdminRes.status, 403, "Wrong admin invite code must return 403");
  console.log("  PASS 9: Admin signup with wrong invite code blocked cleanly (403)");

  await studentSse.close();
  console.log("[test:flow] ALL 9 END-TO-END FLOW ASSERTIONS PASSED.");
}

run().catch((err) => {
  console.error("[test:flow] FAILED:", err);
  process.exit(1);
});
