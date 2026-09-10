"""The compact gate inherits actual coverage validation, including missing clauses."""
import json
import unittest
from .test_validate_runtime_coverage import CoverageValidation
from .generate_catalog_readiness import readiness

class CatalogReadiness(unittest.TestCase):
    setUp = CoverageValidation.setUp
    write = CoverageValidation.write

    def generate(self):
        for name, value in [('runtime-obligations', self.manifest), ('runtime-coverage', self.ledger)]:
            (self.root / f'data/second-edition/{name}.json').write_text(json.dumps(value))
        return readiness(self.root, fixture=True)

    def test_pending_coverage_is_valid_but_not_ready(self):
        self.assertFalse(self.generate()['ready'])

    def test_missing_clause_cannot_generate_readiness(self):
        self.ledger['rows'].pop()
        with self.assertRaisesRegex(ValueError, 'missing obligation'):
            self.generate()

    def test_relabeling_rows_accepted_without_receipts_cannot_enable_start(self):
        for row in self.ledger['rows']:
            row['status'] = 'accepted'
            row['remaining'] = []
        with self.assertRaisesRegex(ValueError, 'invalid coverage'):
            self.generate()
