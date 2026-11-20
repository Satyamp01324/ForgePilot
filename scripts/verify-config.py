"""Check Task B using the actual Flask CLI and a dummy app."""
import json
from pathlib import Path
import subprocess
import sys

app = Path(__file__).resolve().parents[1] / "submission" / "flask_demo_app.py"
process = subprocess.run(
    [sys.executable, "-m", "flask", "--app", str(app), "config"],
    check=True,
    capture_output=True,
    text=True,
)
data = json.loads(process.stdout)
assert data["DISPLAY_NAME"] == "ForgePilot demonstration"
assert data["FEATURE_ENABLED"] is True
assert data["NESTED_SETTINGS"]["COUNT"] == 2
assert "demo-only-nested-token" not in process.stdout
sensitive = {
    "SECRET_KEY": "demo-only-secret",
    "DATABASE_PASSWORD": "demo-only-password",
    "SERVICE_TOKEN": "demo-only-token",
    "API_CREDENTIAL": "demo-only-credential",
}
for key, dummy in sensitive.items():
    assert key in data, key
    assert dummy not in process.stdout, key
print("Task B: Flask CLI returned valid JSON with all four illustrative secrets masked.")
