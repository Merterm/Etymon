#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Etymon — the installation's server.

Two jobs:

  1. Serve the piece. The browser loads data/etymon.json over fetch(), so
     opening index.html from the filesystem will not work; it needs an origin.
     This is stdlib-only and runs on any python3.

  2. Optionally dream. If this interpreter can import `anthropic` AND a
     credential is present, POST /dream returns a freshly invented ancestor
     and the piece folds it into the ocean live. If either is missing the
     endpoint returns 503, the app's fetch fails, and after three failures it
     stops asking and runs on the baked corpus for good. That is the normal
     gallery configuration: no key, no network, nothing to go wrong.

    python3 serve.py                    # baked corpus (any python3)
    python3.12 serve.py --port 8000     # + live dreaming, if a key is set

Then open http://localhost:8000 and press f for fullscreen.
"""

import argparse
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))

# The search index is ~10,000 small files. This project lives in iCloud Drive,
# which responds to that by making a conflict copy of every one of them
# asynchronously after the build finishes, silently doubling the directory. So
# the index is built and served from a normal local folder instead, and the app
# still requests it at data/index/... -- this handler maps that path across.
#
# Override with --index, or ETYMON_INDEX. To deploy the piece somewhere else,
# copy that directory to installation/data/index and it will be found in place.
def default_index_dir():
    env = os.environ.get("ETYMON_INDEX")
    if env:
        return os.path.abspath(os.path.expanduser(env))
    local = os.path.join(HERE, "data", "index")
    if os.path.exists(os.path.join(local, "manifest.json")):
        return local
    base = os.environ.get("XDG_DATA_HOME")
    if not base:
        base = os.path.expanduser(
            "~/Library/Application Support" if sys.platform == "darwin"
            else "~/.local/share")
    return os.path.join(base, "Etymon", "index")

# raw relation -> (slot when the word is on the left, slot when on the right).
# The same six relations pipeline/build_graph.py normalises, named the way
# app/neighbours.js expects them.
LOOKUP_SLOTS = {
    "rel:etymology":              ("p", "c"),
    "rel: etymology":             ("p", "c"),
    "rel:etymological_origin_of": ("c", "p"),
    "rel:etymologically_related": ("g", "g"),
    "rel:etymologically":         ("g", "g"),
    "rel:is_derived_from":        ("d", "f"),
    "rel:has_derived_form":       ("f", "d"),
    "rel:derived":                ("d", "f"),
    "rel:variant:orthography":    ("v", "v"),
}

# Resolved on the first /dream call so that startup never depends on the SDK.
_dreamer = {"state": "unknown", "mod": None, "client": None, "why": ""}
_lock = threading.Lock()


def get_dreamer():
    with _lock:
        if _dreamer["state"] == "unknown":
            try:
                sys.path.insert(0, os.path.join(HERE, "pipeline"))
                import dreamer as mod
                _dreamer["client"] = mod.client()   # raises without a credential
                _dreamer["mod"] = mod
                _dreamer["state"] = "ready"
                sys.stderr.write("[dream] live dreaming enabled (%s)\n" % mod.MODEL)
            except Exception as exc:
                _dreamer["state"] = "unavailable"
                _dreamer["why"] = str(exc).split("\n")[0]
                sys.stderr.write("[dream] live dreaming off: %s\n" % _dreamer["why"])
                sys.stderr.write("[dream] the piece runs on the baked corpus\n")
        return _dreamer


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    index_dir = None
    root = HERE
    index_prefix = "/data/index/"
    master = None            # the 332 MB graph, if this machine has it

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=self.root, **kw)

    def translate_path(self, path):
        """Serve the index prefix out of the external index directory."""
        clean = path.split("?", 1)[0].split("#", 1)[0]
        prefix = self.index_prefix
        if self.index_dir and clean.startswith(prefix):
            rel = clean[len(prefix):]
            # no traversal out of the index directory
            safe = os.path.normpath(rel).lstrip(os.sep)
            if safe.startswith(".."):
                return os.path.join(HERE, "data", "index", "missing")
            return os.path.join(self.index_dir, safe)
        return super().translate_path(path)

    # keep the gallery console readable: one line per request is noise
    def log_message(self, fmt, *args):
        if self.path.startswith("/dream"):
            sys.stderr.write("[dream] %s\n" % (fmt % args))

    def end_headers(self):
        # The atlas and the graph are big; let a kiosk browser keep them, but
        # never cache the code.
        #
        # This matters more than it looks. Serving the app through a plain
        # `python3 -m http.server`, which sends no Cache-Control at all, lets
        # Chrome heuristically cache ES modules -- and then one edited module
        # is loaded against stale copies of its neighbours and the app throws
        # on startup. Always serve it through this file.
        if self.path.endswith((".js", ".html", ".json")) and \
                "/data/index/" not in self.path:
            self.send_header("Cache-Control", "no-cache")
        elif "/data/index/" in self.path:
            self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    # ---- GET /lookup?w=&lang= -------------------------------------------
    #
    # The 2018 back end answered a word by grepping every line of the master
    # graph that mentioned it. That is restored here, and it is the only place
    # in the piece that is not static, because it is the only thing the static
    # index cannot do: the shards cap a hub at 24 formations, and English
    # "time" has 1,271 of them. This serves the rest, uncapped, on demand.
    #
    # It needs the master TSV, which is not part of a deployment -- pass
    # --master, or set ETYMON_MASTER. Without it the route reports itself
    # unavailable, the app never offers the expansion, and nothing else
    # changes. A gallery machine runs perfectly well on the shards alone.
    def do_lookup(self, query):
        import urllib.parse as up
        q = up.parse_qs(query or "")
        word = (q.get("w") or [""])[0].strip()
        lang = (q.get("lang") or [""])[0].strip()
        if not self.master or not os.path.exists(self.master):
            self._json(503, {"error": "no master graph on this host",
                             "slots": {}})
            return
        if not word or len(word) > 64:
            self._json(400, {"error": "no word", "slots": {}})
            return

        # A scan of 332 MB, in Python, on purpose.
        #
        # The obvious implementation is to shell out to grep, which is what
        # the 2018 server did. On this machine that took anywhere from 0.1 to
        # 5 seconds for the same query, depending on which grep was on PATH
        # and how the pattern happened to sit -- and a gallery machine will
        # have a different grep again. bytes.find is memchr underneath, reads
        # at around a gigabyte a second, and does the same thing every time.
        left = (u"%s: %s\t" % (lang, word)).encode("utf-8") if lang \
            else (u": %s\t" % word).encode("utf-8")
        right = (u"\t%s: %s" % (lang, word)).encode("utf-8") if lang \
            else (u"\t: %s" % word).encode("utf-8")
        hits = []
        try:
            with open(self.master, "rb") as fh:
                tail = b""
                while True:
                    chunk = fh.read(1 << 23)
                    if not chunk:
                        break
                    buf = tail + chunk
                    cut = buf.rfind(b"\n")
                    if cut < 0:
                        tail = buf
                        continue
                    tail = buf[cut + 1:]
                    buf = buf[:cut]
                    # Only walk the lines that contain one of the patterns.
                    for pat in (left, right):
                        at = buf.find(pat)
                        while at >= 0:
                            a = buf.rfind(b"\n", 0, at) + 1
                            b = buf.find(b"\n", at)
                            if b < 0:
                                b = len(buf)
                            hits.append(buf[a:b])
                            at = buf.find(pat, b + 1)
                if tail:
                    for pat in (left, right):
                        if pat in tail:
                            hits.append(tail)
        except Exception as exc:
            self._json(502, {"error": str(exc), "slots": {}})
            return

        slots = {}
        seen = set()
        for raw in hits:
            parts = raw.decode("utf-8", "replace").split("\t")
            if len(parts) != 3:
                continue
            a, rel, b = parts
            slot = LOOKUP_SLOTS.get(rel.strip())
            if slot is None:
                continue
            mine = a.split(":", 1)
            theirs = b
            if mine[0].strip() == lang and mine[1].strip() == word:
                s2 = slot[0]
            else:
                s2, theirs = slot[1], a
            t = theirs.split(":", 1)
            if len(t) != 2:
                continue
            code, w = t[0].strip(), t[1].strip()
            if not w or (code == lang and w == word):
                continue
            k = s2 + "|" + code + "|" + w
            if k in seen:
                continue
            seen.add(k)
            slots.setdefault(s2, []).append([w, code])
        self._json(200, {"word": word, "lang": lang, "slots": slots,
                         "source": "master"})

    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path.rstrip("/").endswith("/lookup"):
            self.do_lookup(query)
            return
        super().do_GET()

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # Drain the body first, always, before any branch that might answer
        # early. This is HTTP/1.1 with keep-alive: an unread body stays in the
        # socket and the next request line is parsed out of the middle of it,
        # so answering 503 without reading would corrupt every following
        # request on that connection -- which is the usual case here, since
        # 503 is what a gallery machine with no API key gets every time.
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        raw = self.rfile.read(n) if n > 0 else b""

        # The app posts to a *relative* "dream", so the path it arrives on
        # depends on where the piece is mounted: "/dream" when this server's
        # root is the installation, "/installation/dream" when it is the whole
        # project. Matching "/dream" exactly meant live dreaming 404'd under
        # --root .., which is how the piece is normally served.
        route = self.path.split("?", 1)[0].rstrip("/")
        if not route.endswith("/dream"):
            self.send_error(404)
            return

        d = get_dreamer()
        if d["state"] != "ready":
            self._json(503, {"error": "live dreaming unavailable",
                             "detail": d["why"],
                             "dreams": []})
            return

        try:
            req = json.loads(raw or b"{}")
        except Exception as exc:
            self._json(400, {"error": "bad request: %s" % exc, "dreams": []})
            return

        word = (req.get("word") or "").strip()
        lang = (req.get("lang") or "eng").strip()
        count = max(1, min(int(req.get("count") or 1), 3))
        if not word:
            self._json(400, {"error": "no word", "dreams": []})
            return

        try:
            import languages
            r = languages.resolve(lang)
            lang_name = r[1] if r else lang
            rows = d["mod"].dream([(lang_name, word)], count=count,
                                  cli=d["client"])
            self._json(200, {"dreams": [
                {"word": x["word"], "lang": x["lang"], "gloss": x["gloss"]}
                for x in rows]})
        except Exception as exc:
            sys.stderr.write("[dream] failed: %s\n" % exc)
            self._json(502, {"error": str(exc), "dreams": []})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--root", default=None,
                    help="directory to serve (default: this one, so the piece "
                         "is at /). Pass --root .. to serve the whole project, "
                         "with the website at / and the piece at /installation/")
    ap.add_argument("--master", default=None,
                    help="the master etymon.tsv, to answer GET /lookup with "
                         "the relations the static shards cap "
                         "(default: $ETYMON_MASTER, else off)")
    ap.add_argument("--index", default=None,
                    help="where the search index lives (default: "
                         "$ETYMON_INDEX, else data/index if present, else "
                         "~/Library/Application Support/Etymon/index)")
    args = ap.parse_args()

    index_dir = os.path.abspath(os.path.expanduser(args.index)) \
        if args.index else default_index_dir()
    Handler.index_dir = index_dir
    Handler.root = os.path.abspath(os.path.expanduser(args.root)) \
        if args.root else HERE
    # when serving the whole project, the piece sits one level down and so
    # does the path its index requests
    Handler.index_prefix = "/installation/data/index/" \
        if Handler.root != HERE else "/data/index/"

    master = args.master or os.environ.get("ETYMON_MASTER") or ""
    if master:
        master = os.path.abspath(os.path.expanduser(master))
    Handler.master = master if master and os.path.exists(master) else None

    data = os.path.join(HERE, "data", "etymon.json")
    if not os.path.exists(data):
        sys.stderr.write(
            "data/etymon.json is missing. Build it with:\n"
            "  python3 pipeline/build_graph.py --inputs <corpora> --workdir /tmp/etymon\n"
            "  python3 pipeline/weave.py --workdir /tmp/etymon "
            "--score seeds/movements.txt \\\n"
            "      --generated data/generated/*.tsv --out data/etymon.json\n"
            "See README.md.\n")
        return 1
    mb = os.path.getsize(data) / 1e6

    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    sys.stderr.write("Etymøn — an ocean of words\n")
    sys.stderr.write("  graph   data/etymon.json (%.2f MB)\n" % mb)
    man = os.path.join(index_dir, "manifest.json")
    if os.path.exists(man):
        try:
            with open(man) as fh:
                info = json.load(fh)
            sys.stderr.write("  index   %s\n" % index_dir)
            sys.stderr.write("          %s words searchable in %d shards\n"
                             % (format(info.get("words", 0), ","),
                                len(info.get("shards", {}))))
        except Exception:
            sys.stderr.write("  index   %s (unreadable manifest)\n" % index_dir)
    else:
        sys.stderr.write("  index   MISSING at %s\n" % index_dir)
        sys.stderr.write("          search will be unavailable; run ./build.sh\n")
    nbr = os.path.join(index_dir, "nbr", "manifest.json")
    if os.path.exists(nbr):
        try:
            with open(nbr) as fh:
                info = json.load(fh)
            sys.stderr.write("  family  %s words, six relations, %d shards\n"
                             % (format(info.get("words", 0), ","),
                                len(info.get("shards", {}))))
        except Exception:
            sys.stderr.write("  family  %s (unreadable manifest)\n" % nbr)
    else:
        sys.stderr.write("  family  MISSING -- raised words will show their\n")
        sys.stderr.write("          ancestry only; run ./build.sh\n")
    if Handler.master:
        sys.stderr.write("  lookup  %s\n" % Handler.master)
        sys.stderr.write("          GET /lookup answers the relations the\n")
        sys.stderr.write("          shards cap, straight off the master graph\n")
    where = "/" if Handler.root == HERE else "/installation/"
    sys.stderr.write("  root    %s\n" % Handler.root)
    sys.stderr.write("  serving http://%s:%d%s\n"
                     % (args.host, args.port, where))
    sys.stderr.write("  python  %s\n" % sys.version.split()[0])
    sys.stderr.write("  keys    space dive · m mic · . movement · f fullscreen · c captions\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
