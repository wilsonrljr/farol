import os
import sys


def _ensure_backend_on_sys_path() -> None:
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


_ensure_backend_on_sys_path()
