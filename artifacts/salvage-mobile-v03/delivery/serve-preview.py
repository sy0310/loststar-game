"""Same-origin development preview only. Frozen package bytes are never rewritten."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--version', required=True)
parser.add_argument('--port', type=int, default=4283)
args = parser.parse_args()
assert len(args.version) == 7 and all(c in '0123456789abcdef' for c in args.version)

class Preview(SimpleHTTPRequestHandler):
    prefix = '/loststar-salvage/' + args.version + '/'
    def do_GET(self):
        route = self.path.split('?', 1)[0]
        if route not in [self.prefix, self.prefix + 'index.html'] and route in ['/loststar-salvage/', '/loststar-salvage/index.html', '/loststar-salvage/b26455a/', '/loststar-salvage/b26455a/index.html']:
            self.send_response(302)
            self.send_header('Location', self.prefix)
            self.end_headers()
            return
        super().do_GET()
    def translate_path(self, route):
        if route.startswith(self.prefix):
            route = '/loststar-salvage/' + route[len(self.prefix):]
        return super().translate_path(route)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

ThreadingHTTPServer(('127.0.0.1', args.port), partial(Preview, directory=str(args.root.resolve()))).serve_forever()
