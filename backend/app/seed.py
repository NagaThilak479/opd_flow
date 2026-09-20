from datetime import datetime, timedelta, date
import random
from sqlalchemy.orm import Session
try:
    from .database import engine, Base, SessionLocal
    from .models import Doctor, Patient, ConsultationHistory
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.database import engine, Base, SessionLocal
    from app.models import Doctor, Patient, ConsultationHistory

def seed_database(db: Session = None, force_reset: bool = False):
    """
    Seeds the database with realistic synthetic OPD data for demo.
    """
    if db is None:
        db = SessionLocal()
        close_on_finish = True
    else:
        close_on_finish = False

    try:
        # Create tables if not exist
        Base.metadata.create_all(bind=engine)

        # If data already exists and not force reset, don't overwrite
        existing_patients = db.query(Patient).count()
        if existing_patients > 0 and not force_reset:
            return

        if force_reset:
            # Delete in order
            db.query(ConsultationHistory).delete()
            db.query(Patient).delete()
            db.query(Doctor).delete()
            db.commit()

        # 1. Create Primary Doctor
        doctor = Doctor(
            name="Dr. Sarah Mitchell, MD",
            department="General Medicine & Outpatient",
            room_number="Room 102",
            status="BUSY",
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

        # 2. Create Realistic Historical Consultations (50+ past records)
        # Average around 7.2 - 7.8 mins, realistic variation 4 to 12 mins
        random.seed(42)
        base_date = date.today() - timedelta(days=7)
        consultation_records = []

        durations_pool = [
            5.2, 6.8, 8.1, 7.5, 9.0, 6.4, 7.8, 8.5, 5.9, 10.2,
            6.1, 7.3, 8.0, 7.1, 6.9, 8.4, 9.5, 5.5, 7.0, 7.6,
            6.7, 8.2, 7.9, 6.3, 11.1, 7.4, 8.3, 5.8, 6.5, 7.7,
            8.9, 6.2, 7.5, 8.0, 7.2, 9.1, 6.6, 7.8, 5.4, 8.6,
            7.3, 6.8, 8.5, 7.0, 9.4, 6.0, 7.9, 8.1, 7.4, 6.7
        ]

        for i, dur in enumerate(durations_pool):
            day_offset = (i % 7)
            record_date = base_date + timedelta(days=day_offset)
            time_slot = "MORNING" if i % 2 == 0 else "AFTERNOON"
            consultation_records.append(
                ConsultationHistory(
                    doctor_id=doctor.id,
                    consultation_duration_minutes=dur,
                    date=record_date,
                    time_of_day=time_slot
                )
            )
        db.add_all(consultation_records)
        db.commit()

        # 3. Create Demo Patients
        now = datetime.utcnow()
        patients_data = [
            # Completed patients
            ("A101", "Arthur Pendelton", "COMPLETED", 55, 50, 42),
            ("A102", "Elena Rostova", "COMPLETED", 48, 42, 33),
            ("A103", "Marcus Vance", "COMPLETED", 40, 33, 24),
            # Currently in consultation (active for ~4 minutes)
            ("A104", "Priya Sharma", "IN_CONSULTATION", 32, 4, None),
            # Waiting patients in queue order
            ("A105", "David Miller", "WAITING", 28, None, None),
            ("A106", "Amina Yusuf", "WAITING", 25, None, None),
            ("A107", "Liam Chen", "WAITING", 22, None, None),
            ("A108", "Sofia Rodriguez", "WAITING", 19, None, None),
            ("A109", "James Wilson", "WAITING", 16, None, None),
            ("A110", "Ananya Patel", "WAITING", 14, None, None),
            ("A111", "Lucas Bernard", "WAITING", 11, None, None),
            ("A112", "Zoe Washington", "WAITING", 9, None, None),
            ("A113", "Oliver Wright", "WAITING", 7, None, None),
            ("A114", "Mei-Ling Zhou", "WAITING", 5, None, None),
            ("A115", "Tariq Mansour", "WAITING", 3, None, None),
            # Skipped patient (e.g. didn't show up when called)
            ("A116", "Chloe Dubois", "SKIPPED", 35, 15, None),
            # Additional queue
            ("A117", "Benjamin Clark", "WAITING", 2, None, None),
            ("A118", "Fatima Al-Sayed", "WAITING", 1, None, None),
        ]

        created_patients = []
        for token, name, status, arr_min_ago, start_min_ago, comp_min_ago in patients_data:
            arr_time = now - timedelta(minutes=arr_min_ago)
            start_time = (now - timedelta(minutes=start_min_ago)) if start_min_ago is not None else None
            comp_time = (now - timedelta(minutes=comp_min_ago)) if comp_min_ago is not None else None

            p = Patient(
                token_number=token,
                name=name,
                department="General Medicine",
                arrival_time=arr_time,
                consultation_start_time=start_time,
                completed_time=comp_time,
                status=status,
                doctor_id=doctor.id
            )
            created_patients.append(p)

        db.add_all(created_patients)
        db.commit()

        # Update doctor's current patient pointer
        in_consult = db.query(Patient).filter(Patient.status == "IN_CONSULTATION").first()
        if in_consult:
            doctor.current_patient_id = in_consult.id
            doctor.status = "BUSY"
            db.commit()

    finally:
        if close_on_finish:
            db.close()

if __name__ == "__main__":
    seed_database(force_reset=True)
    print("Database seeded successfully with demo OPD records.")
