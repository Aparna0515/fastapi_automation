import os
import sys

# Add the project root to sys.path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)

from fastapi.testclient import TestClient
from app.main import app
from app.core.celery import celery_app

# Force Celery to execute tasks synchronously and store results in memory
celery_app.conf.task_always_eager = True
celery_app.conf.task_store_eager_result = True
celery_app.conf.result_backend = "cache+memory://"
celery_app.conf.task_eager_propagates = True

client = TestClient(app)


def run_upload_tests():
    print("--- 1. Logging In to obtain access token ---")
    login_data = {
        "email": "testuser@example.com",
        "password": "securepassword123",
    }
    response = client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        print("Test user not found, registering a new one...")
        reg_data = {
            "email": "testuser@example.com",
            "name": "Test User",
            "password": "securepassword123",
            "confirm_password": "securepassword123",
        }
        client.post("/api/auth/register", json=reg_data)
        response = client.post("/api/auth/login", json=login_data)

    assert response.status_code == 200, "Login failed!"
    tokens = response.json()
    access_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    print("Access token acquired successfully!\n")

    print("--- 2. Testing Course CSV Upload ---")
    course_csv_content = (
        "course_name\n"
        "Computer Science\n"
        "Data Science\n"
        "Business Administration\n"
    )
    
    files = {
        "file": ("courses.csv", course_csv_content, "text/csv")
    }
    data = {
        "model_name": "Course"
    }
    
    response = client.post("/api/upload/", data=data, files=files, headers=headers)
    print(f"Course CSV Status: {response.status_code}")
    upload_res = response.json()
    print(upload_res)
    assert response.status_code == 200
    assert upload_res["success"] is True
    
    # Get import task details
    task_id = upload_res["task_id"]
    status_res = client.get(f"/api/upload/tasks/{task_id}", headers=headers).json()
    print(f"Course Import Task Status: {status_res['status']}")
    print(status_res["result"])
    assert status_res["status"] == "SUCCESS"

    print("\n--- 3. Testing Student CSV Upload (with Course auto-resolution) ---")
    student_csv_content = (
        "name,email,course\n"
        "Alice Smith,alice.smith@example.com,Computer Science\n"
        "Bob Jones,bob.jones@example.com,Data Science\n"
        "Charlie Brown,charlie.brown@example.com,Physics\n"
    )
    
    files = {
        "file": ("students.csv", student_csv_content, "text/csv")
    }
    data = {
        "model_name": "Student"
    }
    response = client.post("/api/upload/", data=data, files=files, headers=headers)
    print(f"Student CSV Status: {response.status_code}")
    upload_res = response.json()
    print(upload_res)
    assert response.status_code == 200
    
    # Check task status
    task_id = upload_res["task_id"]
    status_res = client.get(f"/api/upload/tasks/{task_id}", headers=headers).json()
    print(f"Student Import Task Status: {status_res['status']}")
    print(status_res["result"])
    assert status_res["status"] == "SUCCESS"

    print("\n--- 4. Testing Course CSV Export ---")
    export_data = {
        "model_name": "Course"
    }
    response = client.post("/api/upload/export", data=export_data, headers=headers)
    print(f"Course Export Trigger Status: {response.status_code}")
    export_res = response.json()
    print(export_res)
    assert response.status_code == 200
    assert export_res["success"] is True

    # Retrieve export task result
    task_id = export_res["task_id"]
    status_res = client.get(f"/api/upload/tasks/{task_id}", headers=headers).json()
    print(f"Course Export Task Status: {status_res['status']}")
    print("CSV Content Output:")
    print(status_res["result"]["csv_data"])
    assert status_res["status"] == "SUCCESS"
    assert "course_name" in status_res["result"]["csv_data"]
    assert "Computer Science" in status_res["result"]["csv_data"]

    print("\n--- 5. Testing Student CSV Export ---")
    export_data = {
        "model_name": "Student"
    }
    response = client.post("/api/upload/export", data=export_data, headers=headers)
    print(f"Student Export Trigger Status: {response.status_code}")
    export_res = response.json()
    print(export_res)
    assert response.status_code == 200
    assert export_res["success"] is True

    # Retrieve export task result
    task_id = export_res["task_id"]
    status_res = client.get(f"/api/upload/tasks/{task_id}", headers=headers).json()
    print(f"Student Export Task Status: {status_res['status']}")
    print("CSV Content Output:")
    print(status_res["result"]["csv_data"])
    assert status_res["status"] == "SUCCESS"
    assert "email" in status_res["result"]["csv_data"]
    assert "alice.smith@example.com" in status_res["result"]["csv_data"]
    assert "Physics" in status_res["result"]["csv_data"]

    print("\n--- 6. Testing User Profile Update ---")
    update_data = {
        "name": "Updated Test User Name",
        "email": "updateduser@example.com",
        "password": "newsecurepassword123"
    }
    response = client.put("/api/auth/profile", json=update_data, headers=headers)
    print(f"Profile Update Status: {response.status_code}")
    update_res = response.json()
    print(update_res)
    assert response.status_code == 200
    assert update_res["name"] == "Updated Test User Name"
    assert update_res["email"] == "updateduser@example.com"

    # Since the user's email was updated in the DB, the old JWT token (carrying testuser@example.com sub)
    # is no longer valid for lookup. We must re-authenticate with the new credentials.
    print("Re-authenticating with new credentials...")
    login_res = client.post("/api/auth/login", json={
        "email": "updateduser@example.com",
        "password": "newsecurepassword123"
    })
    assert login_res.status_code == 200
    new_token = login_res.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # Revert user email and password back to keep database clean
    print("Reverting profile credentials...")
    revert_data = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "securepassword123"
    }
    revert_res = client.put("/api/auth/profile", json=revert_data, headers=new_headers)
    assert revert_res.status_code == 200
    assert revert_res.json()["name"] == "Test User"
    assert revert_res.json()["email"] == "testuser@example.com"

    print("\nAll dynamic upload, export, background task, and profile settings checks passed successfully!")


if __name__ == "__main__":
    run_upload_tests()
