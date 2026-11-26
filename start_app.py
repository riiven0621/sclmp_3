from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import webbrowser


ROOT = Path(__file__).resolve().parent
ALLOWED_FILES = {
    "": "index.html",
    "index.html": "index.html",
    "auth.js": "auth.js",
    "firebase-config.js": "firebase-config.js",
    "schedule-assistant.js": "schedule-assistant.js",
}
PORT = 65420


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        relative_path = unquote(urlsplit(path).path).lstrip("/")
        file_name = ALLOWED_FILES.get(relative_path)
        return str(ROOT / file_name) if file_name else str(ROOT / "__not_found__")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), AppHandler)
    url = f"http://localhost:{PORT}/"
    print(f"行程管理系統已啟動：{url}")
    print("保持這個視窗開啟即可使用；按 Ctrl+C 停止。")
    webbrowser.open(url, new=2)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n行程管理系統已停止。")
    finally:
        server.server_close()
