"""Compatibility entry point. Tests a served URL with real browser storage."""
import os
import subprocess
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

HERE = Path(__file__).resolve().parent
server = None
try:
    if 'SURVIVOR_URL' not in os.environ:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(HERE)))
        Thread(target=server.serve_forever, daemon=True).start()
        os.environ['SURVIVOR_URL'] = f'http://127.0.0.1:{server.server_port}/'
    subprocess.run(['npm', '--prefix', str(HERE), 'run', 'test:browser'], check=True, env=os.environ)
finally:
    if server:
        server.shutdown()
