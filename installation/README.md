# Etymøn — an ocean of words

A projected installation about where words come from, built on the dataset and
the intentions of the 2018 Bilkent senior design project in the parent
directory.

It is a chart of 20,000 real words from 242 languages, and it runs two ways.
Left alone it performs: every twenty seconds a word is chosen, its ancestry
rises out of its own region of the map, turns to face the room, holds long
enough to be read, and sinks back, through eleven movements, forever, with
nothing on screen to suggest a computer. Touch the mouse and it becomes an
instrument: words light under the cursor, clicking one opens its ancestry
beside its Wiktionary entry, and `/` searches 2,563,696 words held locally.

```
python3 serve.py --root ..   # the website at / and the piece at /installation/
python3 serve.py             # or just the piece, at /
```

**Serve it through `serve.py`, not `python3 -m http.server`.** The plain server
sends no `Cache-Control`, so Chrome heuristically caches ES modules and will
happily load one edited module against stale copies of its neighbours — which
throws on startup and looks like the app is broken. `serve.py` sends
`no-cache` on code and lets the index cache properly.

`f` fullscreen · `/` search · `?` help · move the mouse to explore.
Any python3 works to run it. There is no build step and no npm.

---

## What this inherits from 2018

The original project's contributions, and where each one ended up:

| 2018 | here |
|---|---|
| A single interchange format, `<tag>: <word> ⇥ rel:<TYPE> ⇥ <tag>: <word>`, that four incompatible dictionaries were flattened into | Still the input contract for the whole pipeline, and the format the generated registers are written in |
| The scraped corpus: Etymonline, Nişanyan, Starling, Etymological Wordnet — 3.1M relations over 2.97M words | `pipeline/build_graph.py` folds it into one normalised graph |
| A node-link "word cloud" in cytoscape.js, coloured per language | `app/lineage.js` — the same idea, laid out by era so a chain reads as a dive |
| `waves.js`: a 50×50 grid of white dots on two sine waves, the "moving language sea" of the final report | `app/ocean.js` — the same wave function, every dot now a word |
| A button marked **hallucinate**: a character-level LSTM that emitted things shaped like etymologies | `pipeline/dreamer.py` — the same button, on a model that can hold a meaning. Confined to the closing movement |
| The README's stated goal, "find new connections that were not already present in current taxonomy" | The conjecture register: 262 links absent from all four corpora |
| The search box, whose server ran `grep ": <word>\t" etymon.tsv` | `pipeline/searchindex.py` + `app/search.js` — the same reach, as sharded static files, so it needs no server |
| The server's whole-graph lookup: one word in, every line mentioning it out | `pipeline/neighbours.py` + `app/neighbours.js` — the same answer, precomputed into shards. `serve.py --master` will still scan the 332 MB graph live for the relations the shards cap |
| `rel:is_derived_from` / `has_derived_form`, 71% of the corpus | Walked as a fallback where a word has no etymological parent, drawn as its own kind of line, and listed under **built into** / **built on** in the word panel |
| `rel:etymologically_related`, 325,707 edges | The cognate register: a dotted line running sideways, and **kin to** in the panel |
| `rel:variant:orthography`, 15,621 edges | **also spelled** — the corpus's only record that two forms are one word. Dropped as noise until recently |
| The Wiktionary side panel and its "Jump to word" button | `app/hud.js` — restored, now showing only the entry for the language the word is actually in |
| The "?" modal explaining what the colours meant | The help panel, `?` |
| *The Meaning of Words* by Savfk, and the six-bar equalizer that toggled it | `audio/`, and the same six bars in the corner |

Three things in the 2018 tree no longer run, which is why the old site is
broken rather than merely dated: `THREE.CanvasRenderer` and
`SpriteCanvasMaterial` were deleted from three.js at r97, so `waves.js` throws
and takes the page with it; the search endpoint points at
`etymon-190009.appspot.com`, which is gone; and `code/Website/server` is built
on Python 2 and TensorFlow 1.4.

## Two bugs found in the original pipeline

Both were found by rebuilding it, and both are fixed:

**The graph was double-counted.** The master `etymon.tsv` stores every relation
alongside its own inverse, so 6.77M lines describe about 3.16M facts.
`build_graph.py` collapses each inverse pair into one canonical direction.

**The most important languages in the dataset were dangling.** The Etymonline
scraper wrote human-readable language names (`Latin`, `Old French`, `PIE`)
while every other source wrote ISO codes, so those nodes joined up with
nothing. Resolving them recovered **34,790** descent relations and about 87,000
references that had been silently dropped since 2018. The Nişanyan scrape had
the same problem in Turkish (`Eski Türkçe`), and the Starling parse in English
(`Proto-Turkic`). All three are now aliased in `pipeline/languages.py`, which
also drops the tags that were never languages at all — the Etymonline regex
had swallowed fragments of surrounding prose like `past participle stem of`.

