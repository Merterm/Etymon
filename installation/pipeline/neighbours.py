# -*- coding: utf-8 -*-
"""
Stage 5 of the Etymon pipeline: the neighbourhood index.

Stage 1 folds six dictionaries into 3.17M edges of five distinct kinds. Until
this stage existed, almost none of that reached the browser. The composed
score carries ~1,100 edges, and the search index stores, for each word, a
single linear chain of ancestors -- one thread upward and nothing else. So
2.26M derivations, 326k cognate links and 15.6k spelling variants were
computed and then thrown away, and a visitor who looked up a word saw a
lonely stick of five ancestors instead of its family.

The 2018 project did not have this problem, because it had a server: the page
asked localhost for a word and a Node process grepped the 332 MB master graph
for every line mentioning it. Everything was one hop away. That server is
gone, and a gallery machine should not need one.

This is that lookup, precomputed and sharded. For every node in the graph it
records the words directly related to it, keeping the relations apart:

    p  parents      it descends from these          (etymology)
    c  children     these descend from it
    g  cognates     related, no direction claimed
    d  bases        it is built out of these        (morphology)
    f  formations   these are built out of it
    v  variants     the same word, spelled otherwise

Sharded on the same key as the search index, so resolving a word's family
costs one fetch of a few kilobytes, offline. Hubs are capped -- Latin
"pareo" has thousands of formations and no view can show them, so the most
connected are kept and the rest counted, which is what the app displays as
"+1,412 more".

    python3 neighbours.py --workdir <workdir> --out <dir>
"""

import argparse
import io
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import languages
from searchindex import fold

# how many of each relation survive for one word, and in which order the app
# should read them. Descent is never capped tightly: a word has few parents,
# and its children are the interesting part of looking it up. Morphological
# formations are the ones that run to thousands.
CAPS = {"p": 8, "c": 24, "g": 16, "d": 6, "f": 24, "v": 8}
SLOTS = ("p", "c", "g", "d", "f", "v")

# edges.tsv relation -> (slot for the source, slot for the destination)
EDGE_SLOTS = {
    "descends_from": ("p", "c"),
    "derived_from":  ("d", "f"),
    "cognate":       ("g", "g"),
    "variant":       ("v", "v"),
}

# ---- how a shard is named --------------------------------------------------
#
# The *logical* key is a prefix of the folded word, and it is what the browser
# matches against the manifest: three characters for Latin script, one for
# everything else, split deeper where the corpus is dense.
#
# The *filename* is that key with anything but ASCII alphanumerics encoded, so
# that Cyrillic and Armenian shards can be split as freely as Latin ones. The
# earlier version refused to split on a non-ASCII character to keep filenames
# safe, which left twelve buckets -- Russian "\u043f", Armenian "\u0561" -- at up to
# 652 kB, the only slow lookups left in the piece. app/neighbours.js mirrors
# both functions.
def logical_key(f):
    if not f:
        return "_"
    c = f[0]
    if c.isdigit():
        return "0"
    if not (c.isalpha() and ord(c) < 128):
        return c
    a2 = len(f) > 1 and f[1].isalpha() and ord(f[1]) < 128
    a3 = len(f) > 2 and f[2].isalpha() and ord(f[2]) < 128
    if a2 and a3:
        return f[:3]
    if a2:
        return f[:2]
    return c + "_"


def file_of(key):
    return u"".join(
        ch if (ch.isalnum() and ord(ch) < 128) else u"u%04x" % ord(ch)
        for ch in key)


COARSE = 128        # temp buckets; every shard lands wholly inside one


