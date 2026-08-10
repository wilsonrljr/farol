"""Test path bootstrap for legacy imports.

Some older regression tests import the application as ``app`` rather than
``backend.app``.  Make focused test runs deterministic instead of relying on
pytest collecting ``backend/app/tests/conftest.py`` first.
"""

import sys
from pathlib import Path

BACKEND_ROOT = str(Path(__file__).resolve().parents[1])
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)
