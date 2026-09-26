import os
import re
import json
import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from rapidfuzz import fuzz, process

from app.database import get_db
from app.models.all_models import (
    Product, StockQuant, Supplier, Warehouse, Location, Receipt, ReceiptItem,
    DeliveryOrder, DeliveryItem, InternalTransfer, TransferItem, InventoryAdjustment, AdjustmentItem,
    StockMovement, DocumentStatus, AdjustmentReason, User, UserRole
)
from app.services.auth_service import get_current_user
from app.services.inventory_engine import InventoryEngine
from app.routers.analytics import get_full_analytics

router = APIRouter(prefix="/copilot", tags=["Agentic Inventory Copilot"])

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    action_preview: Optional[Dict[str, Any]] = None
    chart_data: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_prompt: str

class ExecuteActionRequest(BaseModel):
    action_type: str  # "CREATE_RECEIPT", "CREATE_DELIVERY", "CREATE_TRANSFER", "CREATE_ADJUSTMENT"
    action_payload: Dict[str, Any]

def _load_gemini_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY")
    if key: return key
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        return line.split("=", 1)[1].strip()
        except Exception: pass
    return ""

# --- TOOL IMPLEMENTATIONS ---
def tool_get_stock_status(db: Session, query_term: Optional[str] = None) -> List[Dict[str, Any]]:
    p_query = db.query(Product)
    if query_term:
        p_query = p_query.filter(
            (Product.name.ilike(f"%{query_term}%")) | (Product.sku.ilike(f"%{query_term}%"))
        )
    prods = p_query.all()
    res = []
    for p in prods:
        quants = db.query(StockQuant).filter(StockQuant.product_id == p.id).all()
        stock = sum(q.quantity for q in quants)
        status_str = "OUT_OF_STOCK" if stock == 0 else ("LOW_STOCK" if stock <= p.min_stock else "NORMAL")
        res.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "current_stock": stock,
            "min_stock": p.min_stock,
            "max_stock": p.max_stock,
            "uom": p.uom,
            "status": status_str,
            "locations": [{"warehouse": q.warehouse.name, "location": q.location.name, "quantity": q.quantity} for q in quants]
        })
    return res

def tool_get_low_stock(db: Session) -> List[Dict[str, Any]]:
    all_prods = tool_get_stock_status(db)
    return [p for p in all_prods if p["status"] in ["LOW_STOCK", "OUT_OF_STOCK"]]

