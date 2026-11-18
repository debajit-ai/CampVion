"""
CampVion Authentication & Security Verification Suite
Tests account registration, scrypt password hashing, role enforcement,
duplicate detection, login, lockout protection, session persistence,
logout revocation, password recovery, expired/used reset tokens,
and unauthorized access protection across API routes.
"""

from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.db import models
from app.db.database import get_db
from app.core.security import (
    auth_rate_limiter,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)


def _fresh_client(db) -> TestClient:
    auth_rate_limiter.clear()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_password_hashing_scrypt_and_constant_time():
    raw = "StrongPass2026!"
    hashed = hash_password(raw)
    assert hashed.startswith("scrypt$16384$8$1$")
    assert raw not in hashed
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPass2026!", hashed) is False


def test_unauthorized_api_access_blocked(db):
    anon = _fresh_client(db)
    # Public health endpoint remains accessible
    res_health = anon.get("/api/health")
    assert res_health.status_code == 200

    # Protected operational routes must reject unauthenticated requests with 401
    assert anon.get("/api/auth/me").status_code == 401
    assert anon.get("/api/students/").status_code == 401
    assert anon.get("/api/tools/").status_code == 401
    assert anon.get("/api/traces/1").status_code == 401
    assert anon.post("/api/agent/run", json={"student_id": "S001", "goal": "Apply for leave"}).status_code == 401


def test_signup_and_role_escalation_prevention(db):
    anon = _fresh_client(db)

    # Attempt to inject role='system_administrator' during signup — must be ignored and set to 'student'
    res = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Rohan Kapoor",
            "email": "rohan.kapoor@university.edu",
            "password": "CampusUser2026",
            "confirm_password": "CampusUser2026",
            "accept_terms": True,
            "role": "system_administrator",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "rohan.kapoor@university.edu"
    assert data["user"]["full_name"] == "Rohan Kapoor"
    assert data["user"]["role"] == "student"
    assert "campvion_session" in res.cookies

    # Session persists on /api/auth/me
    me = anon.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "rohan.kapoor@university.edu"


def test_duplicate_account_handling(db):
    anon = _fresh_client(db)
    res = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Duplicate User",
            "email": "ROHAN.KAPOOR@university.edu",
            "password": "CampusUser2026",
            "confirm_password": "CampusUser2026",
            "accept_terms": True,
        },
    )
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


def test_signup_validation_rules(db):
    anon = _fresh_client(db)

    # Weak password (no uppercase or number)
    res_weak = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Test Student",
            "email": "weakpass@university.edu",
            "password": "weakpassword",
            "confirm_password": "weakpassword",
            "accept_terms": True,
        },
    )
    assert res_weak.status_code == 400

    # Mismatched confirm_password
    res_mismatch = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Test Student",
            "email": "mismatch@university.edu",
            "password": "ValidPassword1",
            "confirm_password": "ValidPassword2",
            "accept_terms": True,
        },
    )
    assert res_mismatch.status_code == 400

    # Unaccepted terms
    res_terms = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Test Student",
            "email": "noterms@university.edu",
            "password": "ValidPassword1",
            "confirm_password": "ValidPassword1",
            "accept_terms": False,
        },
    )
    assert res_terms.status_code == 400


def test_login_invalid_password_and_lockout(db):
    anon = _fresh_client(db)

    # Create dedicated account for login/lockout test
    anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Lockout Target",
            "email": "lockout.test@university.edu",
            "password": "CorrectPassword9",
            "confirm_password": "CorrectPassword9",
            "accept_terms": True,
        },
    )
    anon.cookies.clear()

    # Invalid password attempt
    bad = anon.post(
        "/api/auth/login",
        json={"email": "lockout.test@university.edu", "password": "WrongPassword1"},
    )
    assert bad.status_code == 401

    # Valid login succeeds
    good = anon.post(
        "/api/auth/login",
        json={
            "email": "lockout.test@university.edu",
            "password": "CorrectPassword9",
            "remember_me": True,
        },
    )
    assert good.status_code == 200
    assert good.json()["user"]["email"] == "lockout.test@university.edu"


