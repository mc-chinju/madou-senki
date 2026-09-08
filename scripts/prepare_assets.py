#!/usr/bin/env python3
"""Render the checked 2nd PDF cards; never substitute 3rd-edition images.

Requires Poppler (pdftoppm) and Pillow. Output is local and gitignored.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image, ImageChops, features, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/second-edition'
DEFAULT_OUTPUT = ROOT / 'apps/web/public/cards/second'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_cards():
    cards = []
    for filename in ('actions-01-06.json', 'actions-07-17.json',
                     'actions-18-25.json', 'characters.json'):
        is_character = filename == 'characters.json'
        source = 'Character(A4).pdf' if is_character else 'CardAll.pdf'
        for card in json.loads((DATA / filename).read_text())['cards']:
            if card.get('visually_verified') is not True:
                raise ValueError(f'Unverified card: {card["id"]}')
            cards.append({**card, 'pdf': source, 'grid': 2 if is_character else 3})
    return cards


def crop_card(page, *, row, column, grid):
    if not 1 <= row <= grid or not 1 <= column <= grid:
        raise ValueError('Card cell outside the printed grid')
    width, height = page.size
    cell = page.convert('RGB').crop((round((column - 1) * width / grid),
                                    round((row - 1) * height / grid),
                                    round(column * width / grid), round(row * height / grid)))
    # The printed rectangular border is the outermost ink in each cell.
    ink = ImageChops.difference(cell, Image.new('RGB', cell.size, 'white'))
    bounds = ink.convert('L').point(lambda value: 255 if value > 15 else 0).getbbox()
    if bounds is None:
        raise ValueError('No card ink in expected cell')
    return cell.crop(bounds)


def verify(output):
    manifest = json.loads((output / 'manifest.json').read_text())
    cards = load_cards()
    expected = {c['id'] for c in cards}
    if manifest.get('edition') != 'second' or manifest.get('format') != 'webp-lossless':
        raise ValueError('Wrong asset edition or encoding')
    if not isinstance(manifest.get('dpi'), int) or not 100 <= manifest['dpi'] <= 600:
        raise ValueError('Invalid rendering resolution')
    if set(manifest['cards']) != expected:
        raise ValueError('Asset manifest does not match the 246-card catalog')
    if {p.name for p in output.glob('*.webp')} != {f'{cid}.webp' for cid in expected}:
        raise ValueError('Missing or unexpected card images in output directory')
    expected_sources = {f'resources/original/second-edition/{c["pdf"]}' for c in cards}
    if set(manifest.get('sources', {})) != expected_sources:
        raise ValueError('Missing or unexpected PDF provenance')
    for path, digest in manifest['sources'].items():
        if sha256(ROOT / path) != digest:
            raise ValueError(f'Source changed: {path}')
    by_id = {c['id']: c for c in cards}
    for cid, item in manifest['cards'].items():
        card = by_id[cid]
        expected_metadata = {
            'url': f'/cards/second/{cid}.webp',
            'source': f'resources/original/second-edition/{card["pdf"]}',
            'page': card['page'], 'row': card['row'], 'column': card['column'],
        }
        if any(item.get(key) != value for key, value in expected_metadata.items()):
            raise ValueError(f'Asset physical source mapping changed: {cid}')
        path = output / f'{cid}.webp'
        if sha256(path) != item['sha256']:
            raise ValueError(f'Asset missing or changed: {cid}')
        with Image.open(path) as image:
            if image.format != 'WEBP' or image.size != (item['width'], item['height']):
                raise ValueError(f'Asset dimensions changed: {cid}')
    return len(expected)


def prepare(output, dpi):
    if not shutil.which('pdftoppm'):
        raise SystemExit('Install Poppler to provide pdftoppm')
    cards = load_cards()
    expected_names = {f'{c["id"]}.webp' for c in cards}
    if output.exists() and {p.name for p in output.glob('*.webp')} - expected_names:
        raise ValueError('Unexpected images in output directory; use a clean output directory')
    source_root = ROOT / 'resources/original/second-edition'
    sources = {str((source_root / c['pdf']).relative_to(ROOT)) for c in cards}
    poppler = subprocess.run(['pdftoppm', '-v'], check=True, capture_output=True, text=True)
    manifest = {'edition': 'second', 'dpi': dpi, 'format': 'webp-lossless',
                'toolchain': {'pillow': pillow_version, 'webp': features.version('webp'),
                              'poppler': (poppler.stderr or poppler.stdout).splitlines()[0]},
                'sources': {p: sha256(ROOT / p) for p in sorted(sources)}, 'cards': {}}
    output.mkdir(parents=True, exist_ok=True)
    # Render one page at a time so peak memory and temp storage stay bounded.
    groups = {}
    for card in cards:
        groups.setdefault((card['pdf'], card['page']), []).append(card)
    with tempfile.TemporaryDirectory(prefix='madou-assets-') as temp:
        prefix = Path(temp) / 'page'
        for (pdf, number), page_cards in groups.items():
            subprocess.run(['pdftoppm', '-f', str(number), '-l', str(number),
                            '-singlefile', '-scale-to', str(round(dpi * 11.7)), '-png',
                            str(source_root / pdf), str(prefix)], check=True, capture_output=True)
            with Image.open(prefix.with_suffix('.png')) as page:
                for card in page_cards:
                    crop = crop_card(page, row=card['row'], column=card['column'], grid=card['grid'])
                    path = output / f'{card["id"]}.webp'
                    crop.save(path, 'WEBP', lossless=True, method=4)
                    manifest['cards'][card['id']] = {
                        'url': f'/cards/second/{card["id"]}.webp',
                        'width': crop.width, 'height': crop.height,
                        'sha256': sha256(path), 'page': number,
                        'row': card['row'], 'column': card['column'],
                        'source': str((source_root / pdf).relative_to(ROOT)),
                    }
    staged = output / 'manifest.json.tmp'
    staged.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    staged.replace(output / 'manifest.json')
    return verify(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--dpi', type=int, default=240)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    if not 100 <= args.dpi <= 600:
        parser.error('--dpi must be between 100 and 600')
    count = verify(args.output) if args.verify else prepare(args.output, args.dpi)
    print(f'Verified {count} 2nd-edition card images in {args.output}')
