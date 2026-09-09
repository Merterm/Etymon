# -*- coding: utf-8 -*-
"""
Stage 4 of the Etymon pipeline: make every word searchable, offline.

The 2018 app had a search box, and the server behind it ran

    grep ": <word>\t" etymon.tsv

against the 332 MB master graph. That worked, but it made the page depend on a
live server, and the server is gone.

This builds the same capability as static files. Every word in the corpus that
has a real ancestry gets its chain precomputed by exactly the walk the
installation's composed lineages use -- same depth-monotonic rule, same loan
budget, same conjecture layer -- and the result is sharded by first letter so
the browser fetches one small file per query and nothing else. A gallery
machine with no network can still find any of them.

Ancestors repeat enormously (a few thousand Latin and Proto-Indo-European roots
sit under hundreds of thousands of words), so each shard keeps a deduplicated
pool of forms and the chains are lists of indices into it. That is what keeps
the whole index to a few megabytes instead of fifty.

    python3 searchindex.py --workdir <workdir> --out ../data/index \
        --generated ../data/generated/conjectures.tsv
"""

import argparse
import io
import json
import os
import sys
import unicodedata
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import languages
from weave import Lexicon, load_corpus, load_generated, walk


def fold(s):
    """The key the browser types against: accent- and case-insensitive."""
    d = unicodedata.normalize("NFD", s)
    return u"".join(c for c in d if not unicodedata.combining(c)).lower()


def suggest_key(folded):
    """The bucket a *prefix* is looked up in, which is not the same thing as
    the bucket a whole word is stored in.

    Words are sharded on three characters so the Latin and Romance buckets stay
    small. But someone typing "wo" cannot reach the "wor" shard that holds
    "world" -- there is no way to know which of the 26 third letters to fetch.
    So prefixes get their own small index, two characters deep, holding the
    best candidates for that prefix. Without it, typing anything shorter than a
    whole word returns nothing, which is exactly as broken as it sounds.
    """
    if not folded:
        return "_"
    c = folded[0]
    if not (c.isalpha() and ord(c) < 128):
        return "u%04x" % ord(c)
    c2 = folded[1] if len(folded) > 1 else ""
    if c2 and c2.isalpha() and ord(c2) < 128:
        return folded[:2]
    return c + "_"