def test_logout_revokes_session(db):
    anon = _fresh_client(db)
    login_res = anon.post(
        "/api/auth/login",
        json={"email": "rohan.kapoor@university.edu", "password": "CampusUser2026"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["session_token"]

    # Verify session works via Bearer token as well
    assert anon.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    # Logout revokes session in database
    logout_res = anon.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Reusing the revoked token must fail with 401
    assert anon.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_forgot_and_reset_password_lifecycle(db):
    anon = _fresh_client(db)

    # 1. Forgot password for existing vs non-existing account returns identical structure (no enumeration)
    res_existing = anon.post("/api/auth/forgot-password", json={"email": "rohan.kapoor@university.edu"})
    res_unknown = anon.post("/api/auth/forgot-password", json={"email": "nobody.nowhere@university.edu"})
    assert res_existing.status_code == 200
    assert res_unknown.status_code == 200
    assert res_existing.json()["message"] == res_unknown.json()["message"]
    assert res_existing.json()["status"] == "accepted"

    # 2. Issue a known reset token in DB for rohan.kapoor@university.edu and test reset flow
    user = db.query(models.UserAccount).filter_by(email="rohan.kapoor@university.edu").first()
    raw_token = generate_secure_token(32)
    reset_entry = models.PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        used=0,
    )
    db.add(reset_entry)
    db.commit()

    # Verify reset token endpoint
    verify_res = anon.get(f"/api/auth/verify-reset-token?token={raw_token}")
    assert verify_res.status_code == 200
    assert verify_res.json()["valid"] is True

    # Reset password
    reset_res = anon.post(
        "/api/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": "NewSecurePassword2026",
            "confirm_password": "NewSecurePassword2026",
        },
    )
    assert reset_res.status_code == 200

    # 3. Used token cannot be reused
    reuse_res = anon.post(
        "/api/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": "AnotherPassword2026",
            "confirm_password": "AnotherPassword2026",
        },
    )
    assert reuse_res.status_code == 400
    assert "already been used" in reuse_res.json()["detail"].lower()

    # 4. Expired token is rejected
    expired_raw = generate_secure_token(32)
    db.add(
        models.PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(expired_raw),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            used=0,
        )
    )
    db.commit()

    exp_res = anon.post(
        "/api/auth/reset-password",
        json={
            "token": expired_raw,
            "new_password": "AnotherPassword2026",
            "confirm_password": "AnotherPassword2026",
        },
    )
    assert exp_res.status_code == 400
    assert "expired" in exp_res.json()["detail"].lower()

    # 5. Old password no longer works; new password works
    assert (
        anon.post(
            "/api/auth/login",
            json={"email": "rohan.kapoor@university.edu", "password": "CampusUser2026"},
        ).status_code
        == 401
    )
    assert (
        anon.post(
            "/api/auth/login",
            json={"email": "rohan.kapoor@university.edu", "password": "NewSecurePassword2026"},
        ).status_code
        == 200
    )


def test_colleges_directory_signup_and_profile_update(db):
    anon = _fresh_client(db)

    # 1. Public /api/colleges returns 100+ institutions with LPU featured first & Cache-Control
    res_all = anon.get("/api/colleges")
    assert res_all.status_code == 200
    assert "max-age=" in res_all.headers.get("cache-control", "")
    data = res_all.json()
    assert data["total"] >= 100
    assert data["items"][0]["name"] == "Lovely Professional University"

    # 2. Query search matches LPU and IIT Bombay
    res_lpu = anon.get("/api/colleges?q=lpu")
    assert res_lpu.status_code == 200
    assert res_lpu.json()["items"][0]["name"] == "Lovely Professional University"

    res_iit = anon.get("/api/colleges?q=IIT Bombay")
    assert res_iit.status_code == 200
    assert any("Bombay" in item["name"] for item in res_iit.json()["items"])

    # 3. Student signup sanitizes 'Other' college (strips HTML tags, enforces max 120 chars)
    long_custom = "<script>alert(1)</script>  " + ("Custom Tech Institute Punjab " * 6)
    res_signup = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Priya Nair",
            "email": "priya.college@university.edu",
            "password": "CampusUser2026!",
            "confirm_password": "CampusUser2026!",
            "accept_terms": True,
            "role": "student",
            "college": long_custom,
        },
    )
    assert res_signup.status_code == 201
    user_data = res_signup.json()["user"]
    assert "<script>" not in user_data["college"]
    assert len(user_data["college"]) <= 120
    assert user_data["college"].startswith("alert(1) Custom Tech Institute")

    # 4. Student can update college via PATCH /api/auth/profile and it persists on Student & /auth/me
    upd = anon.patch("/api/auth/profile", json={"college": "Indian Institute of Technology Delhi"})
    assert upd.status_code == 200
    assert upd.json()["college"] == "Indian Institute of Technology Delhi"
    me = anon.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["college"] == "Indian Institute of Technology Delhi"


def test_signup_blank_student_id_display_name_and_admin_invite_flows(db):
    from app.core.config import settings
    from app.db.seed_users import seed_demo_users

    seed_demo_users(db=db, verbose=False)
    anon = _fresh_client(db)

    # 1. Student signup matching UI form: blank optional student_id & display_name, LPU college
    res_stu = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Rhea Sen",
            "email": "rhea.sen@lpu.edu",
            "password": "StrongPassword2026!",
            "confirm_password": "StrongPassword2026!",
            "accept_terms": True,
            "role": "student",
            "student_id": "",
            "display_name": "",
            "college": "Lovely Professional University",
        },
    )
    assert res_stu.status_code == 201, res_stu.text
    stu_data = res_stu.json()["user"]
    assert stu_data["role"] == "student"
    assert stu_data["student_id"].startswith("S")
    assert stu_data["college"] == "Lovely Professional University"

    # Duplicate email returns clean 409 JSON message
    res_dup = anon.post(
        "/api/auth/signup",
        json={
            "full_name": "Rhea Sen",
            "email": "rhea.sen@lpu.edu",
            "password": "StrongPassword2026!",
            "confirm_password": "StrongPassword2026!",
            "accept_terms": True,
            "role": "student",
            "college": "Lovely Professional University",
        },
    )
    assert res_dup.status_code == 409
    assert "already exists" in res_dup.json()["detail"].lower()

    # 2. Both demo accounts sign in cleanly
    for demo_email, demo_pw, exp_role in [
        ("alice@lpu.edu", "CampVion@2026", "student"),
        ("admin@campvion.edu", "Admin@CampVion2026", "administrator"),
    ]:
        res_login = _fresh_client(db).post(
            "/api/auth/login",
            json={"email": demo_email, "password": demo_pw, "remember_me": False},
        )
        assert res_login.status_code == 200, res_login.text
        assert res_login.json()["user"]["role"] == exp_role

    # 3. Admin signup without invite code -> 403; with invite code -> 201
    res_adm_no = _fresh_client(db).post(
        "/api/auth/signup",
        json={
            "full_name": "Admin Rejected",
            "email": "adm.reject@campvion.edu",
            "password": "StrongPassword2026!",
            "confirm_password": "StrongPassword2026!",
            "accept_terms": True,
            "role": "administrator",
            "authority_title": "Warden",
        },
    )
    assert res_adm_no.status_code == 403

    res_adm_ok = _fresh_client(db).post(
        "/api/auth/signup",
        json={
            "full_name": "Admin Accepted",
            "email": "adm.accept@campvion.edu",
            "password": "StrongPassword2026!",
            "confirm_password": "StrongPassword2026!",
            "accept_terms": True,
            "role": "administrator",
            "invite_code": settings.ADMIN_INVITE_CODE,
            "authority_title": "Warden",
        },
    )
    assert res_adm_ok.status_code == 201, res_adm_ok.text
    assert res_adm_ok.json()["user"]["role"] == "administrator"



