from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

# Doctor Schemas
class DoctorBase(BaseModel):
    name: str
    department: str
    room_number: str
    status: str

class DoctorStatusUpdate(BaseModel):
    status: str = Field(..., description="AVAILABLE, BUSY, or PAUSED")

class DoctorResponse(DoctorBase):
    id: int
    current_patient_id: Optional[int] = None

    class Config:
        from_attributes = True

# Patient Schemas
class PatientCreate(BaseModel):
    name: str
    department: Optional[str] = "General Medicine"
    token_number: Optional[str] = None  # Auto-generated if not provided

class PatientResponse(BaseModel):
    id: int
    token_number: str
    name: str
    department: str
    arrival_time: datetime
    consultation_start_time: Optional[datetime] = None
    completed_time: Optional[datetime] = None
    status: str
    doctor_id: Optional[int] = None
    patients_ahead: Optional[int] = 0
    estimated_wait_minutes: Optional[int] = 0

    class Config:
        from_attributes = True

class PredictionBreakdown(BaseModel):
    token_number: str
    patient_name: str
    status: str
    patients_ahead: int
    historical_avg_duration: float
    average_consultation_duration: float
    active_remaining_minutes: float
    status_adjustment_minutes: float
    estimated_wait_minutes: int
    estimated_wait_range_min: int
    estimated_wait_range_max: int
    current_consultation_elapsed_minutes: float
    doctor_name: str
    doctor_status: str
    doctor_room: str
    queue_movement_status: str  # Moving, Slow, Paused, Called
    historical_samples_count: int
    time_of_day: Optional[str] = "MORNING"
    time_of_day_samples_count: Optional[int] = 0
    calculation_method: Optional[str] = "doctor_overall_trimmed_mean"
    model_description: Optional[str] = "Data-driven waiting-time prediction using historical consultation patterns and live queue state."
    last_updated: datetime

class QueueSummary(BaseModel):
    total_waiting: int
    in_consultation_count: int
    total_completed: int
    total_skipped: int
    current_token: Optional[str] = None
    current_patient_name: Optional[str] = None
    doctor: DoctorResponse
    average_wait_minutes: float
    patients: List[PatientResponse]
    last_updated: datetime

class HealthCheck(BaseModel):
    status: str
    version: str
    database: str
    active_tokens: int

# Privacy-compliant Public Queue Schemas for Patient View
class PublicQueueItem(BaseModel):
    token_number: str
    status: str  # COMPLETED, IN_CONSULTATION, WAITING, SKIPPED
    arrival_time: Optional[datetime] = None

    class Config:
        from_attributes = True

class PublicQueueResponse(BaseModel):
    total_waiting: int
    current_token: Optional[str] = None
    doctor_status: Optional[str] = None
    tokens: List[PublicQueueItem]
    last_updated: datetime

