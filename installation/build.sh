#!/usr/bin/env bash
# Etymon — rebuild data/etymon.json from the source corpora.
#
# Two stages. Stage 1 folds the four scraped dictionaries into one normalised
# graph; stage 2 slices that graph into the ocean and the lineages the
# installation draws, layering in the generated conjecture and dream registers.
#
#   ./build.sh                      # rebuild everything
#   WORKDIR=/tmp/etymon ./build.sh  # keep the 3M-edge intermediate somewhere
#
# Stdlib python3 only. The optional live-dreaming path (pipeline/dream.py)
# needs python >= 3.10 and the anthropic SDK; nothing here does.

set -euo pipefail
cd "$(dirname "$0")"

PY=${PY:-python3}
REPO=..
WORKDIR=${WORKDIR:-${TMPDIR:-/tmp}/etymon-build}
MASTER=${MASTER:-$WORKDIR/etymon.tsv}

mkdir -p "$WORKDIR"

# ---------------------------------------------------------------------------
# The 332 MB master graph ships zipped in the 2018 tree. Everything else is
# already plain text.
# ---------------------------------------------------------------------------
if [ ! -f "$MASTER" ]; then
  if [ -f "$REPO/code/Website/server/etymon.tsv.zip" ]; then
    echo "==> unzipping master graph (332 MB) into $WORKDIR"
    unzip -o -q "$REPO/code/Website/server/etymon.tsv.zip" etymon.tsv -d "$WORKDIR"
  else
    echo "!! $MASTER not found and etymon.tsv.zip is missing." >&2
    echo "   The master graph is in the repository's releases; or build from" >&2
    echo "   the per-source corpora alone by removing it from INPUTS below." >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Stage 1 — fold every corpus into one normalised, deduplicated graph.
# ---------------------------------------------------------------------------
echo "==> stage 1: normalising corpora"
"$PY" pipeline/languages.py
"$PY" pipeline/build_graph.py \
  --inputs \
    "$MASTER" \
    "$REPO/data/Nisanyan/Nisanyan.tsv" \
    "$REPO/data/Starling/Turkic etymology.tsv" \
    "$REPO/data/Starling/Abkhaz-Adyghe etymology.tsv" \
    "$REPO/data/Etymonline/etymonline.tsv" \
  --workdir "$WORKDIR"

# ---------------------------------------------------------------------------
# Stage 2 — compose the installation.
# ---------------------------------------------------------------------------
echo "==> stage 2: weaving the installation"
"$PY" pipeline/weave.py \
  --workdir "$WORKDIR" \
  --score seeds/movements.txt \
  --generated data/generated/conjectures.tsv data/generated/dreams.tsv \
  --dream-movement "dreams itself" \
  --ocean-size 60000 --ocean-per-lang 700 \
  --out data/etymon.json

# ---------------------------------------------------------------------------
# Stage 3 — the map. Needs numpy and scikit-learn, so it may want a different
# interpreter than the rest of the pipeline; PY_SCI overrides. This is the only
# stage with third-party dependencies, and it is build-time only: the
# coordinates are baked into the graph and the installation ships plain.
# ---------------------------------------------------------------------------
find_sci() {
  for cand in "${PY_SCI:-}" python3.12 python3.11 python3 \
              "$HOME/miniconda3/bin/python3" /opt/homebrew/bin/python3; do
    [ -n "$cand" ] || continue
    if command -v "$cand" >/dev/null 2>&1 && \
       "$cand" -c "import numpy, sklearn" >/dev/null 2>&1; then
      echo "$cand"; return 0
    fi
  done
  return 1
}

echo "==> stage 3: drawing the map"
if SCI=$(find_sci); then
  echo "    using $SCI"
  "$SCI" pipeline/cartography.py --graph data/etymon.json --workdir "$WORKDIR"
elif "$PY" -c "
import json,sys
d=json.load(open('data/etymon.json'))
sys.exit(0 if d.get('cartography') and d.get('territories') else 1)" 2>/dev/null; then
  # The coordinates are baked into data/etymon.json, which ships with the
  # repository, so a clone that only wants to *run* the piece does not need
  # numpy at all. This used to exit 1 here, which meant nobody could build the
  # search index without first installing scikit-learn to recompute a map that
  # was already sitting in the file.
  echo "    skipped: data/etymon.json already carries its map."
  echo "    To recompute it (after changing the corpora or the chart):"
  echo "      python3 -m pip install numpy scikit-learn && ./build.sh"
