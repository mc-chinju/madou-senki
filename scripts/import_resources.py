#!/usr/bin/env python3
"""Copy supplied resources, safely extract the ZIP, and index without guessing rules.

Requires Python 3.10+ and Poppler's pdftotext/pdfinfo. No game code is generated.
"""
import argparse
from collections import Counter
from datetime import date
import hashlib
import html
import json
from pathlib import Path
import shutil
import stat
import subprocess
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RESOURCE = ROOT / "resources"
SOURCE_URL = "https://note.com/dreamfv/n/nb58307ec682c"
PDFS = ("Summary.pdf", "MadoRule.pdf", "CardAll.pdf", "Character(A4).pdf")
ZIP_NAME = "魔導戦記1 3rd Ed ルームデータ.zip"


def record(path):
    return {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def copy_original(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes() != source.read_bytes():
        raise ValueError(f"Original already exists with different contents: {target}")
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    return {"original_name": source.name, **record(target)}


def index_room():
    folder = RESOURCE / "extracted" / "udonarium-3rd"
    xml_bytes = (folder / "data.xml").read_bytes()
    if b"<!DOCTYPE" in xml_bytes or b"<!ENTITY" in xml_bytes:
        raise ValueError("Unexpected XML document type/entity")
    room = ET.fromstring(xml_bytes)
    groups = [(f"stack-{i+1}", list(s.iter("card")))
              for i, s in enumerate(room.findall("card-stack"))]
    groups.append(("loose", room.findall("card")))
    cards, definitions = [], {}
    for group, entries in groups:
        for i, card in enumerate(entries):
            def value(name):
                return card.findtext(f".//data[@name='{name}']", default="")
            front, back = value("front"), value("back")
            for image_id in (front, back):
                if not (folder / f"{image_id}.jpg").is_file():
                    raise ValueError(f"Missing card image: {image_id}")
            item = {"instance_id": f"{group}-{i+1:03}", "source_group": group,
                    "source_order": i, "source_label": value("name"),
                    "front_image": f"{front}.jpg", "back_image": f"{back}.jpg",
                    "source_attributes": dict(card.attrib)}
            cards.append(item)
            definition = definitions.setdefault(front, {
                "asset_id": front, "front_image": f"{front}.jpg", "copies": 0,
                "source_groups": [], "source_labels": [],
                "rules_status": "image-only-untranscribed"})
            definition["copies"] += 1
            for key, val in (("source_groups", group), ("source_labels", value("name"))):
                if val not in definition[key]:
                    definition[key].append(val)
    refs = Counter(e.text for e in room.findall(".//data[@type='image']") if e.text)
    for node in room.iter():
        for key in ("imageIdentifier", "backgroundImageIdentifier"):
            if node.get(key) and node.get(key) != "null":
                refs[node.get(key)] += 1
    missing = sorted(r for r in refs if not (folder / f"{r}.jpg").exists())
    summary = {
        "edition": "third", "source_format": "Udonarium room snapshot",
        "xml_files": len(list(folder.glob("*.xml"))),
        "jpeg_files": len(list(folder.glob("*.jpg"))),
        "card_instances": len(cards), "unique_card_fronts": len(definitions),
        "groups": [{"id": group, "instances": len(entries),
                    "unique_fronts": len({e.findtext(".//data[@name='front']") for e in entries})}
                   for group, entries in groups],
        "xml_character_objects": len(room.findall("character")),
        "table_masks": len(list(room.iter("table-mask"))),
        "dice_symbols": len(room.findall("dice-symbol")),
        "unbundled_image_identifiers": missing,
        "note": "XML character objects include counters and Udonarium templates; game characters are cards. Counts describe this saved room, not a verified official deck list."
    }
    catalog = RESOURCE / "catalog"
    write_json(catalog / "room-summary.json", summary)
    write_json(catalog / "card-instances.json", cards)
    write_json(catalog / "card-fronts.json", list(definitions.values()))
    preview = ['<!doctype html><html lang="ja"><meta charset="utf-8">',
               '<meta name="viewport" content="width=device-width, initial-scale=1">',
               '<title>魔導戦記 3rd Ed. 素材一覧</title>',
               '<style>body{font-family:system-ui;margin:24px;background:#f4f1eb;color:#232323} main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px} figure{margin:0;padding:12px;background:white} img{width:100%;height:360px;object-fit:contain} figcaption{overflow-wrap:anywhere;font-size:13px}</style>',
               '<h1>3rd Ed. カード表面一覧</h1><p>画像単位の索引。名称・効果は未転記です。複製枚数は保存されたルーム内の値です。</p><main>']
    for i, d in enumerate(definitions.values(), 1):
        src = "../extracted/udonarium-3rd/" + d["front_image"]
        label = f'{i:03} / {", ".join(d["source_groups"])} / {d["copies"]}枚 / {d["asset_id"][:12]}'
        preview.append(f'<figure><a href="{html.escape(src)}"><img loading="lazy" src="{html.escape(src)}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>')
    preview.append('</main></html>')
    (catalog / "preview.html").write_text("\n".join(preview), encoding="utf-8")
    return summary


def verify():
    manifest = json.loads((RESOURCE / "manifest.json").read_text())
    for expected in manifest["originals"] + manifest["archive_entries"]:
        actual = record(ROOT / expected["path"])
        if any(actual[k] != expected[k] for k in ("bytes", "sha256")):
            raise ValueError(f"Integrity mismatch: {expected['path']}")
    actual_files = {p.relative_to(ROOT).as_posix() for p in (RESOURCE / "extracted" / "udonarium-3rd").rglob("*") if p.is_file()}
    if actual_files != {e["path"] for e in manifest["archive_entries"]}:
        raise ValueError("Extracted file set differs from archive manifest")
    cards = json.loads((RESOURCE / "catalog" / "card-instances.json").read_text())
    fronts = json.loads((RESOURCE / "catalog" / "card-fronts.json").read_text())
    if len(cards) != sum(d["copies"] for d in fronts):
        raise ValueError("Card copy counts differ")
    for card in cards:
        for key in ("front_image", "back_image"):
            if not (RESOURCE / "extracted" / "udonarium-3rd" / card[key]).is_file():
                raise ValueError(f"Missing image: {card[key]}")
    print(f"Verified {len(manifest['originals'])} originals, {len(actual_files)} extracted files, {len(cards)} card instances, {len(fronts)} unique fronts.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--verify", action="store_true", help="Read-only integrity verification")
    args = parser.parse_args()
    if args.verify:
        verify()
        return
    for tool in ("pdftotext", "pdfinfo"):
        if not shutil.which(tool):
            raise SystemExit(f"Missing {tool}; install Poppler first.")
    candidates = {unicodedata.normalize("NFC", p.name): p for p in args.source_dir.iterdir()}
    for name in (*PDFS, ZIP_NAME):
        if name not in candidates:
            raise SystemExit(f"Missing input: {name}")
    originals, pdf_metadata = [], []
    for name in PDFS:
        target = RESOURCE / "original" / "second-edition" / name
        originals.append({"edition": "second", **copy_original(candidates[name], target)})
        text_dir = RESOURCE / "text" / "second-edition"
        text_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(["pdftotext", "-layout", str(target), str(text_dir / f"{target.stem}.txt")], check=True)
        info = subprocess.run(["pdfinfo", str(target)], check=True, capture_output=True, text=True).stdout
        pages = int(next(line.split(":", 1)[1] for line in info.splitlines() if line.startswith("Pages:")))
        pdf_metadata.append({"file": name, "edition": "second", "pages": pages,
                             "text_quality": "garbled-font-mapping-use-rendered-pages" if name in ("CardAll.pdf", "Character(A4).pdf") else "readable-layout-columns-need-visual-review"})
    target = RESOURCE / "original" / "third-edition" / "madou-senki-3rd-room.zip"
    originals.append({"edition": "third", **copy_original(candidates[ZIP_NAME], target)})
    out = RESOURCE / "extracted" / "udonarium-3rd"
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target) as archive:
        names = set()
        for info in archive.infolist():
            dest = (out / info.filename).resolve()
            if not dest.is_relative_to(out.resolve()) or stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError(f"Unsafe archive entry: {info.filename}")
            if info.filename in names:
                raise ValueError(f"Duplicate archive entry: {info.filename}")
            names.add(info.filename)
            if dest.is_file() and dest.read_bytes() != archive.read(info):
                raise ValueError(f"Extracted file already modified: {dest}")
        archive.extractall(out)
        entries = [record(out / info.filename) for info in archive.infolist() if not info.is_dir()]
    manifest_path = RESOURCE / "manifest.json"
    imported_on = date.today().isoformat()
    if manifest_path.exists():
        imported_on = json.loads(manifest_path.read_text()).get("imported_on", imported_on)
    write_json(manifest_path, {"source_url": SOURCE_URL, "imported_on": imported_on,
                              "originals": originals, "archive_entries": entries})
    write_json(RESOURCE / "catalog" / "pdf-metadata.json", pdf_metadata)
    print(json.dumps(index_room(), ensure_ascii=False, indent=2))
    verify()


if __name__ == "__main__":
    main()
