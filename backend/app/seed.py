import sys
import os

# Ensure app module is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base, SessionLocal
from app.models.all_models import (
    User, UserRole, Category, Supplier, Warehouse, Location, Product,
    Receipt, ReceiptItem, DeliveryOrder, DeliveryItem, InternalTransfer, TransferItem,
    InventoryAdjustment, AdjustmentItem, ReorderRule, DocumentStatus, AdjustmentReason
)
from app.services.auth_service import hash_password
from app.services.inventory_engine import InventoryEngine

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Users if not present
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                email="admin@stocksense.io",
                password_hash=hash_password("password123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            manager = User(
                username="manager",
                email="manager@stocksense.io",
                password_hash=hash_password("password123"),
                role=UserRole.INVENTORY_MANAGER,
                is_active=True
            )
            staff = User(
                username="staff",
                email="staff@stocksense.io",
                password_hash=hash_password("password123"),
                role=UserRole.WAREHOUSE_STAFF,
                is_active=True
            )
            db.add_all([admin, manager, staff])
            db.commit()
            print("[+] Users seeded (admin, manager, staff)")

        admin_user = db.query(User).filter(User.username == "admin").first()

        # 2. Seed Categories
        cats = [
            ("Electronics & Hardware", "ELEC", "Components, routers, and microcontrollers"),
            ("Raw Materials", "RAW", "Copper wiring, sheet metal, plastics"),
            ("Office Supplies", "OFFICE", "Furniture and desk equipment"),
            ("Industrial Tools", "TOOLS", "Precision measurement tools and machinery")
        ]
        cat_objs = {}
        for name, code, desc in cats:
            c = db.query(Category).filter(Category.code == code).first()
            if not c:
                c = Category(name=name, code=code, description=desc)
                db.add(c)
                db.commit()
            cat_objs[code] = c
        print("[+] Categories seeded")

        # 3. Seed Suppliers
        sups = [
            ("TechDistro Global Corp", "SUP-TECH", "sales@techdistro.com", "+1-800-555-0199", "100 Tech Blvd, CA", "Sarah Jenkins"),
            ("Apex Raw Materials", "SUP-APEX", "orders@apexraw.com", "+1-800-555-0288", "45 Industrial Pkwy, TX", "Michael Chang"),
            ("Global Tool & Supply", "SUP-TOOL", "support@globaltool.com", "+1-800-555-0377", "88 Factory Way, IL", "David Miller")
        ]
        sup_objs = {}
        for name, code, email, phone, addr, contact in sups:
            s = db.query(Supplier).filter(Supplier.code == code).first()
            if not s:
                s = Supplier(name=name, code=code, email=email, phone=phone, address=addr, contact_person=contact)
                db.add(s)
                db.commit()
            sup_objs[code] = s
        print("[+] Suppliers seeded")

        # 4. Seed Warehouses & Locations
        wh1 = db.query(Warehouse).filter(Warehouse.code == "WH-MAIN").first()
        if not wh1:
            wh1 = Warehouse(name="Main Central Warehouse", code="WH-MAIN", address="Building A, Logistics Hub", is_active=True)
            db.add(wh1)
            db.commit()
            l1 = Location(warehouse_id=wh1.id, name="Rack A1 - High Density", code="WH-MAIN-A1", type="Rack")
            l2 = Location(warehouse_id=wh1.id, name="Rack B2 - Bulk Zone", code="WH-MAIN-B2", type="Rack")
            l3 = Location(warehouse_id=wh1.id, name="Receiving Dock 1", code="WH-MAIN-REC", type="Receiving")
            db.add_all([l1, l2, l3])
            db.commit()

        wh2 = db.query(Warehouse).filter(Warehouse.code == "WH-EAST").first()
        if not wh2:
            wh2 = Warehouse(name="East Overflow Facility", code="WH-EAST", address="Zone 4 Industrial Estate", is_active=True)
            db.add(wh2)
            db.commit()
            l4 = Location(warehouse_id=wh2.id, name="Shelf 101 - Small Parts", code="WH-EAST-101", type="Shelf")
            l5 = Location(warehouse_id=wh2.id, name="Storage Bin C", code="WH-EAST-BIN", type="Bin")
            db.add_all([l4, l5])
            db.commit()
        print("[+] Warehouses & Locations seeded")

        wh1_loc = db.query(Location).filter(Location.code == "WH-MAIN-A1").first()
        wh2_loc = db.query(Location).filter(Location.code == "WH-EAST-101").first()

        # 5. Seed Products & Initial Stock
        prods = [
            ("PROD-101", "Enterprise Wi-Fi 6 Router", "High performance multi-gigabit router", cat_objs["ELEC"].id, "Units", 15.0, 200.0, 50.0, 10.0, 85.0),
            ("PROD-102", "ARM Cortex Microcontroller", "32-bit embedded processing unit", cat_objs["ELEC"].id, "Units", 50.0, 1000.0, 200.0, 30.0, 450.0),
            ("PROD-201", "Heavy Gauge Copper Wire (100m)", "Industrial grade copper spool", cat_objs["RAW"].id, "Spools", 10.0, 150.0, 25.0, 5.0, 8.0),
            ("PROD-301", "Ergonomic Mesh Task Chair", "Lumbar support adjustable office chair", cat_objs["OFFICE"].id, "Units", 5.0, 50.0, 10.0, 2.0, 24.0),
            ("PROD-401", "Digital Caliper Tool 150mm", "High accuracy Stainless Steel Digital Micrometer", cat_objs["TOOLS"].id, "Units", 12.0, 100.0, 20.0, 5.0, 0.0) # 0 stock to trigger Out Of Stock KPI!
        ]

        for sku, name, desc, cat_id, uom, min_s, max_s, reorder_q, safety_s, init_qty in prods:
            p = db.query(Product).filter(Product.sku == sku).first()
            if not p:
                p = Product(
                    sku=sku, name=name, description=desc, category_id=cat_id, uom=uom,
                    min_stock=min_s, max_stock=max_s, reorder_qty=reorder_q, safety_stock=safety_s
                )
                db.add(p)
                db.commit()

                # Add initial stock
                if init_qty > 0:
                    InventoryEngine.add_initial_stock(
                        db=db,
                        product_id=p.id,
                        warehouse_id=wh1.id,
                        location_id=wh1_loc.id,
                        initial_qty=init_qty,
                        user_id=admin_user.id
                    )

                # Add reorder rule
                rr = ReorderRule(
                    product_id=p.id,
                    warehouse_id=wh1.id,
                    location_id=wh1_loc.id,
                    min_stock=min_s,
                    max_stock=max_s,
                    reorder_quantity=reorder_q,
                    lead_time_days=5,
                    safety_stock=safety_s
                )
                db.add(rr)
                db.commit()
        print("[+] Products, initial stock & reorder rules seeded")

        # 6. Seed Sample Draft Receipts & Deliveries & Transfers & Adjustments
        prod1 = db.query(Product).filter(Product.sku == "PROD-101").first()
        prod2 = db.query(Product).filter(Product.sku == "PROD-401").first()

        # Draft Receipt
        if not db.query(Receipt).filter(Receipt.reference_no == "REC-202609-001").first():
            rec = Receipt(
                reference_no="REC-202609-001",
                supplier_id=sup_objs["SUP-TECH"].id,
                warehouse_id=wh1.id,
                location_id=wh1_loc.id,
                status=DocumentStatus.WAITING,
                notes="Incoming stock for Digital Calipers",
                created_by_id=admin_user.id
            )
            db.add(rec)
            db.commit()
            ri = ReceiptItem(receipt_id=rec.id, product_id=prod2.id, demand_qty=50.0, received_qty=50.0, unit_price=45.0)
            db.add(ri)
            db.commit()

        # Draft Delivery
        if not db.query(DeliveryOrder).filter(DeliveryOrder.reference_no == "DEL-202609-001").first():
            deli = DeliveryOrder(
                reference_no="DEL-202609-001",
                customer_name="Acme Corp Solutions",
                warehouse_id=wh1.id,
                location_id=wh1_loc.id,
                status=DocumentStatus.READY,
                notes="Urgent shipment of Wi-Fi 6 Routers",
                created_by_id=admin_user.id
            )
            db.add(deli)
            db.commit()
            di = DeliveryItem(delivery_id=deli.id, product_id=prod1.id, demand_qty=5.0, delivered_qty=5.0, unit_price=120.0)
            db.add(di)
            db.commit()

        print("[+] Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[-] Seeding error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
