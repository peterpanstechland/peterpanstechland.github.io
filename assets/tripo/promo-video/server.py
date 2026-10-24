from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import urllib.parse
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'static'),**kw)
 def do_GET(self):
  path=urllib.parse.urlsplit(self.path).path
  if path=='/promo/film.js':data=(OUT/'film.js').read_bytes();kind='text/javascript'
  elif path=='/maker-garage-preview/community/config.json':data=b'{"apiBase":"http://127.0.0.1:4180/api/","mode":"shared","maxLocalEntries":48}';kind='application/json'
  elif path in ['/api/sponsors/plans','/api/sponsors']:
   data=(OUT/('plans.json' if path.endswith('/plans') else 'sponsors.json')).read_bytes();kind='application/json'
  elif path.startswith('/promo/assets/'):
   f=(ROOT/path.removeprefix('/promo/')).resolve()
   if not f.is_relative_to(ROOT/'assets'):self.send_error(403);return
   data=f.read_bytes();kind='image/png'
  elif path=='/maker-garage-preview/scene.js':
   s=(ROOT/'static/maker-garage-preview/scene.js').read_text(encoding='utf-8')
   s="import {setupFilm} from '/promo/film.js';\n"+s
   s=s.replace('  const cameraChanged = controls.update();','  window.filmBefore?.();\n  const cameraChanged = controls.update();')
   s=s.replace('  if(heroPending){','  window.filmAfter?.();\n  if(heroPending){')
   s=s.replace('  await loadConfiguration();','  await loadConfiguration();\n  setupFilm({THREE,camera,controls,renderer,setShutterOpen,requestFrame});')
   data=s.encode();kind='text/javascript'
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
 def do_POST(self):
  if self.path!='/promo/upload':self.send_error(404);return
  n=int(self.headers['Content-Length']);(OUT/'garage-recording.webm').write_bytes(self.rfile.read(n))
  self.send_response(200);self.end_headers();self.wfile.write(b'OK')
 def log_message(self,*a):pass
ThreadingHTTPServer(('127.0.0.1',4180),Handler).serve_forever()
