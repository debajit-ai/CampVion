/**
 * End-to-end authentication verification script against live CampVion endpoints.
 * Verifies:
 *   1. Student demo login (alice@lpu.edu) + 12h HttpOnly SameSite=Lax cookie
 *   2. /api/auth/me role check + server-side admin RBAC denial (403)
 *   3. /api/auth/logout session revocation + post-logout 401
 *   4. Administrator demo login (admin@campvion.edu) + remember_me (14d) + RBAC allow (200)
 *   5. Generic "Invalid email or password" error on bad password & unknown account
 *   6. Signup end-to-end student creation + immediate /auth/me check
 */

import assert from "node:assert/strict";

const FRONTEND_API = process.env.AUTH_TEST_API_BASE || "http://localhost:3000/api";
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
  throw new Error(
    `No healthy CampVion API found at ${FRONTEND_API} or ${BACKEND_API}. Start backend & frontend first.`
  );
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
      const firstPart = raw.split(";")[0];
      return firstPart;
    }
  }
  return null;
}

async function run() {
  const apiBase = await resolveWorkingBase();
  console.log(`[test:auth] Testing authentication pipeline at ${apiBase}`);

  // 1. Student Login
  const stuLoginRes = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alice@lpu.edu",
      password: "CampVion@2026",
      remember_me: false,
    }),
  });
  assert.equal(stuLoginRes.status, 200, "Student login should return 200");
  const stuCookies = getSetCookies(stuLoginRes);
  const stuSessionCookie = extractCookiePair(stuCookies, "campvion_session");
  assert.ok(stuSessionCookie, "Expected campvion_session Set-Cookie on student login");
  const rawSessionHeader = stuCookies.find((c) => c.startsWith("campvion_session=")) || "";
  assert.match(rawSessionHeader, /httponly/i, "Session cookie must be HttpOnly");
  assert.match(rawSessionHeader, /samesite=lax/i, "Session cookie must be SameSite=Lax");
  assert.match(rawSessionHeader, /max-age=43200/i, "Default expiry must be 12h (43200s)");
  const stuData = await stuLoginRes.json();
  assert.equal(stuData.user.role, "student");
  console.log("  PASS 1: Student (alice@lpu.edu) signed in, 12h HttpOnly SameSite=Lax cookie issued");

  // 2. Student /auth/me + Server-side RBAC check
  const stuMeRes = await fetch(`${apiBase}/auth/me`, {
    headers: { Cookie: stuSessionCookie },
  });
  assert.equal(stuMeRes.status, 200, "Student /auth/me must return 200");
  const stuMe = await stuMeRes.json();
  assert.equal(stuMe.email, "alice@lpu.edu");
  assert.equal(stuMe.role, "student");

  const stuAdminBlocked = await fetch(`${apiBase}/auth/admin/verify`, {
    headers: { Cookie: stuSessionCookie },
  });
  assert.equal(stuAdminBlocked.status, 403, "Student must be blocked from admin endpoint (403)");
  console.log("  PASS 2: /auth/me verified role=student and server-side RBAC returned 403 on admin route");

  // 3. Logout revokes session
  const logoutRes = await fetch(`${apiBase}/auth/logout`, {
    method: "POST",
    headers: { Cookie: stuSessionCookie },
  });
  assert.equal(logoutRes.status, 200, "Logout should return 200");
  const revokedMe = await fetch(`${apiBase}/auth/me`, {
    headers: { Cookie: stuSessionCookie },
  });
  assert.equal(revokedMe.status, 401, "Revoked session must fail /auth/me with 401");
  console.log("  PASS 3: Logout revoked session and /auth/me now rejects with 401");

  // 4. Administrator login with Remember Me (14 days) + RBAC allow
  const adminLoginRes = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@campvion.edu",
      password: "Admin@CampVion2026",
      remember_me: true,
    }),
  });
  assert.equal(adminLoginRes.status, 200, "Admin login should return 200");
  const adminCookies = getSetCookies(adminLoginRes);
  const adminSessionCookie = extractCookiePair(adminCookies, "campvion_session");
  assert.ok(adminSessionCookie, "Expected campvion_session Set-Cookie on admin login");
  const rawAdminHeader = adminCookies.find((c) => c.startsWith("campvion_session=")) || "";
  assert.match(rawAdminHeader, /max-age=1209600/i, "Remember-me expiry must be 14d (1209600s)");
  const adminMe = await (
    await fetch(`${apiBase}/auth/me`, { headers: { Cookie: adminSessionCookie } })
  ).json();
  assert.equal(adminMe.role, "administrator");
  const adminAllowed = await fetch(`${apiBase}/auth/admin/verify`, {
    headers: { Cookie: adminSessionCookie },
  });
  assert.equal(adminAllowed.status, 200, "Admin must pass server-side admin RBAC (200)");
  await fetch(`${apiBase}/auth/logout`, {
    method: "POST",
    headers: { Cookie: adminSessionCookie },
  });
  console.log("  PASS 4: Admin (admin@campvion.edu) signed in with 14d Remember Me & passed admin RBAC");

  // 5. Wrong password & non-existent email (no user enumeration)
  const wrongPwRes = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "alice@lpu.edu",
      password: "WrongPassword999",
    }),
  });
  assert.equal(wrongPwRes.status, 401);
  const wrongPwBody = await wrongPwRes.json();
  assert.equal(wrongPwBody.detail, "Invalid email or password");

  const unknownUserRes = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `nobody.${Date.now()}@campvion.edu`,
      password: "WrongPassword999",
    }),
  });
  assert.equal(unknownUserRes.status, 401);
  const unknownUserBody = await unknownUserRes.json();
  assert.equal(unknownUserBody.detail, "Invalid email or password");
  console.log("  PASS 5: Wrong password & unknown account both return generic 401 'Invalid email or password'");

  // 6. End-to-end signup -> /auth/me -> logout
  const tempEmail = `verify.${Date.now()}@campvion.edu`;
  const signupRes = await fetch(`${apiBase}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Verification Student",
      email: tempEmail,
      password: "VerifyPass2026",
      confirm_password: "VerifyPass2026",
      accept_terms: true,
    }),
  });
  assert.equal(signupRes.status, 201, "Signup should return 201");
  const signupCookie = extractCookiePair(getSetCookies(signupRes), "campvion_session");
  assert.ok(signupCookie, "Expected campvion_session Set-Cookie on signup");
  const signupMe = await (
    await fetch(`${apiBase}/auth/me`, { headers: { Cookie: signupCookie } })
  ).json();
  assert.equal(signupMe.email, tempEmail);
  assert.equal(signupMe.role, "student");
  await fetch(`${apiBase}/auth/logout`, {
    method: "POST",
    headers: { Cookie: signupCookie },
  });
  console.log("  PASS 6: Signup created student account, issued cookie, verified /auth/me, logged out");

  console.log("\n[test:auth] ALL AUTHENTICATION CHECKS PASSED.");
}

run().catch((err) => {
  console.error("\n[test:auth] FAILED:", err);
  process.exit(1);
});
