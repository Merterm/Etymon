# -*- coding: utf-8 -*-
"""
Stage 2 of the Etymon pipeline: compose the installation out of the graph.

Emits the two things the piece actually draws, plus the three registers of
truth it draws them in.

  ocean     ~20k words with no structure at all. These are the sea: the
            undulating field of the original waves.js, except every particle
            is a real word from a real language instead of a white dot.

  lineages  a few hundred ancestries, each a path from a living word down to
            the deepest form that can be reached. These are the node-link
            graphs the 2018 project proposed, and they rise up out of the
            ocean one at a time, hold, and sink back into it.

Three registers, and why they are kept apart
--------------------------------------------
  attested    (kind 0) asserted by one of the four scraped corpora
  conjecture  (kind 1) absent from all four, proposed in data/generated
  dream       (kind 2) invented; no such word ever existed

Nothing here silently promotes a conjecture or a dream into the record. A node
is attested only if some corpus edge touches it, and the flag travels all the
way to the renderer, which gives each register its own light. Since the dreams
are built to sit at the same era depth as the real reconstructions, that
difference in light is the only thing distinguishing the floor of the language
from a fabrication -- which is the argument of the piece, and the reason the
distinction is load-bearing rather than decorative.

The rule that makes lineages legible
------------------------------------
Descent must move into the past. An edge child -> parent is only walked when
the parent's era depth is at least the child's. This one constraint removes
almost all of the noise that made the 2018 graphs unreadable:

  * backwards edges, e.g. lat: modus -> eng: modus, where the corpus recorded
    a modern borrowing in the ancestor direction;
  * homograph collisions. The graph keys nodes on (language, spelling), so
    Turkish "dil" (tongue) and Persian "dil" (heart) are one node, and an
    unfiltered walk from Turkish dil wanders off into Avestan words for blood.
    Equal-depth edges are kept, because loans between living languages are
    real and interesting, but each path gets a budget of exactly one. That
    budget is what lets "cipher" cross into Arabic sifr and go on to the root
    s-f-r, or "carat" cross into qirat and go on to Greek keration -- the
    entire Loanword Currents movement is living-to-living borrowings, and
    without it that movement never leaves the surface. Spending the budget
    then bars any further lateral step, so a homograph can pull a path one
    language sideways but never wander across a chain of them.

An edge into an apparently *younger* parent is walked only when the child is a
historical stage and the drop is at most one era, where it means the corpus
dated a loan by its still-living donor (Middle French modelle <- Italian
modello) rather than that the edge is reversed. From a living child, or out of
a reconstructed form, the same shape is a collision and is dropped. See walk()
for the three cases.
"""

import argparse
import io
import json
import os
import random
import sys
import unicodedata
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import languages

def _fold(s):
    """Diacritic-insensitive form, for matching generated links onto the
    corpus's own spellings."""
    d = unicodedata.normalize("NFD", s)
    return u"".join(c for c in d if not unicodedata.combining(c)).lower()


ATTESTED, CONJECTURE, DREAM = 0, 1, 2
REL_DESCENDS, REL_CONJECTURE, REL_COGNATE, REL_DREAM, REL_DERIVED = 0, 1, 2, 3, 4

GEN_RELS = {"rel:conjecture": CONJECTURE, "rel:dream": DREAM}


class Lexicon(object):
    """Nodes keyed 'code|word', with metadata resolved from languages.py so a
    node introduced by a generated file needs no corpus entry to exist."""

    def __init__(self):
        self.meta = {}        # key -> (code, word, current, depth, script)
        self.attested = set()
        self.gloss = {}
        self.degree = {}
        self._fold = None

    def add(self, tag, word):
        r = languages.resolve(tag)
        if r is None:
            return None
        code, name, current, depth, script = r
        key = code + "|" + word
        if key not in self.meta:
            self.meta[key] = (code, word, current, depth, script)
        return key

    def _build_fold_index(self):
        self._fold = {}
        for key in self.attested:
            code, word = key.split("|", 1)
            self._fold.setdefault(code + "|" + _fold(word), key)

    def attach(self, tag, word):
        """Resolve a *generated* endpoint, preferring an existing corpus node.

        Macrons on Old English and Old Norse are a modern editorial
        convention, and the corpora are inconsistent about them: the graph has
        `ang: mona` where a reference would write `mona` with a macron. Keying
        nodes on the exact string meant a hand-written conjecture for
        "m\u014dna" created a second, near-duplicate node and the chain for
        "moon" stopped one step short. So a generated endpoint that does not
        match exactly is retried against the corpus with diacritics folded, and
        adopts the corpus's own spelling when that is unambiguous.
        """
        r = languages.resolve(tag)
        if r is None:
            return None
        code = r[0]
        exact = code + "|" + word
        if exact in self.meta:
            return exact
        if self._fold is None:
            self._build_fold_index()
        hit = self._fold.get(code + "|" + _fold(word))
        if hit is not None:
            return hit
        return self.add(tag, word)

    def depth(self, key):
        return self.meta[key][3]

    def code(self, key):
        return self.meta[key][0]

    def current(self, key):
        return self.meta[key][2]


