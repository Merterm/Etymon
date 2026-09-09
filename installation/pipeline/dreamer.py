# -*- coding: utf-8 -*-
"""
Etymon — the dreaming layer, 2026 edition.

In 2018 this was `generate_text.py`: a character-level LSTM, two stacked
layers, trained on the raw text of etymwn.tsv, seeded with a fragment of a
triple and asked to keep typing. It produced things shaped like etymologies
without ever holding a meaning, which was the honest limit of a 256-unit LSTM
over characters. The button was called "hallucinate" six years before the word
meant what it means now.

This module is that button, rebuilt. It asks Claude for an ancestor that does
not exist: a well-formed proto-word with a gloss, for a word that does exist.
Two jobs, the same as the original project set itself --

    dream       invent an ancestor. Explicitly false.
    conjecture  propose a real missing link the corpora failed to record.
                This is the README's stated goal, "find new connections that
                were not already present in current taxonomy".

Both are written back in the project's own interchange format, so a dreamed
ancestor and a scraped one are the same kind of row and the renderer decides
how each is lit.

Used from two places:
    pipeline/dream.py   batch: grow the baked corpus offline
    serve.py            live: one dream per lineage while the piece runs

Requires python >= 3.10 and `pip install anthropic`. The rest of the pipeline
is stdlib-only and runs on the system python; only this file needs the SDK, so
a gallery machine with no key and no network runs the baked corpus untouched.
"""

import json
import os
import sys

MODEL = "claude-opus-5"

# Proto-languages the dreamer is allowed to invent in. Restricted on purpose:
# a dreamed form has to sit at the same era depth as the real reconstructions
# for the piece to work, so it must be tagged with a language the installation
# already places on the floor of the ocean.
PROTO = {
    "ine": "Proto-Indo-European",
    "gem": "Proto-Germanic",
    "itc": "Proto-Italic",
    "cel": "Proto-Celtic",
    "sla": "Proto-Slavic",
    "iir": "Proto-Indo-Iranian",
    "ira": "Proto-Iranian",
    "trk": "Proto-Turkic",
    "sem": "Proto-Semitic",
    "bat": "Proto-Baltic",
    "fiu": "Finno-Ugric",
}

SYSTEM_DREAM = """\
You invent etymologies that are false.

This is for Etymøn, a projected installation about the difference between the
recorded history of a word and a plausible fabrication of one. The audience is
told plainly which lineages are invented; your inventions are labelled as
inventions in the room. So there is no deception to worry about here, and no
reason to hedge — your job is to make the fabrication good.

Given a real word, invent one ancestor for it that has never existed.

Rules for the form:
  - It must be well-formed for the proto-language it is tagged with.
    Proto-Indo-European takes laryngeals (h₁ h₂ h₃), ablaut, and a leading
    asterisk: *deyḱ-, *bʰedʰ-, *ǵenh₁-. Proto-Turkic takes long vowels and
    the asterisk: *ȫr-, *dɨl. Proto-Semitic takes a triconsonantal root:
    *k-t-b. Match the convention of whichever you choose.
  - It must NOT be the real root. If you know the actual etymology, go
    somewhere else. A knowledgeable visitor should recognise it as invented
    only because it is labelled, never because it is sloppy.
  - Choose a proto-language that is plausible for the word's own family.

Rules for the gloss:
  - This is the part the room reads. One clause, lower case, no final period.
  - It should do what the best real etymologies do: name a concrete physical
    act or object that the abstract modern word has forgotten it came from.
    Real examples of that shape, for calibration: "text" is a thing woven;
    "code" was a tree trunk; "noise" descends from seasickness; "divan" was a
    Sumerian clay tablet.
  - Be specific and physical. Avoid the mystical register — no "eternal",
    no "the soul of", no "that which binds all things". A good gloss is
    concrete and slightly strange: "the mark a finger leaves in wet clay",
    "to wander a great distance while standing still".
"""

SYSTEM_CONJECTURE = """\
You propose missing links in an etymological database.

This is for Etymøn, whose four source corpora (Etymonline, Nişanyan, Starling,
the Etymological Wordnet, scraped in 2018) are patchy: many words stop one or
two steps above their real root because the scrape lost the chain, not because
the chain is unknown.

Given a word and the deepest ancestor the corpora actually record, propose the
next real step further into the past.

Rules:
  - Standard scholarship only. This is the opposite of the dreaming task: do
    not invent. If you are not reasonably confident, say so in `confidence`.
  - Use the era-appropriate language: Old English rather than English for a
    pre-1150 form, Latin rather than French for a Latin form, and so on.
  - The gloss is the parent's meaning, one clause, lower case, no final
    period. Prefer the concrete original sense over the modern one.
  - Set confidence honestly: "high" for anything in a standard reference,
    "medium" where the details are argued over, "low" for one account of
    several.
"""

