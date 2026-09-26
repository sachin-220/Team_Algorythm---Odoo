from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import User, UserRole
from app.schemas.all_schemas import UserResponse
from app.services.auth_service import require_role

router = APIRouter(prefix="/users", tags=["Users Management"])

@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role([UserRole.ADMIN]))
):
    return db.query(User).all()

@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role: UserRole,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role([UserRole.ADMIN]))
):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role([UserRole.ADMIN]))
):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own admin account")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
