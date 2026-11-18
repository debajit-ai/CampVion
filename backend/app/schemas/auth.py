"""
CampVion Authentication & Account Schemas
Strict Pydantic v2 request/response contracts for account registration,
session authentication, password recovery, and role-based user profiles.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120, description="User's full name")
    email: EmailStr = Field(..., description="University or institutional email address")
    password: str = Field(..., min_length=8, max_length=128, description="Account password")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Password confirmation")
    accept_terms: bool = Field(..., description="Must accept Terms of Service and Privacy Policy")
    role: Optional[str] = Field(default="student", description="Requested account role ('student' or 'administrator')")
    student_id: Optional[str] = Field(default=None, max_length=32, description="Optional unique university student ID")
    college: Optional[str] = Field(default=None, max_length=300, description="Student college or university name")
    display_name: Optional[str] = Field(default=None, max_length=120, description="Optional preferred display name")
    displayName: Optional[str] = Field(default=None, max_length=120, description="Optional preferred display name alias")
    invite_code: Optional[str] = Field(default=None, max_length=128, description="Required secret invite code for admin signup")
    authority_title: Optional[str] = Field(default=None, max_length=60, description="Administrator authority title (Warden, Dean, Registrar)")
    phone: Optional[str] = Field(default=None, max_length=32, description="Contact phone number")

    model_config = ConfigDict(extra="ignore")


class AdminProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    college: Optional[str] = Field(default=None, max_length=300)
    authority_title: Optional[str] = Field(default=None, max_length=60)
    phone: Optional[str] = Field(default=None, max_length=32)
    office: Optional[str] = Field(default=None, max_length=160)
    office_hours: Optional[str] = Field(default=None, max_length=120)
    contact_email: Optional[EmailStr] = Field(default=None)

    model_config = ConfigDict(extra="ignore")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=6, max_length=128, description="Account password")
    remember_me: bool = Field(default=False, description="Extend session validity to 14 days")

    model_config = ConfigDict(extra="ignore")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address for password recovery")

    model_config = ConfigDict(extra="ignore")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=256, description="One-time password reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New account password")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Confirm new password")

    model_config = ConfigDict(extra="ignore")


class UserProfileResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    student_id: Optional[str] = None
    college: Optional[str] = None
    hostel_block: Optional[str] = None
    hostel_room: Optional[str] = None
    authority_title: Optional[str] = None
    phone: Optional[str] = None
    office: Optional[str] = None
    office_hours: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AuthSessionResponse(BaseModel):
    authenticated: bool = True
    user: UserProfileResponse
    csrf_token: str
    expires_at: datetime
    session_token: Optional[str] = None