DREAM_SCHEMA = {
    "type": "object",
    "properties": {
        "dreams": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string",
                             "description": "the invented ancestor, with a leading asterisk"},
                    "lang": {"type": "string", "enum": sorted(PROTO.keys()),
                             "description": "proto-language tag"},
                    "gloss": {"type": "string"},
                },
                "required": ["word", "lang", "gloss"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["dreams"],
    "additionalProperties": False,
}

CONJECTURE_SCHEMA = {
    "type": "object",
    "properties": {
        "links": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "child": {"type": "string",
                              "description": "tag: word, the form being explained"},
                    "parent": {"type": "string",
                               "description": "tag: word, the proposed ancestor"},
                    "gloss": {"type": "string"},
                    "confidence": {"type": "string",
                                   "enum": ["high", "medium", "low"]},
                },
                "required": ["child", "parent", "gloss", "confidence"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["links"],
    "additionalProperties": False,
}


def client():
    try:
        import anthropic
    except ImportError:
        raise RuntimeError(
            "the anthropic SDK is not installed for this interpreter.\n"
            "  %s -m pip install anthropic\n"
            "(needs python >= 3.10; the rest of the pipeline does not)"
            % sys.executable)
    # Resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login`
    # profile. Nothing is read from the page or passed through the browser.
    return anthropic.Anthropic()


def _json_out(resp):
    """output_config.format guarantees the first text block is valid JSON."""
    if getattr(resp, "stop_reason", None) == "refusal":
        return None
    for block in resp.content:
        if block.type == "text":
            return json.loads(block.text)
    return None


def dream(words, count=1, model=MODEL, cli=None):
    """words: [(lang_name, word)] -> [{word, lang, gloss, of}]"""
    cli = cli or client()
    out = []
    for lang_name, word in words:
        ask = ("Invent %d ancestor%s for this word.\n\n"
               "word: %s\nlanguage: %s\n"
               % (count, "" if count == 1 else "s", word, lang_name))
        resp = cli.messages.create(
            model=model,
            max_tokens=4000,
            # The system prompt is identical across every call in a batch, so
            # caching it turns a few hundred calls into one billed prefix.
            system=[{"type": "text", "text": SYSTEM_DREAM,
                     "cache_control": {"type": "ephemeral"}}],
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema",
                                      "schema": DREAM_SCHEMA}},
            messages=[{"role": "user", "content": ask}],
        )
        data = _json_out(resp)
        if not data:
            continue
        for d in data.get("dreams", []):
            if d.get("lang") in PROTO:
                d["of"] = word
                out.append(d)
    return out


def conjecture(items, model=MODEL, cli=None):
    """items: [(child_tag_word, deepest_tag_word)] -> [{child,parent,gloss,confidence}]"""
    cli = cli or client()
    out = []
    for child, deepest in items:
        ask = ("The corpora record this much and no further. Propose the next "
               "step into the past.\n\nword: %s\ndeepest recorded ancestor: %s\n"
               % (child, deepest))
        resp = cli.messages.create(
            model=model,
            max_tokens=4000,
            system=[{"type": "text", "text": SYSTEM_CONJECTURE,
                     "cache_control": {"type": "ephemeral"}}],
            thinking={"type": "adaptive"},
            output_config={"format": {"type": "json_schema",
                                      "schema": CONJECTURE_SCHEMA}},
            messages=[{"role": "user", "content": ask}],
        )
        data = _json_out(resp)
        if not data:
            continue
        out.extend(data.get("links", []))
    return out


def to_tsv_dream(rows):
    return u"".join(
        u"%s\trel:dream\t%s: %s\t%s\n"
        % (r["of"] if ":" in r["of"] else u"eng: " + r["of"],
           r["lang"], r["word"], r["gloss"])
        for r in rows)


def to_tsv_conjecture(rows):
    return u"".join(
        u"%s\trel:conjecture\t%s\t%s\t%s\n"
        % (r["child"], r["parent"], r["gloss"], r.get("confidence", "medium"))
        for r in rows)
