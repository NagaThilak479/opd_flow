# OPD Flow 🩺
> **"Know your place. Know your wait."**
> A real-time outpatient department (OPD) queue management and waiting-time prediction system.

OPD Flow eliminates waiting-room anxiety for hospital patients by showing their exact real-time queue position, number of patients ahead, attending doctor status, and dynamically recalculated estimated waiting times that update instantly as the queue moves.

---

## 🌟 Key Features

### For Patients
- **Real-Time Token Tracking**: Enter or select any token (e.g. `A108`) to view live queue position.
- **Dynamic Waiting-Time Predictions**: Computes estimated wait minutes based on doctor's historical consultation durations and active consultation elapsed time.
- **Live Progress Timeline**: Visual stages tracking check-in, waiting queue, "Up Next", consultation room, and completion.
- **Doctor Transparency**: Know whether the doctor is actively consulting, available, or on a scheduled break.
- **Auto-Sync**: Automatically synchronizes with the hospital queue every 3 seconds without manual refreshing.
- **Audio/Visual Call Alert**: Displays an instant callout banner when the patient's token is called to the consultation room.

### For Hospital Staff & Doctors
- **Live Queue Management**: 1-click **"Call Next Patient"**, **"Mark Completed"**, and **"Skip / Absent"**.
- **Doctor Status Controls**: Seamless toggling between `Available`, `Busy`, and `Paused / On Break`.
- **Walk-In Registration**: Quickly issue new tokens with automatic token numbering.
- **Queue Analytics**: Visual chart showing waiting time distribution across upcoming tokens.
- **Instant Demo Reset**: 1-click button to reset the OPD state back to initial synthetic demo data.

---

## 🏗️ Architecture & Project Structure

```
opd-flow/
├── backend/
│   ├── app/
│   │   ├── database.py           # SQLite connection & SQLAlchemy Session
│   │   ├── models.py             # Doctor, Patient, ConsultationHistory entities
│   │   ├── schemas.py            # Pydantic validation & response schemas
│   │   ├── seed.py               # Synthetic OPD dataset (Tokens A101-A120, 50+ consultations)
│   │   ├── services/
│   │   │   └── prediction.py     # Isolated waiting-time prediction engine
│   │   ├── routes/
│   │   │   ├── queue.py          # Queue endpoints (list, get, add, next, complete, skip, reset)
│   │   │   ├── doctor.py         # Doctor status controls
│   │   │   └── prediction.py     # Prediction breakdown endpoint
│   │   └── main.py               # FastAPI entry point, CORS, startup auto-seeding
│   ├── run.py                    # Server launcher
│   ├── test_api.py               # Automated end-to-end API test script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Sticky header with doctor status & demo reset
│   │   │   ├── QueueVisualizer.jsx # Patient queue stage timeline
│   │   │   ├── StatCard.jsx      # Reusable healthcare KPI card
│   │   │   └── AddPatientModal.jsx # Walk-in patient registration dialog
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx   # Hero banner & dual portals
│   │   │   ├── PatientPage.jsx   # Prominent waiting-time card, doctor info, auto-sync
│   │   │   └── StaffPage.jsx     # Staff dashboard, queue table, chart, actions
│   │   ├── services/
│   │   │   └── api.js            # Axios client with backend endpoints
│   │   ├── App.jsx               # React Router routes
│   │   └── index.css             # Tailwind CSS healthcare styling
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 🧠 Prediction Engine

The baseline prediction engine is cleanly isolated in `backend/app/services/prediction.py`:

$$\text{Estimated Wait} = \text{Remaining Active Consultation} + (N_{\text{patients ahead}} \times \bar{D}_{\text{historical}}) + \text{Status Buffer}$$

- **Doctor Historical Average ($\bar{D}_{\text{historical}}$)**: Calculated from the doctor's completed consultations in `ConsultationHistory` (e.g. 7.5 min / patient). Fallback safe default is 7.5 min if fewer than 3 records exist.
- **Active Consultation Adjustment**: If a patient is currently in consultation, computes elapsed minutes and subtracts from average: $\max(1.0, \bar{D} - \text{elapsed})$.
- **Doctor Status Adjustment**: If doctor status is `PAUSED`, an extra 10-minute break buffer is added and marked in the queue status.
- **Confidence Range**: Provides lower and upper expected bounds (e.g., $20 - 31\text{ min}$) alongside the point estimate.

---

## 🚀 Quick Start (Running Locally)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start Backend Server

```bash
cd backend
python -m pip install -r requirements.txt
python run.py
```
*Backend runs on: `http://127.0.0.1:8000`*  
*Swagger API Docs: `http://127.0.0.1:8000/docs`*  
*(The database `opd_flow.db` is created and auto-seeded automatically on first run).*

### 2. Start Frontend Server

```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on: `http://localhost:5173`*

---

## 🧪 Automated Tests

Run the automated integration test suite verifying all 8 core API flows:

```bash
cd backend
python test_api.py
```

---

## 🎯 Demo Script for Hackathon Judges

1. **Landing Page (`http://localhost:5173/`)**:
   - Point out the headline **"Know your place. Know your wait."**
   - Note the live Doctor status indicator in the top navbar (`Dr. Sarah Mitchell, MD • In Consultation`).
   - Click the **"A108 (3 Ahead)"** demo token chip.

2. **Patient Experience (`/patient/A108`)**:
   - Show the large prominent **Estimated Wait Card** (**25 min**, expected range 20–31 min).
   - Point out **Patients Ahead: 3**.
   - Show the **Queue Progress Timeline** and the transparent calculation breakdown explaining how the 25 minutes was estimated.

3. **Staff Dashboard Movement (`/staff`)**:
   - Open `/staff` in the navbar or in a side-by-side tab.
   - Show the KPI stats (13 waiting, 1 in consultation, 4 completed).
   - Point out that **Token A104** is currently in Room 102.
   - Click the big **"Call Next Patient"** button.
   - A notification confirms **A105 (David Miller)** is called to Room 102.

4. **Live Synchronization Proof**:
   - Switch back to the Patient View for **A108**.
   - Watch the numbers dynamically update:
     - **Patients Ahead** decreased from **3 to 2**!
     - **Estimated Wait** recalculated from **25 min down to 22 min**!

5. **Doctor Status Simulation**:
   - In Staff Dashboard, click **"Paused / Break"**.
   - Switch back to Patient View: The queue status updates to **"Doctor Paused / On Break"** and applies a 10-minute adjustment.

6. **1-Click Demo Reset**:
   - Click **"Reset Demo"** in the top navbar anytime to return the entire hospital state back to the beginning.

---

## ⚠️ Known Limitations & Future Roadmap

- **Single Clinic Scope**: MVP manages a single primary OPD room/doctor. Multi-doctor multi-specialty routing is planned for v2.
- **Baseline Prediction vs ML**: Uses an empirical statistical model based on historical distributions. Can be upgraded to a Random Forest or XGBoost regressor incorporating patient triage severity and historical time-of-day traffic.
- **Authentication**: Intentionally omitted for the 12-hour hackathon prototype to focus on queue mechanics and user experience.
