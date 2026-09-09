# -*- coding: utf-8 -*-
"""
Stage 3 of the Etymon pipeline: give the sea a map.

Until now the sea was a lattice with random jitter -- every word placed
arbitrarily, which made it decoration rather than an argument. Position now
carries meaning, at two scales:

  continents   Language families are laid out by how much they actually
               exchange words. The affinity between two families is the number
               of edges running between them in the corpus (descent, cognate
               and loan), and the territories are placed by multidimensional
               scaling on that affinity, then relaxed so they do not overlap.
               So Romance sits against Germanic and Celtic because that is
               where the borrowing went; Turkic sits against Iranian and
               Semitic for the same reason. Nobody chose the arrangement.

  within them  Inside a territory, words are placed by resemblance: character
               n-gram vectors reduced with SVD and embedded by t-SNE. Words
               that look and sound alike end up adjacent, so a territory has
               its own internal grain -- orthographic neighbourhoods, and
               languages loosely clumping because languages share spelling
               conventions. That clumping is emergent, not imposed.

The third axis stays what it was: era. A word's height is the age of the
language it belongs to, so each territory is layered, with the reconstructed
proto-forms lying on the floor beneath their own descendants.

The two scales mean different things and the room is told so: the register key
gains a line about it.

Needs numpy and scikit-learn, and runs at build time only. The coordinates are
baked into data/etymon.json, so the installation itself stays dependency-free.

    python3.11 cartography.py --graph ../data/etymon.json --workdir <workdir>
"""

import argparse
import io
import json
import math
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import languages

try:
    import numpy as np
except ImportError:
    sys.stderr.write(
        "cartography needs numpy and scikit-learn, and this interpreter has "
        "neither.\n  %s -m pip install numpy scikit-learn\n"
        "It is a build-time stage only; the installation does not need them.\n"
        % sys.executable)
    raise SystemExit(2)

# Territories. Several of the finer currents are folded together here, and
# only where the fold is genealogically real: Baltic and Slavic are a genuine
# clade, and Armenian, Albanian, Anatolian and Proto-Indo-European itself go
# into one "other Indo-European" region rather than each getting a hue of its
# own. This is what cuts the colour count without lying about the tree.
TERRITORY_OF = {
    "romance": "romance",
    "germanic": "germanic",
    "slavic": "balto-slavic",
    "baltic": "balto-slavic",
    "hellenic": "hellenic",
    "celtic": "celtic",
    "indo-iranian": "indo-iranian",
    "armenian": "ie-other",
    "ie-other": "ie-other",
    "turkic": "turkic",
    "semitic": "semitic",
    "uralic": "uralic",
    "distant": "distant",
    "constructed": "constructed",
}

TERRITORY_NAME = {
    "romance": "Italic and Romance",
    "germanic": "Germanic",
    "balto-slavic": "Balto-Slavic",
    "hellenic": "Hellenic",
    "celtic": "Celtic",
    "indo-iranian": "Indo-Iranian",
    "ie-other": "Indo-European, other",
    "turkic": "Turkic",
    "semitic": "Semitic and Afro-Asiatic",
    "uralic": "Uralic",
    "distant": "Distant waters",
    "constructed": "Constructed",
}


def territory(current):
    return TERRITORY_OF.get(current, "distant")


def load_affinity(workdir, keep):
    """Edges between territories -> a symmetric affinity matrix.

    This is the only input to the continental layout. It is a plain count of
    how often the corpus connects one family to another, so the map is a
    picture of contact history rather than of anyone's opinion about it.
    """
    aff = defaultdict(float)
    path = os.path.join(workdir, "edges.tsv")
    for line in io.open(path, "r", encoding="utf-8"):
        s, r, d = line.rstrip("\n").split("\t")
        ca, cb = s.split("|", 1)[0], d.split("|", 1)[0]
        if ca not in languages.LANG or cb not in languages.LANG:
            continue
        ta = territory(languages.LANG[ca][1])
        tb = territory(languages.LANG[cb][1])
        if ta == tb or ta not in keep or tb not in keep:
            continue
        # descent and cognate say more about kinship than a derivation does
        w = 1.0 if r == "derived_from" else 3.0
        key = (ta, tb) if ta < tb else (tb, ta)
        aff[key] += w
    return aff


