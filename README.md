# Etymøn

Etymøn is an open-source map of where words come from — **3,176,725
etymological relations between 2,980,629 words in 255 languages** — and a
projected installation built on top of it.

It began in 2018 as an undergraduate capstone project at Bilkent University:
scrape the world's etymological dictionaries, fold them into one graph, and see
whether the shape of that graph says anything the dictionaries do not.
<http://etymon.org>

---

## The installation

**[`installation/`](installation/) — an ocean of words.**

A chart of 60,000 real words from 242 languages that runs two ways. Left alone
it performs: every twenty seconds a word is chosen, its ancestry rises out of
its own region of the map, turns to face the room, holds long enough to be
read, and sinks back — eleven movements, forever, with nothing on screen to
suggest a computer. Touch the mouse and it becomes an instrument: words light
under the cursor, clicking one opens its ancestry beside its Wiktionary entry,
and `/` searches 2,790,971 words held locally.

Raising a word brings its **family** with it — not just the thread of ancestors
but everything the corpus records one hop away, with the relations kept apart:
what descended from it, what it is built out of, what is built out of it, its
cognates in other languages, and its other spellings. That is 5.5 million links
from an index of 2,941,432 words, and each relation is drawn with its own kind
of line.

A word's position is an argument. **Which region** it lies in is its language
family, and the regions are placed by how much they actually exchange words —
so Romance sits against Germanic, Turkic borders Semitic and Iranian, and the
constructed languages end up alone offshore. **Where it sits inside a region**
is resemblance, from a character n-gram embedding. **How deep it lies** is the
age of its language. All three come out of the corpus; none of it was arranged
by hand.

### Run it

Any python3. No npm, no build step, no network, nothing to install.

```
git clone -b installation https://github.com/Merterm/Etymon.git
cd Etymon/installation
python3 serve.py                        # http://localhost:8000
```

The piece lives on the `installation` branch for the moment — `master` is
still the 2018 project, and it is what etymon.org serves.

That gets you the whole piece: the ocean, the score, the eleven movements, the
depth layers, the music. `f` fullscreen · `?` help · move the mouse to explore.

**To also get search and a word's family**, build the two indexes once. They
are ~400 MB of small files, which is why they are not in the repository:

```
./build.sh                              # about six minutes
python3 serve.py
```

`build.sh` unzips the 332 MB master graph that ships in `code/Website/server/`,
normalises it, and writes the search index and the neighbourhood index outside
the project (`~/.local/share/Etymon/index`, or Application Support on macOS —
set `ETYMON_INDEX` to put them elsewhere). Stage 3 wants numpy and
scikit-learn, but skips itself if the map is already baked into
`data/etymon.json`, which it is in a fresh clone. So a plain python3 is enough.

**Optionally**, let the piece answer the relations the index caps — a hub keeps
24 of them and English *time* has 1,271:

```
python3 serve.py --master /path/to/etymon.tsv
```

Then "+1,247 more" in a word's panel becomes a button.

To serve the website and the piece together — site at `/`, piece at
`/installation/` — run `python3 serve.py --root ..` from `installation/`.

Serve it through `serve.py`, not `python3 -m http.server`: the latter sends no
`Cache-Control`, and Chrome will happily mix a stale ES module with fresh ones
and throw on startup.

See [installation/README.md](installation/README.md) for how to put it in a
room — projector, microphone, kiosk mode, and what to do about the audio
autoplay policy.

What surfaces is the argument. Nearly every word we have coined for this
technological moment is an older and usually physical word pressed back into
service. *Text* is a thing woven — Latin `texere`, and so is *textile*, and so
is *subtle*, `sub tela`, under the warp of the loom. *Code* was a tree trunk
split into tablets. *Noise* descends from Latin `nausea`, seasickness, and so
from `naus`, a ship. The *divan* you sit on is named for a Persian
account-book, named for an Old Persian word for writing, which is a Sumerian
clay tablet. And *hallucinate* is Latin `alucinari`: to wander in the mind.