def tool_get_movements_history(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
    movements = db.query(StockMovement).order_by(StockMovement.id.desc()).limit(limit).all()
    return [{
        "id": m.id,
        "type": m.movement_type.value,
        "product": m.product.name if m.product else "",
        "sku": m.product.sku if m.product else "",
        "quantity": m.quantity,
        "reference_doc": m.reference_doc,
        "timestamp": m.timestamp.strftime("%Y-%m-%d %H:%M:%S")
    } for m in movements]

def tool_build_action_preview(db: Session, user_prompt: str) -> Optional[Dict[str, Any]]:
    prompt_lower = user_prompt.lower()
    
    # 1. Receipt Creation Intent
    if any(k in prompt_lower for k in ["create receipt", "new receipt", "receive stock", "add receipt"]):
        sups = db.query(Supplier).all()
        whs = db.query(Warehouse).all()
        prods = db.query(Product).all()
        
        sup_target = sups[0] if sups else None
        wh_target = whs[0] if whs else None
        loc_target = wh_target.locations[0] if wh_target and wh_target.locations else None
        prod_target = prods[0] if prods else None
        
        qty_m = re.search(r'\b(\d+)\b', prompt_lower)
        qty = float(qty_m.group(1)) if qty_m else 20.0

        return {
            "action_type": "CREATE_RECEIPT",
            "title": "Action Preview: Create & Validate Incoming Receipt",
            "description": f"Create incoming stock receipt for '{prod_target.name if prod_target else 'Product'}' at '{wh_target.name if wh_target else 'Warehouse'}'.",
            "payload": {
                "supplier_id": sup_target.id if sup_target else 1,
                "supplier_name": sup_target.name if sup_target else "Supplier",
                "warehouse_id": wh_target.id if wh_target else 1,
                "warehouse_name": wh_target.name if wh_target else "Main WH",
                "location_id": loc_target.id if loc_target else 1,
                "location_name": loc_target.name if loc_target else "Main Rack",
                "invoice_number": f"REC-AI-{secrets.token_hex(2).upper()}",
                "auto_validate": True,
                "items": [{
                    "product_id": prod_target.id if prod_target else 1,
                    "product_name": prod_target.name if prod_target else "Item",
                    "product_sku": prod_target.sku if prod_target else "SKU",
                    "demand_qty": qty,
                    "unit_price": 45.0
                }]
            }
        }

    # 2. Delivery Creation Intent
    elif any(k in prompt_lower for k in ["create delivery", "new delivery", "send stock", "dispatch stock"]):
        whs = db.query(Warehouse).all()
        prods = db.query(Product).all()
        
        wh_target = whs[0] if whs else None
        loc_target = wh_target.locations[0] if wh_target and wh_target.locations else None
        prod_target = prods[0] if prods else None

        qty_m = re.search(r'\b(\d+)\b', prompt_lower)
        qty = float(qty_m.group(1)) if qty_m else 5.0

        return {
            "action_type": "CREATE_DELIVERY",
            "title": "Action Preview: Create & Validate Delivery Order",
            "description": f"Dispatch '{qty}' units of '{prod_target.name if prod_target else 'Item'}' from '{wh_target.name if wh_target else 'Warehouse'}'.",
            "payload": {
                "customer_name": "Acme Logistics Corp",
                "warehouse_id": wh_target.id if wh_target else 1,
                "warehouse_name": wh_target.name if wh_target else "Main WH",
                "location_id": loc_target.id if loc_target else 1,
                "location_name": loc_target.name if loc_target else "Main Rack",
                "auto_validate": True,
                "items": [{
                    "product_id": prod_target.id if prod_target else 1,
                    "product_name": prod_target.name if prod_target else "Item",
                    "product_sku": prod_target.sku if prod_target else "SKU",
                    "demand_qty": qty,
                    "unit_price": 120.0
                }]
            }
        }

    # 3. Internal Transfer Intent
    elif any(k in prompt_lower for k in ["create transfer", "internal transfer", "move stock"]):
        whs = db.query(Warehouse).all()
        prods = db.query(Product).all()

        src_wh = whs[0] if whs else None
        src_loc = src_wh.locations[0] if src_wh and src_wh.locations else None
        dest_wh = whs[1] if len(whs) > 1 else src_wh
        dest_loc = dest_wh.locations[0] if dest_wh and dest_wh.locations else src_loc
        prod_target = prods[0] if prods else None

        return {
            "action_type": "CREATE_TRANSFER",
            "title": "Action Preview: Execute Internal Stock Relocation",
            "description": f"Relocate stock from '{src_wh.name if src_wh else 'WH1'}' to '{dest_wh.name if dest_wh else 'WH2'}'.",
            "payload": {
                "src_warehouse_id": src_wh.id if src_wh else 1,
                "src_warehouse_name": src_wh.name if src_wh else "WH1",
                "src_location_id": src_loc.id if src_loc else 1,
                "src_location_name": src_loc.name if src_loc else "Loc1",
                "dest_warehouse_id": dest_wh.id if dest_wh else 1,
                "dest_warehouse_name": dest_wh.name if dest_wh else "WH2",
                "dest_location_id": dest_loc.id if dest_loc else 1,
                "dest_location_name": dest_loc.name if dest_loc else "Loc2",
                "auto_confirm": True,
                "items": [{
                    "product_id": prod_target.id if prod_target else 1,
                    "product_name": prod_target.name if prod_target else "Item",
                    "product_sku": prod_target.sku if prod_target else "SKU",
                    "demand_qty": 5.0
                }]
            }
        }

    return None

@router.post("/chat", response_model=ChatMessage)
def copilot_chat_handler(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_prompt = req.user_prompt.strip()
    prompt_lower = user_prompt.lower()

    action_preview = tool_build_action_preview(db, user_prompt)
    chart_data = None

    # Check if user requests trend/historical analytics chart
    if any(k in prompt_lower for k in ["trend", "analytics", "chart", "fastest", "velocity", "distribution", "health", "valuation"]):
        analytics_res = get_full_analytics("30D", None, None, None, None, None, None, db, current_user)
        chart_data = {
            "title": "StockSense Inventory Analytics & Trend Data",
            "value_trend": analytics_res["charts"]["value_trend"],
            "inflow_outflow_trend": analytics_res["charts"]["inflow_outflow_trend"],
            "stock_health": analytics_res["charts"]["stock_health"]
        }

    # Intent routing to safe read tools
    if "low" in prompt_lower or "out of stock" in prompt_lower:
        low_items = tool_get_low_stock(db)
        if low_items:
            items_str = "\n".join([f"• **{item['name']}** ({item['sku']}): Stock = **{item['current_stock']} {item['uom']}** (Status: `{item['status']}`)" for item in low_items])
            answer = f"🔍 **Low / Out-of-Stock Items Analysis:**\nFound **{len(low_items)}** item(s) requiring attention:\n\n{items_str}\n\n*Recommendation: Create a purchase receipt or trigger a reorder rule to replenish minimum safety thresholds.*"
        else:
            answer = "✓ All inventory products are currently above minimum safety stock levels!"

    elif "movement" in prompt_lower or "ledger" in prompt_lower or "history" in prompt_lower:
        mvs = tool_get_movements_history(db, 6)
        mvs_str = "\n".join([f"• **[{m['type']}]** `{m['reference_doc']}` — {m['product']} ({m['sku']}): **{m['quantity']}** units @ {m['timestamp']}" for m in mvs])
        answer = f"📜 **Recent Stock Ledger Audit Trail:**\n\n{mvs_str}"

    elif "warehouse" in prompt_lower or "location" in prompt_lower:
        whs = db.query(Warehouse).all()
        wh_str = []
        for w in whs:
            quants = db.query(StockQuant).filter(StockQuant.warehouse_id == w.id).all()
            total_u = sum(q.quantity for q in quants)
            wh_str.append(f"• **{w.name}** (`{w.code}`): **{total_u}** total units across {len(w.locations)} location racks.")
        answer = "🏢 **Warehouse Facilities Overview:**\n\n" + "\n".join(wh_str)

    elif action_preview:
        answer = f"🤖 **Agentic Action Draft Prepared:**\nI have generated a structured action preview for **{action_preview['action_type']}**. Please review the action card below and click **Confirm Action** to execute through StockSense InventoryEngine."

    else:
        # Default smart summary
        stocks = tool_get_stock_status(db)
        total_units = sum(s["current_stock"] for s in stocks)
        answer = f"👋 Hello **{current_user.username}**! I am your **StockSense Agentic Copilot**.\n\n" \
                 f"• Total Master Products: **{len(stocks)}**\n" \
                 f"• Total Physical Units: **{total_units}**\n\n" \
                 f"You can ask me to check low stock, show warehouse balances, view audit movement history, analyze trends, or create receipts, deliveries, and transfers!"

    return ChatMessage(
        role="assistant",
        content=answer,
        action_preview=action_preview,
        chart_data=chart_data
    )

@router.post("/execute-action")
def execute_copilot_confirmed_action(
    req: ExecuteActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    action_type = req.action_type
    payload = req.action_payload

    try:
        if action_type == "CREATE_RECEIPT":
            ref_no = payload.get("invoice_number", f"REC-AI-{secrets.token_hex(2).upper()}")
            receipt = Receipt(
                reference_no=ref_no,
                supplier_id=payload["supplier_id"],
                warehouse_id=payload["warehouse_id"],
                location_id=payload["location_id"],
                status=DocumentStatus.DRAFT,
                notes="Executed via StockSense Agentic Copilot",
                created_by_id=user.id
            )
            db.add(receipt)
            db.commit()

            for item in payload.get("items", []):
                ri = ReceiptItem(
                    receipt_id=receipt.id,
                    product_id=item["product_id"],
                    demand_qty=item["demand_qty"],
                    received_qty=item["demand_qty"],
                    unit_price=item.get("unit_price", 0.0)
                )
                db.add(ri)
            db.commit()

            if payload.get("auto_validate", True):
                receipt = InventoryEngine.process_receipt_validation(db, receipt, user)

            return {
                "success": True,
                "message": f"Receipt #{receipt.reference_no} created and stock updated successfully via InventoryEngine!",
                "receipt_id": receipt.id
            }

        elif action_type == "CREATE_DELIVERY":
            ref_no = f"DEL-AI-{secrets.token_hex(2).upper()}"
            delivery = DeliveryOrder(
                reference_no=ref_no,
                customer_name=payload.get("customer_name", "Acme Corp"),
                warehouse_id=payload["warehouse_id"],
                location_id=payload["location_id"],
                status=DocumentStatus.DRAFT,
                notes="Executed via StockSense Agentic Copilot",
                created_by_id=user.id
            )
            db.add(delivery)
            db.commit()

            for item in payload.get("items", []):
                di = DeliveryItem(
                    delivery_id=delivery.id,
                    product_id=item["product_id"],
                    demand_qty=item["demand_qty"],
                    delivered_qty=item["demand_qty"],
                    unit_price=item.get("unit_price", 0.0)
                )
                db.add(di)
            db.commit()

            if payload.get("auto_validate", True):
                delivery = InventoryEngine.process_delivery_validation(db, delivery, user)

            return {
                "success": True,
                "message": f"Delivery Order #{delivery.reference_no} dispatched and stock updated via InventoryEngine!",
                "delivery_id": delivery.id
            }

        elif action_type == "CREATE_TRANSFER":
            ref_no = f"TRF-AI-{secrets.token_hex(2).upper()}"
            transfer = InternalTransfer(
                reference_no=ref_no,
                src_warehouse_id=payload["src_warehouse_id"],
                src_location_id=payload["src_location_id"],
                dest_warehouse_id=payload["dest_warehouse_id"],
                dest_location_id=payload["dest_location_id"],
                status=DocumentStatus.DRAFT,
                notes="Executed via StockSense Agentic Copilot",
                created_by_id=user.id
            )
            db.add(transfer)
            db.commit()

            for item in payload.get("items", []):
                ti = TransferItem(
                    transfer_id=transfer.id,
                    product_id=item["product_id"],
                    demand_qty=item["demand_qty"],
                    transferred_qty=item["demand_qty"]
                )
                db.add(ti)
            db.commit()

            if payload.get("auto_confirm", True):
                transfer = InventoryEngine.process_transfer_validation(db, transfer, user)

            return {
                "success": True,
                "message": f"Internal Transfer #{transfer.reference_no} confirmed and stock relocated via InventoryEngine!",
                "transfer_id": transfer.id
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action type '{action_type}'")

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