def place_territories(names, sizes, aff, extent=5200.0, seed=20180503):
    """Multidimensional scaling on family affinity, then overlap relaxation."""
    from sklearn.manifold import MDS

    n = len(names)
    idx = {t: i for i, t in enumerate(names)}

    # affinity -> dissimilarity. Log-compressed, because the raw counts span
    # four orders of magnitude and would otherwise put everything except
    # Romance and Germanic on top of each other.
    D = np.ones((n, n), dtype=float)
    mx = max(aff.values()) if aff else 1.0
    for (a, b), v in aff.items():
        d = 1.0 - math.log1p(v) / math.log1p(mx)
        D[idx[a], idx[b]] = D[idx[b], idx[a]] = 0.10 + 0.90 * d
    np.fill_diagonal(D, 0.0)

    mds = MDS(n_components=2, dissimilarity="precomputed", random_state=seed,
              normalized_stress="auto", n_init=8, max_iter=900)
    P = mds.fit_transform(D)

    # radius of each territory from how many words it holds
    R = np.array([math.sqrt(sizes[t]) for t in names], dtype=float)
    R = R / R.max()

    # scale into the map, then push apart until territories stop overlapping
    P -= P.mean(axis=0)
    span = np.abs(P).max() or 1.0
    P *= extent / span
    rad = R * extent * 0.44 + 260.0

    for _ in range(900):
        moved = 0.0
        for i in range(n):
            for j in range(i + 1, n):
                dv = P[j] - P[i]
                dist = float(np.hypot(*dv)) or 1e-6
                want = (rad[i] + rad[j]) * 0.82
                if dist < want:
                    push = (want - dist) * 0.5
                    u = dv / dist
                    P[i] -= u * push
                    P[j] += u * push
                    moved += push
        if moved < 1.0:
            break

    return {t: (float(P[i][0]), float(P[i][1]), float(rad[i]))
            for i, t in enumerate(names)}


