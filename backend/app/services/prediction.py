from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from ..models import Patient, Doctor, ConsultationHistory

# Safe clinical default if insufficient historical consultation records exist
DEFAULT_CONSULTATION_DURATION_MINUTES = 7.5
PAUSED_DOCTOR_BUFFER_MINUTES = 10.0
MIN_SAMPLE_REQUIREMENT_OVERALL = 3
MIN_SAMPLE_REQUIREMENT_TIME_OF_DAY = 5

def compute_robust_duration(durations: List[float]) -> float:
    """
    Computes a robust expected duration statistic.
    If sample size >= 10, calculates a 10% trimmed mean to resist outliers.
    If 3 <= sample size < 10, calculates the arithmetic mean.
    Returns the rounded duration.
    """
    if not durations:
        return DEFAULT_CONSULTATION_DURATION_MINUTES

    if len(durations) < 10:
        return round(sum(durations) / len(durations), 1)

    sorted_d = sorted(durations)
    # Trim top 10% and bottom 10%
    trim_count = max(1, int(len(sorted_d) * 0.10))
    trimmed = sorted_d[trim_count:-trim_count]
    if not trimmed:
        trimmed = sorted_d
    return round(sum(trimmed) / len(trimmed), 1)

def get_current_time_of_day(dt: Optional[datetime] = None) -> str:
    """Classifies current time into MORNING, AFTERNOON, or EVENING."""
    if dt is None:
        dt = datetime.utcnow()
    hour = dt.hour
    if hour < 12:
        return "MORNING"
    elif hour < 17:
        return "AFTERNOON"
    else:
        return "EVENING"

def get_doctor_expected_consultation_time(
    db: Session, 
    doctor_id: Optional[int], 
    time_of_day: Optional[str] = None
) -> tuple[float, int, str, int]:
    """
    Data-driven expected consultation duration:
    1. Evaluates doctor's historical records.
    2. If time-of-day slot has >= 5 samples, applies time-of-day robust trimmed mean.
    3. If insufficient time-of-day data exists, applies doctor's overall robust trimmed mean (if >= 3 samples).
    4. Otherwise falls back to clinical default (7.5 min).

    Returns:
        (expected_duration_minutes, total_sample_count, calculation_method, time_of_day_samples)
    """
    if not doctor_id:
        return DEFAULT_CONSULTATION_DURATION_MINUTES, 0, "default_fallback", 0

    records = db.query(
        ConsultationHistory.consultation_duration_minutes, 
        ConsultationHistory.time_of_day
    ).filter(ConsultationHistory.doctor_id == doctor_id).all()

    if not records or len(records) < MIN_SAMPLE_REQUIREMENT_OVERALL:
        return DEFAULT_CONSULTATION_DURATION_MINUTES, len(records), "insufficient_data_fallback", 0

    all_durations = [r[0] for r in records]

    # Time-of-day specific evaluation
    if time_of_day:
        tod_durations = [r[0] for r in records if (r[1] or "").upper() == time_of_day.upper()]
        if len(tod_durations) >= MIN_SAMPLE_REQUIREMENT_TIME_OF_DAY:
            tod_avg = compute_robust_duration(tod_durations)
            return tod_avg, len(records), f"time_of_day_{time_of_day.lower()}_trimmed_mean", len(tod_durations)

    # Fallback to doctor's overall robust mean
    overall_avg = compute_robust_duration(all_durations)
    return overall_avg, len(records), "doctor_overall_trimmed_mean", 0

def get_doctor_average_consultation_time(db: Session, doctor_id: Optional[int]) -> tuple[float, int]:
    """Preserved helper for queue summaries, returning robust doctor duration."""
    current_tod = get_current_time_of_day()
    dur, count, _, _ = get_doctor_expected_consultation_time(db, doctor_id, current_tod)
    return dur, count

