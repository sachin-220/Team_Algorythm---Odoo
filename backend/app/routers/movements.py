from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import StockMovement, MovementType, User
from app.schemas.all_schemas import StockMovementResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/movements", tags=["Stock Ledger & Movements"])

def _format_movement_response(m: StockMovement) -> StockMovementResponse:
    return StockMovementResponse(
        id=m.id,
        movement_type=m.movement_type,
        product_id=m.product_id,
        product_sku=m.product.sku if m.product else "",
        product_name=m.product.name if m.product else "",
        quantity=m.quantity,
        src_warehouse_name=m.src_warehouse.name if m.src_warehouse else None,
        src_location_name=m.src_location.name if m.src_location else None,
        dest_warehouse_name=m.dest_warehouse.name if m.dest_warehouse else None,
        dest_location_name=m.dest_location.name if m.dest_location else None,
        reference_doc=m.reference_doc,
        user_name=m.user.username if m.user else None,
        timestamp=m.timestamp,
        reason=m.reason
    )

@router.get("/", response_model=List[StockMovementResponse])
def list_movements(
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    location_id: Optional[int] = None,
    movement_type: Optional[MovementType] = None,
    user_id: Optional[int] = None,
    reference_doc: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(StockMovement)

    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    if user_id:
        query = query.filter(StockMovement.user_id == user_id)
    if reference_doc:
        query = query.filter(StockMovement.reference_doc.ilike(f"%{reference_doc}%"))
    if warehouse_id:
        query = query.filter(
            (StockMovement.src_warehouse_id == warehouse_id) |
            (StockMovement.dest_warehouse_id == warehouse_id)
        )
    if location_id:
        query = query.filter(
            (StockMovement.src_location_id == location_id) |
            (StockMovement.dest_location_id == location_id)
        )
    if start_date:
        query = query.filter(StockMovement.timestamp >= start_date)
    if end_date:
        query = query.filter(StockMovement.timestamp <= end_date)

    movements = query.order_by(StockMovement.id.desc()).all()
    return [_format_movement_response(m) for m in movements]
