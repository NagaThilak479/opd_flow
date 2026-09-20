from starlette.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)

    print("--- 1. Testing Doctor Login (Valid) ---")
    res = client.post("/api/auth/doctor-login", json={"doctor_id": "DR-SARAH-001", "pin": "1234"})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["role"] == "DOCTOR"
    assert data["doctor_id"] == "DR-SARAH-001"
    print("Doctor Login Passed:", data)

    print("\n--- 2. Testing Doctor Login (Invalid PIN) ---")
    res = client.post("/api/auth/doctor-login", json={"doctor_id": "DR-SARAH-001", "pin": "wrong"})
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("Doctor Invalid Login correctly rejected with 401")

    print("\n--- 3. Testing Patient Login (Valid A108) ---")
    res = client.post("/api/auth/patient-login", json={"token_number": "A108"})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    p_data = res.json()
    assert p_data["role"] == "PATIENT"
    assert p_data["token_number"] == "A108"
    print("Patient Login Passed for A108:", p_data)

    print("\n--- 4. Testing Patient Login (Non-existent Token) ---")
    res = client.post("/api/auth/patient-login", json={"token_number": "Z999"})
    assert res.status_code == 404, f"Expected 404, got {res.status_code}"
    print("Non-existent token correctly rejected with 404")

    print("\n--- 5. Testing Patient Access to Own Prediction (A108) ---")
    res = client.get("/api/prediction/A108", headers={"X-Patient-Token": "A108"})
    assert res.status_code == 200
    pred = res.json()
    assert pred["token_number"] == "A108"
    print("A108 session accessed own prediction successfully:", pred["estimated_wait_minutes"], "min")

    print("\n--- 6. Testing Patient Attempting to View Other Prediction (A105 with A108 session) ---")
    res = client.get("/api/prediction/A105", headers={"X-Patient-Token": "A108"})
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print("Blocked with 403 Forbidden as required!")

    print("\n--- 7. Testing Patient Attempting to Call Doctor Action (POST /api/queue/next) ---")
    res = client.post("/api/queue/next", headers={"X-User-Role": "PATIENT"})
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print("Blocked patient from calling next patient with 403 Forbidden!")

    print("\n--- 8. Testing Public Queue Privacy ---")
    res = client.get("/api/queue/public")
    assert res.status_code == 200
    pub_data = res.json()
    tokens = pub_data["tokens"]
    assert len(tokens) > 0
    for item in tokens:
        assert "token_number" in item
        assert "status" in item
        # Ensure patient name is NOT exposed in public queue
        assert "name" not in item
        assert "patient_name" not in item
    print("Public queue privacy verified: tokens and statuses only, no names exposed.")

    print("\n>>> ALL AUTH AND SECURITY BACKEND TESTS PASSED! <<<")

if __name__ == "__main__":
    run_tests()
