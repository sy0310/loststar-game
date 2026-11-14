"""Run real HTTP browser tests, including Safari MP3 byte-range requests."""
import os
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
server = None
try:
    if 'SURVIVOR_URL' not in os.environ:
        server = subprocess.Popen(
            ['node', str(HERE / 'serve.cjs'), '--port', '0'],
            stdout=subprocess.PIPE, text=True,
        )
        line = server.stdout.readline().strip()
        if not line.startswith('Static survivor preview http://'):
            raise RuntimeError('HTTP preview failed to start')
        os.environ['SURVIVOR_URL'] = line.split('preview ', 1)[1]
    subprocess.run(['npm', '--prefix', str(HERE), 'run', 'test:browser'], check=True, env=os.environ)
finally:
    if server:
        server.terminate()
        server.wait(timeout=5)
