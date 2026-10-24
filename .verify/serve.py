import http.server, socketserver, os, threading

ROOT = 'C:/Users/20355/WorkBuddy/2026-10-24-10-30-54/video-loop-player'
os.chdir(ROOT)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # 静默

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

with Server(('127.0.0.1', 8765), Handler) as httpd:
    print('serving on http://127.0.0.1:8765', flush=True)
    httpd.serve_forever()
