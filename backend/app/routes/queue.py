from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Patient, Doctor, ConsultationHistory
from ..schemas import (
    PatientResponse, PatientCreate, QueueSummary, DoctorResponse,
    PublicQueueResponse, PublicQueueItem
)
from ..services.prediction import (
    calculate_patient_wait_time, 
    get_doctor_average_consultation_time,
    DEFAULT_CONSULTATION_DURATION_MINUTES
)
from ..seed import seed_database

router = APIRouter(prefix="/api/queue", tags=["Queue"])

def verify_staff_role(x_user_role: Optional[str] = Header(None, alias="X-User-Role")):
    """Ensure that callers with a Patient session role cannot execute staff actions."""
    if x_user_role and x_user_role.strip().upper() == "PATIENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Patient sessions cannot perform staff actions."
        )

def enrich_patient(patient: Patient, db: Session) -> dict:
    """Enriches a Patient model with prediction data."""
    pred = calculate_patient_wait_time(db, patient.token_number)
    return {
        "id": patient.id,
        "token_number": patient.token_number,
        "name": patient.name,
        "department": patient.department,
        "arrival_time": patient.arrival_time,
        "consultation_start_time": patient.consultation_start_time,
        "completed_time": patient.completed_time,
        "status": patient.status,
        "doctor_id": patient.doctor_id,
        "patients_ahead": pred["patients_ahead"],
        "estimated_wait_minutes": pred["estimated_wait_minutes"],
    }

@router.get("", response_model=QueueSummary)
def get_queue(db: Session = Depends(get_db)):
    """Returns the full active queue summary, doctor status, and list of patients."""
    doctor = db.query(Doctor).first()
    if not doctor:
        doctor = Doctor(
            name="Dr. Sarah Mitchell, MD",
            department="General Medicine",
            room_number="Room 102",
            status="AVAILABLE"
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

    # Active consultation
    active_patient = db.query(Patient).filter(Patient.status == "IN_CONSULTATION").first()

    # Query all patients ordered by arrival time
    # We display IN_CONSULTATION first, then WAITING, then SKIPPED, then COMPLETED
    patients = db.query(Patient).order_by(Patient.arrival_time.asc()).all()

    enriched_patients = [enrich_patient(p, db) for p in patients]

    # Quick metrics
    total_waiting = sum(1 for p in patients if p.status == "WAITING")
    in_consultation_count = 1 if active_patient else 0
    total_completed = sum(1 for p in patients if p.status == "COMPLETED")
    total_skipped = sum(1 for p in patients if p.status == "SKIPPED")

    avg_wait, _ = get_doctor_average_consultation_time(db, doctor.id)

    return {
        "total_waiting": total_waiting,
        "in_consultation_count": in_consultation_count,
        "total_completed": total_completed,
        "total_skipped": total_skipped,
        "current_token": active_patient.token_number if active_patient else None,
        "current_patient_name": active_patient.name if active_patient else None,
        "doctor": doctor,
        "average_wait_minutes": avg_wait,
        "patients": enriched_patients,
        "last_updated": datetime.utcnow()
    }

@router.get("/public", response_model=PublicQueueResponse)
def get_public_queue(db: Session = Depends(get_db)):
    """
    Returns public queue order and basic token status for patient view.
    Ensures strict patient privacy:
    - Queue order and basic token status are VISIBLE.
    - Other patients' names and personal info are NOT exposed.
    - Other patients' individual predictions and breakdowns are NOT exposed.
    """
    doctor = db.query(Doctor).first()
    active_patient = db.query(Patient).filter(Patient.status == "IN_CONSULTATION").first()
    patients = db.query(Patient).order_by(Patient.arrival_time.asc()).all()

    total_waiting = sum(1 for p in patients if p.status == "WAITING")
    tokens = [
        PublicQueueItem(
            token_number=p.token_number,
            status=p.status,
            arrival_time=p.arrival_time
        )
        for p in patients
    ]

    return {
        "total_waiting": total_waiting,
        "current_token": active_patient.token_number if active_patient else None,
        "doctor_status": doctor.status if doctor else "AVAILABLE",
        "tokens": tokens,
        "last_updated": datetime.utcnow()
    }

@router.get("/{token}", response_model=PatientResponse)
def get_patient_by_token(
    token: str, 
    db: Session = Depends(get_db),
    x_patient_token: Optional[str] = Header(None, alias="X-Patient-Token")
):
    """Fetch patient and current queue status by token number."""
    requested_token = token.strip().upper()

    if x_patient_token:
        session_token = x_patient_token.strip().upper()
        if session_token != requested_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Patient session ({session_token}) cannot view private details for ({requested_token})."
            )

    patient = db.query(Patient).filter(Patient.token_number.ilike(requested_token)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Token '{token}' not found in active records."
        )
    return enrich_patient(patient, db)