def shard_key(folded):
    """Two leading characters for Latin script, one for everything else.

    Sharding on a single letter left an "s" bucket of 1.4 MB, which is a
    noticeable wait to resolve one query. Two characters puts the typical
    fetch around 60 kB. Non-Latin scripts stay one character per bucket --
    they are small already, and their first character carries much more
    information than a Latin one does.
    """
    if not folded:
        return "_"
    c = folded[0]
    if c.isdigit():
        return "0"
    if not (c.isalpha() and ord(c) < 128):
        return "u%04x" % ord(c)
    if len(folded) > 2 and folded[1].isalpha() and folded[2].isalpha() \
            and ord(folded[1]) < 128 and ord(folded[2]) < 128:
        # Three characters, not two: with every inflected form indexed the
        # Latin and Romance buckets are enormous, and a query should still cost
        # one small fetch.
        return folded[:3]
    if len(folded) > 1 and folded[1].isalpha() and ord(folded[1]) < 128:
        return folded[:2]
    return c + "_"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--generated", nargs="*", default=[])
    ap.add_argument("--min-era", type=int, default=1,
                    help="only index words whose chain reaches this era. The "
                         "default of 2 was wrong: it silently dropped every "
                         "word whose recorded ancestry stops at Middle "
                         "English, which is most of the core vocabulary -- "
                         "'life' and 'night' were unsearchable. 1 means any "
                         "word with an ancestor at all.")
    ap.add_argument("--max-nodes", type=int, default=14)
    ap.add_argument("--max-hops", type=int, default=8)
    ap.add_argument("--max-per-key", type=int, default=6)
    ap.add_argument("--suggest-per-key", type=int, default=450,
                    help="candidates kept per two-character prefix")
    ap.add_argument("--lemmas-only-below", type=int, default=2,
                    help="a derivation-only word with fewer than this many "
                         "edges is treated as an inflected form: it is still "
                         "searchable, but instead of its own chain the index "
                         "stores a pointer to its lemma, and the app shows the "
                         "lemma. That is what keeps 2.5M words searchable "
                         "without storing 2.5M chains.")
    args = ap.parse_args()

    lex = Lexicon()
    sys.stderr.write("loading graph...\n")
    up, cog, der = load_corpus(args.workdir, lex)
    load_generated(args.generated, lex, up)

    # Every word with any parent at all, not just an etymological one. Limiting
    # this to descends_from left 88% of the corpus unsearchable, because
    # derivation is 72% of its edges and 2.24M words have no other route.
    # Two kinds of entry.
    #
    #   full    a word with an etymology, or a derivation with a family of its
    #           own: its whole chain is stored.
    #   lemma   an inflected form -- Latin "transpareamus", Spanish
    #           "erigirian". 2.02M of the corpus's words are these, and storing
    #           a chain for each costs 150 MB to say the same thing 50 times
    #           over. Instead the index records which lemma it belongs to, and
    #           the app resolves it and shows the lemma. Everything is
    #           searchable; nothing is stored twice.
    keys = set(up)
    infl = {}
    for k in der:
        if k in keys:
            continue
        if lex.degree.get(k, 0) < args.lemmas_only_below:
            infl[k] = None
            continue
        keys.add(k)

    # Words that are only ever somebody else's parent.
    #
    # 465,881 nodes -- 16% of the corpus -- have relations but no ancestor of
    # their own, so a rule of "index anything with a chain" refuses them all.
    # Chinese 日 takes part in eighty relations and could not be looked up;
    # Russian хлеб has children and a cognate and could not be looked up. What
    # the corpus does not know is where *they* came from, which is a reason to
    # show a short entry, not to pretend the word is absent.
    #
    # They are indexed as a single node. The panel says nothing lies under it,
    # and the family -- which is the whole of what is known about them -- comes
    # from the neighbourhood index as it does for everything else.
    rootish = set()
    for k, deg in lex.degree.items():
        if k in keys or k in infl or deg < 1:
            continue
        rootish.add(k)
    keys |= rootish
    sys.stderr.write("  %d words indexed as roots (relations, no ancestry)\n"
                     % len(rootish))

    def find_lemma(key):
        """Walk derivation up to the nearest form that has a full entry.

        Two things matter here and the first version got both wrong. It has to
        stop at the *nearest* such form, not the deepest: "transpareamus"
        belongs to "transpareo", and walking on to "pareo" throws away the
        prefix and answers a different question. And it has to land on a word
        that will actually be in the index, or the pointer resolves to nothing
        -- which is why Polish "owieczkami" and Italian "dogheremmo" came back
        empty even though both were indexed.
        """
        seen = set()
        cur = key
        for _ in range(10):
            if cur in seen:
                break
            seen.add(cur)
            nxt = der.get(cur)
            if not nxt:
                break
            cur = nxt[0]
            if cur in keys:            # a form with a chain of its own
                return cur
        # Nothing on the way up has an entry. Return the topmost form anyway
        # and promote it below, so the pointer always resolves: an inflected
        # form whose lemma is also inflection-only used to be indexed and then
        # answer nothing at all, which is worse than not indexing it.
        return cur if cur != key and cur in lex.meta else None

    for k in list(infl):
        infl[k] = find_lemma(k)
    infl = {k: v for k, v in infl.items() if v and v in lex.meta}

    # Any lemma that is not itself a full entry gets promoted into one, so that
    # every pointer lands somewhere. These are headwords the corpus records
    # only through inflection -- Polish "owieczka", Italian "doghere" -- and
    # without this their whole paradigm was searchable and silently empty.
    promoted = {v for v in infl.values() if v not in keys}
    keys |= promoted
    sys.stderr.write("  %d lemmas promoted to full entries\n" % len(promoted))
    sys.stderr.write("  %d full entries, %d inflected forms pointing at "
                     "a lemma\n" % (len(keys), len(infl)))
    sys.stderr.write("  %d nodes; %d with descent, %d with derivation\n"
                     % (len(lex.meta), len(up), len(der)))

    shards = defaultdict(lambda: {"pool": {}, "index": defaultdict(list),
                                  "lpool": {}, "lemma": {}})
    stats = defaultdict(int)

    total = len(keys)
    for n, key in enumerate(keys):
        if n % 25000 == 0:
            sys.stderr.write("  %.0f%%\r" % (100.0 * n / total))
            sys.stderr.flush()
        if key not in lex.meta:
            continue
        code, word, current, era, script = lex.meta[key]
        # A two-character floor is right for alphabetic scripts, where a
        # single letter is not a word, and wrong for the ones where it is:
        # Chinese and Japanese headwords are routinely one character, and the
        # floor made every one of them unsearchable -- looking up the corpus's
        # own word for "mother" returned nothing.
        short = len(word) < (2 if ord(word[0]) < 128 else 1)
        if short or len(word) > 24 or word.startswith("-") or word.endswith("-"):
            stats["skipped_form"] += 1
            continue

        paths = walk(key, lex, up, args.max_nodes, 1, args.max_hops, der)
        path, kinds = (paths[0] if paths else ([key], []))
        if len(path) < 2:
            # A promoted lemma with no recorded ancestry is still worth an
            # entry: it is what a whole paradigm points at, and answering with
            # the headword alone beats answering with nothing.
            if key in promoted or key in rootish:
                path, kinds = [key], []
            else:
                stats["no_chain"] += 1
                continue
        if len(path) > 1 and max(lex.depth(k) for k in path) < args.min_era:
            stats["too_shallow"] += 1
            continue

        f = fold(word)
        sh = shards[shard_key(f)]
        if len(sh["index"][f]) >= args.max_per_key:
            stats["key_full"] += 1
            continue
        reach = max(lex.depth(k) for k in path)

        chain = []
        for step, k in enumerate(path):
            c2, w2, _, e2, _ = lex.meta[k]
            kind = 1 if step and kinds[step - 1] == 1 else 0
            g = lex.gloss.get(k, "")
            ident = (w2, c2, e2, kind, g)
            pi = sh["pool"].get(ident)
            if pi is None:
                pi = len(sh["pool"])
                sh["pool"][ident] = pi
            chain.append(pi)
        # Several senses share a folded key -- "Moon" the proper noun beside
        # "moon", Norwegian "fire" (four) beside English "fire" -- and the
        # order they happen to be walked in is meaningless. Keep the sort key
        # so the deepest, longest ancestry is offered first; unsorted, a search
        # for "fire" answered with the Old Norse word for the number four.
        # Depth first; then the word spelled exactly as typed, so a search for
        # "love" is not answered with Swedish "love" just because that chain
        # runs one step longer; then the longer ancestry.
        sh["index"][f].append((-reach, 0 if word == f else 1,
                               -len(chain), word, chain))
        stats["indexed"] += 1

    # inflected forms: one pointer each
    for key, lemma in infl.items():
        code, word = key.split("|", 1)
        if len(word) < (2 if ord(word[0]) < 128 else 1) or len(word) > 32:
            continue
        f = fold(word)
        sh = shards[shard_key(f)]
        if f in sh["index"] or f in sh["lemma"]:
            continue
        lcode, lword = lemma.split("|", 1)
        ident = lcode + "|" + lword
        li = sh["lpool"].get(ident)
        if li is None:
            li = len(sh["lpool"])
            sh["lpool"][ident] = li
        sh["lemma"][f] = li
        stats["inflected"] += 1

    for name in shards:
        sh = shards[name]
        pl = [None] * len(sh["pool"])
        for ident, i in sh["pool"].items():
            pl[i] = ident
        sh["pool_list"] = pl

    # ---- the prefix index -------------------------------------------------
    #
    # Ranked by prominence, not by brevity. Sorting on word length first put
    # "wo", "won", "woo", "woe" ahead of "word", "world" and "work", which is
    # the opposite of useful. Degree -- how many relations a word takes part in
    # -- is the best proxy the corpus offers for how ordinary a word is.
    #
    # Inflected forms are left out of *suggestions* on purpose. They are 74% of
    # the index and nobody browses for "transpareamus"; typing it in full still
    # finds it, and it still resolves to its lemma. Leaving them out is what
    # keeps this small enough to hold every real headword.
    sugg = defaultdict(list)
    for name in shards:
        sh = shards[name]
        for key, entries in sh["index"].items():
            if not entries:
                continue
            # Sort first. The shard writer sorts these later, but this loop
            # runs before it did and was reading entries[0] -- whichever
            # homograph the walk happened to reach first, which is nothing.
            # It only started to matter when the index grew to include words
            # that are nobody's descendant: they arrived ahead of the real
            # senses and represented them, so "word" and "world" were ranked
            # by a namesake with no relations at all and fell out of the
            # suggestions for "wor" entirely.
            entries.sort(key=lambda e: e[:4])
            row = entries[0]
            chain = row[4] if len(row) > 4 else []
            steps = len(chain) or 1
            deep, best = "", -1
            for pi in chain:
                ident = sh["pool_list"][pi]
                if ident and ident[2] > best:
                    best, deep = ident[2], ident[1]
            surface = row[3] if len(row) > 3 else key
            # and rank the key by its most connected sense, not by whichever
            # one is shown: a prefix list offers the word, not a reading of it
            deg = 0
            for e in entries:
                ch = e[4] if len(e) > 4 else []
                w = e[3] if len(e) > 3 else key
                code = ch and sh["pool_list"][ch[0]][1] or ""
                deg = max(deg, lex.degree.get(code + "|" + w, 0))
            sugg[suggest_key(key)].append([key, steps, deep, deg])

    for k in sugg:
        # affixes last, then the most connected, then the longest ancestry,
        # then the shortest word
        sugg[k].sort(key=lambda r: (1 if ("-" in r[0] or "'" in r[0]) else 0,
                                    -r[3], -r[1], len(r[0])))
        del sugg[k][args.suggest_per_key:]
        for r in sugg[k]:
            del r[3]                      # degree was only for the sort

    sys.stderr.write("     \r")
    if not os.path.isdir(args.out):
        os.makedirs(args.out)

    manifest, bytes_total = {}, 0
    for name in sorted(shards):
        sh = shards[name]
        pool = [None] * len(sh["pool"])
        for ident, i in sh["pool"].items():
            w, c, e, k, g = ident
            pool[i] = [w, c, e, k] + ([g] if g else [])
        index = {}
        for k, entries in sh["index"].items():
            entries.sort(key=lambda e: e[:4])
            index[k] = [e[4] for e in entries]
        lpool = [None] * len(sh["lpool"])
        for ident, i in sh["lpool"].items():
            lpool[i] = ident
        doc = {"pool": pool, "index": index}
        if sh["lemma"]:
            doc["lpool"] = lpool
            doc["lemma"] = sh["lemma"]
        path = os.path.join(args.out, "%s.json" % name)
        with io.open(path, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        size = os.path.getsize(path)
        bytes_total += size
        manifest[name] = {"words": len(sh["index"]) + len(sh["lemma"]),
                          "kb": round(size / 1024.0, 1)}

    sdir = os.path.join(args.out, "suggest")
    os.makedirs(sdir)
    sbytes = 0
    for k, rows in sugg.items():
        path = os.path.join(sdir, "%s.json" % k)
        with io.open(path, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(rows, ensure_ascii=False,
                                separators=(",", ":")))
        sbytes += os.path.getsize(path)

    with io.open(os.path.join(args.out, "manifest.json"), "w",
                 encoding="utf-8") as fh:
        fh.write(json.dumps({"shards": manifest,
                             "words": stats["indexed"] + stats["inflected"],
                             "full": stats["indexed"],
                             "inflected": stats["inflected"],
                             "suggest": sorted(sugg.keys()),
                             "note": "fold(word) -> chains of pool indices; "
                                     "lemma -> lpool index; "
                                     "suggest/<2 chars>.json -> prefix "
                                     "candidates"},
                            ensure_ascii=False, separators=(",", ":")))

    sys.stderr.write("\n=== search index ===\n")
    sys.stderr.write("indexed     %d with their own chain\n" % stats["indexed"])
    sys.stderr.write("            %d inflected forms -> lemma\n"
                     % stats["inflected"])
    sys.stderr.write("            %d searchable in total\n"
                     % (stats["indexed"] + stats["inflected"]))
    sys.stderr.write("shards      %d\n" % len(manifest))
    sys.stderr.write("total       %.2f MB (+ %.2f MB of prefix index in %d "
                     "buckets)\n"
                     % (bytes_total / 1e6, sbytes / 1e6, len(sugg)))
    big = sorted(manifest.items(), key=lambda kv: -kv[1]["kb"])[:8]
    for name, m in big:
        sys.stderr.write("  %-8s %7.1f kB  %6d words\n"
                         % (name, m["kb"], m["words"]))
    for k in sorted(stats):
        if k != "indexed":
            sys.stderr.write("  %-14s %d\n" % (k, stats[k]))


if __name__ == "__main__":
    main()
