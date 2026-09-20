import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def test_all():
    print("--- 1. Testing GET /api/health ---")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health failed: {r.status_code}"
    print("Health check passed:", r.json())

    print("\n--- 2. Testing GET /api/queue ---")
    r = requests.get(f"{BASE_URL}/queue")
    assert r.status_code == 200
    queue_data = r.json()
    print(f"Total Waiting: {queue_data['total_waiting']}, In Consultation: {queue_data['in_consultation_count']}, Current: {queue_data['current_token']}")
    assert queue_data['total_waiting'] > 0
    assert len(queue_data['patients']) > 0

    print("\n--- 3. Testing GET /api/queue/A108 ---")
    r = requests.get(f"{BASE_URL}/queue/A108")
    assert r.status_code == 200
    p = r.json()
    print(f"Token A108: {p['name']}, Status: {p['status']}, Ahead: {p['patients_ahead']}, Est Wait: {p['estimated_wait_minutes']} min")
    initial_ahead = p['patients_ahead']
    initial_wait = p['estimated_wait_minutes']

    print("\n--- 4. Testing GET /api/prediction/A108 ---")
    r = requests.get(f"{BASE_URL}/prediction/A108")
    assert r.status_code == 200
    pred = r.json()
    print(f"Prediction: {pred['estimated_wait_minutes']} min (Range: {pred['estimated_wait_range_min']}-{pred['estimated_wait_range_max']} min)")
    print(f"Historical Avg Duration: {pred['historical_avg_duration']} min, Active Remaining: {pred['active_remaining_minutes']} min")
    print(f"Status Adjustment: {pred['status_adjustment_minutes']} min, Method: {pred['calculation_method']}, Time-of-Day: {pred['time_of_day']}")
    print(f"Model Description: {pred['model_description']}")
    assert pred['historical_avg_duration'] > 0
    assert pred['active_remaining_minutes'] >= 0
    assert pred['status_adjustment_minutes'] >= 0
    assert pred['estimated_wait_minutes'] >= 0
    assert "historical consultation patterns" in pred['model_description']

    print("\n--- 5. Testing POST /api/queue/patient (Walk-In) ---")
    r = requests.post(f"{BASE_URL}/queue/patient", json={"name": "Test Walkin", "department": "General Medicine"})
    assert r.status_code == 200
    new_p = r.json()
    print(f"Added patient: {new_p['token_number']} ({new_p['name']})")

    print("\n--- 6. Testing POST /api/queue/next (Advancing queue) ---")
    r = requests.post(f"{BASE_URL}/queue/next")
    assert r.status_code == 200
    call_res = r.json()
    print("Call next result:", call_res['message'])

    # Check A108 new wait time and patients ahead!
    r = requests.get(f"{BASE_URL}/queue/A108")
    p_after = r.json()
    print(f"A108 after Call Next: Ahead={p_after['patients_ahead']} (was {initial_ahead}), Wait={p_after['estimated_wait_minutes']} min (was {initial_wait} min)")
    assert p_after['patients_ahead'] < initial_ahead, "Patients ahead should have decreased!"

    print("\n--- 7. Testing POST /api/doctor/status (PAUSED) ---")
    r = requests.post(f"{BASE_URL}/doctor/status", json={"status": "PAUSED"})
    assert r.status_code == 200
    print("Doctor status set to PAUSED")

    r = requests.get(f"{BASE_URL}/prediction/A108")
    pred_paused = r.json()
    print(f"A108 Prediction when doctor paused: Wait={pred_paused['estimated_wait_minutes']} min, Movement={pred_paused['queue_movement_status']}")
    assert "Pause" in pred_paused['queue_movement_status'] or "Break" in pred_paused['queue_movement_status']

    print("\n--- 8. Testing POST /api/queue/reset (Reset Demo) ---")
    r = requests.post(f"{BASE_URL}/queue/reset")
    assert r.status_code == 200
    print("Demo queue reset successful!")

    # Verify reset
    r = requests.get(f"{BASE_URL}/queue")
    q_reset = r.json()
    print(f"Queue after reset: Total Waiting={q_reset['total_waiting']}, Current Token={q_reset['current_token']}")
    assert q_reset['current_token'] == "A104"

    print("\n>>> ALL API TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_all()
