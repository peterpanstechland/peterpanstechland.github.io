from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import urllib.parse,os
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'static'),**kw)
 def do_GET(self):
  path=urllib.parse.urlsplit(self.path).path
  if path in ['/promo/ad-film.js','/promo/orbit-film.js','/promo/ad-chapters.json','/promo/ad-en.json']:
   data=(OUT/Path(path).name).read_bytes();kind='application/json' if path.endswith('.json') else 'text/javascript'
  elif path.startswith('/promo/plaud-') and path.endswith('.mp4'):
   clips={'1':'ed6b91a973f6275fe0189c45c0d16d88','2':'8603b9304432e66c7f76e6ba4fdf70ae','3':'af6cd669c46a8a8be7a7a55a0233a514','5':'6750c8e0cec70eef34d6858a2a22b992'}
   key=path.removeprefix('/promo/plaud-').removesuffix('.mp4')
   if key not in clips:self.send_error(404);return
   footage=Path(os.environ.get('TECHLAND_PLAUD_CLIPS_DIR',str(ROOT/'.local-media/plaud-originals')))
   data=(footage/(clips[key]+'.mp4')).read_bytes();kind='video/mp4'
  elif path=='/maker-garage-preview/community/config.json':data=b'{"apiBase":"http://127.0.0.1:4181/api/","mode":"shared","maxLocalEntries":48}';kind='application/json'
  elif path in ['/api/sponsors/plans','/api/sponsors']:
   data=(OUT/('plans.json' if path.endswith('/plans') else 'sponsors.json')).read_bytes();kind='application/json'
  elif path.startswith('/promo/assets/'):
   f=(ROOT/path.removeprefix('/promo/')).resolve()
   if not f.is_relative_to(ROOT/'assets'):self.send_error(403);return
   data=f.read_bytes();kind='image/png'
  elif path=='/maker-garage-preview/scene.js':
   s=(ROOT/'static/maker-garage-preview/scene.js').read_text(encoding='utf-8')
   s="import {setupFilm} from '/promo/orbit-film.js';\n"+s
   s=s.replace('  const cameraChanged = controls.update();','  window.filmBefore?.();\n  const cameraChanged = controls.update();')
   s=s.replace('  if(heroPending){','  window.filmAfter?.();\n  if(heroPending){')
   s=s.replace('  await loadConfiguration();','  await loadConfiguration();\n  setupFilm({THREE,scene,camera,controls,renderer,setShutterOpen,requestFrame});')
   data=s.encode();kind='text/javascript'
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
 def do_POST(self):
  if self.path=='/promo/orbit-upload':
   n=int(self.headers['Content-Length']);(OUT/'orbit.webm').write_bytes(self.rfile.read(n));self.send_response(200);self.end_headers();return
  if self.path!='/promo/ad-upload':self.send_error(404);return
  n=int(self.headers['Content-Length']);name='ad-recording-en.webm' if self.headers.get('X-Film-Language')=='en' else 'ad-recording-zh.webm';(OUT/name).write_bytes(self.rfile.read(n))
  self.send_response(200);self.end_headers();self.wfile.write(b'OK')
 def log_message(self,*a):pass
ThreadingHTTPServer(('127.0.0.1',4181),Handler).serve_forever()