else
  echo "!! no interpreter with numpy + scikit-learn found, and" >&2
  echo "   data/etymon.json has no map baked into it." >&2
  echo "   The chart's coordinates come from this stage and the app needs" >&2
  echo "   them. Install them and re-run, or set PY_SCI:" >&2
  echo "     python3 -m pip install numpy scikit-learn" >&2
  echo "     PY_SCI=/path/to/python ./build.sh" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Stage 4 — the search index. Every word in the corpus with a real ancestry,
# sharded so a query costs one small fetch and works offline.
# ---------------------------------------------------------------------------
echo "==> stage 4: search index"
# This tree lives in iCloud Drive. Rewriting 1,100 small files in place while
# iCloud is mid-sync makes it produce a conflict copy of each one ("aa 2.json"),
# which doubles the directory and is invisible to the manifest. Build into a
# temporary directory and swap it in as a single move instead.
# Where the index lands. Outside the project on purpose: it is ~10,000 small
# files and this tree lives in iCloud Drive, which duplicates each of them
# asynchronously after the build. serve.py serves this path at data/index/.
# Where the index lands, per platform. The macOS path was hard-coded, so on
# Linux without XDG_DATA_HOME set the build quietly created a directory called
# "Library/Application Support" in the user's home.
if [ -n "${ETYMON_INDEX:-}" ]; then
  INDEX_DIR=$ETYMON_INDEX
elif [ -n "${XDG_DATA_HOME:-}" ]; then
  INDEX_DIR=$XDG_DATA_HOME/Etymon/index
elif [ "$(uname -s)" = "Darwin" ]; then
  INDEX_DIR=$HOME/Library/Application\ Support/Etymon/index
else
  INDEX_DIR=$HOME/.local/share/Etymon/index
fi
INDEX_TMP="$WORKDIR/index.new"
rm -rf "$INDEX_TMP"
"$PY" pipeline/searchindex.py \
  --workdir "$WORKDIR" \
  --out "$INDEX_TMP" \
  --min-era 0 \
  --lemmas-only-below 2 \
  --generated data/generated/conjectures.tsv
mkdir -p "$(dirname "$INDEX_DIR")"
rm -rf "$INDEX_DIR"
mv "$INDEX_TMP" "$INDEX_DIR"
echo "    index -> $INDEX_DIR"
# If an older build left an index inside the project (where iCloud will churn
# it), take it out of the way: serve.py prefers data/index when it exists.
if [ -d data/index ]; then
  echo "    removing the old in-project copy at data/index"
  rm -rf data/index
fi

# ---------------------------------------------------------------------------
# Stage 5 — the neighbourhood index. Everything the corpus records one hop
# from a word, with the six relations kept apart.
#
# Stage 1 folds 3.17M edges of five kinds out of the six dictionaries. Before
# this stage existed almost none of that reached the browser: the score
# carries ~1,100 edges and the search index stores one linear chain per word,
# so 2.26M derivations, 326k cognate links and every spelling variant were
# computed and then dropped. This is the lookup the 2018 Node server did by
# grepping the master graph, precomputed and sharded -- 5.5M links, every
# shard under 200 kB, and it works with the network unplugged.
# ---------------------------------------------------------------------------
echo "==> stage 5: neighbourhoods"
NBR_TMP="$WORKDIR/nbr.new"
rm -rf "$NBR_TMP"
"$PY" pipeline/neighbours.py --workdir "$WORKDIR" --out "$NBR_TMP"
rm -rf "$INDEX_DIR/nbr"
mv "$NBR_TMP" "$INDEX_DIR/nbr"
echo "    neighbourhoods -> $INDEX_DIR/nbr"

echo
echo "==> done. run it with:"
echo "      python3 serve.py"
echo "    to also answer the relations the shards cap (a hub keeps 24 of"
echo "    them; English \"time\" has 1,271), point it at the master graph:"
echo "      python3 serve.py --master $MASTER"
echo "    then open http://localhost:8000"
echo "    press f for fullscreen, / to search, ? for help"
