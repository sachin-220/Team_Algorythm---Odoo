import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import (
    InternalTransfer, TransferItem, DocumentStatus, Warehouse, Location, Product, User
)
from app.schemas.all_schemas import (
    TransferCreate, TransferResponse, TransferItemResponse
)
from app.services.auth_service import get_current_user
from app.services.inventory_engine import InventoryEngine

router = APIRouter(prefix="/transfers", tags=["Internal Transfers"])

def _format_transfer_response(db: Session, t: InternalTransfer) -> TransferResponse:
    items_res = []
    for item in t.items:
        avail_src = InventoryEngine.get_available_stock(db, item.product_id, t.src_warehouse_id, t.src_location_id)
        items_res.append(TransferItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_sku=item.product.sku if item.product else "",
            product_name=item.product.name if item.product else "",
            demand_qty=item.demand_qty,
            transferred_qty=item.transferred_qty,
            available_src_stock=avail_src
        ))
    return TransferResponse(
        id=t.id,
        reference_no=t.reference_no,
        src_warehouse_id=t.src_warehouse_id,
        src_warehouse_name=t.src_warehouse.name if t.src_warehouse else "",
        src_location_id=t.src_location_id,
        src_location_name=t.src_location.name if t.src_location else "",
        dest_warehouse_id=t.dest_warehouse_id,
        dest_warehouse_name=t.dest_warehouse.name if t.dest_warehouse else "",
        dest_location_id=t.dest_location_id,
        dest_location_name=t.dest_location.name if t.dest_location else "",
        status=t.status,
        notes=t.notes,
        created_by_name=t.created_by.username if t.created_by else None,
        validated_by_name=t.validated_by.username if t.validated_by else None,
        items=items_res,
        created_at=t.created_at,
        updated_at=t.updated_at
    )

@router.get("/", response_model=List[TransferResponse])
def list_transfers(
    search: Optional[str] = None,
    status_filter: Optional[DocumentStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(InternalTransfer)
    if status_filter:
        query = query.filter(InternalTransfer.status == status_filter)
    if search:
        query = query.filter(InternalTransfer.reference_no.ilike(f"%{search}%"))
    transfers = query.order_by(InternalTransfer.id.desc()).all()
    return [_format_transfer_response(db, t) for t in transfers]

@router.get("/{transfer_id}", response_model=TransferResponse)
def get_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    t = db.query(InternalTransfer).get(transfer_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return _format_transfer_response(db, t)

@router.post("/", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(
    tr_in: TransferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if tr_in.src_warehouse_id == tr_in.dest_warehouse_id and tr_in.src_location_id == tr_in.dest_location_id:
        raise HTTPException(status_code=400, detail="Source and Destination locations must be different")

    if not db.query(Warehouse).get(tr_in.src_warehouse_id) or not db.query(Warehouse).get(tr_in.dest_warehouse_id):
        raise HTTPException(status_code=400, detail="Source or Destination warehouse not found")

    if not tr_in.items:
        raise HTTPException(status_code=400, detail="Transfer must contain at least one item")

    ref_no = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    t = InternalTransfer(
        reference_no=ref_no,
        src_warehouse_id=tr_in.src_warehouse_id,
        src_location_id=tr_in.src_location_id,
        dest_warehouse_id=tr_in.dest_warehouse_id,
        dest_location_id=tr_in.dest_location_id,
        status=DocumentStatus.DRAFT,
        notes=tr_in.notes,
        created_by_id=user.id
    )
    db.add(t)
    db.commit()

    for item in tr_in.items:
        if not db.query(Product).get(item.product_id):
            raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not found")
        ti = TransferItem(
            transfer_id=t.id,
            product_id=item.product_id,
            demand_qty=item.demand_qty,
            transferred_qty=item.demand_qty
        )
        db.add(ti)

    db.commit()
    db.refresh(t)
    return _format_transfer_response(db, t)

@router.post("/{transfer_id}/confirm", response_model=TransferResponse)
def confirm_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    t = db.query(InternalTransfer).get(transfer_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")

    updated_transfer = InventoryEngine.process_transfer_validation(db, t, user)
    return _format_transfer_response(db, updated_transfer)
