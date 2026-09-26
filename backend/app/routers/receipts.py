import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import (
    Receipt, ReceiptItem, DocumentStatus, Supplier, Warehouse, Location, Product, User, UserRole
)
from app.schemas.all_schemas import (
    ReceiptCreate, ReceiptResponse, ReceiptItemResponse
)
from app.services.auth_service import get_current_user
from app.services.inventory_engine import InventoryEngine

router = APIRouter(prefix="/receipts", tags=["Receipts - Incoming Stock"])

def _format_receipt_response(r: Receipt) -> ReceiptResponse:
    items_res = []
    for item in r.items:
        items_res.append(ReceiptItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_sku=item.product.sku if item.product else "",
            product_name=item.product.name if item.product else "",
            demand_qty=item.demand_qty,
            received_qty=item.received_qty,
            unit_price=item.unit_price
        ))
    return ReceiptResponse(
        id=r.id,
        reference_no=r.reference_no,
        supplier_id=r.supplier_id,
        supplier_name=r.supplier.name if r.supplier else "",
        warehouse_id=r.warehouse_id,
        warehouse_name=r.warehouse.name if r.warehouse else "",
        location_id=r.location_id,
        location_name=r.location.name if r.location else "",
        status=r.status,
        notes=r.notes,
        created_by_name=r.created_by.username if r.created_by else None,
        validated_by_name=r.validated_by.username if r.validated_by else None,
        items=items_res,
        created_at=r.created_at,
        updated_at=r.updated_at
    )

@router.get("/", response_model=List[ReceiptResponse])
def list_receipts(
    search: Optional[str] = None,
    status_filter: Optional[DocumentStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Receipt)
    if status_filter:
        query = query.filter(Receipt.status == status_filter)
    if search:
        query = query.filter(Receipt.reference_no.ilike(f"%{search}%"))
    receipts = query.order_by(Receipt.id.desc()).all()
    return [_format_receipt_response(r) for r in receipts]

@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(Receipt).get(receipt_id)
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return _format_receipt_response(r)

@router.post("/", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_receipt(
    rec_in: ReceiptCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not db.query(Supplier).get(rec_in.supplier_id):
        raise HTTPException(status_code=400, detail="Supplier not found")
    if not db.query(Warehouse).get(rec_in.warehouse_id):
        raise HTTPException(status_code=400, detail="Warehouse not found")
    if not db.query(Location).get(rec_in.location_id):
        raise HTTPException(status_code=400, detail="Location not found")
    if not rec_in.items:
        raise HTTPException(status_code=400, detail="Receipt must contain at least one product line")

    ref_no = f"REC-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    r = Receipt(
        reference_no=ref_no,
        supplier_id=rec_in.supplier_id,
        warehouse_id=rec_in.warehouse_id,
        location_id=rec_in.location_id,
        status=DocumentStatus.DRAFT,
        notes=rec_in.notes,
        created_by_id=user.id
    )
    db.add(r)
    db.commit()

    for item in rec_in.items:
        if not db.query(Product).get(item.product_id):
            raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")
        ri = ReceiptItem(
            receipt_id=r.id,
            product_id=item.product_id,
            demand_qty=item.demand_qty,
            received_qty=item.received_qty or item.demand_qty,
            unit_price=item.unit_price or 0.0
        )
        db.add(ri)

    db.commit()
    db.refresh(r)
    return _format_receipt_response(r)

@router.put("/{receipt_id}/status", response_model=ReceiptResponse)
def update_receipt_status(
    receipt_id: int,
    new_status: DocumentStatus,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    r = db.query(Receipt).get(receipt_id)
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")

    if r.status == DocumentStatus.DONE:
        raise HTTPException(status_code=400, detail="Cannot change status of a completed receipt")
    
    if new_status == DocumentStatus.DONE:
        raise HTTPException(status_code=400, detail="Use the /validate endpoint to complete receipt and increase stock")

    r.status = new_status
    db.commit()
    db.refresh(r)
    return _format_receipt_response(r)

@router.post("/{receipt_id}/validate", response_model=ReceiptResponse)
def validate_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    r = db.query(Receipt).get(receipt_id)
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")

    updated_receipt = InventoryEngine.process_receipt_validation(db, r, user)
    return _format_receipt_response(updated_receipt)