def embed_words(words, seed=20180503):
    """Character n-gram vectors -> SVD -> t-SNE. Returns unit-disc coords.

    Resemblance, not kinship: this is what gives a territory its internal
    grain. Words sharing a prefix, a suffix or a spelling convention pull
    together, which also makes languages clump without being told to.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD
    from sklearn.manifold import TSNE

    n = len(words)
    if n < 8:
        # too few to embed; ring them
        out = np.zeros((n, 2))
        for i in range(n):
            a = 2 * math.pi * i / max(n, 1)
            out[i] = (math.cos(a) * 0.5, math.sin(a) * 0.5)
        return out

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4),
                          min_df=2, max_features=20000, lowercase=True)
    try:
        X = vec.fit_transform(words)
    except ValueError:
        X = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3),
                            lowercase=True).fit_transform(words)

    dims = int(min(48, max(2, min(X.shape) - 1)))
    X = TruncatedSVD(n_components=dims, random_state=seed).fit_transform(X)

    perp = float(max(5.0, min(40.0, n / 90.0)))
    # sklearn renamed TSNE's iteration cap from n_iter to max_iter in 1.5.
    kw = dict(n_components=2, random_state=seed, perplexity=perp,
              init="pca", learning_rate="auto")
    try:
        ts = TSNE(max_iter=750, **kw)
    except TypeError:
        ts = TSNE(n_iter=750, **kw)
    Y = ts.fit_transform(X)

    Y -= Y.mean(axis=0)
    r = np.hypot(Y[:, 0], Y[:, 1]).max() or 1.0
    return Y / r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--graph", required=True, help="data/etymon.json, edited in place")
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--extent", type=float, default=5200.0)
    ap.add_argument("--seed", type=int, default=20180503)
    args = ap.parse_args()

    doc = json.load(io.open(args.graph, encoding="utf-8"))
    ocean = doc["ocean"]
    langs = doc["languages"]

    # group the sea by territory
    groups = defaultdict(list)
    for i, entry in enumerate(ocean):
        word, code = entry[0], entry[1]
        cur = langs[code]["current"] if code in langs else "distant"
        groups[territory(cur)].append(i)

    names = sorted(groups, key=lambda t: -len(groups[t]))
    sizes = {t: len(groups[t]) for t in names}
    sys.stderr.write("territories:\n")
    for t in names:
        sys.stderr.write("  %-26s %6d words\n" % (TERRITORY_NAME[t], sizes[t]))

    sys.stderr.write("\nplacing continents by inter-family affinity...\n")
    aff = load_affinity(args.workdir, set(names))
    top = sorted(aff.items(), key=lambda kv: -kv[1])[:10]
    for (a, b), v in top:
        sys.stderr.write("  %-16s <-> %-16s %10.0f\n" % (a, b, v))
    placed = place_territories(names, sizes, aff, args.extent, args.seed)

    sys.stderr.write("\nembedding words within each territory...\n")
    coords = [None] * len(ocean)
    for t in names:
        ids = groups[t]
        cx, cy, rad = placed[t]
        Y = embed_words([ocean[i][0] for i in ids], args.seed)
        for k, i in enumerate(ids):
            coords[i] = (cx + float(Y[k][0]) * rad, cy + float(Y[k][1]) * rad)
        sys.stderr.write("  %-26s %6d -> r=%.0f at (%.0f, %.0f)\n"
                         % (TERRITORY_NAME[t], len(ids), rad, cx, cy))

    # ocean entries become [word, code, era, x, z, degree]
    for i, entry in enumerate(ocean):
        x, z = coords[i] if coords[i] else (0.0, 0.0)
        deg = entry[3] if len(entry) > 3 else 0
        ocean[i] = [entry[0], entry[1], entry[2],
                    round(x, 1), round(z, 1), deg]

    # Lineage words are placed in their own territory too, so a chain rises out
    # of the right part of the map rather than from wherever the camera was.
    home = {}
    for t in names:
        cx, cy, rad = placed[t]
        home[t] = {"x": round(cx, 1), "z": round(cy, 1), "r": round(rad, 1),
                   "name": TERRITORY_NAME[t], "words": sizes[t]}
    # The renderer colours by territory, so record the mapping here rather
    # than duplicating TERRITORY_OF in JavaScript where it could drift.
    #
    # Each language also gets its own coordinates: the centroid of its words
    # inside its region. Without this a raised chain had nowhere truthful to
    # put its nodes and stacked them all over the seed's own region, so an
    # English word's German ancestor appeared in the middle of the English
    # words. With it, a chain is drawn across the map between the islands it
    # actually belongs to.
    #
    # Languages too sparse in the sample to have a centroid are placed at the
    # centre of their region, pulled inward with era, so the reconstructed
    # forms sit at the heart of the family they are the ancestor of.
    acc = defaultdict(lambda: [0.0, 0.0, 0])
    for i, entry in enumerate(ocean):
        code = entry[1]
        if coords[i]:
            acc[code][0] += coords[i][0]
            acc[code][1] += coords[i][1]
            acc[code][2] += 1
    placed_langs = 0
    for code, meta in langs.items():
        t = territory(meta.get("current", "distant"))
        meta["territory"] = t
        cx, cy, rad = placed.get(t, (0.0, 0.0, 1200.0))
        a = acc.get(code)
        if a and a[2] >= 5:
            meta["pos"] = [round(a[0] / a[2], 1), round(a[1] / a[2], 1)]
            placed_langs += 1
        else:
            # deterministic spot in the region, drawn inward by era
            h = 0
            for ch in code:
                h = (h * 131 + ord(ch)) & 0xffffffff
            ang = (h % 3600) / 3600.0 * 2 * math.pi
            pull = 1.0 - 0.16 * meta.get("depth", 0)
            r = rad * 0.42 * pull
            meta["pos"] = [round(cx + math.cos(ang) * r, 1),
                           round(cy + math.sin(ang) * r, 1)]
    sys.stderr.write("language positions: %d from their own words, "
                     "%d placed in-region\n"
                     % (placed_langs, len(langs) - placed_langs))
    doc["territories"] = home
    doc["cartography"] = {
        "extent": args.extent,
        "continents": "language families, placed by how much they exchange words",
        "within": "resemblance: character n-gram vectors, SVD, t-SNE",
        "vertical": "era of the language, oldest deepest",
    }

    with io.open(args.graph, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    sys.stderr.write("\nwrote %s (%.2f MB)\n"
                     % (args.graph, os.path.getsize(args.graph) / 1e6))


if __name__ == "__main__":
    main()
