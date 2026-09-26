from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import Supplier, User, UserRole
from app.schemas.all_schemas import SupplierCreate, SupplierUpdate, SupplierResponse
from app.services.auth_service import get_current_user, require_role

router = APIRouter(prefix="/suppliers", tags=["Supplier Management"])

@router.get("/", response_model=List[SupplierResponse])
def list_suppliers(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Supplier)
    if search:
        query = query.filter(
            (Supplier.name.ilike(f"%{search}%")) |
            (Supplier.code.ilike(f"%{search}%")) |
            (Supplier.contact_person.ilike(f"%{search}%"))
        )
    return query.all()

@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = db.query(Supplier).get(supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return s

@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    sup_in: SupplierCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    if db.query(Supplier).filter(Supplier.code == sup_in.code).first():
        raise HTTPException(status_code=400, detail=f"Supplier code '{sup_in.code}' already exists")

    s = Supplier(**sup_in.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    sup_in: SupplierUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    s = db.query(Supplier).get(supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    update_data = sup_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != s.code:
        if db.query(Supplier).filter(Supplier.code == update_data["code"]).first():
            raise HTTPException(status_code=400, detail=f"Supplier code '{update_data['code']}' already exists")

    for key, val in update_data.items():
        setattr(s, key, val)

    db.commit()
    db.refresh(s)
    return s

@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    s = db.query(Supplier).get(supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(s)
    db.commit()
    return {"message": "Supplier deleted successfully"}
