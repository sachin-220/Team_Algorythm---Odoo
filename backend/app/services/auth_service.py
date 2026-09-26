import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
import jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.all_models import User, UserRole
from app.schemas.all_schemas import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    if len(pwd_bytes) > 72:
        pwd_bytes = pwd_bytes[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')
    if len(pwd_bytes) > 72:
        pwd_bytes = pwd_bytes[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    jwt_secret = settings.get_jwt_secret()
    encoded_jwt = jwt.encode(to_encode, jwt_secret, algorithm=settings.ALGORITHM)
    return encoded_jwt

def generate_secure_otp() -> str:
    """Generates a cryptographically secure 6-digit numeric OTP."""
    num = secrets.randbelow(900000) + 100000
    return str(num)

def generate_otp() -> str:
    return generate_secure_otp()

def hash_otp(otp_code: str) -> str:
    """Returns a HMAC-SHA256 hash of the OTP for secure database storage."""
    secret = settings.get_jwt_secret().encode('utf-8')
    return hmac.new(secret, otp_code.encode('utf-8'), hashlib.sha256).hexdigest()

def verify_otp_hash(plain_otp: str, hashed_otp: Optional[str]) -> bool:
    """Constant-time verification of OTP code against stored hash."""
    if not hashed_otp or not plain_otp:
        return False
    computed = hash_otp(plain_otp)
    return hmac.compare_digest(computed, hashed_otp)

def generate_reset_token() -> str:
    """Generates a secure temporary token for reset password step."""
    return secrets.token_urlsafe(32)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        jwt_secret = settings.get_jwt_secret()
        payload = jwt.decode(token, jwt_secret, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=payload.get("role"))
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

def require_role(allowed_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker
