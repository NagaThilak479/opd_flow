from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Doctor
from ..schemas import DoctorResponse, DoctorStatusUpdate

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])

def verify_staff_role(x_user_role: Optional[str] = Header(None, alias="X-User-Role")):
    """Ensure that callers with a Patient session role cannot execute staff actions."""
    if x_user_role and x_user_role.strip().upper() == "PATIENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Patient sessions cannot update doctor status."
        )

@router.get("", response_model=DoctorResponse)
def get_doctor(db: Session = Depends(get_db)):
    """Fetch current primary doctor info."""
    doctor = db.query(Doctor).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return doctor

@router.post("/status", response_model=DoctorResponse, dependencies=[Depends(verify_staff_role)])
def update_doctor_status(payload: DoctorStatusUpdate, db: Session = Depends(get_db)):
    """Update doctor status (AVAILABLE, BUSY, PAUSED)."""
    doctor = db.query(Doctor).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    new_status = payload.status.upper().strip()
    if new_status not in ["AVAILABLE", "BUSY", "PAUSED"]:
        raise HTTPException(
            status_code=400, 
            detail="Status must be one of: AVAILABLE, BUSY, PAUSED"
        )

    doctor.status = new_status
    db.commit()
    db.refresh(doctor)
    return doctor
