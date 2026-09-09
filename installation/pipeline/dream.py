# -*- coding: utf-8 -*-
"""
Batch dreaming: grow the baked corpus offline.

The installation ships with a hand-authored data/generated/*.tsv and needs
nothing else to run. This script regrows or extends those files, so the corpus
is reproducible rather than a one-off artefact.

    # invent ancestors for every seed in a movement
    python3.12 dream.py dream  --score ../seeds/movements.txt \
        --movement "The Machine Dreams" --append ../data/generated/dreams.tsv

    # propose real missing links wherever the corpora stall near the surface
    python3.12 dream.py conjecture --graph ../data/etymon.json --max-era 1 \
        --append ../data/generated/conjectures.tsv

Requires python >= 3.10, `pip install anthropic`, and a credential
(ANTHROPIC_API_KEY, or `ant auth login`). Costs real money: --dry-run prints
what it would ask for and exits.
"""

import argparse
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dreamer
import languages
from weave import parse_score


def cmd_dream(args):
    movements = parse_score(args.score)
    todo = []
    for title, sub, seeds in movements:
        if args.movement and args.movement.lower() not in title.lower():
            continue
        for tag, word in seeds:
            r = languages.resolve(tag)
            todo.append((r[1] if r else tag, word, tag))
    if args.limit:
        todo = todo[:args.limit]

    sys.stderr.write("dreaming ancestors for %d words\n" % len(todo))
    if args.dry_run:
        for lang_name, word, tag in todo:
            sys.stderr.write("  %s: %s\n" % (tag, word))
        return

    rows = dreamer.dream([(ln, w) for ln, w, _ in todo], count=args.count,
                         model=args.model)
    # re-tag each dream against the seed's own language tag
    tag_of = {w: t for _, w, t in todo}
    for r in rows:
        r["of"] = "%s: %s" % (tag_of.get(r["of"], "eng"), r["of"])
    text = dreamer.to_tsv_dream(rows)
    emit(args, text, "# --- dreamed %d ancestors ---\n" % len(rows))


def cmd_conjecture(args):
    doc = json.load(io.open(args.graph, encoding="utf-8"))
    nodes = doc["nodes"]
    langname = {c: v["name"] for c, v in doc["languages"].items()}
    todo, seen = [], set()
    for m in doc["movements"]:
        for l in m["lineages"]:
            if l["depth"] > args.max_era:
                continue
            path = l["paths"][0]
            child = nodes[path[0]]
            deep = nodes[path[-1]]
            key = (child[0], deep[0])
            if key in seen:
                continue
            seen.add(key)
            todo.append((
                "%s: %s" % (child[1], child[0]),
                "%s: %s" % (deep[1], deep[0]),
                langname.get(child[1], child[1]),
            ))
    if args.limit:
        todo = todo[:args.limit]

    sys.stderr.write("proposing links for %d stalled lineages\n" % len(todo))
    if args.dry_run:
        for child, deep, _ in todo:
            sys.stderr.write("  %-28s stops at  %s\n" % (child, deep))
        return

    rows = dreamer.conjecture([(c, d) for c, d, _ in todo], model=args.model)
    # keep only rows whose language tags the installation can actually place
    kept = []
    for r in rows:
        ok = True
        for side in (r["child"], r["parent"]):
            i = side.find(":")
            if i < 0 or languages.resolve(side[:i]) is None:
                sys.stderr.write("  dropped (unknown tag): %s\n" % side)
                ok = False
        if ok:
            kept.append(r)
    text = dreamer.to_tsv_conjecture(kept)
    emit(args, text, "# --- conjectured %d links ---\n" % len(kept))


def emit(args, text, header):
    if not text:
        sys.stderr.write("nothing generated\n")
        return
    if args.append:
        with io.open(args.append, "a", encoding="utf-8") as fh:
            fh.write(u"\n" + header + text)
        sys.stderr.write("appended to %s\n" % args.append)
        sys.stderr.write("re-run weave.py to fold it into the installation\n")
    else:
        sys.stdout.write(text)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")

    d = sub.add_parser("dream", help="invent ancestors that do not exist")
    d.add_argument("--score", default="../seeds/movements.txt")
    d.add_argument("--movement", help="only seeds in movements matching this")
    d.add_argument("--count", type=int, default=1)
    d.set_defaults(fn=cmd_dream)

    c = sub.add_parser("conjecture", help="propose real links the corpora lack")
    c.add_argument("--graph", default="../data/etymon.json")
    c.add_argument("--max-era", type=int, default=1,
                   help="only lineages that stall at or above this era")
    c.set_defaults(fn=cmd_conjecture)

    for p in (d, c):
        p.add_argument("--append", help="append to this tsv instead of stdout")
        p.add_argument("--limit", type=int)
        p.add_argument("--model", default=dreamer.MODEL)
        p.add_argument("--dry-run", action="store_true",
                       help="print the requests and exit without spending")

    args = ap.parse_args()
    if not getattr(args, "fn", None):
        ap.print_help()
        return 2
    args.fn(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
