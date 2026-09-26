import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import (
    InventoryAdjustment, AdjustmentItem, DocumentStatus, AdjustmentReason,
    Warehouse, Location, Product, User
)
from app.schemas.all_schemas import (
    AdjustmentCreate, AdjustmentResponse, AdjustmentItemResponse
)
from app.services.auth_service import get_current_user
from app.services.inventory_engine import InventoryEngine

router = APIRouter(prefix="/adjustments", tags=["Inventory Adjustments"])

def _format_adjustment_response(a: InventoryAdjustment) -> AdjustmentResponse:
    items_res = []
    for item in a.items:
        items_res.append(AdjustmentItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_sku=item.product.sku if item.product else "",
            product_name=item.product.name if item.product else "",
            theoretical_qty=item.theoretical_qty,
            physical_qty=item.physical_qty,
            difference_qty=item.difference_qty
        ))
    return AdjustmentResponse(
        id=a.id,
        reference_no=a.reference_no,
        warehouse_id=a.warehouse_id,
        warehouse_name=a.warehouse.name if a.warehouse else "",
        location_id=a.location_id,
        location_name=a.location.name if a.location else "",
        status=a.status,
        reason=a.reason,
        notes=a.notes,
        created_by_name=a.created_by.username if a.created_by else None,
        items=items_res,
        created_at=a.created_at
    )

@router.get("/", response_model=List[AdjustmentResponse])
def list_adjustments(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(InventoryAdjustment)
    if search:
        query = query.filter(InventoryAdjustment.reference_no.ilike(f"%{search}%"))
    adjustments = query.order_by(InventoryAdjustment.id.desc()).all()
    return [_format_adjustment_response(a) for a in adjustments]

@router.get("/{adjustment_id}", response_model=AdjustmentResponse)
def get_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(InventoryAdjustment).get(adjustment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    return _format_adjustment_response(a)

@router.post("/", response_model=AdjustmentResponse, status_code=status.HTTP_201_CREATED)
def create_adjustment(
    adj_in: AdjustmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not db.query(Warehouse).get(adj_in.warehouse_id):
        raise HTTPException(status_code=400, detail="Warehouse not found")
    if not db.query(Location).get(adj_in.location_id):
        raise HTTPException(status_code=400, detail="Location not found")
    if not adj_in.items:
        raise HTTPException(status_code=400, detail="Adjustment must contain at least one item")

    ref_no = f"ADJ-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    a = InventoryAdjustment(
        reference_no=ref_no,
        warehouse_id=adj_in.warehouse_id,
        location_id=adj_in.location_id,
        status=DocumentStatus.DRAFT,
        reason=adj_in.reason,
        notes=adj_in.notes,
        created_by_id=user.id
    )
    db.add(a)
    db.commit()

    for item in adj_in.items:
        prod = db.query(Product).get(item.product_id)
        if not prod:
            raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")

        current_theoretical = InventoryEngine.get_available_stock(
            db, item.product_id, adj_in.warehouse_id, adj_in.location_id
        )
        diff = item.physical_qty - current_theoretical

        ai = AdjustmentItem(
            adjustment_id=a.id,
            product_id=item.product_id,
            theoretical_qty=current_theoretical,
            physical_qty=item.physical_qty,
            difference_qty=diff
        )
        db.add(ai)

    db.commit()
    db.refresh(a)
    return _format_adjustment_response(a)

@router.post("/{adjustment_id}/confirm", response_model=AdjustmentResponse)
def confirm_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    a = db.query(InventoryAdjustment).get(adjustment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    updated_adj = InventoryEngine.process_adjustment_confirmation(db, a, user)
    return _format_adjustment_response(updated_adj)
