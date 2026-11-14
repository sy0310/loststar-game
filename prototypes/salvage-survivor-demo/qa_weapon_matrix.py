"""Run the actual damage/slot assertions, not injected HTML or mocked storage."""
import subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
subprocess.run(['node', str(HERE / 'tests/model.test.cjs')], cwd=HERE, check=True)
