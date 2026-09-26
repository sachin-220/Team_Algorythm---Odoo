from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.all_models import (
    StockQuant, StockMovement, MovementType, DocumentStatus,
    Receipt, DeliveryOrder, InternalTransfer, InventoryAdjustment,
    Product, Warehouse, Location, User
)

class InventoryEngine:
    """
    Centralized Inventory Engine responsible for every stock change in StockSense.
    Ensures atomic operations, stock movement logging, and guards against invalid state.
    """

    @staticmethod
    def get_or_create_quant(
        db: Session,
        product_id: int,
        warehouse_id: int,
        location_id: int
    ) -> StockQuant:
        quant = db.query(StockQuant).filter(
            StockQuant.product_id == product_id,
            StockQuant.warehouse_id == warehouse_id,
            StockQuant.location_id == location_id
        ).first()

        if not quant:
            quant = StockQuant(
                product_id=product_id,
                warehouse_id=warehouse_id,
                location_id=location_id,
                quantity=0.0
            )
            db.add(quant)
            db.flush()
        return quant

    @staticmethod
    def get_available_stock(
        db: Session,
        product_id: int,
        warehouse_id: int,
        location_id: int
    ) -> float:
        quant = db.query(StockQuant).filter(
            StockQuant.product_id == product_id,
            StockQuant.warehouse_id == warehouse_id,
            StockQuant.location_id == location_id
        ).first()
        return quant.quantity if quant else 0.0

    @staticmethod
    def get_total_product_stock(db: Session, product_id: int) -> float:
        quants = db.query(StockQuant).filter(StockQuant.product_id == product_id).all()
        return sum(q.quantity for q in quants)

    @classmethod
    def process_receipt_validation(
        cls,
        db: Session,
        receipt: Receipt,
        user: User
    ) -> Receipt:
        if receipt.status == DocumentStatus.DONE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Receipt is already validated and completed."
            )
        if receipt.status == DocumentStatus.CANCELED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot validate a canceled receipt."
            )
        if not receipt.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Receipt must contain at least one product item."
            )

        for item in receipt.items:
            qty_to_add = item.received_qty if item.received_qty > 0 else item.demand_qty
            if qty_to_add <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid quantity {qty_to_add} for product ID {item.product_id}"
                )
            
            # Increase target location stock
            quant = cls.get_or_create_quant(db, item.product_id, receipt.warehouse_id, receipt.location_id)
            quant.quantity += qty_to_add

            # Log Stock Movement
            movement = StockMovement(
                movement_type=MovementType.INCOMING,
                product_id=item.product_id,
                quantity=qty_to_add,
                src_warehouse_id=None,
                src_location_id=None,
                dest_warehouse_id=receipt.warehouse_id,
                dest_location_id=receipt.location_id,
                reference_doc=receipt.reference_no,
                user_id=user.id,
                timestamp=datetime.utcnow(),
                reason=f"Receipt from Supplier ID {receipt.supplier_id}"
            )
            db.add(movement)

        receipt.status = DocumentStatus.DONE
        receipt.validated_by_id = user.id
        db.commit()
        db.refresh(receipt)
        return receipt

    @classmethod
    def process_delivery_validation(
        cls,
        db: Session,
        delivery: DeliveryOrder,
        user: User
    ) -> DeliveryOrder:
        if delivery.status == DocumentStatus.DONE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery Order is already validated and completed."
            )
        if delivery.status == DocumentStatus.CANCELED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot validate a canceled delivery order."
            )
        if not delivery.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery Order must contain at least one product item."
            )

        # First pass: check stock availability for ALL items before modifying anything
        for item in delivery.items:
            qty_to_deliver = item.delivered_qty if item.delivered_qty > 0 else item.demand_qty
            if qty_to_deliver <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid quantity {qty_to_deliver} for product ID {item.product_id}"
                )
            
            avail = cls.get_available_stock(db, item.product_id, delivery.warehouse_id, delivery.location_id)
            if avail < qty_to_deliver:
                prod = db.query(Product).get(item.product_id)
                prod_name = prod.name if prod else f"ID {item.product_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for '{prod_name}'. Demanded: {qty_to_deliver}, Available: {avail}"
                )

        # Second pass: execute stock deduction and log movement
        for item in delivery.items:
            qty_to_deliver = item.delivered_qty if item.delivered_qty > 0 else item.demand_qty
            quant = cls.get_or_create_quant(db, item.product_id, delivery.warehouse_id, delivery.location_id)
            quant.quantity -= qty_to_deliver

            movement = StockMovement(
                movement_type=MovementType.OUTGOING,
                product_id=item.product_id,
                quantity=qty_to_deliver,
                src_warehouse_id=delivery.warehouse_id,
                src_location_id=delivery.location_id,
                dest_warehouse_id=None,
                dest_location_id=None,
                reference_doc=delivery.reference_no,
                user_id=user.id,
                timestamp=datetime.utcnow(),
                reason=f"Delivery to Customer '{delivery.customer_name}'"
            )
            db.add(movement)

        delivery.status = DocumentStatus.DONE
        delivery.validated_by_id = user.id
        db.commit()
        db.refresh(delivery)
        return delivery

    @classmethod
    def process_transfer_validation(
        cls,
        db: Session,
        transfer: InternalTransfer,
        user: User
    ) -> InternalTransfer:
        if transfer.status == DocumentStatus.DONE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer is already completed."
            )
        if transfer.status == DocumentStatus.CANCELED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot confirm a canceled transfer."
            )
        if not transfer.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer must contain at least one item."
            )

        if transfer.src_warehouse_id == transfer.dest_warehouse_id and transfer.src_location_id == transfer.dest_location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source location and Destination location cannot be identical."
            )

        # Check stock availability at source
        for item in transfer.items:
            qty = item.transferred_qty if item.transferred_qty > 0 else item.demand_qty
            if qty <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid transfer quantity {qty} for product ID {item.product_id}"
                )
            
            avail = cls.get_available_stock(db, item.product_id, transfer.src_warehouse_id, transfer.src_location_id)
            if avail < qty:
                prod = db.query(Product).get(item.product_id)
                prod_name = prod.name if prod else f"ID {item.product_id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient source stock for '{prod_name}'. Required: {qty}, Available: {avail}"
                )

        # Execute transfer: deduct source, add destination
        for item in transfer.items:
            qty = item.transferred_qty if item.transferred_qty > 0 else item.demand_qty
            item.transferred_qty = qty
            
            # Deduct source
            src_quant = cls.get_or_create_quant(db, item.product_id, transfer.src_warehouse_id, transfer.src_location_id)
            src_quant.quantity -= qty

            # Add destination
            dest_quant = cls.get_or_create_quant(db, item.product_id, transfer.dest_warehouse_id, transfer.dest_location_id)
            dest_quant.quantity += qty

            # Log Stock Movement
            movement = StockMovement(
                movement_type=MovementType.TRANSFER,
                product_id=item.product_id,
                quantity=qty,
                src_warehouse_id=transfer.src_warehouse_id,
                src_location_id=transfer.src_location_id,
                dest_warehouse_id=transfer.dest_warehouse_id,
                dest_location_id=transfer.dest_location_id,
                reference_doc=transfer.reference_no,
                user_id=user.id,
                timestamp=datetime.utcnow(),
                reason="Internal Stock Transfer"
            )
            db.add(movement)

        transfer.status = DocumentStatus.DONE
        transfer.validated_by_id = user.id
        db.commit()
        db.refresh(transfer)
        return transfer

    @classmethod
    def process_adjustment_confirmation(
        cls,
        db: Session,
        adjustment: InventoryAdjustment,
        user: User
    ) -> InventoryAdjustment:
        if adjustment.status == DocumentStatus.DONE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Adjustment is already confirmed."
            )
        if adjustment.status == DocumentStatus.CANCELED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot confirm a canceled adjustment."
            )
        if not adjustment.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Adjustment must contain at least one item."
            )

        for item in adjustment.items:
            # Theoretical stock
            current_quant = cls.get_or_create_quant(db, item.product_id, adjustment.warehouse_id, adjustment.location_id)
            item.theoretical_qty = current_quant.quantity
            item.difference_qty = item.physical_qty - item.theoretical_qty

            # Update quant to physical count
            current_quant.quantity = item.physical_qty

            # Log Stock Movement
            movement = StockMovement(
                movement_type=MovementType.ADJUSTMENT,
                product_id=item.product_id,
                quantity=item.difference_qty,
                src_warehouse_id=adjustment.warehouse_id if item.difference_qty < 0 else None,
                src_location_id=adjustment.location_id if item.difference_qty < 0 else None,
                dest_warehouse_id=adjustment.warehouse_id if item.difference_qty > 0 else None,
                dest_location_id=adjustment.location_id if item.difference_qty > 0 else None,
                reference_doc=adjustment.reference_no,
                user_id=user.id,
                timestamp=datetime.utcnow(),
                reason=f"Adjustment Reason: {adjustment.reason.value}"
            )
            db.add(movement)

        adjustment.status = DocumentStatus.DONE
        db.commit()
        db.refresh(adjustment)
        return adjustment

    @classmethod
    def add_initial_stock(
        cls,
        db: Session,
        product_id: int,
        warehouse_id: int,
        location_id: int,
        initial_qty: float,
        user_id: Optional[int] = None
    ):
        if initial_qty <= 0:
            return
        quant = cls.get_or_create_quant(db, product_id, warehouse_id, location_id)
        quant.quantity += initial_qty

        movement = StockMovement(
            movement_type=MovementType.INCOMING,
            product_id=product_id,
            quantity=initial_qty,
            src_warehouse_id=None,
            src_location_id=None,
            dest_warehouse_id=warehouse_id,
            dest_location_id=location_id,
            reference_doc="INITIAL_STOCK",
            user_id=user_id,
            timestamp=datetime.utcnow(),
            reason="Initial Stock Setup"
        )
        db.add(movement)
        db.commit()
