from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import PredictionBreakdown
from ..services.prediction import calculate_patient_wait_time

router = APIRouter(prefix="/api/prediction", tags=["Prediction"])

@router.get("/{token}", response_model=PredictionBreakdown)
def get_prediction(
    token: str, 
    db: Session = Depends(get_db),
    x_patient_token: Optional[str] = Header(None, alias="X-Patient-Token")
):
    """
    Returns waiting-time prediction calculation details for a given patient token.
    Provides estimated wait time, range, patients ahead, doctor status,
    historical duration average, and elapsed consultation time.

    If X-Patient-Token header is provided (patient session), verifies that
    the caller is only requesting their own prediction data.
    """
    requested_token = token.strip().upper()

    if x_patient_token:
        session_token = x_patient_token.strip().upper()
        if session_token != requested_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Patient session ({session_token}) cannot view private prediction for ({requested_token})."
            )

    try:
        prediction = calculate_patient_wait_time(db, requested_token)
        return prediction
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