## Three registers, and why they are kept apart

The dreamed words are deliberately built to be indistinguishable from the real
floor of the language: correct laryngeals and ablaut for Proto-Indo-European,
correct triconsonantal roots for Proto-Semitic, and the same era depth as the
genuine reconstructions, so they cannot be told apart by position. The only
thing separating a fabrication from the record is how it is lit — which makes
the lighting load-bearing, and makes the key in the corner of the projection
non-negotiable.

| register | in the room | in the data |
|---|---|---|
| **attested** | steady filament | asserted by one of the four corpora |
| **conjectured** | a pulse travels down the edge, node ringed | absent from every corpus; proposed in `data/generated/conjectures.tsv` |
| **dreamed** | shimmers, drifts off its colour, evaporates | invented; `data/generated/dreams.tsv`. No such word has ever existed |

A node is attested only if some corpus edge touches it. Nothing promotes a
conjecture or a dream into the record.

## Where things live

The graph, the map and the score are in the project. **The search index is
not**: it is ~10,000 small files, and this tree lives in iCloud Drive, which
makes a conflict copy of every one of them asynchronously after the build
finishes. So `build.sh` writes it to

```
~/Library/Application Support/Etymon/index      # or $ETYMON_INDEX
```

and `serve.py` serves that directory at `data/index/`. To deploy the piece
anywhere else, copy it to `installation/data/index/` and it will be found in
place — `serve.py` prefers a local copy when one exists.

## What is actually used

The corpus is 3,161,104 canonical edges over 2,970,656 words. An earlier
version of this piece used only `descends_from` — 573,526 edges, 18% of the
total — and ignored derivation entirely, which left 88% of the corpus
unsearchable. That was indefensible and is fixed.

| relation | edges | used for |
|---|---:|---|
| `derived_from` | 2,261,871 | walked where a word has no etymological parent; drawn as fine dashes |
| `descends_from` | 573,526 | the spine: ancestry, and every raised chain |
| `cognate` | 325,707 | sideways links between families, drawn dotted |

What is deliberately **not** on the chart or in the index: 2,022,760 inflected
forms. The Etymological Wordnet expanded verb paradigms, so Latin alone
contributes 603,024 entries like `transpareamus` and `nuntiarunt`, 94% of them
with a single edge. Indexing them costs 150 MB, nobody searches for them, and a
chart of them is a chart of conjugation tables. `searchindex.py
--min-degree-derived 1` includes them if you want them.

### Everything is searchable; lemmas are what you see

**2,790,971 words are searchable** — 94% of the corpus — in three kinds of entry:

* **911,006 full entries.** A word with an etymology, or a derivation with a
  family of its own, stores its whole chain. This includes 465,881 words that
  are only ever somebody else's parent — Chinese 日, Russian хлеб — which used
  to be refused because they have no ancestry to store. What the corpus does
  not know is where *they* came from; that is a reason for a short entry, not
  for pretending the word is absent.
* **1,879,965 inflected forms.** Latin `transpareamus`, Spanish `erigirían`,
  Polish `owieczkami`. Storing a chain for each would cost 150 MB to say the
  same thing fifty times over, so the index records which **lemma** each one
  belongs to, and the app resolves it and shows the headword — saying so in the
  panel: *"you typed erigirían — an inflected form; showing its lemma."*

That is 92 MB across 12,055 shards, and a query still costs one small fetch.

Typing needs a second, separate index. Words are sharded three characters deep
so the Latin buckets stay small — which means a two-character prefix cannot
reach them, because there is no way to know which third letter to fetch. So
`suggest/<two characters>.json` holds the best candidates for each prefix (4.3
MB, 3,776 buckets), ranked by how connected a word is rather than how short it
is: sorting on length put "wo", "won", "woe" ahead of "word", "world" and
"work". Inflected forms are left out of suggestions — nobody browses for
`transpareamus` — but typing one in full still finds it and still resolves to
its lemma.
The chart itself stays lemmas only (60,000 well-connected words): a chart of
conjugation tables is not a map.

Two subtleties worth knowing, because both were bugs first. The lemma is the
*nearest* form with an entry, not the deepest — `transpareamus` belongs to
`transpareo`, and walking on to `pareo` throws the prefix away and answers a
different question. And 213,808 lemmas had to be promoted to full entries
because the corpus records them only through inflection (Polish `owieczka`,
Finnish `nylkeä`); without that their whole paradigm was searchable and
silently answered nothing.

## The map

Position means something, at two scales, both computed in
`pipeline/cartography.py` and baked into the graph:

