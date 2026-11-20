"""Dummy application for the ForgePilot Flask CLI demonstration."""
from flask import Flask

app = Flask(__name__)
app.config.update(
    DISPLAY_NAME="ForgePilot demonstration",
    FEATURE_ENABLED=True,
    SECRET_KEY="demo-only-secret",
    DATABASE_PASSWORD="demo-only-password",
    SERVICE_TOKEN="demo-only-token",
    API_CREDENTIAL="demo-only-credential",
    NESTED_SETTINGS={"MORE_TOKEN": "demo-only-nested-token", "COUNT": 2},
    UNSERIALIZABLE=object(),
)
