from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.all_models import Category, Product, User, UserRole
from app.schemas.all_schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.auth_service import get_current_user, require_role

router = APIRouter(prefix="/categories", tags=["Category Management"])

@router.get("/", response_model=List[CategoryResponse])
def list_categories(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Category)
    if search:
        query = query.filter(
            (Category.name.ilike(f"%{search}%")) | (Category.code.ilike(f"%{search}%"))
        )
    categories = query.all()
    
    res = []
    for c in categories:
        prod_count = db.query(Product).filter(Product.category_id == c.id).count()
        res.append(CategoryResponse(
            id=c.id,
            name=c.name,
            code=c.code,
            description=c.description,
            product_count=prod_count,
            created_at=c.created_at
        ))
    return res

@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Category).get(category_id)
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    prod_count = db.query(Product).filter(Product.category_id == c.id).count()
    return CategoryResponse(
        id=c.id,
        name=c.name,
        code=c.code,
        description=c.description,
        product_count=prod_count,
        created_at=c.created_at
    )

@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    if db.query(Category).filter(Category.code == cat_in.code).first():
        raise HTTPException(status_code=400, detail=f"Category code '{cat_in.code}' already exists")
    if db.query(Category).filter(Category.name == cat_in.name).first():
        raise HTTPException(status_code=400, detail=f"Category name '{cat_in.name}' already exists")

    c = Category(**cat_in.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return CategoryResponse(
        id=c.id, name=c.name, code=c.code, description=c.description, product_count=0, created_at=c.created_at
    )

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    cat_in: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    c = db.query(Category).get(category_id)
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = cat_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != c.code:
        if db.query(Category).filter(Category.code == update_data["code"]).first():
            raise HTTPException(status_code=400, detail=f"Category code '{update_data['code']}' already exists")
    
    for key, val in update_data.items():
        setattr(c, key, val)

    db.commit()
    db.refresh(c)
    prod_count = db.query(Product).filter(Product.category_id == c.id).count()
    return CategoryResponse(
        id=c.id, name=c.name, code=c.code, description=c.description, product_count=prod_count, created_at=c.created_at
    )

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    c = db.query(Category).get(category_id)
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(c)
    db.commit()
    return {"message": "Category deleted successfully"}
