from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0].endswith('/models/23_workbench.glb') and not Path('assets/tripo/records/qa-restore-workbench.flag').exists():
            self.send_error(404, 'Deliberate workbench failure for local QA')
        else:
            super().do_GET()
ThreadingHTTPServer(('127.0.0.1',4175),partial(Handler,directory='static')).serve_forever()
