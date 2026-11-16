"""Fixed-seed model strategies. Separate from natural real-time browser evidence."""
import subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
subprocess.run(['node', str(HERE / 'tests/simulate.cjs')], cwd=HERE, check=True)