* **Which region a word is in** — its language family. The regions are placed
  by multidimensional scaling on inter-family affinity, where affinity is
  simply how many edges the corpus runs between two families. The result is a
  picture of contact history: Romance ends up against Germanic (117,493 shared
  edges), Hellenic between Romance and Germanic, Turkic bordering Semitic
  (15,252) and Indo-Iranian, and the constructed languages alone offshore.
  Nobody arranged it.
* **Where it sits inside that region** — resemblance. Character n-gram vectors,
  SVD, then t-SNE, so spelling neighbourhoods form and languages clump because
  languages share orthographic conventions. Emergent, not imposed.
* **How deep it lies** — the era of its language. All five layers are
  reachable: the gauge on the left draws each era as a length of the sea's own
  wave, and clicking one travels there while the others dim — and the layer you
  are in is *lifted*, undoing the depth dimming that is right when looking down
  through all five and wrong once you are standing on the floor.

  The chart is budgeted per stratum rather than per language, because a flat
  per-language cap let the many living languages soak up the whole budget:
  56,275 ancient words were available and 3,200 were being drawn. Now the thin
  deep strata are taken whole — every one of the 1,527 reconstructed forms and
  9,761 medieval ones — and the surface gets the remainder.

Raising a word also lifts the language families it touches, so you can see
where in the world it has been: `coffee` brightens Germanic, Turkic, Semitic
and Romance and holds the rest back.

Every language also has its own coordinates, so a raised chain is drawn across
the map between the islands it really belongs to. `divan` runs from the
Germanic shore through Indo-Iranian to Semitic and ends on Sumerian `dub`, 5,000
units away; `coffee` crosses Germanic, Turkic, Semitic and Romance. An earlier
version stacked every chain over the seed's own region, which was legible and
untrue.

The two scales are deliberately different kinds of claim, and the `?` panel
says so. Words are drawn as dots and only about 200 are labelled at a time —
the most connected ones near where you are looking, plus whatever the cursor is
over. An earlier version labelled all of them in twelve saturated colours and
was unreadable.

## Two modes

**Ambient** is what a gallery gets: no cursor, no controls, the score running
itself. **Explore** starts the moment the mouse moves or a key is pressed — the
cursor returns, hover highlights, click opens the panel, search works, drag
pans the chart and the wheel zooms. The score pauses so a chain is not yanked
away mid-read. After 50 seconds idle, with nothing open, it drifts back to
ambient.

```
/       search (2,563,696 words)       m  microphone on / off
?       help                           p  music on / off
space   dive for the next word         c  captions on / off
. / ,   next / previous movement       k  register key on / off
f       fullscreen                     s  render stats to the console
esc     close, or return to ambient     r  restart the score
```

Drag to pan · wheel to zoom · click a word for its ancestry and its
Wiktionary entry · **Jump to** re-centres everything on it.

## Running it in a room

* **Projector.** Any aspect ratio; the layout is in `vmin` and has no
  breakpoints. Nothing is pure white — projectors bloom, and a warm off-white
  reads as light on water where `#fff` reads as paper.
* **Browser.** Chrome or Safari in fullscreen (`f`). It needs WebGL2.
* **It never needs the network.** Load it once and unplug the machine. Search
  is local; only the Wiktionary panel reaches out, and it fails quietly.
* **Sound.** *The Meaning of Words* by Savfk, CC BY 4.0, carried over from the
  2018 site along with its six-bar equalizer. Browsers no longer allow autoplay
  with sound, so it starts off: press `p` or click the bars. For an unattended
  install, click it once when you open the piece.
* **Microphone**, if you want it: press `m`. A visitor says a word and the
  installation goes looking for it across every language in the corpus, not
  just English. If recognition is denied or the room is too loud, nothing
  breaks and the ambient score continues.
* **Left it running for a month?** The word atlas is fixed-size and the sea
  recycles slots out of a fixed pool, so memory is flat. The score loops.

## A note on iCloud

This tree sits in iCloud Drive, and the search index is ~2,000 small files.
iCloud responds to that by making a conflict copy of each one (`aa 2.json`)
asynchronously, *after* the build has finished, which silently doubles the
directory. They are never referenced — `data/index/manifest.json` lists the
real names — and they are gitignored, but to clear them:

```
find data/index -name "* [0-9].json" -delete
```

## Rebuilding the data

```
./build.sh
```

Five stages, about six minutes:

1. `build_graph.py` folds the corpora into one normalised graph in a work
   directory — 3.1M canonical edges, ~25 s.
2. `weave.py` composes the piece into `data/etymon.json`: 45,000 chart words,
   319 lineages across 11 movements, the three registers.
3. `cartography.py` computes the map and writes the coordinates back. **This is
   the only stage with third-party dependencies** (numpy, scikit-learn) and it
   is build-time only; `build.sh` finds an interpreter that has them, or set
   `PY_SCI=/path/to/python`. The installation itself ships dependency-free.