def load_corpus(workdir, lex):
    """nodes.tsv / edges.tsv from build_graph.py -- the attested register.

    All three relations are loaded. Derivation used to be dropped on the floor,
    which was indefensible: it is 2.26M of the corpus's 3.16M edges, 72% of
    everything the 2018 scrape collected, and 2.24M words are reachable by no
    other route. Discarding it made 88% of the corpus unfindable.

    It is kept distinct from descent, because the two say different things.
    "waterage" does not *descend* from "water"; it is built out of it, inside
    the same language. So it is walked only where there is no etymological
    parent to walk instead, and it is drawn differently.
    """
    up = defaultdict(list)
    cog = defaultdict(list)
    der = defaultdict(list)
    npath = os.path.join(workdir, "nodes.tsv")
    for line in io.open(npath, "r", encoding="utf-8"):
        code, word, current, depth, deg = line.rstrip("\n").split("\t")
        key = code + "|" + word
        lex.meta[key] = (code, word, current, int(depth),
                         languages.LANG[code][3])
        lex.attested.add(key)
        lex.degree[key] = int(deg)
    epath = os.path.join(workdir, "edges.tsv")
    for line in io.open(epath, "r", encoding="utf-8"):
        s, r, d = line.rstrip("\n").split("\t")
        if r == "descends_from":
            up[s].append((d, ATTESTED))
        elif r == "cognate":
            cog[s].append(d)
            cog[d].append(s)
        elif r == "derived_from":
            der[s].append(d)
    lex.derived = der
    return up, cog, der


def load_generated(paths, lex, up):
    """conjectures.tsv / dreams.tsv -- the two generated registers."""
    dreams = defaultdict(list)
    stats = defaultdict(int)
    for path in paths:
        if not os.path.exists(path):
            sys.stderr.write("  skip (missing): %s\n" % path)
            continue
        for lineno, raw in enumerate(io.open(path, "r", encoding="utf-8"), 1):
            line = raw.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cols = line.split("\t")
            if len(cols) < 3:
                sys.stderr.write("  %s:%d malformed\n"
                                 % (os.path.basename(path), lineno))
                stats["malformed"] += 1
                continue
            left, rel, right = cols[0], cols[1].strip(), cols[2]
            gloss = cols[3].strip() if len(cols) > 3 else ""
            if rel not in GEN_RELS:
                stats["unknown_rel"] += 1
                continue
            kind = GEN_RELS[rel]

            ok = True
            pair = []
            for side in (left, right):
                i = side.find(":")
                if i < 0:
                    ok = False
                    break
                key = lex.attach(side[:i].strip(), side[i + 1:].strip())
                if key is None:
                    sys.stderr.write("  %s:%d unknown language tag %r\n"
                                     % (os.path.basename(path), lineno,
                                        side[:i].strip()))
                    stats["bad_lang"] += 1
                    ok = False
                    break
                pair.append(key)
            if not ok:
                continue
            child, parent = pair
            if gloss:
                lex.gloss.setdefault(parent, gloss)
            if kind == CONJECTURE:
                up[child].append((parent, CONJECTURE))
                stats["conjecture"] += 1
            else:
                dreams[child].append(parent)
                stats["dream"] += 1
    return dreams, stats


