import os
import sys

# Add the project root to sys.path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_auth_flow():
    print("--- 1. Testing Registration ---")
    reg_data = {
        "email": "testuser@example.com",
        "name": "Test User",
        "password": "securepassword123",
        "confirm_password": "securepassword123",
    }

    # Register user
    response = client.post("/api/auth/register", json=reg_data)
    if response.status_code == 201:
        print("Registration successful!")
        print(response.json())
    elif response.status_code == 400 and "already registered" in response.json().get(
        "detail", ""
    ):
        print("User already registered. Proceeding to login test...")
    else:
        print(f"Registration failed: {response.status_code}")
        print(response.json())
        sys.exit(1)

    print("\n--- 2. Testing Login ---")
    login_data = {
        "email": "testuser@example.com",
        "password": "securepassword123",
    }
    response = client.post("/api/auth/login", json=login_data)
    if response.status_code == 200:
        print("Login successful!")
        tokens = response.json()
        print(tokens)
        access_token = tokens["access_token"]
    else:
        print(f"Login failed: {response.status_code}")
        print(response.json())
        sys.exit(1)

    print("\n--- 3. Testing Get Profile (/me) ---")
    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/auth/me", headers=headers)
    if response.status_code == 200:
        print("Profile retrieval successful!")
        print(response.json())
    else:
        print(f"Profile retrieval failed: {response.status_code}")
        print(response.json())
        sys.exit(1)

    print("\n--- 4. Testing Logout ---")
    response = client.post("/api/auth/logout", headers=headers)
    if response.status_code == 200:
        print("Logout successful!")
        print(response.json())
    else:
        print(f"Logout failed: {response.status_code}")
        print(response.json())
        sys.exit(1)

    print("\n--- 5. Testing Profile Retrieval After Logout (Should fail) ---")
    response = client.get("/api/auth/me", headers=headers)
    if response.status_code == 401:
        print("Profile retrieval failed as expected! (Token is blacklisted)")
        print(response.json())
    else:
        print(
            f"Error: Profile retrieval succeeded but should have failed: {response.status_code}"
        )
        print(response.json())
        sys.exit(1)

    print("\nAll auth flow checks passed successfully!")


if __name__ == "__main__":
    test_auth_flow()