4. `searchindex.py` precomputes the ancestry of every word that has one and
   shards it — 2,790,971 words in 12,055 shards.
5. `neighbours.py` precomputes each word's *family*: everything one hop away,
   with the six relations kept apart — 2,941,432 words, 5.5M links, 18,202
   shards, 226 MB, every one of them under 200 kB so a lookup is a single
   small fetch. This is the 2018 back end, made static.

Stages 4 and 5 write outside the project, into
`~/Library/Application Support/Etymon/index`, because this tree lives in
iCloud Drive and iCloud responds to ~29,000 small files by making a conflict
copy of each. `serve.py` serves that path at `data/index/`; set `ETYMON_INDEX`
to put it elsewhere, or copy it to `installation/data/index` to deploy.

The composition is in `seeds/movements.txt`, which is the piece's score. Add a
word to a movement, re-run `./build.sh`, and it will be dived for.

`weave.py` is where the editorial judgement lives. Its one substantive rule is
that **descent must move into the past** — an edge is only walked when the
parent's era is at least the child's. Without it the graph is unreadable, for a
reason worth knowing about: nodes are keyed on `(language, spelling)`, so
Turkish *dil* "tongue" and Persian *dil* "heart" are the same node, and an
unfiltered walk from the Turkish word wanders off into Avestan words for blood.
Loans between living languages are still followed — the whole Loanword Currents
movement is nothing else — but only when a word has no ancestry of its own, so
a homograph can contribute a leaf and never a false lineage. The three cases
are documented in `walk()`.

## Optional: live dreaming

The installation ships with a baked corpus and needs nothing else. If you want
it inventing fresh ancestors while it runs:

```
pip install anthropic                    # needs python >= 3.10
export ANTHROPIC_API_KEY=...             # or: ant auth login
python3.12 serve.py
```

`serve.py` then answers `POST /dream` and the piece folds new dreams into the
ocean as it goes, in the same register and the same evaporating light. Without
a key the endpoint returns 503, the app stops asking after three failures, and
the baked corpus carries the piece — which is the normal gallery configuration.

To grow the baked corpus offline instead:

```
python3.12 pipeline/dream.py dream --movement "The Machine Dreams" \
    --append data/generated/dreams.tsv --dry-run
python3.12 pipeline/dream.py conjecture --max-era 1 \
    --append data/generated/conjectures.tsv --dry-run
```

Drop `--dry-run` to actually spend money, then re-run `./build.sh`.

## Layout

```
index.html              the projection; one stylesheet, no framework
serve.py                static server + the optional /dream endpoint
build.sh                rebuilds data/etymon.json from the corpora
app/
  main.js               the score, the camera, the operator keys
  ocean.js              the chart — dots, sparse labels, the 2018 wave
  lineage.js            the chain that stands up out of the water
  atlas.js              every word rasterised once into one texture
  palette.js            territories, era depth as water, the three registers
  hud.js                search, the word panel, help, music, captions
  voice.js              the microphone, and the word index it shares
  search.js             the sharded-index client behind /
  neighbours.js         a word's family: the six relations, one hop out
pipeline/
  languages.py          318 language tags: name, family, era, script
  build_graph.py        stage 1 — fold the corpora
  weave.py              stage 2 — compose the piece
  cartography.py        stage 3 — the map (needs numpy + scikit-learn)
  searchindex.py        stage 4 — every word with an ancestry, sharded
  neighbours.py         stage 5 — every word's family, sharded
  dreamer.py            the prompts and schemas for both generated registers
  dream.py              batch CLI for growing the baked corpus
seeds/movements.txt     the score: eleven movements, 319 seed words
data/
  etymon.json           what the installation loads
  languages.json        the language table, for reuse
  index/                the search index, and index/nbr the neighbourhoods
                        (both outside the project — see the build, below)
  generated/*.tsv       the conjecture and dream registers, in the 2018 format
audio/                  the 2018 soundtrack, CC BY 4.0 — see CREDIT.txt
vendor/three.module.js  three.js r169, vendored so the piece runs offline
```

## Credits

Etymøn was Nashiha Ahmed, Mert İnan, Cholpon Mambetova and Utku Uçkun,
supervised by Mehmet Koyutürk, at Bilkent University, 2017–2018.

The etymological data belongs to the dictionaries it was derived from:
Etymonline (Douglas Harper), Nişanyan Sözlük (Sevan Nişanyan), the Tower of
Babel / Starling databases, and the Etymological Wordnet (Gerard de Melo).
Definitions in the word panel come from Wiktionary, CC BY-SA 3.0. Music is
*The Meaning of Words* by Savfk, CC BY 4.0, as on the 2018 site.

MIT, as the parent repository.
