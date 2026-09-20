from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department = Column(String, default="General Medicine")
    room_number = Column(String, default="Consultation Room 102")
    status = Column(String, default="AVAILABLE")  # AVAILABLE, BUSY, PAUSED
    current_patient_id = Column(Integer, nullable=True)

    consultations = relationship("ConsultationHistory", back_populates="doctor")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String, default="General Medicine")
    arrival_time = Column(DateTime, default=datetime.utcnow)
    consultation_start_time = Column(DateTime, nullable=True)
    completed_time = Column(DateTime, nullable=True)
    status = Column(String, default="WAITING")  # WAITING, IN_CONSULTATION, COMPLETED, SKIPPED
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)

class ConsultationHistory(Base):
    __tablename__ = "consultation_history"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    consultation_duration_minutes = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    time_of_day = Column(String, default="MORNING")  # MORNING, AFTERNOON, EVENING

    doctor = relationship("Doctor", back_populates="consultations")
