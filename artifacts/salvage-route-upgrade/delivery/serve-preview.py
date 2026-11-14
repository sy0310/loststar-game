from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
class PreviewHandler(SimpleHTTPRequestHandler):
    version_prefix='/loststar-salvage/b26455a/'
    def do_GET(self):
        if self.path.split('?',1)[0] in ('/loststar-salvage/','/loststar-salvage/index.html'):
            self.send_response(302)
            self.send_header('Location',self.version_prefix)
            self.end_headers()
            return
        super().do_GET()
    def translate_path(self,path):
        if path.startswith(self.version_prefix):
            path='/loststar-salvage/'+path[len(self.version_prefix):]
        return super().translate_path(path)
    def end_headers(self):
        self.send_header('Cache-Control','no-cache, no-store, must-revalidate')
        self.send_header('Pragma','no-cache')
        self.send_header('Expires','0')
        super().end_headers()
root=Path('/Users/shuhuayu/loststar-game/releases/salvage-v02-b26455a')
ThreadingHTTPServer(('127.0.0.1',4283),partial(PreviewHandler,directory=str(root))).serve_forever()