@router.post("/patient", response_model=PatientResponse, dependencies=[Depends(verify_staff_role)])
def add_patient(payload: PatientCreate, db: Session = Depends(get_db)):
    """Adds a new patient to the waiting queue."""
    now = datetime.utcnow()

    # Auto-generate token if not provided (e.g. find max token number)
    token = payload.token_number
    if not token or not token.strip():
        # Find highest token like A...
        existing_tokens = db.query(Patient.token_number).all()
        max_num = 100
        for (t,) in existing_tokens:
            if t.startswith("A") and t[1:].isdigit():
                num = int(t[1:])
                if num > max_num:
                    max_num = num
        token = f"A{max_num + 1}"
    else:
        token = token.strip().upper()
        # Verify unique
        existing = db.query(Patient).filter(Patient.token_number == token).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Token '{token}' already exists."
            )

    doctor = db.query(Doctor).first()

    new_patient = Patient(
        token_number=token,
        name=payload.name.strip(),
        department=payload.department or "General Medicine",
        arrival_time=now,
        status="WAITING",
        doctor_id=doctor.id if doctor else None
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    return enrich_patient(new_patient, db)

@router.post("/next", dependencies=[Depends(verify_staff_role)])
def call_next_patient(db: Session = Depends(get_db)):
    """
    Calls the next patient in queue:
    1. If a patient is currently IN_CONSULTATION, marks them as COMPLETED 
       and logs consultation duration to ConsultationHistory.
    2. Takes the next WAITING patient (ordered by arrival_time) and marks them IN_CONSULTATION.
    3. Updates Doctor status to BUSY.
    """
    now = datetime.utcnow()
    doctor = db.query(Doctor).first()

    # 1. Complete current patient if exists
    current_patient = db.query(Patient).filter(Patient.status == "IN_CONSULTATION").first()
    if current_patient:
        current_patient.status = "COMPLETED"
        current_patient.completed_time = now

        # Calculate actual consultation duration
        start = current_patient.consultation_start_time or current_patient.arrival_time
        duration = max(1.0, round((now - start).total_seconds() / 60.0, 1))

        # Record to history
        if doctor:
            history_record = ConsultationHistory(
                doctor_id=doctor.id,
                consultation_duration_minutes=duration,
                date=date.today(),
                time_of_day="MORNING" if now.hour < 12 else "AFTERNOON"
            )
            db.add(history_record)

    # 2. Find next waiting patient
    next_patient = db.query(Patient)\
                     .filter(Patient.status == "WAITING")\
                     .order_by(Patient.arrival_time.asc())\
                     .first()

    if not next_patient:
        # No one waiting
        if doctor:
            doctor.status = "AVAILABLE"
            doctor.current_patient_id = None
        db.commit()
        return {
            "message": "Queue is currently empty. No waiting patients to call.",
            "current_token": None,
            "doctor_status": "AVAILABLE"
        }

    # Set next patient to IN_CONSULTATION
    next_patient.status = "IN_CONSULTATION"
    next_patient.consultation_start_time = now

    if doctor:
        doctor.status = "BUSY"
        doctor.current_patient_id = next_patient.id

    db.commit()
    db.refresh(next_patient)

    return {
        "message": f"Called patient {next_patient.token_number} ({next_patient.name})",
        "current_token": next_patient.token_number,
        "patient": enrich_patient(next_patient, db),
        "doctor_status": "BUSY"
    }

@router.post("/{token}/complete", dependencies=[Depends(verify_staff_role)])
def complete_patient(token: str, db: Session = Depends(get_db)):
    """Marks a patient as COMPLETED and logs duration."""
    now = datetime.utcnow()
    patient = db.query(Patient).filter(Patient.token_number.ilike(token.strip())).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient token not found")

    doctor = db.query(Doctor).first()

    patient.status = "COMPLETED"
    patient.completed_time = now

    # Record duration
    start = patient.consultation_start_time or patient.arrival_time
    duration = max(1.0, round((now - start).total_seconds() / 60.0, 1))

    if doctor:
        history_record = ConsultationHistory(
            doctor_id=doctor.id,
            consultation_duration_minutes=duration,
            date=date.today(),
            time_of_day="MORNING" if now.hour < 12 else "AFTERNOON"
        )
        db.add(history_record)

        if doctor.current_patient_id == patient.id:
            doctor.current_patient_id = None
            doctor.status = "AVAILABLE"

    db.commit()
    return {"message": f"Patient {token} marked as COMPLETED", "token": token}

@router.post("/{token}/skip", dependencies=[Depends(verify_staff_role)])
def skip_patient(token: str, db: Session = Depends(get_db)):
    """Marks a patient as SKIPPED (absent/no-show)."""
    patient = db.query(Patient).filter(Patient.token_number.ilike(token.strip())).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient token not found")

    patient.status = "SKIPPED"

    doctor = db.query(Doctor).first()
    if doctor and doctor.current_patient_id == patient.id:
        doctor.current_patient_id = None
        doctor.status = "AVAILABLE"

    db.commit()
    return {"message": f"Patient {token} marked as SKIPPED", "token": token}

@router.post("/reset", dependencies=[Depends(verify_staff_role)])
def reset_demo_queue(db: Session = Depends(get_db)):
    """Resets the demo database back to clean seeded OPD state."""
    seed_database(db=db, force_reset=True)
    return {"message": "Queue and synthetic records successfully reset to demo state."}
