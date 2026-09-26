from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.all_models import (
    Product, StockQuant, Receipt, ReceiptItem, DeliveryOrder, DeliveryItem,
    InternalTransfer, StockMovement, MovementType, DocumentStatus, Warehouse, Location, Category, User
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics Engine"])

def _get_date_cutoff(time_range: str) -> datetime:
    now = datetime.utcnow()
    if time_range == "7D":
        return now - timedelta(days=7)
    elif time_range == "30D":
        return now - timedelta(days=30)
    elif time_range == "90D":
        return now - timedelta(days=90)
    elif time_range == "1Y":
        return now - timedelta(days=365)
    return now - timedelta(days=30)  # Default 30D

def _get_product_unit_val(db: Session, product_id: int) -> float:
    # Try receipt price first, then delivery price, default 50.0
    rec_item = db.query(ReceiptItem).filter(ReceiptItem.product_id == product_id, ReceiptItem.unit_price > 0).first()
    if rec_item and rec_item.unit_price:
        return rec_item.unit_price
    del_item = db.query(DeliveryItem).filter(DeliveryItem.product_id == product_id, DeliveryItem.unit_price > 0).first()
    if del_item and del_item.unit_price:
        return del_item.unit_price
    return 45.0  # Default estimate

@router.get("/dashboard-full")
def get_full_analytics(
    time_range: str = Query("30D", pattern="^(7D|30D|90D|1Y|CUSTOM)$"),
    warehouse_id: Optional[int] = None,
    location_id: Optional[int] = None,
    category_id: Optional[int] = None,
    product_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if time_range != "CUSTOM" or not start_date:
        cutoff = _get_date_cutoff(time_range)
    else:
        cutoff = start_date

    end_cutoff = end_date if end_date else datetime.utcnow()

    # Base Product Query
    prod_query = db.query(Product)
    if category_id:
        prod_query = prod_query.filter(Product.category_id == category_id)
    if product_id:
        prod_query = prod_query.filter(Product.id == product_id)
    products = prod_query.all()

    total_inventory_value = 0.0
    total_stock_units = 0.0
    low_stock_count = 0
    out_of_stock_count = 0
    product_stock_map = {}

    for p in products:
        unit_val = _get_product_unit_val(db, p.id)
        q_query = db.query(StockQuant).filter(StockQuant.product_id == p.id)
        if warehouse_id:
            q_query = q_query.filter(StockQuant.warehouse_id == warehouse_id)
        if location_id:
            q_query = q_query.filter(StockQuant.location_id == location_id)
        quants = q_query.all()
        stock = sum(q.quantity for q in quants)

        total_stock_units += stock
        item_val = stock * unit_val
        total_inventory_value += item_val
        product_stock_map[p.id] = {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "stock": stock,
            "unit_price": unit_val,
            "total_value": item_val,
            "min_stock": p.min_stock,
            "max_stock": p.max_stock,
            "reorder_qty": p.reorder_qty,
            "uom": p.uom
        }

        if stock == 0:
            out_of_stock_count += 1
        elif stock <= p.min_stock:
            low_stock_count += 1

    # Movement Queries within Time Cutoff
    mv_query = db.query(StockMovement).filter(
        StockMovement.timestamp >= cutoff,
        StockMovement.timestamp <= end_cutoff
    )
    if warehouse_id:
        mv_query = mv_query.filter(
            (StockMovement.src_warehouse_id == warehouse_id) |
            (StockMovement.dest_warehouse_id == warehouse_id)
        )
    if location_id:
        mv_query = mv_query.filter(
            (StockMovement.src_location_id == location_id) |
            (StockMovement.dest_location_id == location_id)
        )
    if product_id:
        mv_query = mv_query.filter(StockMovement.product_id == product_id)
    movements = mv_query.all()

    stock_inflow = sum(m.quantity for m in movements if m.movement_type == MovementType.INCOMING)
    stock_outflow = sum(m.quantity for m in movements if m.movement_type == MovementType.OUTGOING)

    # Document Pending Counts
    rec_q = db.query(Receipt).filter(Receipt.status.in_([DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY]))
    if warehouse_id: rec_q = rec_q.filter(Receipt.warehouse_id == warehouse_id)
    pending_receipts = rec_q.count()

    del_q = db.query(DeliveryOrder).filter(DeliveryOrder.status.in_([DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY]))
    if warehouse_id: del_q = del_q.filter(DeliveryOrder.warehouse_id == warehouse_id)
    pending_deliveries = del_q.count()

    tr_q = db.query(InternalTransfer).filter(InternalTransfer.status.in_([DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.READY]))
    if warehouse_id: tr_q = tr_q.filter((InternalTransfer.src_warehouse_id == warehouse_id) | (InternalTransfer.dest_warehouse_id == warehouse_id))
    scheduled_transfers = tr_q.count()

    # 1. Inflow vs Outflow Trend Chart
    days_count = max(1, (end_cutoff - cutoff).days)
    daily_stats = {}
    for i in range(days_count + 1):
        d_str = (cutoff + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_stats[d_str] = {"date": d_str, "inflow": 0.0, "outflow": 0.0, "transfer": 0.0, "adjustment": 0.0}

    for m in movements:
        d_str = m.timestamp.strftime("%Y-%m-%d")
        if d_str in daily_stats:
            if m.movement_type == MovementType.INCOMING:
                daily_stats[d_str]["inflow"] += m.quantity
            elif m.movement_type == MovementType.OUTGOING:
                daily_stats[d_str]["outflow"] += m.quantity
            elif m.movement_type == MovementType.TRANSFER:
                daily_stats[d_str]["transfer"] += m.quantity
            elif m.movement_type == MovementType.ADJUSTMENT:
                daily_stats[d_str]["adjustment"] += abs(m.quantity)

    inflow_outflow_trend = list(daily_stats.values())

    # 2. Inventory Value Trend (running cumulative estimate over time)
    val_trend = []
    accumulated_val = total_inventory_value
    for d_obj in reversed(inflow_outflow_trend):
        val_trend.append({
            "date": d_obj["date"],
            "value": round(accumulated_val, 2),
            "units": round(total_stock_units, 2)
        })
        accumulated_val -= (d_obj["inflow"] * 45.0 - d_obj["outflow"] * 45.0)
    val_trend.reverse()

    # 3. Warehouse Distribution Chart
    wh_query = db.query(Warehouse).all()
    warehouse_distribution = []
    for wh in wh_query:
        wh_quants = db.query(StockQuant).filter(StockQuant.warehouse_id == wh.id).all()
        wh_units = sum(q.quantity for q in wh_quants)
        wh_val = sum(q.quantity * _get_product_unit_val(db, q.product_id) for q in wh_quants)
        if wh_units > 0 or not warehouse_id or warehouse_id == wh.id:
            warehouse_distribution.append({
                "warehouse_name": wh.name,
                "code": wh.code,
                "units": wh_units,
                "value": round(wh_val, 2)
            })

    # 4. Stock Health Breakdown
    stock_health = [
        {"name": "In Stock (Normal)", "value": len([p for p in products if product_stock_map[p.id]["stock"] > p.min_stock and product_stock_map[p.id]["stock"] < p.max_stock]), "color": "#10b981"},
        {"name": "Low Stock", "value": low_stock_count, "color": "#f59e0b"},
        {"name": "Out of Stock", "value": out_of_stock_count, "color": "#ef4444"},
        {"name": "Over Stock", "value": len([p for p in products if product_stock_map[p.id]["stock"] >= p.max_stock]), "color": "#6366f1"}
    ]

    # 5. Inventory Velocity Classification
    prod_movement_counts = {}
    for m in movements:
        prod_movement_counts[m.product_id] = prod_movement_counts.get(m.product_id, 0) + m.quantity

    fast_moving, medium_moving, slow_moving, dead_stock = 0, 0, 0, 0
    top_moving_prods = []

    for p in products:
        moved_qty = prod_movement_counts.get(p.id, 0)
        p_info = product_stock_map[p.id]
        p_info["moved_qty"] = moved_qty
        top_moving_prods.append(p_info)

        if moved_qty >= 50:
            fast_moving += 1
        elif moved_qty >= 10:
            medium_moving += 1
        elif moved_qty > 0:
            slow_moving += 1
        else:
            dead_stock += 1

    velocity_breakdown = [
        {"category": "Fast Moving (>50 units)", "count": fast_moving, "color": "#10b981"},
        {"category": "Medium Moving (10-50 units)", "count": medium_moving, "color": "#3b82f6"},
        {"category": "Slow Moving (1-10 units)", "count": slow_moving, "color": "#f59e0b"},
        {"category": "Dead Stock (0 units)", "count": dead_stock, "color": "#ef4444"}
    ]

    # 6. ABC Analysis (Pareto classification by inventory value)
    sorted_by_val = sorted(product_stock_map.values(), key=lambda x: x["total_value"], reverse=True)
    running_sum = 0.0
    abc_classification = []

    for item in sorted_by_val:
        running_sum += item["total_value"]
        pct = (running_sum / max(1.0, total_inventory_value)) * 100
        category = "A (High Value)" if pct <= 80 else ("B (Medium Value)" if pct <= 95 else "C (Low Value)")
        abc_classification.append({
            "name": item["name"],
            "sku": item["sku"],
            "value": round(item["total_value"], 2),
            "percentage": round(pct, 1),
            "abc_class": category
        })

    # 7. Reorder Risk Matrix
    risk_matrix = []
    for p in products:
        p_info = product_stock_map[p.id]
        stock_ratio = p_info["stock"] / max(1.0, p.min_stock)
        risk_level = "CRITICAL" if p_info["stock"] == 0 else ("HIGH" if stock_ratio <= 1.0 else ("MEDIUM" if stock_ratio <= 1.5 else "LOW"))
        risk_matrix.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "current_stock": p_info["stock"],
            "min_stock": p.min_stock,
            "max_stock": p.max_stock,
            "reorder_qty": p.reorder_qty,
            "risk_level": risk_level,
            "stock_ratio": round(stock_ratio, 2)
        })

    # Top/Bottom Moving Products
    top_moving_prods.sort(key=lambda x: x["moved_qty"], reverse=True)
    top_5 = top_moving_prods[:5]
    bottom_5 = list(reversed(top_moving_prods))[:5]

    return {
        "kpis": {
            "inventory_value": round(total_inventory_value, 2),
            "total_stock_units": round(total_stock_units, 2),
            "stock_inflow": stock_inflow,
            "stock_outflow": stock_outflow,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "pending_receipts": pending_receipts,
            "pending_deliveries": pending_deliveries,
            "scheduled_transfers": scheduled_transfers
        },
        "charts": {
            "value_trend": val_trend,
            "inflow_outflow_trend": inflow_outflow_trend,
            "warehouse_distribution": warehouse_distribution,
            "stock_health": stock_health,
            "velocity_breakdown": velocity_breakdown,
            "abc_analysis": abc_classification,
            "reorder_risk_matrix": risk_matrix,
            "top_moving": top_5,
            "bottom_moving": bottom_5
        }
    }
