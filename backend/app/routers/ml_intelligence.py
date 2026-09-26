from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import User
from app.services.auth_service import get_current_user
from app.services.ml_service import MLService

router = APIRouter(prefix="/ml", tags=["Machine Learning Inventory Intelligence"])

@router.get("/summary")
def get_ml_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve high-level ML KPIs, model accuracy metrics, and active operational risk flags."""
    try:
        return MLService.get_ml_summary(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate ML summary: {str(e)}")

@router.get("/demand-forecast")
def get_demand_forecast(
    product_id: Optional[int] = Query(None, description="Optional product ID to forecast. If omitted, forecasts all products."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Retrieve 7-day and 30-day demand forecasts, actual vs. predicted demand, and model error metrics."""
    try:
        if product_id:
            return MLService.get_demand_forecast(db, product_id)
        
        # Return forecasts for all products
        from app.models.all_models import Product
        products = db.query(Product).all()
        forecasts = []
        for p in products:
            f = MLService.get_demand_forecast(db, p.id)
            forecasts.append(f)
        return forecasts
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate demand forecast: {str(e)}")

@router.get("/stockouts")
def get_stockouts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Predict stockout dates, days until depletion, burn rates, and risk tiers for all inventory products."""
    try:
        return MLService.get_stockout_predictions(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate stockout horizons: {str(e)}")

@router.get("/reorder-recommendations")
def get_reorder_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Generate intelligent reorder quantities, lead time calculations, priority tags, and human-readable explanations."""
    try:
        return MLService.get_reorder_recommendations(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate reorder recommendations: {str(e)}")

@router.get("/anomalies")
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Detect unusual inventory adjustments, loss/damage write-offs, and quantity discrepancies using Isolation Forest."""
    try:
        return MLService.detect_anomalies(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run Isolation Forest anomaly detection: {str(e)}")

@router.post("/retrain")
def retrain_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrain ML demand forecasting models and Isolation Forest anomaly detectors on latest MySQL transactions."""
    try:
        return MLService.retrain_all_models(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrain ML models: {str(e)}")
