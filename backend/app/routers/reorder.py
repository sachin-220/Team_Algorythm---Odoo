from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import ReorderRule, Product, Warehouse, Location, User, UserRole
from app.schemas.all_schemas import ReorderRuleCreate, ReorderRuleResponse
from app.services.auth_service import get_current_user, require_role
from app.services.reorder_service import get_reorder_rules_with_status

router = APIRouter(prefix="/reorder-rules", tags=["Reordering Rules"])
router_alias = APIRouter(prefix="/reorder", tags=["Reordering Rules"])

@router.get("/", response_model=List[ReorderRuleResponse])
@router_alias.get("/", response_model=List[ReorderRuleResponse])
def list_reorder_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_reorder_rules_with_status(db)

@router.post("/", response_model=ReorderRuleResponse, status_code=status.HTTP_201_CREATED)
@router_alias.post("/", response_model=ReorderRuleResponse, status_code=status.HTTP_201_CREATED)
def create_reorder_rule(
    rule_in: ReorderRuleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    if not db.query(Product).get(rule_in.product_id):
        raise HTTPException(status_code=400, detail="Product not found")
    if not db.query(Warehouse).get(rule_in.warehouse_id):
        raise HTTPException(status_code=400, detail="Warehouse not found")

    rule = ReorderRule(**rule_in.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    rules = get_reorder_rules_with_status(db)
    for r in rules:
        if r["id"] == rule.id:
            return r
    raise HTTPException(status_code=500, detail="Error formatting created rule")

@router.delete("/{rule_id}")
@router_alias.delete("/{rule_id}")
def delete_reorder_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    rule = db.query(ReorderRule).get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Reorder rule not found")
    db.delete(rule)
    db.commit()
    return {"message": "Reorder rule deleted successfully"}
