from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import (
    Product, StockQuant, Receipt, DeliveryOrder, InternalTransfer, StockMovement, DocumentStatus, User
)
from app.schemas.all_schemas import DashboardKPIs
from app.services.auth_service import get_current_user
from app.routers.products import _format_product_response
from app.routers.movements import _format_movement_response

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/kpis", response_model=DashboardKPIs)
def get_dashboard_kpis(
    warehouse_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Total products & stock calculation
    prod_query = db.query(Product)
    if category_id:
        prod_query = prod_query.filter(Product.category_id == category_id)
    all_prods = prod_query.all()

    total_products = len(all_prods)
    low_stock_count = 0
    out_of_stock_count = 0
    total_qty = 0.0
    low_stock_products = []

    for p in all_prods:
        quant_query = db.query(StockQuant).filter(StockQuant.product_id == p.id)
        if warehouse_id:
            quant_query = quant_query.filter(StockQuant.warehouse_id == warehouse_id)
        quants = quant_query.all()
        stock = sum(q.quantity for q in quants)
        total_qty += stock

        if stock == 0:
            out_of_stock_count += 1
            low_stock_products.append(_format_product_response(db, p))
        elif stock <= p.min_stock:
            low_stock_count += 1
            low_stock_products.append(_format_product_response(db, p))

    # Pending Receipts
    rec_query = db.query(Receipt).filter(Receipt.status.in_([DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY]))
    if warehouse_id:
        rec_query = rec_query.filter(Receipt.warehouse_id == warehouse_id)
    pending_receipts = rec_query.count()

    # Pending Deliveries
    del_query = db.query(DeliveryOrder).filter(DeliveryOrder.status.in_([DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY]))
    if warehouse_id:
        del_query = del_query.filter(DeliveryOrder.warehouse_id == warehouse_id)
    pending_deliveries = del_query.count()

    # Pending Transfers
    tr_query = db.query(InternalTransfer).filter(InternalTransfer.status.in_([DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY]))
    if warehouse_id:
        tr_query = tr_query.filter((InternalTransfer.src_warehouse_id == warehouse_id) | (InternalTransfer.dest_warehouse_id == warehouse_id))
    pending_transfers = tr_query.count()

    # Recent movements
    recent_m = db.query(StockMovement).order_by(StockMovement.id.desc()).limit(10).all()
    recent_movements = [_format_movement_response(m) for m in recent_m]

    return DashboardKPIs(
        total_products_in_stock=total_products,
        total_stock_quantity=total_qty,
        low_stock_items_count=low_stock_count,
        out_of_stock_items_count=out_of_stock_count,
        pending_receipts_count=pending_receipts,
        pending_deliveries_count=pending_deliveries,
        pending_transfers_count=pending_transfers,
        recent_movements=recent_movements,
        low_stock_products=low_stock_products[:5]
    )
