# -*- coding: utf-8 -*-
"""
Stage 1 of the Etymon pipeline: fold every corpus into one normalised graph.

The 2018 project's real contribution was a single interchange format --

    <tag>: <word> \t rel:<TYPE> \t <tag>: <word>

-- that Etymonline, Nisanyan, Starling and the Etymological Wordnet were all
flattened into. This script keeps that format as the input contract and
produces a normalised, deduplicated, language-resolved graph from it.

Two cleanups the original never did:

  * The master etymon.tsv is fully symmetric -- every relation is stored
    alongside its own inverse, so 6.4M lines describe ~3.2M facts. We collapse
    each inverse pair into one canonical direction (child -> parent).
  * Language tags are resolved through pipeline/languages.py, so the Turkish
    labels from the Nisanyan scrape ("Eski Turkce") and the English ones from
    the Starling parse ("Proto-Turkic") land on the same nodes as the ISO
    codes, instead of floating as unreachable islands.

Output: a compact TSV of canonical edges, plus a node table with degree,
written to the work directory for stage 2 to slice into lineages.
"""

import argparse
import io
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import languages

# raw relation -> (canonical relation, flip?)
#   descends_from : child -> etymological parent (the ocean's vertical edges)
#   derived_from  : child -> morphological parent, usually same language
#   cognate       : undirected sibling relation
RELMAP = {
    "rel:etymology":                ("descends_from", False),
    "rel: etymology":               ("descends_from", False),
    "rel:etymological_origin_of":   ("descends_from", True),
    "rel:etymologically_related":   ("cognate",       False),
    "rel:etymologically":           ("cognate",       False),
    "rel:is_derived_from":          ("derived_from",  False),
    "rel:has_derived_form":         ("derived_from",  True),
    "rel:derived":                  ("derived_from",  False),
    # Spelling variants: "colour"/"color", "encyclopaedia"/"encyclopedia".
    # These used to be dropped as noise, which was a judgement call in the
    # wrong direction -- 16,516 of them are the corpus's only record that two
    # forms are the same word, and the piece is about exactly that. They are
    # kept as their own relation and drawn as their own kind of edge, never
    # walked as ancestry.
    "rel:variant:orthography":      ("variant",       False),
}

# relations that are symmetric and so stored in one canonical ordering
SYMMETRIC = ("cognate", "variant")


def split_tag(side):
    """'lat: aqua' -> ('lat', 'aqua'). Tolerates the corpus's ragged spacing."""
    i = side.find(":")
    if i < 0:
        return None
    return side[:i].strip(), side[i + 1:].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inputs", nargs="+", required=True,
                    help="corpus files in <tag>: <word> TAB rel TAB <tag>: <word> form")
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--min-word-len", type=int, default=1)
    ap.add_argument("--max-word-len", type=int, default=32)
    args = ap.parse_args()

    if not os.path.isdir(args.workdir):
        os.makedirs(args.workdir)

    edges = {}                       # (src, rel, dst) -> True, src/dst = "code|word"
    degree = defaultdict(int)
    stats = defaultdict(int)
    unresolved = defaultdict(int)

    for path in args.inputs:
        if not os.path.exists(path):
            sys.stderr.write("  skip (missing): %s\n" % path)
            continue
        sys.stderr.write("  reading %s\n" % os.path.basename(path))
        with io.open(path, "r", encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh):
                if lineno % 500000 == 0 and lineno:
                    sys.stderr.write("    %.1fM lines\r" % (lineno / 1e6))
                    sys.stderr.flush()
                stats["lines"] += 1
                parts = line.rstrip("\n").split("\t")
                if len(parts) != 3:
                    stats["malformed"] += 1
                    continue
                left, rel, right = parts
                rel = rel.strip()
                if rel not in RELMAP:
                    stats["unknown_rel"] += 1
                    continue
                canon, flip = RELMAP[rel]

                a, b = split_tag(left), split_tag(right)
                if not a or not b:
                    stats["malformed"] += 1
                    continue

                if a[0] in languages.NONLANG or b[0] in languages.NONLANG:
                    stats["nonlang_tag"] += 1
                    continue

                ra, rb = languages.resolve(a[0]), languages.resolve(b[0])
                if ra is None:
                    unresolved[a[0]] += 1
                if rb is None:
                    unresolved[b[0]] += 1
                if ra is None or rb is None:
                    stats["unresolved_lang"] += 1
                    continue

                wa, wb = a[1], b[1]
                if not (args.min_word_len <= len(wa) <= args.max_word_len):
                    stats["bad_word"] += 1
                    continue
                if not (args.min_word_len <= len(wb) <= args.max_word_len):
                    stats["bad_word"] += 1
                    continue
                if wa == wb and ra[0] == rb[0]:
                    stats["self_loop"] += 1
                    continue

                src = ra[0] + "|" + wa
                dst = rb[0] + "|" + wb
                if flip:
                    src, dst = dst, src

                # symmetric relations: store one canonical ordering only
                if canon in SYMMETRIC and src > dst:
                    src, dst = dst, src

                key = (src, canon, dst)
                if key in edges:
                    stats["dup"] += 1
                    continue
                edges[key] = True
                degree[src] += 1
                degree[dst] += 1

        sys.stderr.write("    done%s\n" % (" " * 20))

    # ---- write canonical edges -------------------------------------------
    epath = os.path.join(args.workdir, "edges.tsv")
    with io.open(epath, "w", encoding="utf-8") as fh:
        for (src, rel, dst) in sorted(edges):
            fh.write(u"%s\t%s\t%s\n" % (src, rel, dst))

    npath = os.path.join(args.workdir, "nodes.tsv")
    with io.open(npath, "w", encoding="utf-8") as fh:
        for key in sorted(degree, key=lambda k: (-degree[k], k)):
            code, word = key.split("|", 1)
            meta = languages.LANG[code]
            fh.write(u"%s\t%s\t%s\t%d\t%d\n"
                     % (code, word, meta[1], meta[2], degree[key]))

    relcount = defaultdict(int)
    for (_, rel, _) in edges:
        relcount[rel] += 1

    sys.stderr.write("\n=== graph ===\n")
    sys.stderr.write("nodes            %d\n" % len(degree))
    sys.stderr.write("canonical edges  %d\n" % len(edges))
    for r in sorted(relcount, key=lambda r: -relcount[r]):
        sys.stderr.write("  %-16s %d\n" % (r, relcount[r]))
    sys.stderr.write("--- input accounting ---\n")
    for k in sorted(stats, key=lambda k: -stats[k]):
        sys.stderr.write("  %-16s %d\n" % (k, stats[k]))
    if unresolved:
        tot = sum(unresolved.values())
        sys.stderr.write("--- top unresolved tags (%d refs total) ---\n" % tot)
        for tag in sorted(unresolved, key=lambda t: -unresolved[t])[:25]:
            sys.stderr.write("  %-32s %d\n" % (tag[:32], unresolved[tag]))
    sys.stderr.write("\nwrote %s\n      %s\n" % (epath, npath))


if __name__ == "__main__":
    main()
