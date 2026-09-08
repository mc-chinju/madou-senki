"""Checks asset geometry and exact catalog selection independently of OCR."""
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw


class AssetTests(unittest.TestCase):
    def manifest_fixture(self, root):
        module = self.load_module()
        data = root / 'data/second-edition'
        data.mkdir(parents=True)
        originals = root / 'resources/original/second-edition'
        originals.mkdir(parents=True)
        output = root / 'output'
        output.mkdir()
        for name in ('CardAll.pdf', 'Character(A4).pdf'):
            (originals / name).write_bytes(b'fixture PDF source identity')
        cards = [
            {'id': 'a2-p01-r1c1', 'page': 1, 'row': 1, 'column': 1, 'visually_verified': True},
            {'id': 'c2-p01-r1c1', 'page': 1, 'row': 1, 'column': 1, 'visually_verified': True},
        ]
        for name, rows in [('actions-01-06.json', [cards[0]]), ('actions-07-17.json', []),
                           ('actions-18-25.json', []), ('characters.json', [cards[1]])]:
            (data / name).write_text(json.dumps({'cards': rows}))
        manifest = {'edition': 'second', 'dpi': 240, 'format': 'webp-lossless',
                    'sources': {}, 'cards': {}, 'toolchain': {'pillow': 'fixture', 'poppler': 'fixture', 'webp': 'fixture'}}
        for source in originals.iterdir():
            manifest['sources'][str(source.relative_to(root))] = hashlib.sha256(source.read_bytes()).hexdigest()
        for card in cards:
            cid = card['id']
            file = output / f'{cid}.webp'
            Image.new('RGB', (16, 24), 'red').save(file, 'WEBP', lossless=True)
            manifest['cards'][cid] = {
                'url': f'/cards/second/{cid}.webp', 'width': 16, 'height': 24,
                'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'page': 1, 'row': 1, 'column': 1,
                'source': f'resources/original/second-edition/{"CardAll.pdf" if cid.startswith("a2") else "Character(A4).pdf"}',
            }
        return module, data, output, manifest

    def test_verifies_assets_against_sources_and_rejects_stale_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            module, data, output, manifest = self.manifest_fixture(root)
            (output / 'manifest.json').write_text(json.dumps(manifest))
            with patch.object(module, 'ROOT', root), patch.object(module, 'DATA', data):
                self.assertEqual(module.verify(output), 2)
                (output / 'unexpected-3rd.webp').write_bytes(b'stale asset')
                with self.assertRaises(ValueError):
                    module.verify(output)

    def test_rejects_missing_provenance_and_wrong_physical_mapping(self):
        for kind in ('sources', 'source', 'url', 'page', 'edition'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                module, data, output, manifest = self.manifest_fixture(root)
                if kind == 'sources':
                    manifest['sources'] = {}
                elif kind == 'edition':
                    manifest['edition'] = 'third'
                else:
                    manifest['cards']['a2-p01-r1c1'][kind] = 25 if kind == 'page' else 'wrong'
                (output / 'manifest.json').write_text(json.dumps(manifest))
                with patch.object(module, 'ROOT', root), patch.object(module, 'DATA', data):
                    with self.assertRaises(ValueError):
                        module.verify(output)

    def test_rejects_changed_or_missing_image_and_changed_pdf(self):
        for kind in ('changed-image', 'missing-image', 'changed-source'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                module, data, output, manifest = self.manifest_fixture(root)
                (output / 'manifest.json').write_text(json.dumps(manifest))
                if kind == 'changed-source':
                    (root / 'resources/original/second-edition/CardAll.pdf').write_bytes(b'changed')
                elif kind == 'missing-image':
                    (output / 'a2-p01-r1c1.webp').unlink()
                else:
                    (output / 'a2-p01-r1c1.webp').write_bytes(b'changed')
                with patch.object(module, 'ROOT', root), patch.object(module, 'DATA', data):
                    with self.assertRaises(ValueError):
                        module.verify(output)

    def test_prepare_encodes_rendered_pages_and_complete_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            module, data, output, _ = self.manifest_fixture(root)

            def render_page(args, **_kwargs):
                if '-v' in args:
                    return subprocess.CompletedProcess(args, 0, stdout='', stderr='pdftoppm fixture\n')
                page = Image.new('RGB', (600, 900), 'white')
                border = (10, 10, 190, 290) if args[-2].endswith('CardAll.pdf') else (10, 10, 290, 440)
                ImageDraw.Draw(page).rectangle(border, outline='black', width=2)
                page.save(Path(args[-1]).with_suffix('.png'))
                return subprocess.CompletedProcess(args, 0, stdout=b'', stderr=b'')

            # Only the external renderer is replaced; real cropping, encoding,
            # source/output hashes, file writes and manifest verification execute.
            with patch.object(module, 'ROOT', root), patch.object(module, 'DATA', data), \
                 patch.object(module.shutil, 'which', return_value='/fixture/pdftoppm'), \
                 patch.object(module.subprocess, 'run', side_effect=render_page):
                self.assertEqual(module.prepare(output, 240), 2)
                manifest = json.loads((output / 'manifest.json').read_text())
                self.assertEqual(len(manifest['sources']), 2)
                self.assertEqual(manifest['cards']['a2-p01-r1c1']['width'], 181)
                self.assertEqual(manifest['cards']['c2-p01-r1c1']['width'], 281)
                self.assertEqual(manifest['toolchain']['poppler'], 'pdftoppm fixture')
                with Image.open(output / 'a2-p01-r1c1.webp') as image:
                    self.assertEqual(image.convert('RGB').getpixel((0, 0)), (0, 0, 0))
                (output / 'obsolete.webp').write_bytes(b'stale')
                with self.assertRaises(ValueError):
                    module.prepare(output, 240)

    def load_module(self):
        path = Path(__file__).with_name('prepare_assets.py')
        self.assertTrue(path.exists(), 'Asset preparation command is not implemented')
        spec = importlib.util.spec_from_file_location('prepare_assets', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_selects_all_second_edition_cards_without_blank_cells(self):
        module = self.load_module()
        cards = module.load_cards()
        self.assertEqual(len(cards), 246)
        self.assertEqual(len({c['id'] for c in cards}), 246)
        self.assertNotIn('a2-p25-r2c2', {c['id'] for c in cards})
        self.assertNotIn('c2-p07-r2c1', {c['id'] for c in cards})

    def test_crops_selected_cell_and_preserves_printed_border(self):
        module = self.load_module()
        page = Image.new('RGB', (300, 450), 'white')
        draw = ImageDraw.Draw(page)
        draw.rectangle((110, 170, 189, 279), outline='black', width=2)
        draw.rectangle((125, 190, 175, 250), fill='red')
        draw.rectangle((220, 170, 280, 280), fill='blue')
        card = module.crop_card(page, row=2, column=2, grid=3)
        self.assertEqual(card.size, (80, 110))
        self.assertEqual(card.getpixel((0, 0)), (0, 0, 0))
        self.assertEqual(card.getpixel((40, 50)), (255, 0, 0))
        self.assertNotIn((0, 0, 255), card.get_flattened_data())

    def test_rejects_invalid_cells_and_empty_source(self):
        module = self.load_module()
        white = Image.new('RGB', (300, 450), 'white')
        with self.assertRaises(ValueError):
            module.crop_card(white, row=0, column=1, grid=3)
        with self.assertRaises(ValueError):
            module.crop_card(white, row=1, column=1, grid=3)


if __name__ == '__main__':
    unittest.main()
