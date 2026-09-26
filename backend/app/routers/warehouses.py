from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import Warehouse, Location, User, UserRole
from app.schemas.all_schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    LocationCreate, LocationUpdate, LocationResponse
)
from app.services.auth_service import get_current_user, require_role

router = APIRouter(prefix="/warehouses", tags=["Warehouse & Location Management"])

# --- WAREHOUSES ---
@router.get("/", response_model=List[WarehouseResponse])
def list_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Warehouse).all()

@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    w = db.query(Warehouse).get(warehouse_id)
    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return w

@router.post("/", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    wh_in: WarehouseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    if db.query(Warehouse).filter(Warehouse.code == wh_in.code).first():
        raise HTTPException(status_code=400, detail=f"Warehouse code '{wh_in.code}' already exists")

    w = Warehouse(**wh_in.model_dump())
    db.add(w)
    db.commit()

    # Automatically create a default general location for the warehouse
    loc = Location(
        warehouse_id=w.id,
        name=f"{w.name} Main Rack",
        code=f"{w.code}-MAIN",
        type="Rack"
    )
    db.add(loc)
    db.commit()

    db.refresh(w)
    return w

@router.put("/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(
    warehouse_id: int,
    wh_in: WarehouseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    w = db.query(Warehouse).get(warehouse_id)
    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    update_data = wh_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != w.code:
        if db.query(Warehouse).filter(Warehouse.code == update_data["code"]).first():
            raise HTTPException(status_code=400, detail=f"Warehouse code '{update_data['code']}' already exists")

    for key, val in update_data.items():
        setattr(w, key, val)

    db.commit()
    db.refresh(w)
    return w

@router.delete("/{warehouse_id}")
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    w = db.query(Warehouse).get(warehouse_id)
    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    db.delete(w)
    db.commit()
    return {"message": "Warehouse deleted successfully"}

# --- LOCATIONS ---
@router.post("/{warehouse_id}/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    warehouse_id: int,
    loc_in: LocationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    w = db.query(Warehouse).get(warehouse_id)
    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    existing = db.query(Location).filter(
        Location.warehouse_id == warehouse_id,
        Location.code == loc_in.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Location code '{loc_in.code}' already exists in warehouse '{w.name}'")

    loc = Location(
        warehouse_id=warehouse_id,
        name=loc_in.name,
        code=loc_in.code,
        type=loc_in.type
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@router.put("/locations/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    loc_in: LocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    loc = db.query(Location).get(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    update_data = loc_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != loc.code:
        existing = db.query(Location).filter(
            Location.warehouse_id == loc.warehouse_id,
            Location.code == update_data["code"]
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Location code '{update_data['code']}' already exists in this warehouse")

    for key, val in update_data.items():
        setattr(loc, key, val)

    db.commit()
    db.refresh(loc)
    return loc

@router.delete("/locations/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    loc = db.query(Location).get(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(loc)
    db.commit()
    return {"message": "Location deleted successfully"}
