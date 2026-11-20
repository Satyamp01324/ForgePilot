"""Verify Task A against the Flask checkout on PYTHONPATH."""
from unittest.mock import patch

from flask.helpers import get_debug_flag


cases = {
    None: False, "": False, "0": False, "false": False, "no": False,
    "off": False, "disabled": False, "OFF": False, "DISABLED": False,
    "FALSE": False, "NO": False, "1": True, "yes": True, "True": True,
    "on": True, "enabled": True, " off ": True,
}
for value, expected in cases.items():
    env = {} if value is None else {"FLASK_DEBUG": value}
    with patch.dict("os.environ", env, clear=True):
        assert get_debug_flag() is expected, (value, expected)
print(f"Task A: {len(cases)} debug flag cases passed.")
