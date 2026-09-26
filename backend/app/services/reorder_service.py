from sqlalchemy.orm import Session
from app.models.all_models import Product, StockQuant, ReorderRule

def get_product_reorder_status(db: Session, product: Product) -> str:
    quants = db.query(StockQuant).filter(StockQuant.product_id == product.id).all()
    current_stock = sum(q.quantity for q in quants)

    if current_stock == 0:
        return "OUT_OF_STOCK"
    elif current_stock <= product.min_stock:
        return "LOW_STOCK"
    elif current_stock >= product.max_stock:
        return "OVER_STOCK"
    return "NORMAL"

def get_reorder_rules_with_status(db: Session):
    rules = db.query(ReorderRule).all()
    result = []
    for rule in rules:
        quant = db.query(StockQuant).filter(
            StockQuant.product_id == rule.product_id,
            StockQuant.warehouse_id == rule.warehouse_id,
            StockQuant.location_id == rule.location_id if rule.location_id else True
        ).first()
        current_stock = quant.quantity if quant else 0.0
        status_str = "REORDER_NEEDED" if current_stock <= rule.min_stock else "OK"
        result.append({
            "id": rule.id,
            "product_id": rule.product_id,
            "product_sku": rule.product.sku if rule.product else "",
            "product_name": rule.product.name if rule.product else "",
            "warehouse_id": rule.warehouse_id,
            "warehouse_name": rule.warehouse.name if rule.warehouse else "",
            "location_id": rule.location_id,
            "location_name": rule.location.name if rule.location else None,
            "min_stock": rule.min_stock,
            "max_stock": rule.max_stock,
            "reorder_quantity": rule.reorder_quantity,
            "lead_time_days": rule.lead_time_days,
            "safety_stock": rule.safety_stock,
            "current_stock": current_stock,
            "status": status_str
        })
    return result
