from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import Product, StockQuant, Category, User, UserRole, ReorderRule
from app.schemas.all_schemas import (
    ProductCreate, ProductUpdate, ProductResponse, StockQuantResponse
)
from app.services.auth_service import get_current_user, require_role
from app.services.inventory_engine import InventoryEngine
from app.services.reorder_service import get_product_reorder_status

router = APIRouter(prefix="/products", tags=["Product Management"])

def _format_product_response(db: Session, p: Product) -> ProductResponse:
    quants = db.query(StockQuant).filter(StockQuant.product_id == p.id).all()
    current_stock = sum(q.quantity for q in quants)
    
    quant_responses = []
    for q in quants:
        quant_responses.append(StockQuantResponse(
            id=q.id,
            product_id=q.product_id,
            warehouse_id=q.warehouse_id,
            warehouse_name=q.warehouse.name if q.warehouse else "",
            location_id=q.location_id,
            location_name=q.location.name if q.location else "",
            quantity=q.quantity
        ))

    reorder_status = get_product_reorder_status(db, p)

    return ProductResponse(
        id=p.id,
        sku=p.sku,
        name=p.name,
        description=p.description,
        category_id=p.category_id,
        category_name=p.category.name if p.category else None,
        uom=p.uom,
        min_stock=p.min_stock,
        max_stock=p.max_stock,
        reorder_qty=p.reorder_qty,
        safety_stock=p.safety_stock,
        current_stock=current_stock,
        reorder_status=reorder_status,
        quants=quant_responses,
        created_at=p.created_at
    )

@router.get("/", response_model=List[ProductResponse])
def list_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    stock_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product)
    if search:
        query = query.filter(
            (Product.sku.ilike(f"%{search}%")) |
            (Product.name.ilike(f"%{search}%")) |
            (Product.description.ilike(f"%{search}%"))
        )
    if category_id:
        query = query.filter(Product.category_id == category_id)

    products = query.all()
    results = [_format_product_response(db, p) for p in products]

    if stock_status:
        results = [r for r in results if r.reorder_status.upper() == stock_status.upper()]

    return results

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    p = db.query(Product).get(product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _format_product_response(db, p)

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    prod_in: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    if db.query(Product).filter(Product.sku == prod_in.sku).first():
        raise HTTPException(status_code=400, detail=f"Product SKU '{prod_in.sku}' already exists")

    if prod_in.category_id and not db.query(Category).get(prod_in.category_id):
        raise HTTPException(status_code=400, detail=f"Category ID {prod_in.category_id} does not exist")

    p = Product(
        sku=prod_in.sku,
        name=prod_in.name,
        description=prod_in.description,
        category_id=prod_in.category_id,
        uom=prod_in.uom,
        min_stock=prod_in.min_stock,
        max_stock=prod_in.max_stock,
        reorder_qty=prod_in.reorder_qty,
        safety_stock=prod_in.safety_stock
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    # Automatically create reorder rule for product if initial warehouse is passed
    if prod_in.initial_warehouse_id:
        rule = ReorderRule(
            product_id=p.id,
            warehouse_id=prod_in.initial_warehouse_id,
            location_id=prod_in.initial_location_id,
            min_stock=p.min_stock,
            max_stock=p.max_stock,
            reorder_quantity=p.reorder_qty,
            safety_stock=p.safety_stock
        )
        db.add(rule)
        db.commit()

    # Process initial stock via Centralized Inventory Engine if provided
    if prod_in.initial_stock and prod_in.initial_stock > 0:
        if not prod_in.initial_warehouse_id or not prod_in.initial_location_id:
            raise HTTPException(
                status_code=400,
                detail="Initial warehouse ID and location ID are required when setting initial stock"
            )
        InventoryEngine.add_initial_stock(
            db=db,
            product_id=p.id,
            warehouse_id=prod_in.initial_warehouse_id,
            location_id=prod_in.initial_location_id,
            initial_qty=prod_in.initial_stock,
            user_id=user.id
        )

    return _format_product_response(db, p)

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    prod_in: ProductUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    p = db.query(Product).get(product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = prod_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(p, key, val)

    db.commit()
    db.refresh(p)
    return _format_product_response(db, p)

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    p = db.query(Product).get(product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(p)
    db.commit()
    return {"message": "Product deleted successfully"}
