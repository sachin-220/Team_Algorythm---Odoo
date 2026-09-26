import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import (
    DeliveryOrder, DeliveryItem, DocumentStatus, Warehouse, Location, Product, User, UserRole
)
from app.schemas.all_schemas import (
    DeliveryCreate, DeliveryResponse, DeliveryItemResponse
)
from app.services.auth_service import get_current_user
from app.services.inventory_engine import InventoryEngine

router = APIRouter(prefix="/deliveries", tags=["Delivery Orders - Outgoing Stock"])

def _format_delivery_response(db: Session, d: DeliveryOrder) -> DeliveryResponse:
    items_res = []
    for item in d.items:
        avail = InventoryEngine.get_available_stock(db, item.product_id, d.warehouse_id, d.location_id)
        items_res.append(DeliveryItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_sku=item.product.sku if item.product else "",
            product_name=item.product.name if item.product else "",
            demand_qty=item.demand_qty,
            delivered_qty=item.delivered_qty,
            unit_price=item.unit_price,
            available_stock=avail
        ))
    return DeliveryResponse(
        id=d.id,
        reference_no=d.reference_no,
        customer_name=d.customer_name,
        warehouse_id=d.warehouse_id,
        warehouse_name=d.warehouse.name if d.warehouse else "",
        location_id=d.location_id,
        location_name=d.location.name if d.location else "",
        status=d.status,
        notes=d.notes,
        created_by_name=d.created_by.username if d.created_by else None,
        validated_by_name=d.validated_by.username if d.validated_by else None,
        items=items_res,
        created_at=d.created_at,
        updated_at=d.updated_at
    )

@router.get("/", response_model=List[DeliveryResponse])
def list_deliveries(
    search: Optional[str] = None,
    status_filter: Optional[DocumentStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(DeliveryOrder)
    if status_filter:
        query = query.filter(DeliveryOrder.status == status_filter)
    if search:
        query = query.filter(
            (DeliveryOrder.reference_no.ilike(f"%{search}%")) |
            (DeliveryOrder.customer_name.ilike(f"%{search}%"))
        )
    deliveries = query.order_by(DeliveryOrder.id.desc()).all()
    return [_format_delivery_response(db, d) for d in deliveries]

@router.get("/{delivery_id}", response_model=DeliveryResponse)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    d = db.query(DeliveryOrder).get(delivery_id)
    if not d:
        raise HTTPException(status_code=404, detail="Delivery order not found")
    return _format_delivery_response(db, d)

@router.post("/", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
def create_delivery(
    del_in: DeliveryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not db.query(Warehouse).get(del_in.warehouse_id):
        raise HTTPException(status_code=400, detail="Warehouse not found")
    if not db.query(Location).get(del_in.location_id):
        raise HTTPException(status_code=400, detail="Location not found")
    if not del_in.items:
        raise HTTPException(status_code=400, detail="Delivery order must contain at least one item")

    ref_no = f"DEL-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    d = DeliveryOrder(
        reference_no=ref_no,
        customer_name=del_in.customer_name,
        warehouse_id=del_in.warehouse_id,
        location_id=del_in.location_id,
        status=DocumentStatus.DRAFT,
        notes=del_in.notes,
        created_by_id=user.id
    )
    db.add(d)
    db.commit()

    for item in del_in.items:
        prod = db.query(Product).get(item.product_id)
        if not prod:
            raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")
        
        # Check stock preview
        avail = InventoryEngine.get_available_stock(db, item.product_id, del_in.warehouse_id, del_in.location_id)
        di = DeliveryItem(
            delivery_id=d.id,
            product_id=item.product_id,
            demand_qty=item.demand_qty,
            delivered_qty=item.delivered_qty or item.demand_qty,
            unit_price=item.unit_price or 0.0
        )
        db.add(di)

    db.commit()
    db.refresh(d)
    return _format_delivery_response(db, d)

@router.put("/{delivery_id}/status", response_model=DeliveryResponse)
def update_delivery_status(
    delivery_id: int,
    new_status: DocumentStatus,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    d = db.query(DeliveryOrder).get(delivery_id)
    if not d:
        raise HTTPException(status_code=404, detail="Delivery order not found")

    if d.status == DocumentStatus.DONE:
        raise HTTPException(status_code=400, detail="Cannot change status of a completed delivery")
    
    if new_status == DocumentStatus.DONE:
        raise HTTPException(status_code=400, detail="Use the /validate endpoint to complete delivery and decrease stock")

    d.status = new_status
    db.commit()
    db.refresh(d)
    return _format_delivery_response(db, d)

@router.post("/{delivery_id}/validate", response_model=DeliveryResponse)
def validate_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    d = db.query(DeliveryOrder).get(delivery_id)
    if not d:
        raise HTTPException(status_code=404, detail="Delivery order not found")

    updated_delivery = InventoryEngine.process_delivery_validation(db, d, user)
    return _format_delivery_response(db, updated_delivery)
