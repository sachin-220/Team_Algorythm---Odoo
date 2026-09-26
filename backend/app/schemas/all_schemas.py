from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.all_models import UserRole, DocumentStatus, AdjustmentReason, MovementType

# --- AUTH & USER SCHEMAS ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Optional[UserRole] = UserRole.WAREHOUSE_STAFF

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class OTPRequest(BaseModel):
    email: EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)

class ResetPassword(BaseModel):
    email: EmailStr
    new_password: str = Field(..., min_length=6)
    otp_code: Optional[str] = None
    reset_token: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(..., min_length=6)
    otp_code: Optional[str] = None
    reset_token: Optional[str] = None

class OTPResponse(BaseModel):
    message: str
    cooldown_seconds: Optional[int] = 60

class VerifyOTPResponse(BaseModel):
    message: str
    reset_token: str

class UserProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- CATEGORY SCHEMAS ---
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    product_count: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True

# --- SUPPLIER SCHEMAS ---
class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=30)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None

class SupplierResponse(BaseModel):
    id: int
    name: str
    code: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- LOCATION SCHEMAS ---
class LocationCreate(BaseModel):
    warehouse_id: int
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=30)
    type: str = "Rack"

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None

class LocationResponse(BaseModel):
    id: int
    warehouse_id: int
    name: str
    code: str
    type: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- WAREHOUSE SCHEMAS ---
class WarehouseCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    address: Optional[str] = None
    is_active: bool = True

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class WarehouseResponse(BaseModel):
    id: int
    name: str
    code: str
    address: Optional[str] = None
    is_active: bool
    locations: List[LocationResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

# --- PRODUCT SCHEMAS ---
class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    category_id: Optional[int] = None
    uom: str = "Units"
    min_stock: float = 10.0
    max_stock: float = 500.0
    reorder_qty: float = 50.0
    safety_stock: float = 15.0
    initial_stock: Optional[float] = 0.0
    initial_warehouse_id: Optional[int] = None
    initial_location_id: Optional[int] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    uom: Optional[str] = None
    min_stock: Optional[float] = None
    max_stock: Optional[float] = None
    reorder_qty: Optional[float] = None
    safety_stock: Optional[float] = None

class StockQuantResponse(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    warehouse_name: str
    location_id: int
    location_name: str
    quantity: float

    class Config:
        from_attributes = True

class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    uom: str
    min_stock: float
    max_stock: float
    reorder_qty: float
    safety_stock: float
    current_stock: float = 0.0
    reorder_status: str = "NORMAL"  # NORMAL, LOW_STOCK, OUT_OF_STOCK, OVER_STOCK
    quants: List[StockQuantResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

# --- RECEIPT SCHEMAS ---
class ReceiptItemCreate(BaseModel):
    product_id: int
    demand_qty: float = Field(..., gt=0)
    received_qty: Optional[float] = 0.0
    unit_price: Optional[float] = 0.0

class ReceiptCreate(BaseModel):
    supplier_id: int
    warehouse_id: int
    location_id: int
    notes: Optional[str] = None
    items: List[ReceiptItemCreate]

class ReceiptItemResponse(BaseModel):
    id: int
    product_id: int
    product_sku: str
    product_name: str
    demand_qty: float
    received_qty: float
    unit_price: float

    class Config:
        from_attributes = True

class ReceiptResponse(BaseModel):
    id: int
    reference_no: str
    supplier_id: int
    supplier_name: str
    warehouse_id: int
    warehouse_name: str
    location_id: int
    location_name: str
    status: DocumentStatus
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    validated_by_name: Optional[str] = None
    items: List[ReceiptItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- DELIVERY SCHEMAS ---
class DeliveryItemCreate(BaseModel):
    product_id: int
    demand_qty: float = Field(..., gt=0)
    delivered_qty: Optional[float] = 0.0
    unit_price: Optional[float] = 0.0

class DeliveryCreate(BaseModel):
    customer_name: str
    warehouse_id: int
    location_id: int
    notes: Optional[str] = None
    items: List[DeliveryItemCreate]

class DeliveryItemResponse(BaseModel):
    id: int
    product_id: int
    product_sku: str
    product_name: str
    demand_qty: float
    delivered_qty: float
    unit_price: float
    available_stock: Optional[float] = 0.0

    class Config:
        from_attributes = True

class DeliveryResponse(BaseModel):
    id: int
    reference_no: str
    customer_name: str
    warehouse_id: int
    warehouse_name: str
    location_id: int
    location_name: str
    status: DocumentStatus
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    validated_by_name: Optional[str] = None
    items: List[DeliveryItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- TRANSFER SCHEMAS ---
class TransferItemCreate(BaseModel):
    product_id: int
    demand_qty: float = Field(..., gt=0)

class TransferCreate(BaseModel):
    src_warehouse_id: int
    src_location_id: int
    dest_warehouse_id: int
    dest_location_id: int
    notes: Optional[str] = None
    items: List[TransferItemCreate]

class TransferItemResponse(BaseModel):
    id: int
    product_id: int
    product_sku: str
    product_name: str
    demand_qty: float
    transferred_qty: float
    available_src_stock: Optional[float] = 0.0

    class Config:
        from_attributes = True

class TransferResponse(BaseModel):
    id: int
    reference_no: str
    src_warehouse_id: int
    src_warehouse_name: str
    src_location_id: int
    src_location_name: str
    dest_warehouse_id: int
    dest_warehouse_name: str
    dest_location_id: int
    dest_location_name: str
    status: DocumentStatus
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    validated_by_name: Optional[str] = None
    items: List[TransferItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- ADJUSTMENT SCHEMAS ---
class AdjustmentItemCreate(BaseModel):
    product_id: int
    physical_qty: float = Field(..., ge=0)

class AdjustmentCreate(BaseModel):
    warehouse_id: int
    location_id: int
    reason: AdjustmentReason = AdjustmentReason.COUNTING_DIFFERENCE
    notes: Optional[str] = None
    items: List[AdjustmentItemCreate]

class AdjustmentItemResponse(BaseModel):
    id: int
    product_id: int
    product_sku: str
    product_name: str
    theoretical_qty: float
    physical_qty: float
    difference_qty: float

    class Config:
        from_attributes = True

class AdjustmentResponse(BaseModel):
    id: int
    reference_no: str
    warehouse_id: int
    warehouse_name: str
    location_id: int
    location_name: str
    status: DocumentStatus
    reason: AdjustmentReason
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    items: List[AdjustmentItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

# --- STOCK MOVEMENT / LEDGER SCHEMAS ---
class StockMovementResponse(BaseModel):
    id: int
    movement_type: MovementType
    product_id: int
    product_sku: str
    product_name: str
    quantity: float
    src_warehouse_name: Optional[str] = None
    src_location_name: Optional[str] = None
    dest_warehouse_name: Optional[str] = None
    dest_location_name: Optional[str] = None
    reference_doc: str
    user_name: Optional[str] = None
    timestamp: datetime
    reason: Optional[str] = None

    class Config:
        from_attributes = True

# --- REORDER RULE SCHEMAS ---
class ReorderRuleCreate(BaseModel):
    product_id: int
    warehouse_id: int
    location_id: Optional[int] = None
    min_stock: float = Field(..., ge=0)
    max_stock: float = Field(..., gt=0)
    reorder_quantity: float = Field(..., gt=0)
    lead_time_days: int = 5
    safety_stock: float = 0.0

class ReorderRuleResponse(BaseModel):
    id: int
    product_id: int
    product_sku: str
    product_name: str
    warehouse_id: int
    warehouse_name: str
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    min_stock: float
    max_stock: float
    reorder_quantity: float
    lead_time_days: int
    safety_stock: float
    current_stock: float
    status: str  # OK, REORDER_NEEDED

    class Config:
        from_attributes = True

# --- DASHBOARD SCHEMAS ---
class DashboardKPIs(BaseModel):
    total_products_in_stock: int
    total_stock_quantity: float
    low_stock_items_count: int
    out_of_stock_items_count: int
    pending_receipts_count: int
    pending_deliveries_count: int
    pending_transfers_count: int
    recent_movements: List[StockMovementResponse] = []
    low_stock_products: List[ProductResponse] = []
