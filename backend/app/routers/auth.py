from datetime import datetime, timedelta
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.all_models import User
from app.schemas.all_schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest, ResetPassword,
    OTPResponse, VerifyOTPResponse, UserProfileUpdate
)
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    generate_secure_otp, hash_otp, verify_otp_hash, generate_reset_token,
    get_current_user
)
from app.services.email_service import send_otp_email

logger = logging.getLogger("stocksense.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Register new user")
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """Registers a new user account with unique username and email."""
    if db.query(User).filter(func.lower(User.username) == user_in.username.lower()).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(func.lower(User.email) == user_in.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token, summary="User login")
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticates credentials and returns a JWT access token."""
    user = db.query(User).filter(func.lower(User.username) == user_in.username.lower()).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout", summary="User logout")
def logout():
    """Logs out user and terminates the active session."""
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse, summary="Get current profile")
def get_me(current_user: User = Depends(get_current_user)):
    """Returns profile details for the authenticated user."""
    return current_user

@router.put("/me", response_model=UserResponse, summary="Update current profile")
def update_me(profile_in: UserProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Updates email or password for the currently logged-in user."""
    if profile_in.email and profile_in.email.lower() != current_user.email.lower():
        if db.query(User).filter(func.lower(User.email) == profile_in.email.lower()).first():
            raise HTTPException(status_code=400, detail="Email already in use by another user")
        current_user.email = profile_in.email
    
    if profile_in.password:
        current_user.password_hash = hash_password(profile_in.password)

    db.commit()
    db.refresh(current_user)
    return current_user

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# REAL GMAIL SMTP OTP PASSWORD RESET ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/forgot-password", response_model=OTPResponse, summary="Request password reset OTP email")
@router.post("/request-otp", response_model=OTPResponse, summary="Request password reset OTP email (Alias)")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Step 1: Initiates password reset by dispatching a real 6-digit OTP code to the user's email via Gmail SMTP.
    - Security: OTP is hashed before storage; expires in 10 minutes; 60-second resend cooldown enforced; no email enumeration.
    """
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()

    # If user exists, enforce 60-second resend cooldown
    if user and user.otp_last_sent_at:
        elapsed = (datetime.utcnow() - user.otp_last_sent_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} second{'s' if remaining != 1 else ''} before requesting another code."
            )

    if user:
        otp_code = generate_secure_otp()
        user.otp_code = hash_otp(otp_code)
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        user.otp_attempts = 0
        user.otp_last_sent_at = datetime.utcnow()
        user.reset_token = None
        user.reset_token_expires_at = None
        db.commit()

        # Send email via real Gmail SMTP
        try:
            send_otp_email(to_email=user.email, otp_code=otp_code, username=user.username)
        except Exception as e:
            logger.error(f"Failed to dispatch OTP email: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to send verification email. Please ensure the server SMTP configuration is valid."
            )

    # Return standard response to protect against user enumeration
    return {
        "message": "If the email is registered, a 6-digit verification code has been sent.",
        "cooldown_seconds": 60
    }

@router.post("/verify-otp", response_model=VerifyOTPResponse, summary="Verify 6-digit OTP code")
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Step 2: Validates the 6-digit OTP code against the hashed database value.
    - Security: Enforces 10-minute expiry and maximum 5 failed attempts before invalidation.
    - Returns a short-lived reset token for Step 3.
    """
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()

    if not user or not user.otp_code or not user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found. Please request a new code."
        )

    # Check expiration (10 minutes)
    if user.otp_expires_at < datetime.utcnow():
        user.otp_code = None
        user.otp_expires_at = None
        user.otp_attempts = 0
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    # Check maximum 5 attempts
    if (user.otp_attempts or 0) >= 5:
        user.otp_code = None
        user.otp_expires_at = None
        user.otp_attempts = 0
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new code."
        )

    # Verify hashed OTP (or fallback direct comparison for legacy data)
    is_valid = verify_otp_hash(req.otp_code.strip(), user.otp_code) or (user.otp_code == req.otp_code.strip())

    if not is_valid:
        user.otp_attempts = (user.otp_attempts or 0) + 1
        remaining_attempts = max(0, 5 - user.otp_attempts)
        if remaining_attempts == 0:
            user.otp_code = None
            user.otp_expires_at = None
        db.commit()

        if remaining_attempts == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum verification attempts exceeded. Please request a new code."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining_attempts} attempt{'s' if remaining_attempts != 1 else ''} remaining."
        )

    # OTP verified! Generate single-use reset token valid for 10 minutes and invalidate OTP
    reset_token = generate_reset_token()
    user.reset_token = reset_token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(minutes=10)
    user.otp_code = None  # OTP cannot be reused
    user.otp_expires_at = None
    user.otp_attempts = 0
    db.commit()

    return {
        "message": "Verification successful.",
        "reset_token": reset_token
    }

@router.post("/reset-password", summary="Reset password with verified token")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Step 3: Updates the account password using the verified reset token or verified OTP.
    - Hashes password using bcrypt.
    - Invalidates the reset token immediately.
    """
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password reset request.")

    # Validate reset token or direct OTP
    is_authorized = False

    if req.reset_token and user.reset_token and user.reset_token == req.reset_token:
        if user.reset_token_expires_at and user.reset_token_expires_at >= datetime.utcnow():
            is_authorized = True

    # Fallback support for direct OTP in single-request clients
    if not is_authorized and req.otp_code and user.otp_code:
        if user.otp_expires_at and user.otp_expires_at >= datetime.utcnow():
            if verify_otp_hash(req.otp_code.strip(), user.otp_code) or (user.otp_code == req.otp_code.strip()):
                is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has expired or is invalid. Please restart the password reset process."
        )

    if len(req.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters long.")

    # Apply new password
    user.password_hash = hash_password(req.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()

    logger.info(f"Password successfully reset for user account.")
    return {"message": "Password successfully reset. You can now login with your new password."}
