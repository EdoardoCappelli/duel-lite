# Test server for the phone: python serve.py [port]. Forbids browser caching, so Safari never mixes old and new files.
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def send_head(self):
        # never answer 304: Safari must always get the current file
        del self.headers['If-Modified-Since']
        return super().send_head()

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8797
http.server.ThreadingHTTPServer(('', port), functools.partial(NoCache, directory=root)).serve_forever()
