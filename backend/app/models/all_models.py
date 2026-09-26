from datetime import datetime
import enum
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    INVENTORY_MANAGER = "Inventory Manager"
    WAREHOUSE_STAFF = "Warehouse Staff"

class DocumentStatus(str, enum.Enum):
    DRAFT = "Draft"
    WAITING = "Waiting"
    READY = "Ready"
    DONE = "Done"
    CANCELED = "Canceled"

class AdjustmentReason(str, enum.Enum):
    DAMAGED = "Damaged"
    LOST = "Lost"
    FOUND = "Found"
    COUNTING_DIFFERENCE = "Counting Difference"
    OTHER = "Other"

class MovementType(str, enum.Enum):
    INCOMING = "INCOMING"
    OUTGOING = "OUTGOING"
    TRANSFER = "TRANSFER"
    ADJUSTMENT = "ADJUSTMENT"

# --- USER MODEL ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.WAREHOUSE_STAFF, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    otp_code = Column(String(255), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0, nullable=True)
    otp_last_sent_at = Column(DateTime, nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

# --- CATEGORY MODEL ---
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")

# --- SUPPLIER MODEL ---
class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(30), unique=True, index=True, nullable=False)
    email = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    contact_person = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    receipts = relationship("Receipt", back_populates="supplier")

# --- WAREHOUSE MODEL ---
class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    locations = relationship("Location", back_populates="warehouse", cascade="all, delete-orphan")

# --- LOCATION MODEL ---
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(30), nullable=False, index=True)
    type = Column(String(50), default="Rack", nullable=False)  # e.g., Rack, Shelf, Bin, Receiving, Output
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    warehouse = relationship("Warehouse", back_populates="locations")
    
    __table_args__ = (
        UniqueConstraint('warehouse_id', 'code', name='uix_warehouse_location_code'),
    )

# --- PRODUCT MODEL ---
class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    uom = Column(String(30), default="Units", nullable=False)
    min_stock = Column(Float, default=10.0, nullable=False)
    max_stock = Column(Float, default=500.0, nullable=False)
    reorder_qty = Column(Float, default=50.0, nullable=False)
    safety_stock = Column(Float, default=15.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    category = relationship("Category", back_populates="products")
    quants = relationship("StockQuant", back_populates="product", cascade="all, delete-orphan")
    reorder_rules = relationship("ReorderRule", back_populates="product", cascade="all, delete-orphan")

# --- STOCK QUANT (Location-level inventory balances) ---
class StockQuant(Base):
    __tablename__ = "stock_quants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Float, default=0.0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="quants")
    warehouse = relationship("Warehouse")
    location = relationship("Location")

    __table_args__ = (
        UniqueConstraint('product_id', 'warehouse_id', 'location_id', name='uix_product_wh_loc'),
    )

# --- RECEIPT MODEL ---
class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    reference_no = Column(String(50), unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.DRAFT, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    supplier = relationship("Supplier", back_populates="receipts")
    warehouse = relationship("Warehouse")
    location = relationship("Location")
    created_by = relationship("User", foreign_keys=[created_by_id])
    validated_by = relationship("User", foreign_keys=[validated_by_id])
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    demand_qty = Column(Float, nullable=False)
    received_qty = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)

    receipt = relationship("Receipt", back_populates="items")
    product = relationship("Product")

# --- DELIVERY ORDER MODEL ---
class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(Integer, primary_key=True, index=True)
    reference_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.DRAFT, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    warehouse = relationship("Warehouse")
    location = relationship("Location")
    created_by = relationship("User", foreign_keys=[created_by_id])
    validated_by = relationship("User", foreign_keys=[validated_by_id])
    items = relationship("DeliveryItem", back_populates="delivery", cascade="all, delete-orphan")

class DeliveryItem(Base):
    __tablename__ = "delivery_items"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("delivery_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    demand_qty = Column(Float, nullable=False)
    delivered_qty = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)

    delivery = relationship("DeliveryOrder", back_populates="items")
    product = relationship("Product")

# --- INTERNAL TRANSFER MODEL ---
class InternalTransfer(Base):
    __tablename__ = "internal_transfers"

    id = Column(Integer, primary_key=True, index=True)
    reference_no = Column(String(50), unique=True, index=True, nullable=False)
    src_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    src_location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    dest_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    dest_location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.DRAFT, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    src_warehouse = relationship("Warehouse", foreign_keys=[src_warehouse_id])
    src_location = relationship("Location", foreign_keys=[src_location_id])
    dest_warehouse = relationship("Warehouse", foreign_keys=[dest_warehouse_id])
    dest_location = relationship("Location", foreign_keys=[dest_location_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    validated_by = relationship("User", foreign_keys=[validated_by_id])
    items = relationship("TransferItem", back_populates="transfer", cascade="all, delete-orphan")

class TransferItem(Base):
    __tablename__ = "transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("internal_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    demand_qty = Column(Float, nullable=False)
    transferred_qty = Column(Float, default=0.0, nullable=False)

    transfer = relationship("InternalTransfer", back_populates="items")
    product = relationship("Product")

# --- INVENTORY ADJUSTMENT MODEL ---
class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    reference_no = Column(String(50), unique=True, index=True, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.DRAFT, nullable=False, index=True)
    reason = Column(SQLEnum(AdjustmentReason), default=AdjustmentReason.COUNTING_DIFFERENCE, nullable=False)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    warehouse = relationship("Warehouse")
    location = relationship("Location")
    created_by = relationship("User", foreign_keys=[created_by_id])
    items = relationship("AdjustmentItem", back_populates="adjustment", cascade="all, delete-orphan")

class AdjustmentItem(Base):
    __tablename__ = "adjustment_items"

    id = Column(Integer, primary_key=True, index=True)
    adjustment_id = Column(Integer, ForeignKey("inventory_adjustments.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    theoretical_qty = Column(Float, nullable=False)
    physical_qty = Column(Float, nullable=False)
    difference_qty = Column(Float, nullable=False)

    adjustment = relationship("InventoryAdjustment", back_populates="items")
    product = relationship("Product")

# --- STOCK MOVEMENT LEDGER MODEL ---
class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    movement_type = Column(SQLEnum(MovementType), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    src_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)
    src_location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)
    dest_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)
    dest_location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)
    reference_doc = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    reason = Column(String(255), nullable=True)

    product = relationship("Product")
    src_warehouse = relationship("Warehouse", foreign_keys=[src_warehouse_id])
    src_location = relationship("Location", foreign_keys=[src_location_id])
    dest_warehouse = relationship("Warehouse", foreign_keys=[dest_warehouse_id])
    dest_location = relationship("Location", foreign_keys=[dest_location_id])
    user = relationship("User")

# --- REORDER RULE MODEL ---
class ReorderRule(Base):
    __tablename__ = "reorder_rules"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True, index=True)
    min_stock = Column(Float, default=10.0, nullable=False)
    max_stock = Column(Float, default=200.0, nullable=False)
    reorder_quantity = Column(Float, default=50.0, nullable=False)
    lead_time_days = Column(Integer, default=5, nullable=False)
    safety_stock = Column(Float, default=15.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="reorder_rules")
    warehouse = relationship("Warehouse")
    location = relationship("Location")