def calculate_patient_wait_time(db: Session, token_number: str) -> Dict[str, Any]:
    """
    Data-Driven Waiting-Time Prediction Engine:
    -------------------------------------------
    Estimated Wait = Remaining Active Consultation Time
                   + (Patients Ahead × Historical Expected Consultation Duration)
                   + Status Adjustment

    Description:
    "Data-driven waiting-time prediction using historical consultation patterns and live queue state."
    """
    now = datetime.utcnow()
    current_tod = get_current_time_of_day(now)

    patient = db.query(Patient).filter(Patient.token_number == token_number.strip().upper()).first()
    if not patient:
        raise ValueError(f"Patient with token {token_number} not found.")

    # Doctor lookup
    doctor = None
    if patient.doctor_id:
        doctor = db.query(Doctor).filter(Doctor.id == patient.doctor_id).first()
    if not doctor:
        doctor = db.query(Doctor).first()

    # Calculate data-driven expected duration (with time-of-day effect if sufficient data)
    expected_duration, total_samples, calc_method, tod_samples = get_doctor_expected_consultation_time(
        db, doctor.id if doctor else None, current_tod
    )

    doctor_status = doctor.status if doctor else "AVAILABLE"
    doctor_name = doctor.name if doctor else "Duty Physician"
    doctor_room = doctor.room_number if doctor else "Consultation Room 102"

    # Status handling for inactive/completed/in-consultation states
    if patient.status in ["COMPLETED", "IN_CONSULTATION", "SKIPPED"]:
        movement_status_map = {
            "COMPLETED": "Completed",
            "IN_CONSULTATION": "Currently In Consultation",
            "SKIPPED": "Skipped - Contact Reception",
        }
        return {
            "token_number": patient.token_number,
            "patient_name": patient.name,
            "status": patient.status,
            "patients_ahead": 0,
            "historical_avg_duration": expected_duration,
            "average_consultation_duration": expected_duration,
            "active_remaining_minutes": 0.0,
            "status_adjustment_minutes": 0.0,
            "estimated_wait_minutes": 0,
            "estimated_wait_range_min": 0,
            "estimated_wait_range_max": 0,
            "current_consultation_elapsed_minutes": 0.0,
            "doctor_name": doctor_name,
            "doctor_status": doctor_status,
            "doctor_room": doctor_room,
            "queue_movement_status": movement_status_map[patient.status],
            "historical_samples_count": total_samples,
            "time_of_day": current_tod,
            "time_of_day_samples_count": tod_samples,
            "calculation_method": calc_method,
            "model_description": "Data-driven waiting-time prediction using historical consultation patterns and live queue state.",
            "last_updated": now,
        }

    # IMPROVEMENT 4: Only genuinely waiting patients ahead count
    # COMPLETED, SKIPPED, and IN_CONSULTATION are excluded by filtering status == 'WAITING'
    patients_ahead_count = db.query(Patient).filter(
        Patient.status == "WAITING",
        (
            (Patient.arrival_time < patient.arrival_time) |
            ((Patient.arrival_time == patient.arrival_time) & (Patient.id < patient.id))
        )
    ).count()

    # IMPROVEMENT 3: Active consultation remaining time calculation (never negative)
    active_patient = db.query(Patient).filter(Patient.status == "IN_CONSULTATION").first()
    remaining_active_consultation = 0.0
    elapsed_current = 0.0

    if active_patient:
        if active_patient.consultation_start_time:
            elapsed_seconds = max(0.0, (now - active_patient.consultation_start_time).total_seconds())
            elapsed_current = max(0.0, elapsed_seconds / 60.0)
            # strictly non-negative remaining time
            remaining_active_consultation = max(0.0, round(expected_duration - elapsed_current, 1))
        else:
            remaining_active_consultation = max(0.0, round(expected_duration / 2.0, 1))
    elif doctor_status == "BUSY":
        remaining_active_consultation = max(0.0, round(expected_duration / 2.0, 1))
    else:
        remaining_active_consultation = 0.0

    # Status Adjustment & Movement description
    status_adjustment_minutes = 0.0
    if doctor_status == "PAUSED":
        status_adjustment_minutes = PAUSED_DOCTOR_BUFFER_MINUTES
        queue_movement = "Doctor Paused / On Break"
    elif patients_ahead_count == 0 and not active_patient and doctor_status == "AVAILABLE":
        queue_movement = "Ready - Proceed to Room"
    elif patients_ahead_count == 0 and (active_patient or doctor_status == "BUSY"):
        queue_movement = "Up Next (After Current Consultation)"
    else:
        queue_movement = "Moving Normally"

    # Core Formula:
    # Estimated Wait = Remaining Active Consultation Time
    #                + (Patients Ahead × Historical Expected Duration)
    #                + Status Adjustment
    total_wait = (
        remaining_active_consultation +
        (patients_ahead_count * expected_duration) +
        status_adjustment_minutes
    )

    # Strictly non-negative wait time
    total_wait = max(0.0, total_wait)

    if patients_ahead_count == 0 and not active_patient and doctor_status == "AVAILABLE":
        estimated_wait_int = 0
        range_min = 0
        range_max = 2
    else:
        estimated_wait_int = max(0, int(round(total_wait)))
        range_min = max(0, int(round(total_wait * 0.80)))
        range_max = max(estimated_wait_int + 1, int(round(total_wait * 1.25)))

    # Transparent prediction breakdown dictionary
    return {
        "token_number": patient.token_number,
        "patient_name": patient.name,
        "status": patient.status,
        "patients_ahead": patients_ahead_count,
        "historical_avg_duration": expected_duration,
        "average_consultation_duration": expected_duration,  # backwards compatibility
        "active_remaining_minutes": round(remaining_active_consultation, 1),
        "status_adjustment_minutes": round(status_adjustment_minutes, 1),
        "estimated_wait_minutes": estimated_wait_int,
        "estimated_wait_range_min": range_min,
        "estimated_wait_range_max": range_max,
        "current_consultation_elapsed_minutes": round(elapsed_current, 1),
        "doctor_name": doctor_name,
        "doctor_status": doctor_status,
        "doctor_room": doctor_room,
        "queue_movement_status": queue_movement,
        "historical_samples_count": total_samples,
        "time_of_day": current_tod,
        "time_of_day_samples_count": tod_samples,
        "calculation_method": calc_method,
        "model_description": "Data-driven waiting-time prediction using historical consultation patterns and live queue state.",
        "last_updated": now,
    }