def parse_score(path):
    """seeds/movements.txt -> [(title, subtitle, [(tag, word)...])]"""
    movements, cur = [], None
    for raw in io.open(path, "r", encoding="utf-8"):
        line = raw.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("::"):
            parts = [p.strip() for p in line.strip(": ").split("::")]
            cur = (parts[0] if parts else "Untitled",
                   parts[1] if len(parts) > 1 else "", [])
            movements.append(cur)
            continue
        if cur is None:
            cur = ("Untitled", "", [])
            movements.append(cur)
        bits = line.split(None, 1)
        if len(bits) == 2 and len(bits[0]) <= 4 and bits[0].islower():
            cur[2].append((bits[0], bits[1].strip()))
        else:
            cur[2].append(("eng", line.strip()))
    return movements


def walk(seed, lex, up, max_nodes, max_paths, max_hops, der=None):
    """Depth-monotonic upward search. Returns [(path, edge_kinds)], deepest
    first. Attested parents are always preferred over conjectured ones at the
    same era, so a conjecture only ever extends a lineage past where the
    corpora stop -- it never overrides them."""
    found = []

    def self_rel(ekind):
        if ekind == CONJECTURE:
            return REL_CONJECTURE
        if ekind == REL_DERIVED:
            return REL_DERIVED
        return REL_DESCENDS

    def rec(key, path, kinds, hops, loans):
        if hops >= max_hops:
            found.append((path, kinds))
            return
        cd, cc = lex.depth(key), lex.code(key)

        # Derivation is a fallback, not a competitor: follow it only where the
        # corpus records no etymological parent. That keeps "waterage" from
        # short-circuiting past "water"'s real ancestry, while still giving the
        # two and a quarter million words that have nothing else a route down.
        sources = list(up.get(key, []))
        if der is not None and not sources:
            for parent in der.get(key, [])[:3]:
                sources.append((parent, REL_DERIVED))

        cands = []
        for parent, ekind in sources:
            if parent in path or parent not in lex.meta:
                continue
            pd = lex.depth(parent)
            pc = lex.code(parent)
            if pd > cd:
                lateral = False
            elif pd == cd:
                # Same era: intra-language derivation (Latin promptus ->
                # promere) is real descent; a loan between two living
                # languages is also where homograph collisions bite, so those
                # become leaves and are not recursed through.
                lateral = (pc != cc and cd == 0)
            else:
                # Parent looks younger. For a historical stage that is a
                # dating artifact (Middle French modelle <- a then-current
                # Italian); from a living child it is the collision case
                # again. Bound it to a single era, and never out of a
                # reconstructed form: unbounded, a chain could fall to the
                # floor of the language and climb back out somewhere
                # unrelated. "work" reached Proto-Indo-European *werg- and
                # then carried on into English "shop"; "sun" reached *swen-
                # and continued into "roof". A proto-form has no ancestor
                # younger than itself.
                if cd == 0 or cd >= 4 or pd < cd - 1:
                    continue
                lateral = False
            if lateral and loans:
                continue        # one loan per path; see the loan budget note
            if ekind == REL_DERIVED:
                # a derivational step stays inside its own era
                lateral = False
            cands.append((pd, ekind, lateral, parent))
        if not cands:
            found.append((path, kinds))
            return

        # A loan is a fallback, not a competitor. If any genuine descent is
        # available we take that and leave the loans as leaves; only a word
        # with no ancestry of its own is followed sideways into its donor.
        # Without this, Turkish dil (tongue) collides with Persian dil (heart)
        # and the false chain -- which reaches Proto-Indo-European *kerd- and
        # so ties Proto-Turkic on era and wins on length -- becomes the primary
        # lineage for a Turkic word.
        descent = [c for c in cands if not c[2]]
        loanable = [c for c in cands if c[2]]
        if descent:
            for pd, ekind, lateral, parent in loanable[:2]:
                rel = self_rel(ekind)
                found.append((path + [parent], kinds + [rel]))
            chosen = descent
        else:
            chosen = loanable

        # deepest first; attested before conjectured
        chosen.sort(key=lambda t: (-t[0], t[1]))
        for pd, ekind, lateral, parent in chosen[:3]:
            rel = self_rel(ekind)
            rec(parent, path + [parent], kinds + [rel], hops + 1,
                loans + (1 if lateral else 0))

    rec(seed, [seed], [], 0, 0)
    found.sort(key=lambda pk: (-max(lex.depth(k) for k in pk[0]), -len(pk[0])))

    out, seen = [], set()
    for path, kinds in found:
        if len(out) >= max_paths or len(path) < 2:
            continue
        if not [k for k in path if k not in seen] and out:
            continue
        if len(seen | set(path)) > max_nodes:
            continue
        seen |= set(path)
        out.append((path, kinds))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--score", required=True)
    ap.add_argument("--generated", nargs="*", default=[])
    ap.add_argument("--out", required=True)
    ap.add_argument("--ocean-size", type=int, default=20000)
    ap.add_argument("--ocean-per-lang", type=int, default=400)
    ap.add_argument("--max-nodes", type=int, default=18)
    ap.add_argument("--max-paths", type=int, default=3)
    ap.add_argument("--max-hops", type=int, default=8)
    ap.add_argument("--cognates", type=int, default=2)
    ap.add_argument("--dream-movement", default="",
                    help="only attach dreamed ancestors to lineages in the "
                         "movement whose title contains this; empty = all")
    ap.add_argument("--seed", type=int, default=20180503)  # the report's date
    args = ap.parse_args()

    rnd = random.Random(args.seed)
    lex = Lexicon()

    sys.stderr.write("loading corpus graph...\n")
    up, cog, der = load_corpus(args.workdir, lex)
    sys.stderr.write("  %d attested nodes, %d with ancestry\n"
                     % (len(lex.attested), len(up)))

    sys.stderr.write("loading generated registers...\n")
    dreams, gstats = load_generated(args.generated, lex, up)
    sys.stderr.write("  %d conjectured links, %d dreamed\n"
                     % (gstats["conjecture"], gstats["dream"]))
    for k in ("malformed", "bad_lang", "unknown_rel"):
        if gstats[k]:
            sys.stderr.write("  WARNING %s: %d\n" % (k, gstats[k]))

    # ---- emit ------------------------------------------------------------
    idx, out_nodes = {}, []
    node_kind = {}

    def node_id(key):
        if key in idx:
            return idx[key]
        code, word, current, depth, script = lex.meta[key]
        idx[key] = len(out_nodes)
        out_nodes.append([word, code, depth, ATTESTED])
        return idx[key]

    def mark(key, kind):
        """A node's register is the best claim anyone makes on it: touched by a
        corpus edge -> attested, else conjectured, else dreamed."""
        i = node_id(key)
        prev = node_kind.get(i, DREAM)
        best = ATTESTED if key in lex.attested else kind
        node_kind[i] = min(prev, best)
        out_nodes[i][3] = node_kind[i]
        return i

    out_edges, edge_seen = [], set()

    def add_edge(a, b, rel):
        if (a, b, rel) in edge_seen:
            return
        edge_seen.add((a, b, rel))
        out_edges.append([a, b, rel])

    out_movements, missing = [], []
    stats = defaultdict(int)

    for title, subtitle, seeds in parse_score(args.score):
        # Dreaming is confined to a single movement. Spread across the whole
        # score it became wallpaper -- every chain ending in the same shrug of
        # an invented root taught you nothing about the language. Kept to one
        # closing movement it is an argument again, and the rest of the piece
        # is the recovered record.
        dreams_here = (not args.dream_movement or
                       args.dream_movement.lower() in title.lower())
        m_lineages = []
        for tag, word in seeds:
            key = lex.add(tag, word)
            if key is None or key not in lex.meta:
                missing.append("%s: %s" % (tag, word))
                stats["seed_missing"] += 1
                continue
            paths = walk(key, lex, up, args.max_nodes, args.max_paths,
                         args.max_hops, der)
            if not paths:
                missing.append("%s: %s (no ancestry)" % (tag, word))
                stats["seed_no_ancestry"] += 1
                continue

            lin_nodes = []
            has_conj = False
            for path, kinds in paths:
                ids = []
                for step, k in enumerate(path):
                    kind = ATTESTED
                    if step and kinds[step - 1] == REL_CONJECTURE:
                        kind = CONJECTURE
                        has_conj = True
                    ids.append(mark(k, kind))
                for a, b, rel in zip(ids, ids[1:], kinds):
                    add_edge(a, b, rel)
                lin_nodes.extend(ids)

            # cross-current cognates: the surprising sideways links
            orn = 0
            for k in set(x for p, _ in paths for x in p):
                if orn >= args.cognates:
                    break
                for c in cog.get(k, []):
                    if c not in lex.meta or lex.current(c) == lex.current(k):
                        continue
                    add_edge(mark(k, ATTESTED), mark(c, ATTESTED), REL_COGNATE)
                    lin_nodes.append(idx[c])
                    orn += 1
                    break

            # and a couple of words built out of the seed, so derivation --
            # the relation that carries most of the corpus -- is visible on
            # the chart rather than only counted in the statistics
            for c in der.get(key, [])[:2]:
                if c in lex.meta:
                    add_edge(mark(key, ATTESTED), mark(c, ATTESTED), REL_DERIVED)
                    lin_nodes.append(idx[c])

            # dreamed branches hang off any node in the lineage
            dreamt = []
            for k in ([key] + [x for p, _ in paths for x in p]
                      if dreams_here else []):
                for parent in dreams.get(k, []):
                    a, b = mark(k, ATTESTED), mark(parent, DREAM)
                    add_edge(a, b, REL_DREAM)
                    dreamt.append(b)
                    stats["dream_edges"] += 1

            m_lineages.append({
                "seed": idx[key],
                "nodes": sorted(set(lin_nodes + dreamt)),
                "paths": [[idx[k] for k in p] for p, _ in paths],
                "kinds": [ks for _, ks in paths],
                "dreams": sorted(set(dreamt)),
                "depth": max(lex.depth(k) for p, _ in paths for k in p),
                "conjectured": has_conj,
            })
            stats["lineages"] += 1

        out_movements.append({"title": title, "subtitle": subtitle,
                              "lineages": m_lineages})


    # Materialise every dreamed ancestor, not just the ones the closing
    # movement happens to seed. The score still confines *ambient* dreaming to
    # that movement -- spread across all eleven it became wallpaper -- but a
    # visitor who searches or clicks a word that has a dream should see it.
    # Without this index an ad-hoc chain could never carry one.
    dream_index = defaultdict(list)
    for child, parents in dreams.items():
        if child not in lex.meta:
            continue
        for parent in parents:
            pid = mark(parent, DREAM)
            code, word = lex.meta[child][0], lex.meta[child][1]
            dream_index[code + "|" + word].append(pid)
            if child in idx:
                add_edge(idx[child], pid, REL_DREAM)

    # ---- the ocean -------------------------------------------------------
    # ---- the chart -------------------------------------------------------
    #
    # Budgeted by stratum, not by language. A flat per-language cap let the
    # many living languages soak up the whole budget: 56,275 ancient words were
    # available and 3,200 were drawn, so every layer below the surface looked
    # emptier than it is, and the reconstructed floor -- the whole reason for
    # stacking them -- was a handful of specks. The deep strata are small enough
    # to take whole; the surface gets whatever is left.
    by_era_lang = defaultdict(lambda: defaultdict(list))
    for key in lex.attested:
        code, word, current, depth, script = lex.meta[key]
        if len(word) > 18 or len(word) < 2:
            continue
        if word.startswith("-") or word.endswith("-"):
            continue          # bound affixes read as noise on screen
        # Two thirds of the corpus is inflectional: the Etymological Wordnet
        # expanded verb paradigms, so Latin alone contributes 603,024 forms
        # like "transpareamus", 94% of them with a single edge. They are real
        # data and they are used -- the walk follows derivation, and they are
        # searchable -- but a chart of them would be a chart of conjugation
        # tables.
        if lex.degree.get(key, 0) < 2:
            continue
        by_era_lang[depth][code].append(
            [word, code, depth, lex.degree.get(key, 0)])

    # eras filled in this order, so the thin deep ones are never crowded out
    order = [4, 1, 2, 3, 0]
    budget = {4: args.ocean_size, 1: args.ocean_size,
              2: args.ocean_size, 3: 16000, 0: args.ocean_size}
    per_lang = {4: 100000, 1: 100000, 2: 100000, 3: 4000,
                0: args.ocean_per_lang}

    ocean = []
    for era in order:
        left = min(budget[era], args.ocean_size - len(ocean))
        if left <= 0:
            continue
        langs_here = sorted(by_era_lang[era],
                            key=lambda c: -len(by_era_lang[era][c]))
        taken = 0
        # round-robin across the languages of this era so no single one
        # (Latin, in the ancient layer) takes the lot
        pools = []
        for code in langs_here:
            pool = by_era_lang[era][code]
            rnd.shuffle(pool)
            pools.append(pool[:per_lang[era]])
        i = 0
        while taken < left and any(pools):
            pools = [p for p in pools if p]
            if not pools:
                break
            for pool in pools:
                if taken >= left:
                    break
                ocean.append(pool.pop())
                taken += 1
        stats["chart_era_%d" % era] = taken

    rnd.shuffle(ocean)

    used = set(n[1] for n in out_nodes) | set(o[1] for o in ocean)
    lang_out = {}
    for code in used:
        name, current, depth, script = languages.LANG[code]
        lang_out[code] = {"name": name, "current": current,
                          "depth": depth, "script": script}

    glosses = {}
    for key, g in lex.gloss.items():
        if key in idx:
            glosses[str(idx[key])] = g

    doc = {
        "meta": {
            "title": "Etymon",
            "sources": "Etymonline, Nisanyan, Starling, Etymological Wordnet",
            "registers": {"0": "attested", "1": "conjecture", "2": "dream"},
            "relations": {"0": "descends_from", "1": "conjecture",
                      "2": "cognate", "3": "dream", "4": "derived_from"},
            "corpus_nodes": len(lex.attested),
            "seed": args.seed,
        },
        "currents": {k: {"name": v[0], "color": v[1]}
                     for k, v in languages.CURRENTS.items()},
        "languages": lang_out,
        "nodes": out_nodes,
        "edges": out_edges,
        "glosses": glosses,
        "dreamIndex": {k: v for k, v in dream_index.items()},
        "movements": out_movements,
        "ocean": ocean,
    }
    with io.open(args.out, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))

    kinds = defaultdict(int)
    for n in out_nodes:
        kinds[n[3]] += 1
    rels = defaultdict(int)
    for e in out_edges:
        rels[e[2]] += 1
    names = {ATTESTED: "attested", CONJECTURE: "conjecture", DREAM: "dream"}
    relnames = {REL_DESCENDS: "descends", REL_CONJECTURE: "conjecture",
                REL_COGNATE: "cognate", REL_DREAM: "dream",
                REL_DERIVED: "derived"}

    sys.stderr.write("\n=== woven ===\n")
    sys.stderr.write("movements   %d\n" % len(out_movements))
    sys.stderr.write("lineages    %d  (%d extended by conjecture)\n"
                     % (stats["lineages"],
                        sum(1 for m in out_movements for l in m["lineages"]
                            if l["conjectured"])))
    sys.stderr.write("nodes       %d  %s\n"
                     % (len(out_nodes),
                        ", ".join("%s %d" % (names[k], kinds[k])
                                  for k in sorted(kinds))))
    sys.stderr.write("edges       %d  %s\n"
                     % (len(out_edges),
                        ", ".join("%s %d" % (relnames[k], rels[k])
                                  for k in sorted(rels))))
    sys.stderr.write("glosses     %d\n" % len(glosses))
    sys.stderr.write("dreamable   %d words\n" % len(dream_index))
    sys.stderr.write("chart       %d words, %d languages\n"
                     % (len(ocean), len(set(o[1] for o in ocean))))
    for era in range(5):
        sys.stderr.write("   era %d    %d\n"
                         % (era, stats.get("chart_era_%d" % era, 0)))
    sys.stderr.write("size        %.2f MB\n" % (os.path.getsize(args.out) / 1e6))
    reach = defaultdict(int)
    for m in out_movements:
        for l in m["lineages"]:
            reach[l["depth"]] += 1
    sys.stderr.write("lineage reach by era: %s\n" % sorted(reach.items()))
    if missing:
        sys.stderr.write("unrooted seeds (%d): %s\n"
                         % (len(missing), "; ".join(missing[:20])))


if __name__ == "__main__":
    main()
