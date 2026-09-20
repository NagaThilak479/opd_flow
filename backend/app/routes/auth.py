import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Patient, Doctor

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Configuration with environment variables and defaults for hackathon demo
DEMO_DOCTOR_ID = os.getenv("DOCTOR_ID", "DR-SARAH-001")
DEMO_DOCTOR_PIN = os.getenv("DOCTOR_PIN", "1234")

class DoctorLoginRequest(BaseModel):
    doctor_id: str
    pin: str

class DoctorLoginResponse(BaseModel):
    status: str
    role: str
    doctor_id: str
    doctor_name: str
    department: str
    room_number: str
    session_token: str

class PatientLoginRequest(BaseModel):
    token_number: str

class PatientLoginResponse(BaseModel):
    status: str
    role: str
    token_number: str
    patient_name: str
    department: str
    session_token: str

@router.post("/doctor-login", response_model=DoctorLoginResponse)
def doctor_login(payload: DoctorLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a doctor using Doctor ID and PIN.
    Default Demo Credentials:
    Doctor ID: DR-SARAH-001
    PIN: 1234
    """
    doc_id = payload.doctor_id.strip().upper()
    pin = payload.pin.strip()

    if doc_id != DEMO_DOCTOR_ID.upper() or pin != DEMO_DOCTOR_PIN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Doctor ID or PIN. Demo credentials: DR-SARAH-001 / 1234"
        )

    # Fetch or verify primary doctor in DB
    doctor = db.query(Doctor).first()
    doctor_name = doctor.name if doctor else "Dr. Sarah Mitchell, MD"
    dept = doctor.department if doctor else "General Medicine"
    room = doctor.room_number if doctor else "Room 102"

    return DoctorLoginResponse(
        status="success",
        role="DOCTOR",
        doctor_id=DEMO_DOCTOR_ID,
        doctor_name=doctor_name,
        department=dept,
        room_number=room,
        session_token=f"session_doc_{DEMO_DOCTOR_ID}"
    )

@router.post("/patient-login", response_model=PatientLoginResponse)
def patient_login(payload: PatientLoginRequest, db: Session = Depends(get_db)):
    """
    Looks up patient by OPD token number and establishes a locked patient session.
    Fails with 404 if the OPD token number is not found.
    """
    raw_token = payload.token_number.strip().upper()
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OPD number is required."
        )

    patient = db.query(Patient).filter(Patient.token_number.ilike(raw_token)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"OPD token '{raw_token}' not found in active records. Please check your OPD slip."
        )

    return PatientLoginResponse(
        status="success",
        role="PATIENT",
        token_number=patient.token_number,
        patient_name=patient.name,
        department=patient.department,
        session_token=f"session_patient_{patient.token_number}"
    )
