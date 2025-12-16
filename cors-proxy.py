#!/usr/bin/env python3
"""
Proxy CORS simple para la API de Football-Data.org
Ejecuta este script en un puerto diferente al servidor principal
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import urllib.request
import json

class CORSProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Manejar preflight CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, X-Football-API-Key')
        self.end_headers()
    
    def do_GET(self):
        """Proxy GET requests"""
        try:
            # Parsear query string
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            
            if 'url' not in query:
                self.send_error(400, "Falta parámetro 'url'")
                return
            
            target_url = query['url'][0]
            
            # Crear request
            req = urllib.request.Request(target_url)
            req.add_header('Accept', 'application/json')
            
            # Añadir API key si está presente
            if 'X-Football-API-Key' in self.headers:
                req.add_header('X-Auth-Token', self.headers['X-Football-API-Key'])
            
            # Hacer la petición
            with urllib.request.urlopen(req) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self.send_error(500, f"Error en proxy: {str(e)}")
    
    def log_message(self, format, *args):
        """Suprimir logs por defecto"""
        pass

if __name__ == '__main__':
    PORT = 8888
    server = HTTPServer(('localhost', PORT), CORSProxyHandler)
    print(f"Proxy CORS ejecutándose en http://localhost:{PORT}")
    print("Usa ?url=<URL_ENCODED> para hacer peticiones")
    server.serve_forever()