def coarse_of(shard):
    h = 0
    for ch in shard:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return h % COARSE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--per-key", type=int, default=4,
                    help="homographs kept per folded key, most connected first")
    args = ap.parse_args()

    tmp = os.path.join(args.workdir, "nbr.parts")
    if os.path.isdir(tmp):
        for f in os.listdir(tmp):
            os.remove(os.path.join(tmp, f))
    else:
        os.makedirs(tmp)

    # ---- degree, for ranking a hub's neighbours ---------------------------
    #
    # The only measure of prominence the corpus offers. Without it a hub's cap
    # keeps whichever thousand forms happened to sort first, which for Latin
    # means a screenful of inflections of one obscure verb.
    sys.stderr.write("reading nodes...\n")
    degree = {}
    npath = os.path.join(args.workdir, "nodes.tsv")
    for line in io.open(npath, "r", encoding="utf-8"):
        code, word, current, depth, deg = line.rstrip("\n").split("\t")
        degree[code + "|" + word] = int(deg)
    sys.stderr.write("  %d nodes\n" % len(degree))

    # ---- scatter every edge to both of its endpoints ---------------------
    #
    # Two passes over temporary files rather than one adjacency map in memory:
    # 6.35M directed entries as Python lists costs several gigabytes, and this
    # has to run on the same interpreter as the rest of the pipeline.
    sys.stderr.write("scattering edges...\n")
    handles = {}

    def part(shard):
        c = coarse_of(shard)
        fh = handles.get(c)
        if fh is None:
            fh = io.open(os.path.join(tmp, "%03d.tsv" % c), "w",
                         encoding="utf-8")
            handles[c] = fh
        return fh

    epath = os.path.join(args.workdir, "edges.tsv")
    written = 0
    for lineno, line in enumerate(io.open(epath, "r", encoding="utf-8")):
        if lineno % 500000 == 0 and lineno:
            sys.stderr.write("  %.1fM\r" % (lineno / 1e6))
            sys.stderr.flush()
        try:
            src, rel, dst = line.rstrip("\n").split("\t")
        except ValueError:
            continue
        slots = EDGE_SLOTS.get(rel)
        if slots is None:
            continue
        for key, other, slot in ((src, dst, slots[0]), (dst, src, slots[1])):
            i = key.find("|")
            if i < 0:
                continue
            f = fold(key[i + 1:])
            if not f:
                continue
            sh = logical_key(f)
            part(sh).write(u"%s\t%s\t%s\t%s\n" % (sh, key, slot, other))
            written += 1
    for fh in handles.values():
        fh.close()
    sys.stderr.write("  %d directed entries\n" % written)

    # ---- gather each bucket into finished shards -------------------------
    if not os.path.isdir(args.out):
        os.makedirs(args.out)

    manifest = {}
    total_bytes = 0
    kept = defaultdict(int)
    dropped = defaultdict(int)
    words = 0
    files = 0

    # ---- writing a shard, splitting it when it gets fat ------------------
    #
    # Sharding three characters deep is right for the median prefix and badly
    # wrong for the dense ones: with every node carrying a neighbourhood, the
    # Latin- and Romance-derived prefixes pile up and "con" came to 4.4 MB.
    # A visitor typing "consider" would wait on a four-megabyte fetch to be
    # shown eight related words.
    #
    # So a fat shard is partitioned one character deeper, recursively, until
    # every file is small enough to be a keystroke's worth of network. The
    # manifest lists whatever keys were actually written and the browser takes
    # the longest one that prefixes the word it wants, so the depth does not
    # have to be guessed on either side.
    LIMIT = 200000
    MAX_DEPTH = 8

    def write_shard(key, rows, depth):
        """rows: [(-degree, folded, word, code, {slot: (keys, over_cap)})]"""
        pool = {}
        out_n = {}
        by_key = defaultdict(list)
        for r in rows:
            by_key[r[1]].append(r)
        for f in by_key:
            for r in sorted(by_key[f])[:args.per_key]:
                _, _, word, code, rec = r
                enc = {}
                for slot in SLOTS:
                    if slot not in rec:
                        continue
                    them, more = rec[slot]
                    ids = []
                    for k in them:
                        c2, w2 = k.split("|", 1)
                        ident = (w2, c2)
                        pi = pool.get(ident)
                        if pi is None:
                            pi = len(pool)
                            pool[ident] = pi
                        ids.append(pi)
                    enc[slot] = [ids, more] if more else [ids]
                out_n.setdefault(f, []).append([word, code, enc])

        plist = [None] * len(pool)
        for (w, c), i in pool.items():
            plist[i] = [w, c, languages.LANG[c][2]]
        blob = json.dumps({"pool": plist, "n": out_n},
                          ensure_ascii=False, separators=(",", ":"))
        raw = blob.encode("utf-8")

        # Too big, and there is still a character left to split on: partition
        # by the next character of the folded key. Rows whose key has run out
        # of characters stay here, in a shard that keeps this exact key.
        if len(raw) > LIMIT and depth < MAX_DEPTH:
            # Rows whose folded key has run out of characters stay here, in a
            # shard keeping this exact key; the rest partition by the next
            # character, whatever script it is in -- file_of() makes the name
            # safe, so nothing has to be excluded from the split.
            # Not every key is a prefix of the words in it. "c_" is the
            # bucket for a word beginning "c" whose second character is not a
            # letter, and "0" collects every word starting with any digit --
            # splitting those by the next character would produce shard names
            # the browser could never derive from the word it is looking for.
            # Those rows stay put; the buckets are small.
            here, parts = [], defaultdict(list)
            for r in rows:
                f = r[1]
                if len(f) <= depth or f[:len(key)] != key:
                    here.append(r)
                else:
                    parts[f[:depth + 1]].append(r)
            if parts:
                n = 0
                for sub in parts:
                    n += write_shard(sub, parts[sub], depth + 1)
                if here:
                    n += write_shard(key, here, MAX_DEPTH)
                return n

        path = os.path.join(args.out, file_of(key) + ".json")
        with io.open(path, "w", encoding="utf-8") as fh:
            fh.write(blob)
        manifest[key] = sum(len(v) for v in out_n.values())
        return len(raw)

    parts = sorted(os.listdir(tmp))
    for pn, name in enumerate(parts):
        sys.stderr.write("  gathering %d/%d\r" % (pn + 1, len(parts)))
        sys.stderr.flush()
        # shard -> subject key -> slot -> [neighbour keys]
        acc = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        for line in io.open(os.path.join(tmp, name), "r", encoding="utf-8"):
            sh, key, slot, other = line.rstrip("\n").split("\t")
            acc[sh][key][slot].append(other)

        for sh in acc:
            rows = []
            for key, slots in acc[sh].items():
                code, word = key.split("|", 1)
                if code not in languages.LANG:
                    continue
                rec = {}
                for slot in SLOTS:
                    them = slots.get(slot)
                    if not them:
                        continue
                    them = sorted(set(them),
                                  key=lambda k: (-degree.get(k, 0), k))
                    them = [k for k in them
                            if k.split("|", 1)[0] in languages.LANG]
                    cap = CAPS[slot]
                    over = max(0, len(them) - cap)
                    them = them[:cap]
                    if not them:
                        continue
                    rec[slot] = (them, over)
                    kept[slot] += len(them)
                    dropped[slot] += over
                if not rec:
                    continue
                rows.append((-degree.get(key, 0), fold(word), word, code, rec))
            if not rows:
                continue
            total_bytes += write_shard(sh, rows, len(sh))

    words = sum(manifest.values())
    files = len(manifest)

    sys.stderr.write("        \r")
    with io.open(os.path.join(args.out, "manifest.json"), "w",
                 encoding="utf-8") as fh:
        fh.write(json.dumps({"words": words, "shards": manifest,
                             "caps": CAPS, "slots": list(SLOTS)},
                            ensure_ascii=False))

    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)

    sys.stderr.write("\n=== neighbourhoods ===\n")
    sys.stderr.write("words       %d in %d shards\n" % (words, files))
    sys.stderr.write("size        %.1f MB  (mean %.1f kB / shard)\n"
                     % (total_bytes / 1e6,
                        total_bytes / max(1, files) / 1e3))
    names = {"p": "parents", "c": "children", "g": "cognates",
             "d": "bases", "f": "formations", "v": "variants"}
    for slot in SLOTS:
        sys.stderr.write("  %-11s %9d kept  %9d over cap\n"
                         % (names[slot], kept[slot], dropped[slot]))
    sys.stderr.write("wrote %s\n" % args.out)


if __name__ == "__main__":
    main()
