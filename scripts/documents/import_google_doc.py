#!/usr/bin/env python3
"""Convert a Google Docs mobile-basic export into the site's safe rich-text JSON."""

from __future__ import annotations

import argparse
import html
import json
import re
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlparse


ALLOWED_FONTS = {
    "Alegreya",
    "Arial",
    "Courier New",
    "Orbitron",
    "Oswald",
    "Times New Roman",
}


def style_map(value: str) -> dict[str, str]:
    styles: dict[str, str] = {}
    for declaration in value.split(";"):
        if ":" not in declaration:
            continue
        key, raw = declaration.split(":", 1)
        styles[key.strip().lower()] = raw.strip()
    return styles


def clean_link(value: str) -> str:
    parsed = urlparse(value)
    if parsed.netloc == "www.google.com" and parsed.path == "/url":
        value = parse_qs(parsed.query).get("q", [value])[0]
    return value if urlparse(value).scheme in {"http", "https"} else ""


class GoogleDocParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_document = False
        self.document_depth = 0
        self.stack: list[dict[str, object]] = []
        self.block: dict[str, object] | None = None
        self.blocks: list[dict[str, object]] = []

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {key: value or "" for key, value in attrs_list}
        classes = set(attrs.get("class", "").split())
        if tag == "div" and "doc-content" in classes and not self.in_document:
            self.in_document = True
            self.document_depth = 1
            self.stack.append({"tag": tag, "attrs": attrs})
            return
        if not self.in_document:
            return
        if tag == "div":
            self.document_depth += 1
        self.stack.append({"tag": tag, "attrs": attrs})

        if tag == "hr":
            self.blocks.append({"type": "divider", "align": "left", "runs": []})
            return
        if tag not in {"p", "h1", "h2", "h3", "li"}:
            return

        styles = style_map(attrs.get("style", ""))
        block_type = {"h1": "heading1", "h2": "heading2", "h3": "heading3"}.get(tag, "paragraph")
        if "title" in classes:
            block_type = "heading1"
        elif "subtitle" in classes:
            block_type = "heading2"
        if tag == "li":
            parent = next((item for item in reversed(self.stack[:-1]) if item["tag"] in {"ol", "ul"}), None)
            block_type = "numbered" if parent and parent["tag"] == "ol" else "bullet"
            margin = styles.get("margin-left", "0")
            match = re.search(r"(-?\d+(?:\.\d+)?)pt", margin)
            level = max(0, min(3, round(float(match.group(1)) / 36) - 1)) if match else 0
        else:
            level = 0
        self.block = {
            "type": block_type,
            "align": styles.get("text-align", "left") if styles.get("text-align") in {"left", "center", "right"} else "left",
            "level": level,
            "runs": [],
        }
        if tag == "li" and block_type == "numbered" and parent:
            start = str(parent["attrs"].get("start", "")).strip()
            if start.isdigit():
                self.block["start"] = int(start)

    def handle_endtag(self, tag: str) -> None:
        if not self.in_document:
            return
        if tag in {"p", "h1", "h2", "h3", "li"} and self.block:
            runs = self.block["runs"]
            if isinstance(runs, list):
                while runs and not str(runs[0].get("text", "")).strip():
                    runs.pop(0)
                while runs and not str(runs[-1].get("text", "")).strip():
                    runs.pop()
                if runs:
                    self.blocks.append(self.block)
            self.block = None
        if self.stack:
            for index in range(len(self.stack) - 1, -1, -1):
                if self.stack[index]["tag"] == tag:
                    self.stack = self.stack[:index]
                    break
        if tag == "div":
            self.document_depth -= 1
            if self.document_depth <= 0:
                self.in_document = False

    def handle_data(self, data: str) -> None:
        if not self.in_document or not self.block or not data:
            return
        text = re.sub(r"\s+", " ", html.unescape(data))
        if not text.strip() and not self.block["runs"]:
            return
        styles: dict[str, str] = {}
        tags: set[str] = set()
        href = ""
        for item in self.stack:
            tag = str(item["tag"])
            attrs = item["attrs"]
            if not isinstance(attrs, dict):
                continue
            tags.add(tag)
            styles.update(style_map(str(attrs.get("style", ""))))
            if tag == "a":
                href = clean_link(str(attrs.get("href", "")))
        weight = styles.get("font-weight", "")
        size_match = re.search(r"(\d+(?:\.\d+)?)pt", styles.get("font-size", ""))
        family = styles.get("font-family", "").strip('"\'')
        run: dict[str, object] = {"text": text}
        if "b" in tags or "strong" in tags or weight == "bold" or (weight.isdigit() and int(weight) >= 600):
            run["bold"] = True
        if "i" in tags or "em" in tags or styles.get("font-style") == "italic":
            run["italic"] = True
        if "u" in tags or "underline" in styles.get("text-decoration", ""):
            run["underline"] = True
        if size_match:
            run["size"] = max(8, min(36, round(float(size_match.group(1)))))
        if family in ALLOWED_FONTS:
            run["font"] = family
        if href:
            run["href"] = href
        runs = self.block["runs"]
        if isinstance(runs, list) and runs and {key: value for key, value in runs[-1].items() if key != "text"} == {key: value for key, value in run.items() if key != "text"}:
            runs[-1]["text"] += text
        elif isinstance(runs, list):
            runs.append(run)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("output")
    args = parser.parse_args()
    converter = GoogleDocParser()
    with open(args.source, "r", encoding="utf-8") as source:
        converter.feed(source.read())
    promoted = {
        "Aviation Standards and Regulations",
        "ARF Standards and Regulations",
        "Gladius Standards and Regulations",
    }
    normalized: list[dict[str, object]] = []
    for block in converter.blocks:
        text = "".join(str(run.get("text", "")) for run in block.get("runs", []))
        if text in promoted:
            block["type"] = "heading1"
        if text.startswith("Gladius Standards and Regulations When acting"):
            remainder = text.removeprefix("Gladius Standards and Regulations ")
            normalized.append({
                "type": "heading1",
                "align": block.get("align", "left"),
                "level": 0,
                "runs": [{"text": "Gladius Standards and Regulations", "bold": True}],
            })
            block = {
                "type": "paragraph",
                "align": block.get("align", "left"),
                "level": 0,
                "runs": [{"text": remainder}],
            }
        normalized.append(block)
    converter.blocks = normalized
    with open(args.output, "w", encoding="utf-8") as output:
        json.dump(converter.blocks, output, ensure_ascii=False, indent=2)
    print(f"Imported {len(converter.blocks)} rich-text blocks")


if __name__ == "__main__":
    main()
