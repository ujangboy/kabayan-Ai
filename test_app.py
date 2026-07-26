from fastapi.testclient import TestClient
from main import app
import traceback

client = TestClient(app)

try:
    response = client.get("/dashboard")
    print(response.status_code)
    print(response.text)
except Exception as e:
    traceback.print_exc()