The installation draws three kinds of light, and says which is which on the
wall: **attested** (asserted by a source corpus), **conjectured** (absent from
every corpus, and proposed — 478 of these fill gaps the 2018 scrapes lost), and
**dreamed** (invented — no such word has ever existed). The dreamed forms are
built to be indistinguishable from the real floor of the language by shape and
by depth, so the only thing separating a fabrication from the record is how it
is lit. They are confined to the closing movement; spread across the whole
score they stopped being an argument and became wallpaper.

Carried over from 2018 along with the data: the search box, the Wiktionary
panel and its *Jump to word* button, the "?" modal, and the soundtrack —
*The Meaning of Words* by Savfk, CC BY 4.0 — with the same six-bar equalizer
toggling it.

## The data

Four dictionaries, one interchange format — the 2018 project's most useful and
least glamorous contribution:

```
<language tag>: <word>    rel:<TYPE>    <language tag>: <word>

eng: text        rel:etymology               fro: texte
lat: texere      rel:etymological_origin_of  lat: textus
tur: dil         rel:etymology               trk: *dɨl
```

Scraped from **Etymonline** (Douglas Harper), **Nişanyan Sözlük** (Sevan
Nişanyan), **Starling** / Tower of Babel, and the **Etymological Wordnet**
(Gerard de Melo). The per-source data is in [`data/`](data/) as CSV and TSV;
the full 332 MB graph is in the repository's releases. Use it — that is what it
is for. The dictionaries it derives from belong to their authors.

### Four kinds of claim

The corpus does not say one thing about how two words relate; it says four,
and they are not interchangeable. Stage 1 normalises all of them and the
installation draws each with its own line:

| relation | edges | what it claims |
|---|---:|---|
| `derived_from` | 2,261,871 | built out of, usually within one language — *waterage* from *water* |
| `descends_from` | 573,526 | comes from, across time — *text* from Old French *texte* |
| `cognate` | 325,707 | shares an ancestor; siblings, not parent and child |
| `variant` | 15,621 | the same word, spelled otherwise — *colour*, *color* |

Derivation is 71% of the corpus and for 2.24 million words it is the only
relation recorded, so dropping it — which the first pass through this pipeline
did — makes 88% of the graph unreachable.

### Three bugs, fixed

Rebuilding the pipeline turned up three problems in the original data, all now
corrected in [`installation/pipeline/`](installation/pipeline/):

- **The graph was double-counted.** Every relation is stored alongside its own
  inverse, so 6.77M lines describe about 3.18M facts.
- **The most important languages were dangling.** The Etymonline scraper wrote
  human-readable names (`Latin`, `Old French`, `PIE`) while every other source
  wrote ISO codes, so those nodes joined up with nothing. Resolving them
  recovered **34,790 descent relations** and ~87,000 references that had been
  silently dropped since 2018. `installation/data/languages.json` is the
  resulting table: 318 tags with name, family, era and script.
- **Spelling variants were being discarded** as noise. They are the corpus's
  only record that two forms are one word, which is close to the subject of
  the whole project; 15,621 of them are back.

## Layout

```
installation/     the projected piece, its pipeline, and the generated registers
data/             the scraped corpora, per source
docs/             the 2018 senior design reports, in full
code/             the 2018 implementation, kept as an artefact — see below
site/             the etymon.org front page
index.html        etymon.org  ·  index.2018.html is the original page
```

`code/` is history, not a dependency. It does not run today: three.js deleted
`CanvasRenderer` and `SpriteCanvasMaterial` at r97, so the original `waves.js`
throws; the search endpoint points at a Google App Engine instance that is
gone; and the server is Python 2 with TensorFlow 1.4. The parts of it that
mattered are carried forward in `installation/`, and
[installation/README.md](installation/README.md) has a table of what became
what.

## The 2018 project

Submitted to the Department of Computer Engineering at Bilkent University in
partial fulfilment of CS491/2. All reports are in [`docs/`](docs/), including
the parts that did not work.

**Team** — Nashiha Ahmed, Mert İnan, Cholpon Mambetova, Utku Uçkun
**Supervisor** — Prof. Mehmet Koyutürk
**Jury** — Prof. Uğur Doğrusöz, Prof. Çiğdem Gündüz Demir
**Innovation expert** — Dr. Çağla Çığ Karaman

The original README is kept at [README.2018.md](README.2018.md).

MIT licensed.
