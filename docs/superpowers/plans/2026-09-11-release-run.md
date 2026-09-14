# 公開走り切り Implementation Plan

> **再開（2026-09-12）:** ユーザーの明示的なgoal指示により本セッションでM4まで再開。現在の登録済みworktreeは `/Users/chinju/git/madou-senki-worktree-release-run`、ブランチは `worktree-release-run`。旧スレッドのgoalは変更しない。停止時点の記録は [release-run-handoff-2026-09-12.md](../../operations/release-run-handoff-2026-09-12.md) を維持する。B7残4条項から継続する。


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. サブエージェント・独立レビュー・自己レビューはユーザー指定により禁止。受け入れは [試験受け入れ方針](../../operations/acceptance-policy.md) `acceptance-policy/test-only-v1`。

**Goal:** 台帳のsemantic条項5,259件を試験受け入れで全件accepted/notApplicableにし、正式STARTからの一戦を自動試験で通し、Cloudflareのstaging→productionへ招待制で公開する。対人での操作評価は公開後に行う。

**Architecture:** 既存の純粋TypeScriptエンジン、参加者別投影、1卓1SQLite Durable Object、WebSocket、D1、Workers Static Assetsを変更しない。追加するのは (1) 台帳を機械的にverified→acceptedへ進める受け入れパイプライン（run記録・束縛適用・昇格）、(2) 未束縛条項を網羅するデータ駆動試験、(3) 正式STARTからの一戦をWS経由で完走する合法手ボット、(4) 配備・負荷・復旧の実測手順。

**Tech Stack:** TypeScript、React、Vite、Cloudflare Workers / Durable Objects / D1 / Static Assets、Vitest 4、Playwright、pnpm 10、Python 3（台帳スクリプト）。

**Spec:** [判断結果（承認済み）](../../operations/decision-result-2026-09-10.md)、[試験受け入れ方針](../../operations/acceptance-policy.md)、[完遂計画](2026-09-08-completion-plan.md)、[R4計画](2026-09-08-r4-suppression-reclaim.md)、[R5計画](2026-09-08-r5-combat-cards.md)、[R6計画](2026-09-08-r6-scenario-acceptance.md)、[配備手順](../../operations/deploy.md)。

## Global Constraints

- 初回は2nd。行動220枚・人物26枚・固有能力110件。3rdを混在させない。
- 暫定裁定 `second-online-v0.1-provisional` を基準とし、原典と補完裁定を区別する。原作ルールの新設・変更は行わない。
- 試合の正本は1卓1Durable Objectの永続ストレージ。秘密情報はサーバーで参加者別に投影してから送信する。
- 切断は自動パス・自動敗北にしない。同一コマンドの再送で二重処理しない。
- 全条項の受け入れが揃うまで正式デッキ（`readiness.ready=true`）を有効にしない。pendingの一括昇格・正式STARTのgate迂回はしない。
- 現在のソースと検証記録の対応を確認する。過去の成功件数を現在の合格に読み替えない。run証跡は候補hash（`runtime-candidate-v3`）に束縛する。
- integrity 6,094行・aggregate 825行は `pending`・証跡なしのまま維持する（validatorが要求）。受け入れ対象はsemantic 5,259行。
- `notApplicable` は `reason` / `basis` / `edition` / `decidedOn` / `decidedBy: user` / `retainedTests` を持ち、basisが現在のカードデータまたは採用裁定と一致する場合だけ受け入れ扱い。実カード経路の成功として記録しない。
- ブラウザ試験中は実行対象のソース・fixtureを編集しない。
- 作業は worktree `release-run`（ブランチ `worktree-release-run`）で行い、タスクごとにコミットする。main への merge はユーザーが行う。
- 秘密値（Cloudflareトークン、Cookie、アカウントID）を文書・ソース・チャットに書かない。

## ユーザー委任で決めた事項

| 項目 | 決定 | 根拠 |
|---|---|---|
| D5 対人評価 | **公開後に実施**。R3残2項目とM3の対人通し対戦を新設のM5（公開後）へ移す。完了条件は変更せず時期だけ後ろへ | ユーザー指示「実際にプレイして確認は全て後に回す」 |
| D6 公開範囲 | **招待制**（既存の招待リンクのみ。public卓の一覧は残るがログイン必須） | 友人との対戦が目的。素材許諾の露出を最小にする |
| D6 アカウント | staging / production を同一Cloudflareアカウントの別Worker・別D1で運用 | 版分離方針（deploy.md）に従う |
| D6 素材 | 原作画像・効果文は招待した参加者への配信に限定する前提で進める。許諾の確認はユーザーの責任範囲で、計画はクレジット表示（実装済み）を維持する | 計画側で判断できない |
| ユーザー操作 | 唯一の必須操作は Task D1 の `wrangler login`。それ以外はエージェントが実行する | 認証はチャット経由で扱えない |

## 到達点

| 到達点 | 完了条件 |
|---|---|
| M2': 受け入れ済み候補 | semantic全行がaccepted/notApplicable、strict validator成功、`readiness.ready=true`、`pnpm verify:catalog` 成功 |
| M3': 自動一戦 | 通常APIの正式STARTで4/6/8/10席の一戦を勝敗まで完走。全員切断・未ACK再送・終了後再読込・合意終了を自動試験で確認 |
| M4: 公開版 | staging実測（休止復帰・ACK喪失・D1失敗・再配備中維持・10卓×10人負荷）後、同一候補をproductionへ配備し記録 |
| M5: 対人検証（公開後） | 友人との対戦で R3 の理解・判断時間・操作数を記録。playtest-results.md に残す |

## 現状（2026-09-11 着手時）

| 区分 | 件数 | 必要な作業 |
|---|---|---|
| semantic implemented・concrete試験あり | 3,550 | run束縛→verified→accepted（機械） |
| semantic implemented・related試験のみ | 255 | concrete試験へ再束縛 |
| semantic implemented・試験なし | 24 | 試験追加 |
| semantic pending owned-reclaim（所有技600・所有従者184） | 784 | データ駆動試験1本＋パラメータ束縛 |
| semantic pending scenario-source（S01〜S32） | 210 | 既存シナリオ試験へ束縛 |
| semantic pending character-semantic（目的・敗北・陣営・制限・継承・C16ほか） | 約260 | データ駆動試験1本＋束縛 |
| semantic pending その他（ability-effect / shared-semantic / D4対象） | 約170 | 個別試験または notApplicable |
| aggregate / integrity | 6,919 | 変更なし（子の受け入れで自動成立） |

件数は `python3 scripts/ledger_report.py`（Task A3で作る）で再計測し、着手ごとに更新する。

---

## Phase A: 受け入れパイプライン

### Task A1: D1〜D4 の基準コミット

- [x] worktree `release-run` を 3ce2e62 から作成し、D1〜D4 の未コミット変更を持ち込んでコミット（4a4ddfb）。validator試験122件・台帳valid・readiness valid/ready=false・型検査成功を確認済み。

### Task A2: 対人工程の公開後移動と計画文面の同期

**Files:**
- Modify: `docs/superpowers/plans/2026-09-08-completion-plan.md`（R3、R7末尾、R8、「完成までの区切り」表）
- Modify: `docs/operations/playtest-guide.md`
- Modify: `docs/checkpoints/2026-09-08-implementation.md`
- Modify: `docs/operations/decision-result-2026-09-10.md`（D5/D6の承認欄）

- [x] **Step 1: 完成計画の区切り表に M5 を追加し、M3 の「対人の通し対戦」を M5 へ移す**

区切り表の M3 行を次に置換する:

```markdown
| M3: 一戦を遊び切れる候補 | 4/6/8/10セッション、終了・復帰・障害の自動試験を確認 | Task6 / 8 |
| M4: 公開版 | Cloudflare上の復旧・更新・負荷・素材条件を確認して同じ候補を招待制で公開 | Task8 |
| M5: 対人検証（公開後） | 招待した参加者との通し対戦で R3 の理解・判断時間・操作数・例外裁定を記録 | Task6 |
```

- [x] **Step 2: R3 の未完2項目の直前に次の段落を挿入し、R7末尾の「対人の8人通し対戦を複数回行い…M3」を「自動試験の合格で M3。対人確認は M5」に書き換える**

```markdown
2026-09-11: ユーザー指示により、人による操作評価は production 公開後の M5 で実施する。以下2項目の完了条件は変更しない。自動試験で代替したとは記録しない。
```

- [x] **Step 3: playtest-guide.md に「公開後の記録手順」節を追加する**

```markdown
## 公開後の対人記録（M5）

1. 招待リンクで 4〜8 人が参加し、通常の準備完了→対戦を始めるで開始する。テスト用fixtureは使わない。
2. 各割り込み窓で記録者が次を書き留める: 回答者が誰か分かったか、パスで何を見送るか分かったか、処理がどこへ戻るか分かったか、判断にかかった秒数、操作数。
3. 通信待ちが 3 秒を超えた回数と、再読込・再接続の回数を記録する。
4. 例外裁定が必要になった場面はカード名・状況・採った処理を残す。
5. 結果は `playtest-results.md` に日付・人数・候補hash付きで追記する。
```

- [x] **Step 4: checkpoint の「次」を本計画の Task A3 に更新し、decision-result の D5/D6 を「2026-09-11 ユーザー委任により本計画で決定」に更新する**

- [x] **Step 5: リンク確認とコミット**

Run: `grep -n "M5" docs/superpowers/plans/2026-09-08-completion-plan.md docs/operations/playtest-guide.md`
Expected: 両ファイルに M5 が現れる

```bash
git add docs && git commit -m "docs: 対人評価を公開後のM5へ移し、招待制公開の前提を記録する"
```

### Task A3: 台帳集計スクリプト `ledger_report.py`

**Files:**
- Create: `scripts/ledger_report.py`
- Test: `scripts/test_ledger_report.py`

**Interfaces:**
- Produces: `report(root: Path) -> dict` — `{'semantic': {'accepted': n, 'notApplicable': n, 'verified': n, 'implementedConcrete': n, 'implementedRelatedOnly': n, 'implementedNoTests': n, 'pending': {kind: n}}, 'aggregateBlocked': n}`。CLI は JSON を stdout に出す。

- [x] **Step 1: 失敗するテストを書く**

```python
# scripts/test_ledger_report.py
import json, tempfile, unittest
from pathlib import Path
from ledger_report import report

class LedgerReportTest(unittest.TestCase):
    def test_counts_semantic_rows_by_evidence_strength(self):
        root = Path(tempfile.mkdtemp())
        (root / 'data/second-edition').mkdir(parents=True)
        ledger = {'rows': [
            {'entryId': 'a', 'clauseKey': 'x', 'coverageClass': 'semantic', 'kind': 'ability-effect', 'status': 'implemented', 'tests': ['t:1']},
            {'entryId': 'a', 'clauseKey': 'y', 'coverageClass': 'semantic', 'kind': 'ability-effect', 'status': 'implemented', 'tests': ['t:2']},
            {'entryId': 'a', 'clauseKey': 'z', 'coverageClass': 'semantic', 'kind': 'owned-reclaim', 'status': 'pending', 'tests': []},
            {'entryId': 'a', 'clauseKey': 'w', 'coverageClass': 'integrity', 'kind': 'source-field', 'status': 'pending', 'tests': []},
        ], 'testCases': {'t:1': {'kind': 'canonical-transition'}, 't:2': {'kind': 'related'}}}
        (root / 'data/second-edition/runtime-coverage.json').write_text(json.dumps(ledger))
        result = report(root)
        self.assertEqual(result['semantic']['implementedConcrete'], 1)
        self.assertEqual(result['semantic']['implementedRelatedOnly'], 1)
        self.assertEqual(result['semantic']['pending'], {'owned-reclaim': 1})

if __name__ == '__main__':
    unittest.main()
```

- [x] **Step 2: 失敗を確認**

Run: `python3 -m unittest scripts.test_ledger_report`
Expected: `ModuleNotFoundError: No module named 'ledger_report'`

- [x] **Step 3: 実装**

```python
#!/usr/bin/env python3
"""Count semantic ledger rows by evidence strength. Read-only."""
import collections, json, sys
from pathlib import Path

CONCRETE = {'canonical-transition', 'structural-resolver', 'projection', 'worker-persistence', 'browser'}

def report(root):
    ledger = json.loads((Path(root) / 'data/second-edition/runtime-coverage.json').read_text())
    cases = ledger.get('testCases', {})
    semantic = collections.Counter()
    pending = collections.Counter()
    for row in ledger['rows']:
        if row.get('coverageClass') != 'semantic':
            continue
        status = row['status']
        if status == 'pending':
            pending[row.get('kind', '')] += 1
            continue
        if status != 'implemented':
            semantic[status] += 1
            continue
        kinds = {cases[t]['kind'] for t in row.get('tests', []) if t in cases}
        if not row.get('tests'):
            semantic['implementedNoTests'] += 1
        elif kinds & CONCRETE:
            semantic['implementedConcrete'] += 1
        else:
            semantic['implementedRelatedOnly'] += 1
    result = dict(semantic)
    result['pending'] = dict(pending)
    return {'semantic': result}

if __name__ == '__main__':
    print(json.dumps(report(sys.argv[1] if len(sys.argv) > 1 else '.'), ensure_ascii=False, indent=1))
```

- [x] **Step 4: 成功を確認し、実台帳で実行**

Run: `python3 -m unittest scripts.test_ledger_report && python3 scripts/ledger_report.py`
Expected: OK、実台帳の集計 JSON

- [x] **Step 5: コミット**

```bash
git add scripts/ledger_report.py scripts/test_ledger_report.py && git commit -m "scripts: 台帳の証拠強度別集計を追加する"
```

### Task A4: run記録スクリプト `record_runtime_run.py`

**Files:**
- Create: `scripts/record_runtime_run.py`
- Test: `scripts/test_record_runtime_run.py`
- Read: `scripts/validate_runtime_coverage.py`（`candidate_files`, `digest`, `FREEZE_POLICY`, `canonical_digest`）

**Interfaces:**
- Consumes: Vitest の `--reporter=json --outputFile=<path>`（Jest互換: `testResults[].name`, `assertionResults[].ancestorTitles/title/status`）、Playwright の `--reporter=json`（`suites[].file`, 入れ子 `suites[].title`, `specs[].title`, `specs[].tests[].results[].status`）。
- Produces: `runtime-coverage-run/v2` JSON。`cases[]` の `test` は台帳 `testCases` の参照オブジェクトと同一（`path, suite, title, declarationSha256, kind, parameters, bindingNote`）。`format_title(template, parameters)` は Vitest の `%s %i %d %o %j %#` と `$name` を展開する。

- [x] **Step 1: 失敗するテストを書く**

```python
# scripts/test_record_runtime_run.py
import unittest
from record_runtime_run import format_title, match_cases

class FormatTitleTest(unittest.TestCase):
    def test_positional_and_named_parameters(self):
        self.assertEqual(format_title('%s waives chant with %s', ['シェリム', '烈火', 'ab03']), 'シェリム waives chant with 烈火')
        self.assertEqual(format_title('$name uses $card', {'name': 'A', 'card': 'B'}), 'A uses B')
        self.assertEqual(format_title('plain title', None), 'plain title')

class MatchCasesTest(unittest.TestCase):
    def test_binds_reported_result_to_ledger_reference(self):
        refs = {'t:1': {'path': 'packages/engine/test/x.test.ts', 'suite': ['s'], 'title': '%s does it', 'parameters': ['a'], 'kind': 'canonical-transition', 'declarationSha256': 'd', 'bindingNote': None}}
        reported = [{'path': 'packages/engine/test/x.test.ts', 'ancestors': ['s'], 'title': 'a does it', 'status': 'passed'}]
        cases = match_cases(refs, reported)
        self.assertEqual(cases[0]['result'], 'passed')
        self.assertEqual(cases[0]['test'], refs['t:1'])

if __name__ == '__main__':
    unittest.main()
```

- [x] **Step 2: 失敗を確認**

Run: `python3 -m unittest scripts.test_record_runtime_run`
Expected: `ModuleNotFoundError`

- [x] **Step 3: 実装**

```python
#!/usr/bin/env python3
"""Record a runtime-coverage-run/v2 receipt from Vitest/Playwright JSON reports.

Reads report files already produced by the test runners, freezes the candidate
file set, and emits cases whose `test` objects equal the ledger references.
Never runs tests itself; the caller records the exact commands.
"""
import argparse, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from validate_runtime_coverage import FREEZE_POLICY, candidate_files, digest

def format_title(template, parameters):
    if parameters is None:
        return template
    if isinstance(parameters, dict):
        return re.sub(r'\$([A-Za-z_][A-Za-z0-9_.]*)', lambda m: str(_lookup(parameters, m.group(1))), template)
    values = list(parameters) if isinstance(parameters, list) else [parameters]
    index = [0]
    def repl(match):
        code = match.group(1)
        if code == '%':
            return '%'
        if code == '#':
            return str(index[0])
        if index[0] >= len(values):
            return match.group(0)
        value = values[index[0]]; index[0] += 1
        if code in 'oj':
            return json.dumps(value, ensure_ascii=False)
        if code in 'id':
            return str(int(value)) if isinstance(value, (int, float)) else 'NaN'
        return str(value)
    return re.sub(r'%([sidoj#%])', repl, template)

def _lookup(obj, dotted):
    for part in dotted.split('.'):
        obj = obj[part] if isinstance(obj, dict) else getattr(obj, part)
    return obj

def vitest_reported(report_path, root):
    data = json.loads(Path(report_path).read_text())
    for file_result in data.get('testResults', []):
        path = str(Path(file_result['name']).resolve().relative_to(Path(root).resolve()))
        for assertion in file_result.get('assertionResults', []):
            yield {'path': path, 'ancestors': assertion.get('ancestorTitles', []), 'title': assertion['title'], 'status': assertion['status']}

def playwright_reported(report_path, root):
    data = json.loads(Path(report_path).read_text())
    def walk(suite, ancestors, file):
        file = suite.get('file', file)
        for spec in suite.get('specs', []):
            status = 'passed' if all(r.get('status') == 'passed' for t in spec.get('tests', []) for r in t.get('results', [])) and spec.get('tests') else 'failed'
            yield {'path': file, 'ancestors': ancestors, 'title': spec['title'], 'status': status}
        for child in suite.get('suites', []):
            yield from walk(child, ancestors + ([child['title']] if child.get('title') and child.get('title') != child.get('file') else []), file)
    for suite in data.get('suites', []):
        yield from walk(suite, [], suite.get('file'))

def match_cases(refs, reported):
    by_key = {}
    for item in reported:
        by_key[(item['path'], tuple(item['ancestors']), item['title'])] = item['status']
    cases = []
    for ref in refs.values():
        expected = format_title(ref['title'], ref.get('parameters'))
        status = by_key.get((ref['path'], tuple(ref.get('suite', [])), expected))
        if status is None:
            continue
        cases.append({'test': ref, 'result': 'passed' if status == 'passed' else 'failed', 'reportedTitle': expected})
    return cases

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--vitest', type=Path, action='append', default=[])
    parser.add_argument('--playwright', type=Path, action='append', default=[])
    parser.add_argument('--command', action='append', required=True, help='exact command executed, repeatable')
    parser.add_argument('--exit-code', type=int, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    ledger = json.loads((args.root / 'data/second-edition/runtime-coverage.json').read_text())
    manifest = json.loads((args.root / 'data/second-edition/runtime-obligations.json').read_text())
    reported = []
    for path in args.vitest:
        reported.extend(vitest_reported(path, args.root))
    for path in args.playwright:
        reported.extend(playwright_reported(path, args.root))
    cases = match_cases(ledger.get('testCases', {}), reported)
    receipt = {'format': 'runtime-coverage-run/v2', 'command': ' && '.join(args.command), 'commands': args.command,
               'exitCode': args.exit_code, 'manifestSha256': digest(manifest), 'freezePolicy': FREEZE_POLICY,
               'files': candidate_files(args.root), 'cases': cases,
               'scope': f'{len(cases)} ledger references matched; {sum(1 for c in cases if c["result"] != "passed")} failed'}
    args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'written': str(args.output), 'matched': len(cases), 'failed': sum(1 for c in cases if c['result'] != 'passed')}))

if __name__ == '__main__':
    main()
```

`candidate_files` の戻り値が `{path: sha256}` の dict であることを `validate_runtime_coverage.py` の 47〜70 行で確認してから使う。異なる場合はそこで使われている形に合わせる（validator は `run['files'] == frozen_candidate` を比較する）。

- [x] **Step 4: 成功を確認**

Run: `python3 -m unittest scripts.test_record_runtime_run`
Expected: OK

- [x] **Step 5: 実レポートで試す（小さな対象）**

```bash
python3 scripts/record_runtime_run.py --freeze-output .cache/run/snapshot.json
pnpm exec vitest run packages/engine/test/scenario-s01-s05.test.ts --reporter=json --outputFile=.cache/run/engine.json
python3 scripts/record_runtime_run.py --snapshot .cache/run/snapshot.json --vitest .cache/run/engine.json --command "pnpm exec vitest run packages/engine/test/scenario-s01-s05.test.ts" --exit-code 0 --output .cache/run/receipt.json
```

Expected: `matched` が 1 以上、`failed` 0。`.cache/` は `.gitignore` 済みであることを `git check-ignore .cache` で確認する。

- [x] **Step 6: コミット**

```bash
git add scripts/record_runtime_run.py scripts/test_record_runtime_run.py && git commit -m "scripts: 試験レポートから候補固定のrun証跡を生成する"
```


実装時補足: 実行前の --freeze-output と、実行後の --snapshot を必須手順に追加。候補/manifest変更とsnapshotより古いレポートを拒否する。%#は引数位置ではなくASTの行番号を用い、曖昧な参照は未束縛のままとする。空結果・skip・失敗を含む再試行を成功に数えない。参考コードより実装ファイルを正本とする。単体7件成功、S01〜S05実レポートから13参照一致・失敗0。

### Task A5: 束縛適用スクリプト `apply_ledger_bindings.py`

**Files:**
- Create: `scripts/apply_ledger_bindings.py`
- Test: `scripts/test_apply_ledger_bindings.py`
- Read: `scripts/runtime_coverage_ast.cjs`（宣言抽出）、`scripts/validate_runtime_coverage.py`（`canonical_digest`、参照ID `t:`/`h:`/`n:` の生成規則を 200〜245 行で確認）

**Interfaces:**
- Consumes: 束縛ファイル（JSON）
  ```json
  {"bindings": [{"row": "c2-p01-r1c1#objective/extinction-EVIL",
                 "handler": [{"path": "packages/engine/src/lifecycle/objectives.ts", "symbol": "factionObjective"}],
                 "tests": [{"path": "packages/engine/test/character-clauses.test.ts", "suite": ["objectives"], "title": "%s wins when its objective faction is extinct", "parameters": ["白魔術師シェリム"], "kind": "canonical-transition", "bindingNote": "..."}],
                 "status": "implemented", "remaining": ["Exact clause-specific assertion bound; successful run evidence remains."]}]}
  ```
- Produces: 台帳 `rows[]` の `handler` / `tests` / `status` / `remaining` を更新し、`handlers` / `testCases` / `remainingNotes` に参照を追加する。`declarationSha256` は AST 抽出結果から取る（束縛ファイルには書かない）。`status` は `implemented` か `notApplicable` のみ受け付け、`verified`/`accepted` は拒否する（昇格は Task A6）。

- [x] **Step 1: 失敗するテストを書く**

```python
# scripts/test_apply_ledger_bindings.py
import json, unittest
from apply_ledger_bindings import apply_bindings

class ApplyBindingsTest(unittest.TestCase):
    def setUp(self):
        self.ledger = {'rows': [{'entryId': 'a', 'clauseKey': 'x', 'coverageClass': 'semantic', 'kind': 'ability-effect', 'status': 'pending', 'handler': [], 'tests': [], 'remaining': ['n:old']}],
                       'handlers': {}, 'testCases': {}, 'remainingNotes': {'n:old': 'gap'}}
        self.declarations = {'packages/engine/test/x.test.ts': {'functions': [], 'tests': [{'title': '%s does it', 'suite': [], 'each': True, 'parameters': [['a'], ['b']], 'disabled': False, 'declarationSha256': 'sha'}]},
                             'packages/engine/src/x.ts': {'functions': ['handle'], 'tests': []}}

    def test_binds_concrete_test_and_handler(self):
        binding = {'row': 'a#x', 'handler': [{'path': 'packages/engine/src/x.ts', 'symbol': 'handle'}],
                   'tests': [{'path': 'packages/engine/test/x.test.ts', 'suite': [], 'title': '%s does it', 'parameters': ['a'], 'kind': 'canonical-transition', 'bindingNote': 'exact'}],
                   'status': 'implemented', 'remaining': ['run evidence remains']}
        apply_bindings(self.ledger, [binding], self.declarations)
        row = self.ledger['rows'][0]
        self.assertEqual(row['status'], 'implemented')
        self.assertEqual(len(row['tests']), 1)
        self.assertEqual(self.ledger['testCases'][row['tests'][0]]['declarationSha256'], 'sha')

    def test_rejects_promotion_and_unknown_parameters(self):
        bad = {'row': 'a#x', 'handler': [], 'tests': [{'path': 'packages/engine/test/x.test.ts', 'suite': [], 'title': '%s does it', 'parameters': ['zzz'], 'kind': 'canonical-transition', 'bindingNote': ''}], 'status': 'implemented', 'remaining': ['r']}
        with self.assertRaises(ValueError):
            apply_bindings(self.ledger, [bad], self.declarations)
        with self.assertRaises(ValueError):
            apply_bindings(self.ledger, [dict(bad, tests=[], status='accepted')], self.declarations)

if __name__ == '__main__':
    unittest.main()
```

- [x] **Step 2: 失敗を確認**

Run: `python3 -m unittest scripts.test_apply_ledger_bindings`
Expected: `ModuleNotFoundError`

- [x] **Step 3: 実装**

```python
#!/usr/bin/env python3
"""Apply concrete test/handler bindings to the ledger without promoting status.

Bindings name a row, its handler symbols and exact test declarations (with the
concrete each-parameters). declarationSha256 comes from the AST extractor so a
binding can never point at a declaration that does not exist.
"""
import argparse, json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from validate_runtime_coverage import canonical_digest

ALLOWED_STATUS = {'implemented', 'notApplicable'}

def extract_declarations(root, paths):
    request = json.dumps({'root': str(Path(root).resolve()), 'paths': sorted(set(paths))})
    output = subprocess.run(['node', str(Path(root) / 'scripts/runtime_coverage_ast.cjs')], input=request, capture_output=True, text=True, check=True).stdout
    return json.loads(output)

def _ref_id(prefix, payload):
    return f'{prefix}:{canonical_digest(payload)[:16]}'

def apply_bindings(ledger, bindings, declarations):
    rows = {f"{r['entryId']}#{r['clauseKey']}": r for r in ledger['rows']}
    for binding in bindings:
        row = rows.get(binding['row'])
        if row is None:
            raise ValueError(f"unknown row {binding['row']}")
        if binding.get('status') not in ALLOWED_STATUS:
            raise ValueError(f"binding may not set status {binding.get('status')} for {binding['row']}")
        handler_ids, test_ids, note_ids = [], [], []
        for handler in binding.get('handler', []):
            functions = declarations.get(handler['path'], {}).get('functions', [])
            if handler['symbol'] not in functions:
                raise ValueError(f"unknown handler {handler} for {binding['row']}")
            payload = {'path': handler['path'], 'symbol': handler['symbol']}
            ref = _ref_id('h', payload); ledger.setdefault('handlers', {})[ref] = payload; handler_ids.append(ref)
        for test in binding.get('tests', []):
            matches = [t for t in declarations.get(test['path'], {}).get('tests', []) if t['title'] == test['title'] and t['suite'] == test.get('suite', [])]
            if len(matches) != 1:
                raise ValueError(f"nonexistent or ambiguous test {test['title']} for {binding['row']}")
            declared = matches[0]
            if test.get('parameters') is not None and (declared['parameters'] is None or test['parameters'] not in declared['parameters']):
                raise ValueError(f"unknown parameters {test['parameters']} for {binding['row']}")
            if (declared['each'] or '${' in declared['title']) and test.get('parameters') is None:
                raise ValueError(f"each test needs concrete parameters {test['title']} for {binding['row']}")
            payload = {'path': test['path'], 'suite': test.get('suite', []), 'title': test['title'], 'declarationSha256': declared['declarationSha256'],
                       'kind': test['kind'], 'parameters': test.get('parameters'), 'bindingNote': test.get('bindingNote')}
            ref = _ref_id('t', payload); ledger.setdefault('testCases', {})[ref] = payload; test_ids.append(ref)
        for note in binding.get('remaining', []):
            ref = _ref_id('n', note); ledger.setdefault('remainingNotes', {})[ref] = note; note_ids.append(ref)
        if binding['status'] == 'implemented' and not note_ids:
            raise ValueError(f"implemented row needs a remaining note {binding['row']}")
        row['handler'] = handler_ids or row.get('handler', [])
        row['tests'] = test_ids
        row['status'] = binding['status']
        row['remaining'] = note_ids
        if binding['status'] == 'notApplicable':
            row['notApplicable'] = binding['notApplicable']
            row['remaining'] = []
        row.pop('gapKind', None) if binding['status'] == 'notApplicable' else None
    return ledger

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--bindings', type=Path, required=True)
    args = parser.parse_args()
    ledger_path = args.root / 'data/second-edition/runtime-coverage.json'
    ledger = json.loads(ledger_path.read_text())
    bindings = json.loads(args.bindings.read_text())['bindings']
    paths = {h['path'] for b in bindings for h in b.get('handler', [])} | {t['path'] for b in bindings for t in b.get('tests', [])}
    apply_bindings(ledger, bindings, extract_declarations(args.root, paths))
    ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'applied': len(bindings)}))

if __name__ == '__main__':
    main()
```

台帳の既存整形（インデント幅・末尾改行）は `git diff --stat` で行数が束縛数に見合うことを確認し、整形差分が全行に及ぶ場合は既存の書き出し方に合わせる。

- [x] **Step 4: 成功を確認し、既存台帳に空束縛で実行して差分がないことを確認**

Run: `python3 -m unittest scripts.test_apply_ledger_bindings && echo '{"bindings":[]}' > .cache/empty.json && python3 scripts/apply_ledger_bindings.py --bindings .cache/empty.json && git diff --stat data/`
Expected: OK、`git diff --stat` が空（整形が変わる場合はここで書き出し形式を合わせる）

- [x] **Step 5: コミット**

```bash
git add scripts/apply_ledger_bindings.py scripts/test_apply_ledger_bindings.py && git commit -m "scripts: 具体試験と処理関数の束縛を台帳へ適用する"
```

### Task A6: 昇格スクリプト `promote_ledger.py`（implemented→verified→accepted）

**Files:**
- Create: `scripts/promote_ledger.py`
- Modify: `scripts/generate_acceptance_receipt.py`（依存行を受け取る）
- Test: `scripts/test_promote_ledger.py`
- Read: `scripts/validate_runtime_coverage.py` 118〜140 行（`reviewed_row_digest`）、405〜455 行（run/acceptance の検査）

**Interfaces:**
- Consumes: run receipt（Task A4 の出力、`docs/operations/evidence/<date>-candidate-run.json` に置く）。
- Produces: 台帳更新。`implemented` 行のうち `tests` 全件が run で `passed` の行を `verified` にし `runEvidence: {path, sha256}` を付ける。`verified` 行のうち依存行が全て `accepted`/`notApplicable` の行に受け入れ receipt（`docs/operations/evidence/acceptance/<entryId>--<clauseKey>.json`）を書き、`accepted` にして `remaining: []` にする。依存順に反復し、変化がなくなるまで回す。`notApplicable` 行の `retainedTests` も同じ run に束縛する（`runEvidence` を付ける）。
- receipt は `generate_acceptance_receipt.build_acceptance_receipt(manifest, key, row, obligation, dependency_rows, run)` を使う。`dependency_rows` は `obligation.dependsOn` の実行（台帳の該当行 dict）。

- [x] **Step 1: 失敗するテストを書く**

```python
# scripts/test_promote_ledger.py
import hashlib, json, tempfile, unittest
from pathlib import Path
from promote_ledger import promote

class PromoteTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        (self.root / 'data/second-edition').mkdir(parents=True)
        (self.root / 'docs/operations/evidence/acceptance').mkdir(parents=True)
        test_ref = {'path': 'packages/engine/test/x.test.ts', 'suite': [], 'title': 't', 'declarationSha256': 'd', 'kind': 'canonical-transition', 'parameters': None, 'bindingNote': None}
        self.manifest = {'acceptancePolicy': 'acceptance-policy/test-only-v1', 'obligations': [
            {'entryId': 'a', 'clauseKey': 'x', 'source': ['s'], 'rulingIds': [], 'dependsOn': []},
            {'entryId': 'a', 'clauseKey': 'y', 'source': ['s'], 'rulingIds': [], 'dependsOn': ['a#x']}]}
        self.ledger = {'rows': [
            {'entryId': 'a', 'clauseKey': 'x', 'coverageClass': 'semantic', 'status': 'implemented', 'handler': ['h:1'], 'tests': ['t:1'], 'remaining': ['n:1'], 'source': ['s'], 'rulingIds': []},
            {'entryId': 'a', 'clauseKey': 'y', 'coverageClass': 'semantic', 'status': 'implemented', 'handler': ['h:1'], 'tests': ['t:1'], 'remaining': ['n:1'], 'source': ['s'], 'rulingIds': []}],
            'testCases': {'t:1': test_ref}, 'handlers': {'h:1': {}}, 'remainingNotes': {'n:1': 'run remains'}}
        (self.root / 'data/second-edition/runtime-obligations.json').write_text(json.dumps(self.manifest))
        (self.root / 'data/second-edition/runtime-coverage.json').write_text(json.dumps(self.ledger))
        run = {'format': 'runtime-coverage-run/v2', 'exitCode': 0, 'command': 'c', 'cases': [{'test': test_ref, 'result': 'passed'}]}
        self.run_path = self.root / 'docs/operations/evidence/run.json'
        self.run_path.write_text(json.dumps(run))

    def test_promotes_in_dependency_order_and_writes_receipts(self):
        summary = promote(self.root, self.run_path)
        ledger = json.loads((self.root / 'data/second-edition/runtime-coverage.json').read_text())
        statuses = {f"{r['entryId']}#{r['clauseKey']}": r['status'] for r in ledger['rows']}
        self.assertEqual(statuses, {'a#x': 'accepted', 'a#y': 'accepted'})
        row = next(r for r in ledger['rows'] if r['clauseKey'] == 'y')
        receipt_path = self.root / row['acceptanceEvidence']['path']
        self.assertEqual(hashlib.sha256(receipt_path.read_bytes()).hexdigest(), row['acceptanceEvidence']['sha256'])
        self.assertEqual(row['remaining'], [])
        self.assertEqual(summary['accepted'], 2)

    def test_failed_case_never_promotes(self):
        run = json.loads(self.run_path.read_text()); run['cases'][0]['result'] = 'failed'; self.run_path.write_text(json.dumps(run))
        summary = promote(self.root, self.run_path)
        self.assertEqual(summary['verified'], 0)

if __name__ == '__main__':
    unittest.main()
```

- [x] **Step 2: 失敗を確認**

Run: `python3 -m unittest scripts.test_promote_ledger`
Expected: `ModuleNotFoundError`

- [x] **Step 3: `generate_acceptance_receipt.py` の CLI が依存行を渡すように直し、`promote_ledger.py` を実装**

`generate_acceptance_receipt.main()` の `{}` を、`--ledger` と `--manifest` から `dependsOn` の行を引いた dict に置き換える。`promote_ledger.py`:

```python
#!/usr/bin/env python3
"""Promote ledger rows from a successful bound run: implemented→verified→accepted.

Never touches pending rows. Never fabricates run cases. Writes one acceptance
receipt per accepted row under docs/operations/evidence/acceptance/.
"""
import argparse, hashlib, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from generate_acceptance_receipt import build_acceptance_receipt
from validate_runtime_coverage import canonical_digest

DONE = {'accepted', 'notApplicable'}

def _ref(root, path):
    data = Path(path).read_bytes()
    return {'path': str(Path(path).resolve().relative_to(Path(root).resolve())), 'sha256': hashlib.sha256(data).hexdigest()}

def promote(root, run_path):
    root = Path(root)
    ledger_path = root / 'data/second-edition/runtime-coverage.json'
    ledger = json.loads(ledger_path.read_text())
    manifest = json.loads((root / 'data/second-edition/runtime-obligations.json').read_text())
    run = json.loads(Path(run_path).read_text())
    if run.get('format') != 'runtime-coverage-run/v2' or run.get('exitCode') != 0:
        raise ValueError('run receipt must be a successful runtime-coverage-run/v2')
    passed = {canonical_digest(c['test']) for c in run['cases'] if c.get('result') == 'passed'}
    run_ref = _ref(root, run_path)
    rows = {f"{r['entryId']}#{r['clauseKey']}": r for r in ledger['rows']}
    obligations = {f"{o['entryId']}#{o['clauseKey']}": o for o in manifest['obligations']}
    cases = ledger.get('testCases', {})
    summary = {'verified': 0, 'accepted': 0}
    for key, row in rows.items():
        if row.get('status') in {'implemented', 'notApplicable'} and row.get('tests') and all(canonical_digest(cases[t]) in passed for t in row['tests']):
            row['runEvidence'] = run_ref
            if row['status'] == 'implemented':
                row['status'] = 'verified'; summary['verified'] += 1
    receipts = root / 'docs/operations/evidence/acceptance'
    receipts.mkdir(parents=True, exist_ok=True)
    changed = True
    while changed:
        changed = False
        for key, row in rows.items():
            if row.get('status') != 'verified':
                continue
            obligation = obligations.get(key, {})
            deps = obligation.get('dependsOn', [])
            if any(rows.get(d, {}).get('status') not in DONE for d in deps):
                continue
            row['remaining'] = []
            row['status'] = 'accepted'
            dependency_rows = {d: rows[d] for d in deps}
            receipt = build_acceptance_receipt(manifest, key, row, obligation, dependency_rows, run)
            path = receipts / f"{row['entryId']}--{row['clauseKey'].replace('/', '__')}.json"
            path.write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + '\n')
            row['acceptanceEvidence'] = _ref(root, path)
            summary['accepted'] += 1; changed = True
    ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=1) + '\n')
    return summary

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--run', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(promote(args.root, args.run)))

if __name__ == '__main__':
    main()
```

`reviewed_row_digest` が row の `status`/`acceptanceEvidence` を除外し `remaining` を含むため、receipt 生成は `remaining=[]`・`status='accepted'` に更新した後に行う（上記の順序）。validator の `reviewed_row_digest(row, expected, dependency_rows)` の第3引数が「全行 dict」か「依存行だけの dict」かを 118〜140 行で確認し、同じものを渡す。

- [x] **Step 4: 成功を確認**

Run: `python3 -m unittest scripts.test_promote_ledger scripts.test_validate_runtime_coverage`
Expected: OK（validator 側の既存 fixture も成功）

- [x] **Step 5: 小さな実run で end-to-end 確認（Task A4 Step 5 の receipt を使う）**

```bash
cp .cache/run/receipt.json docs/operations/evidence/2026-09-11-probe-run.json
python3 scripts/promote_ledger.py --run docs/operations/evidence/2026-09-11-probe-run.json
python3 scripts/validate_runtime_coverage.py | cut -c1-200
```

Expected: 一部の行が verified/accepted になり validator は `valid: true`。確認後 `git checkout data/ docs/operations/evidence/acceptance` と `rm docs/operations/evidence/2026-09-11-probe-run.json` で戻す（候補が変わるたびに run は無効になるため、本番の昇格は Task B8 で一度に行う）。

- [x] **Step 6: コミット**

```bash
git add scripts/promote_ledger.py scripts/test_promote_ledger.py scripts/generate_acceptance_receipt.py && git commit -m "scripts: 成功runから台帳を依存順にverified/acceptedへ昇格する"
```

実装補足: 候補・manifest一致と重複case拒否を昇格前に検査する。参照IDを展開し推移的依存行をreceiptへ渡す。ファイル名は行キーのSHA256で衝突を避ける。実probeは新しいsnapshot/runを取得し3行accepted、全12,178行validator validを確認後、台帳とprobeを復元済み。新規5試験成功（既存validator58試験も成功）。

### Task A7: `notApplicable` の basis 種別を D4a/b/d へ拡張

**Files:**
- Create: `scripts/inspect_card_data.py`（`inspect_earth_warrior_actions.py` を一般化。旧スクリプトは薄いラッパーとして残す）
- Modify: `scripts/validate_runtime_coverage.py`（`not_applicable_errors`）
- Test: `scripts/test_inspect_card_data.py`、`scripts/test_validate_runtime_coverage.py` に basis 種別のケースを追加
- Create: `docs/operations/evidence/2026-09-11-d4-not-applicable-bindings.json`（Task A5 の束縛形式）

**Interfaces:**
- basis 種別
  - `earth-warrior-technique-absence`（既存、D4c）: `{"kind": ..., "edition": ..., "matches": []}`
  - `card-data-filter`（D4a/D4b）: `{"kind": "card-data-filter", "edition": ..., "query": {"dataset": "actions"|"character-owned-techniques", "where": {...}}, "matches": []}`。validator は `inspect_card_data.run_query(root, query)` を実行し `matches` と一致することを要求する。
  - `adopted-ruling`（D4d）: `{"kind": "adopted-ruling", "edition": ..., "rulingIds": ["A31"], "evidence": {"path": "docs/operations/evidence/2026-09-09-r4-sword-shuffle.json", "sha256": "..."}}`。validator は rulingId が manifest の `rulingIds` 集合に存在し、evidence ファイルの hash が一致することを要求する。
- `run_query` の where 仕様: `dataset=actions` は `actions-*.json` の `cards[]` を対象に、`attributes_contains`（属性文字列）、`printed_category`、`counter: true/false`（`specification`/`printed_text` に「反撃」を含むか）で絞る。`dataset=character-owned-techniques` は `characters.json` の `owned_techniques` を行動カード名に解決し、`character` と `attribute_not_contains` で絞る。

- [x] **Step 1: 失敗するテストを書く（`scripts/test_inspect_card_data.py`）**

```python
import unittest
from pathlib import Path
from inspect_card_data import run_query

ROOT = Path(__file__).resolve().parent.parent

class CardDataQueryTest(unittest.TestCase):
    def test_no_bow_card_grants_counter(self):
        result = run_query(ROOT, {'dataset': 'actions', 'where': {'attributes_contains': '弓', 'counter': True}})
        self.assertEqual(result['matches'], [])

    def test_fury_owned_techniques_all_carry_bow(self):
        result = run_query(ROOT, {'dataset': 'character-owned-techniques', 'where': {'character': 'c2-p02-r1c2', 'attribute_not_contains': '弓'}})
        self.assertEqual(result['matches'], [])

    def test_earth_warrior_query_matches_legacy_script(self):
        from inspect_earth_warrior_actions import collect_earth_warrior_techniques
        result = run_query(ROOT, {'dataset': 'actions', 'where': {'attributes_contains': '地', 'technique_class': '戦士'}})
        self.assertEqual(result['matches'], collect_earth_warrior_techniques(ROOT))

if __name__ == '__main__':
    unittest.main()
```

行動カードの属性・技種別のフィールド名は `inspect_earth_warrior_actions.py` が読んでいるキーをそのまま使う（作成時に該当箇所を確認し、`attributes_contains` / `technique_class` をそのキーに対応させる）。フューリーのIDは `characters.json` で「妖精王フューリー」を検索して確定する。

- [x] **Step 2: 失敗を確認**

Run: `python3 -m unittest scripts.test_inspect_card_data`
Expected: `ModuleNotFoundError`

- [x] **Step 3: `inspect_card_data.py` を実装し、`inspect_earth_warrior_actions.collect_earth_warrior_techniques` をそれを呼ぶ形に置き換える**

```python
#!/usr/bin/env python3
"""Deterministic card-data queries used as notApplicable basis. Read-only."""
import glob, json, sys
from pathlib import Path

def _actions(root):
    cards = []
    for path in sorted(glob.glob(str(Path(root) / 'data/second-edition/actions-*.json'))):
        cards.extend(json.loads(Path(path).read_text())['cards'])
    return cards

def _characters(root):
    return json.loads((Path(root) / 'data/second-edition/characters.json').read_text())['cards']

def _text(card):
    return ' '.join([card.get('printed_text', '') or ''] + list(card.get('specification', []) or []))

def _matches_actions(card, where):
    attributes = ' '.join(card.get('attributes', []) or []) + ' ' + (card.get('attribute', '') or '')
    if 'attributes_contains' in where and where['attributes_contains'] not in attributes: return False
    if 'attribute_not_contains' in where and where['attribute_not_contains'] in attributes: return False
    if 'printed_category' in where and card.get('printed_category') != where['printed_category']: return False
    if 'technique_class' in where and where['technique_class'] not in (card.get('technique_class', '') or card.get('category', '')): return False
    if 'counter' in where and (('反撃' in _text(card)) != where['counter']): return False
    return True

def run_query(root, query):
    where = query.get('where', {})
    if query['dataset'] == 'actions':
        matches = [c['id'] for c in _actions(root) if _matches_actions(c, where)]
    elif query['dataset'] == 'character-owned-techniques':
        by_name = {c['name']: c for c in _actions(root)}
        character = next(c for c in _characters(root) if c['id'] == where['character'])
        matches = []
        for name in character.get('owned_techniques', []):
            card = by_name.get(name)
            if card is None:
                matches.append(f'unresolved:{name}'); continue
            if _matches_actions(card, {k: v for k, v in where.items() if k != 'character'}):
                matches.append(card['id'])
    else:
        raise ValueError(f"unknown dataset {query['dataset']}")
    return {'kind': 'card-data-filter', 'query': query, 'matches': sorted(matches), 'count': len(matches)}

if __name__ == '__main__':
    print(json.dumps(run_query(Path('.'), json.loads(sys.argv[1])), ensure_ascii=False, indent=1))
```

`_matches_actions` の属性・技種別キーは実データのキー名（`inspect_earth_warrior_actions.py` が使うもの）に合わせて書き換える。未解決の所有技名（`unresolved:`）が出た場合は basis に使えないので、名前の表記揺れを `characters.json` と照合して解決する。

- [x] **Step 4: validator の `not_applicable_errors` を basis 種別で分岐させ、`test_validate_runtime_coverage.py` に `card-data-filter` 一致／不一致、`adopted-ruling` の hash 不一致のケースを追加する**

```python
def not_applicable_errors(root, row, key, manifest):
    spec = row.get('notApplicable')
    if not isinstance(spec, dict):
        return [f'missing notApplicable {key}']
    for field in ('reason', 'basis', 'edition', 'decidedOn', 'decidedBy', 'retainedTests'):
        if field not in spec:
            return [f'missing notApplicable {key}']
    if spec.get('decidedBy') != 'user' or spec.get('edition') != ADOPTED_EDITION:
        return [f'missing notApplicable {key}']
    if spec.get('retainedTests') != row.get('tests'):
        return [f'missing notApplicable retainedTests {key}']
    basis = spec.get('basis')
    if not isinstance(basis, dict) or basis.get('edition') != ADOPTED_EDITION:
        return [f'missing notApplicable basis {key}']
    kind = basis.get('kind')
    if kind == 'earth-warrior-technique-absence':
        return [] if basis.get('matches') == earth_warrior_technique_matches(root) else [f'notApplicable basis mismatch {key}']
    if kind == 'card-data-filter':
        current = card_data_query(root, basis.get('query'))
        return [] if basis.get('matches') == current['matches'] else [f'notApplicable basis mismatch {key}']
    if kind == 'adopted-ruling':
        known = {rid for o in manifest.get('obligations', []) for rid in o.get('rulingIds', [])}
        if not basis.get('rulingIds') or any(rid not in known for rid in basis['rulingIds']):
            return [f'notApplicable basis mismatch {key}']
        evidence = basis.get('evidence', {})
        path = (root / evidence.get('path', '')).resolve()
        if not path.is_relative_to(root) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != evidence.get('sha256'):
            return [f'notApplicable basis mismatch {key}']
        return []
    return [f'missing notApplicable basis {key}']
```

呼び出し側（`errors.extend(not_applicable_errors(root, row, key))`）に `manifest` を渡す。`card_data_query` は `inspect_card_data.run_query` を `earth_warrior_technique_matches` と同じ importlib 方式で読み込む。

- [x] **Step 5: 成功を確認**

Run: `python3 -m unittest scripts.test_inspect_card_data scripts.test_inspect_earth_warrior_actions scripts.test_validate_runtime_coverage`
Expected: OK

- [x] **Step 6: D4 対象行を特定し、束縛ファイルを書いて適用する**

対象行の特定コマンド（結果を束縛ファイルの `row` に使う）:

```bash
python3 - <<'EOF'
import json
d=json.load(open('data/second-edition/runtime-coverage.json'))
for r in d['rows']:
    k=f"{r['entryId']}#{r['clauseKey']}"
    if r['coverageClass']=='semantic' and r['status']!='accepted' and (
        'not-earth-warrior' in k or ('c2-p02-r1c2' in k and ('counter' in k or 'non-bow' in k)) or ('a2-p04-r2c1' in k and ('deck' in k or 'attachment' in k))):
        print(k, r['status'])
EOF
```

束縛ファイル `docs/operations/evidence/2026-09-11-d4-not-applicable-bindings.json` の各要素は Task A5 の形式で `status: "notApplicable"`、`tests` に残す試験（D4a: `packages/engine/test/fury-bow-counter-boundary.test.ts` の6件、D4b: `reuse-abilities.test.ts` の `Fury non-bow never offers numerical modifier`、D4c: 既存の合成consumer回帰、D4d: `sword-shuffle` の手札廃棄経路）を `kind: canonical-transition` で指定し、`notApplicable` に次を書く:

```json
{"reason": "現行2ndの弓・専用欄に反撃権を持つカードがなく、反撃化能力はジル格技・シン剣技のみ。フューリー自身の弓反撃は到達不能",
 "basis": {"kind": "card-data-filter", "edition": "second-online-v0.1-provisional", "query": {"dataset": "actions", "where": {"attributes_contains": "弓", "counter": true}}, "matches": []},
 "edition": "second-online-v0.1-provisional", "decidedOn": "2026-09-10", "decidedBy": "user",
 "retainedTests": []}
```

`retainedTests` は適用後に row の `tests` と同じ ID 配列になるよう、`apply_ledger_bindings.py` が `notApplicable.retainedTests = row['tests']` を代入する（Step 3 の実装に1行追加する）。D4d の basis は `adopted-ruling` で `rulingIds: ["A31"]`、evidence は `docs/operations/evidence/2026-09-09-r4-sword-shuffle.json` の sha256。

Run: `python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-d4-not-applicable-bindings.json && python3 scripts/validate_runtime_coverage.py | cut -c1-160`
Expected: `valid: true`、statuses に `notApplicable` が出る

- [x] **Step 7: コミット**

```bash
git add scripts data docs && git commit -m "scripts,data: notApplicableのbasisをカードデータ照会と採用裁定へ拡張し、D4a〜D4dを台帳へ束縛する"
```

---

実装補足（サンプルより優先）:
- D4a/b/d は独立した台帳行が存在しない分岐判断。束縛ファイルの branchDecisions に根拠と保持試験を記録し、弓補正・回収・そぅど設置の行全体を適用外にはしない。独立した D4c 2行のみ bindings に含める。
- D4c は structural-resolver（合成consumer）として保持。歌う船の既存試験と、有翼族の追加試験を使う。retainedTests は validator が比較する展開済み参照オブジェクトで保存する。
- 成功runを要求する validator に合わせ、Step 6 は一時適用→事前snapshot→対象4ファイル実行→run束縛→昇格→全台帳 valid:true を確認し復元。恒久適用は B8 の snapshot 前に行う。2行 notApplicable、18参照一致・失敗0を確認済み。
- Python70試験、対象Engine試験、tsc --noEmit成功。現行台帳はpendingのまま保存し、後続変更で古くなるrunを残さない。

## Phase B: 台帳束縛（semantic 5,259行）

各タスクは「試験を書く→対象suiteを実行→束縛ファイルを書く→`apply_ledger_bindings.py`→validator→コミット」の同じ手順。昇格（verified/accepted）は Task B8 で候補を固定して一度に行う。束縛ファイルは `docs/operations/evidence/2026-09-11-<group>-bindings.json`。

各束縛の `bindingNote` には「この試験のどの assertion が条項のどの語に対応するか」を1文で書く。関連するだけの試験は `kind: related` のまま残し、受け入れには使わない。

### Task B1: related のみ 255 行と試験なし 24 行の再束縛

**Files:**
- Read: `python3 scripts/ledger_report.py` と次の一覧コマンド
- Modify: 該当する `packages/engine/test/*.test.ts`（既存 canonical 試験の参照追加、または新規 it 追加）
- Create: `docs/operations/evidence/2026-09-11-related-rebind-bindings.json`

- [x] **Step 1: 対象行を列挙し、条項ごとに「既存 canonical 試験に該当するものがあるか」を台帳の `testCases` から検索する**

```bash
python3 - <<'EOF'
import json
d=json.load(open('data/second-edition/runtime-coverage.json'))
cases=d['testCases']
for r in d['rows']:
    if r['coverageClass']!='semantic' or r['status']!='implemented': continue
    kinds={cases[t]['kind'] for t in r['tests']}
    if not r['tests'] or kinds=={'related'}:
        print(f"{r['entryId']}#{r['clauseKey']}", r['kind'], [cases[t]['title'][:60] for t in r['tests']])
EOF
```

- [x] **Step 2: 同じ entryId の accepted 候補（canonical 試験を持つ implemented 行）が使っている試験ファイルを開き、条項を直接 assert している `it` があればそれを束縛する。無ければそのファイルに `it('<entryId> <clauseKey> ...', ...)` を追加し、条項の語（例: 効果Lv5以下、従者で受ける前）を具体値で assert する**

追加する試験は既存 fixture（`packages/engine/test/fixtures.ts` の作成関数）を使い、`transition` の戻り値 `ok` と状態差分を assert する。人物・カードは実IDを使い、能力の付け替えをしない。

- [x] **Step 3: 対象ファイルだけ実行**

Run: `pnpm exec vitest run <変更した test ファイル>`
Expected: 全件成功

- [x] **Step 4: 束縛ファイルを書き、適用し、validator を通す**

Run: `python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-related-rebind-bindings.json && python3 scripts/validate_runtime_coverage.py | cut -c1-160 && python3 scripts/ledger_report.py`
Expected: `valid: true`、`implementedRelatedOnly` と `implementedNoTests` が 0

- [x] **Step 5: コミット（ファイル群が多い場合は 50 行ごとに分けてコミット）**

```bash
git add packages/engine/test data docs && git commit -m "test,data: related止まりの条項を具体試験へ再束縛する"
```

B1完了: 279行の不足を解消（束縛281行、既存具体行2行の参照更新を含む）。related-only0/no-tests0、implementedConcrete3829。直近の人物条件10/シナリオEngine10/DO6試験、型、全台帳validator成功。試験群ごとに検証・コミットし、成功runへの束縛とaccepted昇格はB8で行う。

### Task B2: 所有技・所有従者の回収 784 行（データ駆動試験）

**Files:**
- Create: `packages/engine/test/owned-reclaim-matrix.test.ts`
- Read: `packages/engine/test/owned-reclaim.test.ts`（既存の base 回収経路と fixture の使い方）、`packages/engine/src/reclaim.ts`、`packages/engine/src/reclaim-names.ts`
- Create: `docs/operations/evidence/2026-09-11-owned-reclaim-bindings.json`（生成スクリプト `scripts/build_owned_reclaim_bindings.py` で作る）

**Interfaces:**
- 試験は `it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) opens base recovery and returns once', ...)` と `it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) opens base recovery and returns once', ...)`。`CASES` は `characters.json` から `[characterName, cardName, cardId]` を生成する `const` 配列（AST 抽出器が静的に読めるよう、ファイル内で JSON import した値を map した結果を `const` に入れる。抽出器は識別子経由の `each` 引数しか静的評価しないので、`const OWNED_TECHNIQUE_CASES = [...]` を **リテラル配列として** 生成する。生成は `scripts/build_owned_reclaim_bindings.py --emit-cases` で行い、出力を試験ファイルの先頭に貼る）。

- [x] **Step 1: 台帳の owned-reclaim 行の clauseKey 構造を確認する**

```bash
python3 - <<'EOF'
import json,collections
d=json.load(open('data/second-edition/runtime-coverage.json'))
rows=[r for r in d['rows'] if r['kind']=='owned-reclaim' and r['status']=='pending']
print(len(rows)); print(collections.Counter(r['clauseKey'].split('/')[-1] for r in rows).most_common(20)); print(rows[0])
EOF
```

clauseKey の末尾（例: `base-right`, `one-per-game`, `reservation-until-root`）ごとに、試験内の assert を対応づける。末尾が5種類以下であることを前提に、1 `it` の中で全末尾を assert し、束縛時に `bindingNote` で assert 行を指す。6種類以上なら末尾ごとに `it.each` を分ける。

- [x] **Step 2: 失敗する試験を書く（1人物・1技だけの `CASES` で開始）**

```ts
// packages/engine/test/owned-reclaim-matrix.test.ts
import {describe, expect, it} from 'vitest';
import {transition} from '../src/transition.js';
import {makeOwnedReclaimTable, playOwnedCardToDiscard, currentReclaimWindow} from './owned-reclaim-helpers.js';

// 白輪の実IDは `grep -n '"name": "白輪"' data/second-edition/actions-*.json` で確認して書く
const OWNED_TECHNIQUE_CASES: [string, string, string][] = [
  ['白魔術師シェリム', '白輪', '<白輪の実ID>'],
];

describe('owned technique base recovery', () => {
  it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) opens base recovery and returns once', (character, cardName, cardId) => {
    const table = makeOwnedReclaimTable(character, cardId);
    const afterPlay = playOwnedCardToDiscard(table, cardId);
    const window = currentReclaimWindow(afterPlay.state, table.ownerId);
    expect(window?.claims.map(c => c.right)).toContain('base');
    const taken = transition(afterPlay.state, {actorId: table.ownerId, command: {type: 'CHOOSE_RECLAIM', decisionId: window!.decisionId, choice: 'take', claimId: window!.claims[0]!.id}}, table.entropy);
    expect(taken.ok).toBe(true);
    expect(taken.state.reclaimReservations.some(r => r.cardInstanceId === afterPlay.instanceId)).toBe(true);
    const finished = afterPlay.finishRoot(taken.state);
    expect(finished.players[table.ownerId]!.hand.filter(c => c.cardId === cardId)).toHaveLength(1);
    const again = playOwnedCardToDiscard({...table, state: finished}, cardId);
    expect(currentReclaimWindow(again.state, table.ownerId)?.claims.some(c => c.right === 'base')).toBe(false);
    expect(Object.values(again.state.players).flatMap(p => [...p.hand, ...p.discard]).length).toBe(afterPlay.cardCount);
  });
});
```

`owned-reclaim-helpers.ts` は既存 `owned-reclaim.test.ts` の準備コードを関数化して作る（人物を実IDで着席、所有技を手札に置く fixture、攻撃または詠唱で捨て札へ送る操作、root 完了までのパス）。ヘルパーの関数名は上記の3つに固定する。既存試験のコードを読み、`CHOOSE_RECLAIM` の実際のコマンド形（`decisionId`/`claimId`/`choice`）と `reclaimReservations` の型に合わせて修正する。

- [x] **Step 3: 失敗を確認**

Run: `pnpm exec vitest run packages/engine/test/owned-reclaim-matrix.test.ts`
Expected: ヘルパー未定義で失敗

- [x] **Step 4: ヘルパーを実装し、1件成功させる**

Run: `pnpm exec vitest run packages/engine/test/owned-reclaim-matrix.test.ts`
Expected: 1件成功

- [x] **Step 5: `scripts/build_owned_reclaim_bindings.py` を書き、全 `CASES` リテラルと束縛ファイルを生成する**

```python
#!/usr/bin/env python3
"""Emit the literal each-table for owned-reclaim-matrix.test.ts and its ledger bindings."""
import argparse, glob, json
from pathlib import Path

def cases(root):
    actions = {}
    for path in sorted(glob.glob(str(Path(root) / 'data/second-edition/actions-*.json'))):
        for card in json.loads(Path(path).read_text())['cards']:
            actions[card['name']] = card['id']
    characters = json.loads((Path(root) / 'data/second-edition/characters.json').read_text())['cards']
    techniques, followers = [], []
    for c in characters:
        for name in c.get('owned_techniques', []):
            techniques.append([c['name'], name, actions[name]])
        for name in c.get('owned_followers', []):
            followers.append([c['name'], name, actions[name]])
    return techniques, followers

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--emit-cases', action='store_true')
    parser.add_argument('--bindings', type=Path)
    args = parser.parse_args()
    techniques, followers = cases(args.root)
    if args.emit_cases:
        print('const OWNED_TECHNIQUE_CASES: [string, string, string][] = ' + json.dumps(techniques, ensure_ascii=False) + ';')
        print('const OWNED_FOLLOWER_CASES: [string, string, string][] = ' + json.dumps(followers, ensure_ascii=False) + ';')
    if args.bindings:
        ledger = json.loads((Path(args.root) / 'data/second-edition/runtime-coverage.json').read_text())
        by_character = {c['id']: c['name'] for c in json.loads((Path(args.root) / 'data/second-edition/characters.json').read_text())['cards']}
        bindings = []
        for row in ledger['rows']:
            if row.get('kind') != 'owned-reclaim' or row['status'] != 'pending':
                continue
            character = by_character[row['entryId'].split('-ab')[0]] if row['entryId'].split('-ab')[0] in by_character else None
            table = techniques if row['clauseKey'].startswith('owned_techniques') else followers
            title = '%s owned technique %s (%s) opens base recovery and returns once' if table is techniques else '%s owned follower %s (%s) opens base recovery and returns once'
            card_name = row['clauseKey'].split('/')[1]
            match = next((t for t in table if t[0] == character and t[1] == card_name), None)
            if match is None:
                raise SystemExit(f'no case for {row["entryId"]}#{row["clauseKey"]}')
            bindings.append({'row': f"{row['entryId']}#{row['clauseKey']}",
                             'handler': [{'path': 'packages/engine/src/reclaim.ts', 'symbol': 'offerReclaim'}],
                             'tests': [{'path': 'packages/engine/test/owned-reclaim-matrix.test.ts', 'suite': ['owned technique base recovery' if table is techniques else 'owned follower base recovery'], 'title': title, 'parameters': match, 'kind': 'canonical-transition',
                                        'bindingNote': 'base claim offered on actual discard, one reservation, single return, second use offers no base right, 220 cards conserved'}],
                             'status': 'implemented', 'remaining': ['Successful bound run evidence remains.']})
        args.bindings.write_text(json.dumps({'bindings': bindings}, ensure_ascii=False, indent=1) + '\n')
        print(len(bindings))

if __name__ == '__main__':
    main()
```

`row['entryId']` と `clauseKey` から人物・カード名を復元する規則は Step 1 の出力で確認し、上記の `split` を実データに合わせる。`offerReclaim` が `reclaim.ts` の export 名であることを `grep -n "export function offerReclaim" packages/engine/src/reclaim.ts` で確認する。

- [x] **Step 6: `--emit-cases` の出力を試験ファイルの `CASES` に置き換え、所有従者の `describe('owned follower base recovery')` を同じ形で追加して全件実行**

Run: `pnpm exec vitest run packages/engine/test/owned-reclaim-matrix.test.ts`
Expected: 784 件成功。失敗するカードは個別に原因を調べ、engine 側の不具合なら修正し関連 suite（`owned-reclaim.test.ts`, `reclaim-reservations.test.ts`, `reuse-abilities.test.ts`）を再実行する。カード固有の合法経路がない（例: 従者が特定条件でしか置けない）場合はその行を Task A7 の `notApplicable` 手順で扱い、理由に経路不在の根拠を書く。

- [x] **Step 7: 束縛を適用**

Run: `python3 scripts/build_owned_reclaim_bindings.py --bindings docs/operations/evidence/2026-09-11-owned-reclaim-bindings.json && python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-owned-reclaim-bindings.json && python3 scripts/validate_runtime_coverage.py | cut -c1-160`
Expected: `valid: true`、pending の owned-reclaim が 0

- [x] **Step 8: コミット**

```bash
git add packages/engine/test scripts data docs && git commit -m "test,data: 所有技・所有従者784件の通常回収をデータ駆動試験で束縛する"
```

B2部分実績: Step1〜4完了。条項末尾は9種類（通常共通5、技の実使用1、従者の死亡/士気失敗除外/攻撃捨て札除外3）なので種類ごとに静的なit.eachを分ける。技125組・従者23組の物理札を生成器で展開済み。aliases.jsonの複数正規名と同名物理コピーを全て保持し、条項の数字indexを元のowned配列へ対応付ける。白輪3試験・生成器4試験・型・全台帳validator成功。全件試験と束縛適用は未完、784行はpendingを維持。生成器CLIは全件のAST宣言・tuple検証が通るまで束縛ファイルを書かない。

2026-09-12 B2再開記録: PR #3 が main にマージ済みで旧 worktree が無かったため、`2f4c036` から `/private/tmp/madou-release-run/release-run`（`worktree-release-run`）を作成した。白輪に白光・裂界・天舞を追加し、3条項×4枚の12ケースを実行。裂界・天舞はヘルパーが詠唱を省いて `CHANT_REQUIRED` となることを確認し、通常の `CHANT` と手番一巡によって解消した。所有回収・予約保持の既存試験を含む36ケース成功。通常攻撃終了時の回収は選択と同時に親も完了するため、この経路を「未完了の親の下での予約保持」の証拠にはしない。残る全物理札の経路、別コピー共通予算、実変身・死亡復活、親未完了中の予約、従者の3固有条項は未完了。B2の784行はpendingを維持し、束縛生成・適用・accepted昇格はまだ行っていない。

2026-09-12 B2全物理札への展開: 技125組・従者23組の静的CASESを全件配置した。技は実使用・正規名1回・辞退・別コピー共通予算の4条項（500ケース）、従者は実死亡・正規名1回・辞退・別コピー共通予算・親未完了中の予約の5条項（115ケース）が成功。既存24件を含む全639件・型検査・生成器等8件・台帳validator成功。水晶球は実際に命運凶変で取り消された使用、復活は実死亡を起こす既存fixture、従者は配置→実詠唱→滅界による破壊で検証した。原作札の効果一般をこの回収試験だけで受け入れたとは扱わない。詳細とsource hashは [B2進捗証跡](../../operations/evidence/2026-09-12-b2-owned-matrix-progress.json)。残りは技の `retention-transform-revival` / `reserve-before-parent-release`、従者の `retention-transform-revival` / `morale-failure-excluded` / `attack-discard-not-follower-death`。束縛生成の事前検証は未実装のretention条項で停止することを確認済み。784行pending・accepted 0を維持。Step5〜8は未完了。

2026-09-12 B2除外条件と返却境界: 士気失敗が従者死亡の回収窓を開く不具合を13ケースで再現し、採用裁定G11に沿って直接捨て札へ移すよう修正した。士気判定のない札を含む23組と、従者攻撃の捨て札を死亡扱いしない23組を検証した。攻撃手段のないアルケミア城は、直接攻撃・全軍突撃せよの両方が支払い前に拒否されることを確認。技125組には、通常使用の原子的な親完了と、実際の割り込み使用の親未完了中の予約をそれぞれassertする試験を追加した。現在の行列は786ケース。単体全実行は7,335/7,336成功で、士気失敗札がresolutionに残る旧期待値1件を修正。その後、現行行列786件とmulti-hit 6件の全792件が成功。Worker全2,537件・全対象型検査・生成器等8件・台帳validatorも成功。単体全体を一度にgreen再実行したとは扱わない。詳細は [B2除外条件進捗](../../operations/evidence/2026-09-12-b2-exclusions-progress.json)。残件は技125組・従者23組の `retention-transform-revival`。束縛gateはその未実装条項で停止し、784行pending・accepted 0・Step5〜8未完了を維持する。

2026-09-12 B2完了: 残る技125組・従者23組で実死亡と復活後の回収履歴保持を検証し、変身可能なランスロット・ウーノスは実コマンドによる変身も確認した。ヴァンミールは死亡による終局と履歴保持を検証。行列934件と関連117件の全1,051件が成功し、束縛生成・適用784行・台帳validator valid:true。owned-reclaim pendingは0、具体的実装済み4,613、acceptedは0。詳細は [B2完了進捗証跡](../../operations/evidence/2026-09-12-b2-complete-progress.json)。候補版での受入はB8に残す。

### Task B3: 原典例 S01〜S32 の source 行 210 件

**Files:**
- Read: `docs/operations/evidence/2026-09-10-r6-candidate-run.json`（122 参照）、`docs/operations/evidence/2026-09-10-r6-scenario-source-index.json`
- Create: `docs/operations/evidence/2026-09-11-scenario-source-bindings.json`（生成: `scripts/build_scenario_bindings.py`）

- [x] **Step 1: シナリオIDごとに r6 candidate run の試験参照を集め、`S01#source/title`, `source/rulings/N`, `source/given`, `source/when`, `source/then` の各行に、そのシナリオの `canonical-transition` 試験を全て束縛する生成スクリプトを書く**

`scenario-source-index.json` に S→試験の対応がある場合はそれを唯一の入力にする。無い場合は run の `cases[].test.title` が `S01` のような ID で始まるものを対応づける。1シナリオに試験が 1 件も無い場合は列挙して止める（その S は R6 計画の該当項目を再実行して試験を追加する）。

- [x] **Step 2: 適用し validator を通す**

Run: `python3 scripts/build_scenario_bindings.py --bindings docs/operations/evidence/2026-09-11-scenario-source-bindings.json && python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-scenario-source-bindings.json && python3 scripts/validate_runtime_coverage.py | cut -c1-160`
Expected: `valid: true`、pending の scenario-source が 0

- [x] **Step 3: コミット**

```bash
git add scripts data docs && git commit -m "data: 原典例S01〜S32のsource条項を実行済みシナリオ試験へ束縛する"
```

2026-09-12 B3完了: 既存R6の唯一の対応表から210行を束縛した。S13/S32はR6で明記された抽象解決器、S23は初期ゾーン配置を固定した境界試験のため、元のstructural-resolver分類を維持する（canonicalへの付け替え・架空の札組合せ追加なし）。その他はcanonical-transitionを必須とし、全32例・各tuple・現行ASTを生成時に照合。対象Engine21ファイル496件、Python18件、台帳validator valid:true。scenario-source pending 0、具体的実装済み4,823、semantic pending 436、accepted 0。詳細は [B3完了進捗証跡](../../operations/evidence/2026-09-12-b3-complete-progress.json)。過去のrun hashを現候補の受入証跡には再利用せず、B8の候補版受入を残す。

### Task B4: 人物条項（目的・敗北・陣営・制限・継承・C16ほか）約 260 行

**Files:**
- Create: `packages/engine/test/character-clauses.test.ts`
- Read: `packages/engine/src/lifecycle/objectives.ts`（`factionObjective`, `initialProtection`, `protectedDead`, `replaceAllegiance`, `currentDefeatCondition`）、`apps/worker/test/fixtures/r6-extinction-scenario.ts`（全滅による終了の作り方）
- Create: `docs/operations/evidence/2026-09-11-character-clauses-bindings.json`

- [x] **Step 1: 対象行の clauseKey 一覧を取り、末尾ごとに assert を決める**

```bash
python3 - <<'EOF'
import json,collections
d=json.load(open('data/second-edition/runtime-coverage.json'))
rows=[r for r in d['rows'] if r['kind']=='character-semantic' and r['status']=='pending']
print(collections.Counter(r['clauseKey'] .split('/')[0]+'/'+r['clauseKey'].split('/')[-1] for r in rows).most_common(60))
EOF
```

- [x] **Step 2: 26人物の `it.each` を書く。各 `it` は1条項群に対応させる**

```ts
// packages/engine/test/character-clauses.test.ts
import {describe, expect, it} from 'vitest';
import characters from '../../../data/second-edition/characters.json' with {type: 'json'};
import {factionObjective, initialProtection, protectedDead, currentDefeatCondition} from '../src/lifecycle/objectives.js';
import {makeSeatedTable, killCharacter, settleLifecycle} from './fixtures.js';

// `python3 scripts/build_character_bindings.py --emit-cases` が characters.json から [name, id] × 26 のリテラル配列を出力する。その出力をここに貼る
const CHARACTER_CASES: [string, string][] = [];

describe('objectives', () => {
  it.each(CHARACTER_CASES)('%s (%s) wins when every enemy faction character is dead', (name, id) => {
    const table = makeSeatedTable([id, /* 敵陣営の実人物1名 */]);
    const enemy = Object.values(table.state.players).find(p => p.characterId !== id)!;
    const dead = settleLifecycle(killCharacter(table.state, enemy.id));
    expect(dead.outcome?.kind).toBe('victory');
    expect(dead.outcome?.winnerIds).toContain(table.seatOf(id));
    expect(dead.players[table.seatOf(id)]!.currentObjective).toEqual(factionObjective(dead.players[table.seatOf(id)]!.faction));
  });
});

describe('defeat conditions', () => {
  it.each(CHARACTER_CASES)('%s (%s) is defeated exactly when its printed protected character dies', (name, id) => {
    const protection = initialProtection(id);
    const printed = characters.cards.find(c => c.id === id)!.defeat_condition;
    if (protection.characterIds.length === 0) { expect(printed).not.toMatch(/死亡/); return; }
    const table = makeSeatedTable([id, ...protection.characterIds]);
    const dead = settleLifecycle(killCharacter(table.state, table.seatOf(protection.characterIds[0]!)));
    expect(protectedDead(dead, dead.players[table.seatOf(id)]!)).toBe(true);
    expect(dead.outcome?.results[table.seatOf(id)]).toBe('lost');
    expect(currentDefeatCondition(dead.players[table.seatOf(id)]!)).toBe(printed);
  });
});

describe('allegiance', () => {
  it.each(CHARACTER_CASES)('%s (%s) accepts only its printed factions and rejects the rest at setup', (name, id) => {
    // 陣営は setup で initial_faction に固定され、選択コマンドは無い。書き換えは replaceAllegiance（呪歌等の実効果）だけが行う。
    const printed = characters.cards.find(c => c.id === id)!;
    const table = makeSeatedTable([id]);
    const player = table.state.players[table.seatOf(id)]!;
    expect(player.faction).toBe(printed.initial_faction);
    const allowed = allowedFactions(id); // objectives.ts の fixed 表を export 関数にしたもの。表に無い人物は3陣営とも許可
    for (const faction of ['GOOD', 'EVIL', 'ヴァンミール'] as const) {
      const copy = structuredClone(player);
      const accepted = replaceAllegiance(copy, faction, factionObjective(faction), initialProtection(id));
      expect(accepted, `${name} ${faction}`).toBe(allowed.includes(faction));
      expect(copy.faction).toBe(accepted ? faction : printed.initial_faction);
    }
    // 陣営固定は任意能力ではないので、条件付き能力を全て OFF にしても同じ結果になる
    const off = structuredClone(player); off.conditionalSelections = {};
    expect(replaceAllegiance(off, allowed[0]!, factionObjective(allowed[0]!), initialProtection(id))).toBe(true);
  });
});
```

`makeSeatedTable`/`killCharacter`/`settleLifecycle` が `fixtures.ts` に無い場合は、`r6-extinction-scenario.ts` の `act(...)` 手順を関数化して `fixtures.ts` に追加する（既存 export を壊さない）。陣営の許可集合は `objectives.ts` の `replaceAllegiance` 内にある `fixed` 表（11人物）が正本なので、これを `export function allowedFactions(characterId): Faction[]`（表に無い人物は3陣営）として切り出し、`replaceAllegiance` はそれを呼ぶ形にする。試験は `allegiance_text`（例「白の護り手：常にGOOD」）と `allowedFactions` の一致も assert し、表の写し間違いを検出する。

- [x] **Step 3: 実行し、条項の残り（restrictions / inheritance / C16 / 8件ずつある条件付き能力の共通条項）は同じファイルに `describe` を追加して 26 人物分を assert する**

Run: `pnpm exec vitest run packages/engine/test/character-clauses.test.ts`
Expected: 全件成功

- [x] **Step 4: 束縛ファイルを生成（`scripts/build_character_bindings.py`、B2 と同じ構造で clauseKey の先頭語→describe/title の対応表を持つ）し適用**

Run: `python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-character-clauses-bindings.json && python3 scripts/validate_runtime_coverage.py | cut -c1-160`
Expected: `valid: true`、pending の character-semantic が 0

- [x] **Step 5: コミット**

```bash
git add packages/engine data scripts docs && git commit -m "test,data: 人物26名の目的・敗北・陣営・制限・継承条項を束縛する"
```

2026-09-12 B4基本条項: 印刷陣営・目的・敗北・追加継承なし・空の所有リスト・追加制限なしの187行を束縛した。行列216件＋関連140件の356件、全対象型検査、Python22件、台帳validator valid:true。26人物の実全滅勝利、保護対象27組の実死亡→彷徨→最終敗北、空所有12件の実回収窓を確認。陣営の既存fixed表はallowedFactionsへ切り出し、返却配列の変更で表が変わらないことも検証。残る人物能力150行はpendingで、全B4生成gateもその未実装行で停止。明示的な --core-only だけを適用した。具体的実装済み5,010、semantic pending249、accepted0。計画例の即時敗北・原文表示完全一致は採用せず、現行の彷徨処理と正規化された保護対象を検証している。詳細は [B4基本条項進捗](../../operations/evidence/2026-09-12-b4-basic-progress.json)。Step3〜5と候補版受入は未完了。

2026-09-12 B4手番内追加能力: 7能力の試行回数・通常行動保持・公開優先権/非公開選択中の拒否と占星の単一対象を、新規22試験で検証して23行を追加束縛。実取消後のフェーズ変更・JSON保存復帰でも同じ手番の権利は戻らず、実際の次手番で回復する。祝福の指定は実際のヴァンミール宣言で作り、神出鬼没は戦闘除外を守る公開窓で検証。関連含む147試験、全対象型検査、Python14件、台帳validator成功。人物束縛計210行、人物pending127、semantic具体的実装済み5,033、pending226、accepted0。全B4生成gateは残127条項で停止する。詳細は [B4追加能力進捗](../../operations/evidence/2026-09-12-b4-extras-progress.json)。Step3〜5は引き続き未完了。

2026-09-12 B4精神系防御・身代わり: 精神系3能力の実取消→同一2発群の再宣言拒否→後続の合法な別席攻撃での回復、同陣営攻撃者、従者開始後の拒否を能力別に追加。固定陣営は攻撃宣言前の人物設定から検証し、既存の悲しき愛の実身代わり/防御制限試験にも対応付けた。新規11試験、対象計94試験、全対象型検査、Python15件、台帳validator成功。未実装15行を解消し既存2行を再束縛、束縛ファイル計227行。人物pending112、semantic具体的実装済み5,048、pending211、accepted0。全B4生成gateは残112行で停止。詳細は [B4精神系防御進捗](../../operations/evidence/2026-09-12-b4-mental-progress.json)。Step3〜5は未完了。

2026-09-12 B4条件付き能力の選択・不在: 全8能力の初期OFF/実取消/新機会での明示ON/保存復帰/OFFと、実詠唱・裂界・命運凶変による異界移動→祈願でDawn取得→実帰還→実接近・所有者死亡時の選択消去を追加した。別の保存継続では保護対象を実際に殺して彷徨中の保持も確認し、保護対象なしの人物は他者死亡でも在席・選択を保持する。新規16試験、既存込み96試験、型検査、Python16件、台帳validator成功。未実装16行を解消、人物pending96、semantic具体的実装済み5,064、pending195、accepted0。全B4生成gateは残96行で停止。詳細は [B4条件付き能力進捗](../../operations/evidence/2026-09-12-b4-conditional-progress.json)。固有条件の消失・凍結値・継承などとStep3〜5は未完了。

2026-09-12 B4条件付き能力の更新: 全8能力を追加検証。リーアはB指定からC指定への更新を実際の命運凶変で取り消し、旧指定と同機会の試行済み記録を保存復帰後も保持。他7能力は更新対象集合を持たないため、重複ONの原子的拒否で既存選択・履歴が変わらないことを検証し、存在しない更新取消を試験した扱いにはしていない。新規8試験、関連104試験、型検査、Python17件、台帳validator成功。人物pending88、semantic具体的実装済み5,072、pending187、accepted0。全B4生成gateは残88行で停止。詳細は [B4更新規則進捗](../../operations/evidence/2026-09-12-b4-updates-progress.json)。Step3〜5は未完了。

2026-09-12 B4影系子攻撃: イダの影分身3行・ヨーツルムの影跳び6行を実親子攻撃へ束縛。既存の専用影分身による射程・準備済み詠唱・使用判定と、新規5試験による影跳びの射程/詠唱拒否、接近/離脱/手番開始終了拒否、魔法使用レベル判定の成功失敗境界を確認した。支払1枚・移動マーカーなし・子辞退後の防御保持も実取消/辞退試験で確認。関連45試験、型検査、Python18件、台帳validator成功。人物pending79、semantic具体的実装済み5,081、pending178、accepted0。全B4生成gateは残79行で停止。詳細は [B4影系子攻撃進捗](../../operations/evidence/2026-09-12-b4-shadow-progress.json)。Step3〜5は未完了。

2026-09-12 B4複数従者ソース: ウパニシャットとディアの各7条項、計14行を新規8試験へ束縛。手札/配置済みソースを宣言順・対象・専用指定付きで確保し、実親取消で全消費と行動消費を確認。実子取消と使用判定失敗では後続ソースが解決され、士気免除でも使用判定は残る。単一防御群の各ヒットの使用/効果レベル・損害が個別値を保持する。関連189試験、型検査、Python19件、台帳validator成功。人物pending65、semantic具体的実装済み5,095、pending164、accepted0。両人物の踏み込み共有範囲・従者防御snapshotの計4行は未実装。全B4生成gateは残65行で停止。詳細は [B4従者ソース進捗](../../operations/evidence/2026-09-12-b4-bundles-progress.json)。Step3〜5は未完了。

2026-09-12 B4従者ソース境界: 両人物の残4条項を新規4試験へ束縛。最初のソースでB/Cの間合いを1枚の踏み込みで取消し、次ソースでは踏み込み一覧が空となりBの新たな間合いが有効であることを実損害まで確認。女性親衛隊の単一防御snapshotに全ソースのhit indexと個別レベルが保存され、実士気判定が1回だけ行われることも検証。対象70試験、型検査、Python20件、台帳validator成功。従者能力18条項の束縛が揃った。人物pending61、semantic具体的実装済み5,099、pending160、accepted0。全B4生成gateは残61行で停止。詳細は [B4従者ソース境界進捗](../../operations/evidence/2026-09-12-b4-bundle-boundaries-progress.json)。Step3〜5は未完了。

2026-09-12 B4撃破報酬: ヨーツルムの6条項を束縛。実攻撃・実反撃・実氷鏡反射による精神8の対象死亡で、報酬の加害者/対象/原因カード/実損害を確認し、保存復帰後に1回だけ回復・戦士/魔法成長する新規3試験を追加。他者撃破の既存実試験と、彷徨/自傷除外の直接settleDamage試験を併用。後者2行はstructural-resolverとして明示し、実遷移へ昇格させない。対象26試験、型検査、Python21件、台帳validator成功。人物pending55、semantic具体的実装済み5,105、pending154、accepted0。全B4生成gateは残55行で停止。詳細は [B4撃破報酬進捗](../../operations/evidence/2026-09-12-b4-hunger-progress.json)。Step3〜5は未完了。

2026-09-12 B4リーア指定・ディア手札: 5条項を束縛。リーアの指定後にCを実公開しても対象が追加されない試験と、createGameで実際に配られたディアの初期5枚が公開上限7でも増えない試験を追加。既存の実ENDによる上限低下後の調整と、受け手の停止/ハジャ加算の構造試験を併用し、後者2行はstructural-resolverを保持。新規2件、対象82試験、型検査、Python22件、台帳validator成功。人物pending50、semantic具体的実装済み5,110、pending149、accepted0。全B4生成gateは残50行で停止。詳細は [B4リーア・ディア進捗](../../operations/evidence/2026-09-12-b4-lia-dia-progress.json)。Step3〜5は未完了。

2026-09-12 B4ランスロット変身: 残2条項を新規3試験に束縛。実成功/実取消の両方で1回の試行記録を保存復帰・フェーズ変更後も保持し再宣言を拒否。実変身後にリーアの公開状態を直接変更しても人物/継承能力が戻らない境界はstructural-resolverとし、合法な非公開化操作を作り出さない。対象5試験、型検査、Python23件、台帳validator成功。人物pending48、semantic具体的実装済み5,112、pending147、accepted0。全B4生成gateは残48行で停止。詳細は [B4変身進捗](../../operations/evidence/2026-09-12-b4-transform-progress.json)。Step3〜5は未完了。

2026-09-12 B4 C16指定: ヴァンミールの指定/公開機会10条項を束縛。新規2試験で空・重複・不存在の原子的拒否と試行権保持、有効指定後の実通常攻撃、実他者手番での公開応答限定・実取消後の再試行拒否を確認。既存の新規なし拒否/累積/自己指定と非公開人物の比較試験を対応付け、公開候補・秘密情報非依存の4行はstructural-resolverを保持。対象24試験、型検査、Python24件、台帳validator成功。人物pending38、semantic具体的実装済み5,122、pending137、accepted0。全B4生成gateは残38行で停止。詳細は [B4 C16指定進捗](../../operations/evidence/2026-09-12-b4-c16-designations-progress.json)。C16の寿命・祝福および条件付き能力とStep3〜5は未完了。

2026-09-12 B4 C16寿命・祝福: 残14条項を束縛。新規8試験で実手番進行後の指定済み候補・世代保存、実祝福→実致死攻撃による処分前G15失効、直接死亡/再配置での指定保持、直接人物/世代変更での失効と対象不在での保持を確認。既存の秘密情報比較・停止/不在・再指定・復活境界も対応付け、直接状態変更の検証はstructural-resolverを明示。対象32試験、型検査、Python25件、台帳validator成功。C16人物条項の束縛が揃い、残る人物24行は8条件付き能力の条件消失/継承/凍結値。semantic具体的実装済み5,136、pending123、accepted0。全B4生成gateは残24行で停止。詳細は [B4 C16寿命進捗](../../operations/evidence/2026-09-12-b4-c16-lifetimes-progress.json)。Step3〜5は未完了。

2026-09-12 B4条件付き能力の継承境界: 8能力を実際に選択した後、継承元を保持した人物変更・保存復帰・cleanupで能力ID/元人物ID/対象指定が残り、継承元を除去すると選択と候補が消える新規8試験へ束縛。これらの人物にランスロット2への印刷変身はないため、全8行を明示的なstructural-resolverとした。関連114試験、型検査、Python26件、台帳validator成功。人物pending16、semantic具体的実装済み5,144、pending115、accepted0。残りは8能力の条件消失/凍結値で、全B4生成gateは残16行で停止。詳細は [B4継承境界進捗](../../operations/evidence/2026-09-12-b4-inheritance-progress.json)。Step3〜5は未完了。

2026-09-12 B4条件消失: 全8能力を実選択後、能力固有の公開人物/陣営/攻撃文脈/竜従者士気文脈/自身公開の条件を外し、加算だけが0となって選択が残り、保存復帰後の条件回復で再選択なしに加算が戻る新規8試験へ束縛。竜は実攻撃から発生した士気判定を使うが条件変更は直接境界操作なので全8行をstructural-resolverとした。関連122試験、型検査、Python27件、台帳validator成功。人物pending8、semantic具体的実装済み5,152、pending107、accepted0。全B4生成gateは残る凍結値8行で停止。詳細は [B4条件消失進捗](../../operations/evidence/2026-09-12-b4-condition-loss-progress.json)。Step3〜5は未完了。

2026-09-12 B4完了: 最後の凍結値8条項を束縛。新規7試験で6能力の実判定確定→実OFF後の閾値/結果保持と、ウパの実損害確定後OFFでも8損害が解決されることを確認。竜士気/真実の効果・損害/ディアEND保持の既存試験も対応付け。部分指定なしの全生成339行が成功し、計画名の character-clauses-bindings.json を適用。全束縛先13ファイル639試験、型検査、Python28件、台帳validator成功でcharacter-semantic pending0。B4 Step3〜5を完了。semantic具体的実装済み5,160、pending99、accepted0で、候補版受入は未完了。詳細は [B4全体検証記録](../../operations/evidence/2026-09-12-b4-complete-progress.json)。次はB5。

### Task B5: 残る個別条項（ability-effect / shared-semantic / その他約 170 行）

**Files:**
- Modify: 該当 `packages/engine/test/*.test.ts`
- Create: `docs/operations/evidence/2026-09-11-remaining-clauses-bindings.json`

- [x] **Step 1: `python3 scripts/ledger_report.py` の pending 内訳を出し、行ごとに (a) 既存 canonical 試験を束縛、(b) 試験追加、(c) `notApplicable`（A7 手順・ユーザー承認済み D4 の範囲内のみ）に分類した一覧を `docs/operations/evidence/2026-09-11-remaining-clauses.md` に書く。D4 以外を `notApplicable` にしない**

- [ ] **Step 2: (b) の試験を追加し実行、(a)(b) の束縛を適用**

Run: `python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-remaining-clauses-bindings.json && python3 scripts/validate_runtime_coverage.py | cut -c1-160 && python3 scripts/ledger_report.py`
Expected: `valid: true`、semantic の pending が 0、`implementedRelatedOnly` 0、`implementedNoTests` 0

- [ ] **Step 3: コミット**

```bash
git add packages data docs && git commit -m "test,data: 残る個別条項を束縛し、semantic pendingを解消する"
```

2026-09-12 B5開始: 開始時99行の暫定分類一覧を作成し、確認済みの撃破報酬/吸収回復11行を束縛。既存2宣言を静的it.eachへ変換し、4ケースをASTで識別可能にした。対象24試験、型検査、台帳validator成功。具体的実装済み5,171、semantic pending88、accepted0。残86行は直接assertionの確認/追加対象、D4c 2行はA7補足に従いB8直前までpending。分類のbは暫定でStep1〜3は未完了。詳細は [B5報酬進捗](../../operations/evidence/2026-09-12-b5-rewards-progress.json)。

2026-09-12 B5影跳び: 6条項を追加束縛。新規3試験で精神7−2の成功/失敗境界と、子攻撃の別在席対象への原子的拒否→元攻撃者への実攻撃を確認。実辞退・費用・初期配置従者無視・間合い拒否の既存試験も対応付け。対象19試験、型検査、台帳validator成功。具体的実装済み5,177、semantic pending82、accepted0。B5束縛計17行、残通常80行とD4c 2行。詳細は [B5影跳び進捗](../../operations/evidence/2026-09-12-b5-shadow-progress.json)。Step1〜3は未完了。

2026-09-12 B5仮想攻撃: アイエル/フレイアード15条項を既存の実宣言・損害処理・取消・間合い枚数・原子的拒否試験へ束縛。射程近/魔法/使用効果4/水3損害・炎5損害、カード不要、公開条件、アイエル追加間合いを能力別tupleで確認。対象15試験、台帳validator成功。コード変更なし。具体的実装済み5,192、semantic pending67、accepted0。B5束縛計32行、残通常65行とD4c 2行。詳細は [B5仮想攻撃進捗](../../operations/evidence/2026-09-12-b5-virtual-progress.json)。Step1〜3は未完了。

2026-09-12 B5死亡時能力・悲しき愛: チャム3行とウパ4行を実試験へ束縛。実死亡時の本人限定選択/適格対象/追加カード不要、実公開アーネスへの精神加算、実身代わり・取消の一回制限、実同時死亡→復活後の精神報酬・使用済み保持を確認。対象27試験、台帳validator成功。コード変更なし。具体的実装済み5,199、semantic pending60、accepted0。B5束縛計39行、残通常58行とD4c 2行。詳細は [B5死亡時能力進捗](../../operations/evidence/2026-09-12-b5-death-gifts-progress.json)。Step1〜3は未完了。

2026-09-12 B5距離・間合い: チャム/ティア/ランカスター7条項を束縛。新規2ケースで実反撃への間合い選択時は踏み込み機会なし・不正提出拒否、辞退時は実踏み込みで反撃損害が入る対照を確認。接近/離脱/戦闘の必要2枚、1枚費用、地魔法免疫の既存試験も対応付け（戦士かつ地属性の除外のみ構造試験）。対象33試験、型検査、台帳validator成功。具体的実装済み5,206、semantic pending53、accepted0。B5束縛計46行、残通常51行とD4c 2行。詳細は [B5距離進捗](../../operations/evidence/2026-09-12-b5-distance-progress.json)。Step1〜3は未完了。

2026-09-12 B5祝福・能力禁止: リーア5条項/ヴァンミール4条項を束縛。新規3ケースで実手番の精神8−5境界（合計3成功/4失敗）、複数の実禁止対象から単一選択解除、別原因の禁止保持を確認。実取消後の回数消費/次手番回復/通常行動保持/死亡前失効を既存試験へ対応付け。別原因禁止・公開秘匿例外・不在/死亡再登場の直接境界は構造試験と明記。対象57試験、型検査、台帳validator成功。具体的実装済み5,215、semantic pending44、accepted0。B5束縛計55行、残通常42行とD4c 2行。詳細は [B5祝福・禁止進捗](../../operations/evidence/2026-09-12-b5-suppression-progress.json)。Step1〜3は未完了。

2026-09-12 B5属性・攻防条件: フューリー4条項、アーネス2条項、真実の力3条項を束縛。新規4ケースで地槍/風矢/氷矢/炎矢の実選択時に効果Lv4→5、辞退時4、使用Lv4と支払い保持を確認。実攻防の公開男性条件、GOODと公開ウーノス/ガイナス対象条件は既存試験へ対応付け。対象104試験、型検査、台帳validator成功。具体的実装済み5,224、semantic pending35、accepted0。B5束縛計64行、残通常33行とD4c 2行。詳細は [B5属性・攻防進捗](../../operations/evidence/2026-09-12-b5-eligibility-progress.json)。Step1〜3は未完了。

2026-09-12 B5剣・風と斬: アスフェルト6条項を束縛。新規3ケースで実転移による防御対象を斬から除外（0/24損害）し、剣/風の実攻撃が従者破壊能力を選べることを確認。間合いの実支払履歴、多段の発別適用、初期配置兵士のHP控除前の倍加は既存試験へ対応付け（null剣の算術のみ構造試験）。対象83試験、型検査、台帳validator成功。具体的実装済み5,230、semantic pending29、accepted0。B5束縛計70行、残通常27行とD4c 2行。詳細は [B5剣・斬進捗](../../operations/evidence/2026-09-12-b5-sword-progress.json)。Step1〜3は未完了。

2026-09-12 B5精神防御: レスター/ガドューラ/ディアのゾロ目取消・停止・期限9条項と、ガーウィンの指定3能力保護/ガドューラの指定2能力取消を束縛。新規3ケースで実席順一周まで停止保持、攻撃者席到来時の無判定解除と行動再開を確認。実グリフォンの未処理発取消、他対象継続、保護の通常判定結果保持は既存試験へ対応付け。対象246試験、型検査、台帳validator成功。具体的実装済み5,244、semantic pending15、accepted0。B5束縛計84行、残通常13行とD4c 2行。詳細は [B5精神防御進捗](../../operations/evidence/2026-09-12-b5-mental-progress.json)。Step1〜3は未完了。

2026-09-12 B5通常条項完了: 最後の通常13条項を束縛。新規4ケースで実覚醒の改心選択/辞退（ディア・ヨーツルム）と実変身後の盾の戦士Lv6に対する効果6/7境界を確認。強制制限・リーア近距離/自攻撃外・C04は既存実試験へ対応付け。対象210試験に加えてB5全束縛先20ファイル818試験、型検査、台帳validator成功。全99行の分類完了としてStep1を完了。通常97行は具体的実装済みで、残るD4c 2行はA7補足どおりB8直前に適用し、その時点でStep2〜3のpending0条件を閉じる。具体的実装済み5,257、semantic pending2（action-effect）、accepted0。詳細は [B5通常条項全体検証](../../operations/evidence/2026-09-12-b5-ordinary-complete-progress.json)。次はB6。

### Task B6: D2 無制限回収の秘匿比較と D3 同一席2権利の束縛

**Files:**
- Modify: `packages/engine/test/reclaim-reservations.test.ts`（既存の paired-world 比較に unlimited 世界を追加）
- Read: `apps/worker/test/fixtures/shared-reclaim-scenarios.ts`、`docs/operations/evidence/2026-09-09-r5-shared-reclaim.json`
- Create: `docs/operations/evidence/2026-09-11-r4-d2-d3-bindings.json`

- [x] **Step 1: 失敗する試験を書く**

```ts
it('All-pass zero base extra and unlimited worlds with a hidden right holder share one public transcript', () => {
  const worlds = (['none', 'base', 'extra', 'unlimited'] as const).map(right => runSharedReclaimWorld({hiddenRight: right, passEverySeat: true}));
  const publicOf = (w: typeof worlds[number]) => w.nonOwnerViews.map(v => JSON.stringify({window: v.activeWindow, reclaim: v.reclaimView, revision: v.revision, events: v.publicEvents}));
  for (const world of worlds.slice(1)) expect(publicOf(world)).toEqual(publicOf(worlds[0]!));
  for (const world of worlds) expect(world.finalDiscardIds).toEqual(worlds[0]!.finalDiscardIds);
});

it('Unlimited right used after reveal answers in seat order, once per event, and leaves the base slot intact', () => {
  const world = runSharedReclaimWorld({hiddenRight: 'unlimited', passEverySeat: false, revealAndUse: true});
  expect(world.responseOrder).toEqual(world.publicSeatOrderFrom(world.originalUserSeat));
  expect(world.unlimitedAttempts).toBe(1);
  expect(world.baseSlotSpent).toBe(false);
  expect(world.revealAdvancedCursor).toBe(false);
});
```

`runSharedReclaimWorld` は既存の paired-world 試験が使うヘルパー名に合わせる（`reclaim-reservations.test.ts` の該当 `it` を開いて実名に置換する）。無制限権の所持者は R4計画B2 の一覧（例: 公開レスターの月の竪琴・魔詩・呪歌）から、fixture に既にいる人物を使う。

- [x] **Step 2: 失敗→実装（runtime変更が不要なら試験のみ）→成功**

Run: `pnpm exec vitest run packages/engine/test/reclaim-reservations.test.ts`
Expected: 全件成功

- [x] **Step 3: R4計画の該当2行（D2/D3 で文言を修正済み）に対応する台帳行を特定し、上記2件とレスター同一席の既存3件（Engine/DO/browser）を束縛して適用、コミット**

```bash
git add packages data docs && git commit -m "test,data: 無制限回収の秘匿比較と同一席2権利を台帳へ束縛する"
```

2026-09-12 B6試験追加: D2の2試験を reclaim-reservations に追加。単一実カードで追加/無制限の双方を持つ人物組合せがないため、各4世界で弓と魔詩の実使用をそれぞれ比較（架空の能力継承なし）。カードごとに非所有者全投影・revision・event ID・イベント・4席PASS・最終捨て札が一致。実レスター公開でcursor保持、無制限選択1回、重複拒否、通常枠未消費と1枚回収を確認。対象14試験、型検査、台帳validator成功。runtime変更不要。Step1〜2完了、Step3の台帳行対応付けと既存Engine/DO/browser束縛は継続中。詳細は [B6秘匿試験進捗](../../operations/evidence/2026-09-12-b6-privacy-progress.json)。

2026-09-12 B6完了: D2はG11の公開時計回り回答/公開時席維持・無制限通常枠保持・同機会再試行禁止、D3はG11の同一席競合終了へ対応付け、既存束縛を保った4行のファイルを適用。追加Engine2試験と既存レスターbase/printedのEngine/Worker/browserを束縛。Engine42、Worker2、browser2、型検査、台帳validator成功。既存bunが8787を占有していたため、E2EにPLAYWRIGHT_PORT設定（既定8787）を追加し18787で確認。ChromiumのMachポート制約は承認済みローカル実行で解消。Step3完了。詳細は [B6全体検証](../../operations/evidence/2026-09-12-b6-complete-progress.json)。候補受入ではなく、次はB7。

### Task B7: Worker / browser 側の必要束縛

R4/R5/R6 計画で「Worker毎操作保存再送・browser全席reload」を要求する条項のうち、台帳行が Engine 試験だけを持つものに `worker-persistence` / `browser` 試験を追加束縛する。

- [x] **Step 1: 台帳で `kind` に `worker-persistence` と `browser` を持たない semantic 行のうち、manifest の `source` テキストに「保存」「再接続」「投影」「画面」「reload」を含む行を列挙する**

- [x] **Step 2: 対応する既存 `apps/worker/test/room-*.test.ts` と `tests/e2e/*.spec.ts` の試験を束縛する（新規試験は、既存のDO/browser fixtureに該当シナリオが無い場合だけ追加する）。適用・validator・コミット**

```bash
git add apps tests data docs && git commit -m "data: 保存・投影・画面条項へWorker/browser試験を追加束縛する"
```

2026-09-12 B7開始: source参照をmanifestのquoteまで解決し、指定語を含みWorker/browserの片方以上を欠くsemantic39行を [初期一覧](../../operations/evidence/2026-09-12-b7-inventory.md)（JSONに元文・不足種別）へ列挙、Step1完了。禁止の同機会再試行、非公開対象表示、C04取消済み再試行禁止の3行に実DO保存再送とbrowser操作/reloadを追加束縛。Worker対象2ファイル24試験（Engine直接呼出しも含むため、worker-persistence束縛は実DOケースだけ）、browser対象3試験、台帳validator成功。残36行でStep2は継続。コード変更なし。詳細は [B7初回進捗](../../operations/evidence/2026-09-12-b7-first-progress.json)。

2026-09-12 B7続行: G11の間合い使用時の公開処分機会、手番の術の公開回収機会、任意時点カードの所持回収の3行へ既存DO/browser試験を追加束縛。Worker41試験・browser3試験・台帳validator成功。不足33行、Step2継続。コード変更なし。詳細は [B7回収条項進捗](../../operations/evidence/2026-09-12-b7-reclaim-progress.json)。

2026-09-12 B7続行: G11の仮想刃・仮想親衛隊の物理回収禁止とS29保存則の3行を追加束縛。既存browser試験を固定名にし、全席reload後の手札・回収予約等のassertionを追加。Worker13試験・browser5試験・型チェック・台帳validator成功。不足30行、Step2継続。詳細は [B7仮想カード進捗](../../operations/evidence/2026-09-12-b7-virtual-progress.json)。

2026-09-12 B7続行: G11の配置済み従者死亡時の通常回収へDO/browser試験を追加束縛。既存の名前指定死亡回収は無制限能力権で通常権と異なるため、シャリアの実配置・攻撃・死亡・正体公開から通常回収するfixtureを追加。Worker毎操作保存再送1試験・browser全席reload1試験・型チェック・台帳validator成功。不足29行、Step2継続。詳細は [B7従者回収進捗](../../operations/evidence/2026-09-12-b7-follower-progress.json)。

2026-09-12 B7続行: C04対象限定軽減とG14同時各発の従者HP軽減の2行を追加束縛。既存共有攻撃試験をEngine直接呼出しからDO毎操作保存再送へ移し、browser全席reloadを追加。既存3発試験も毎操作保存再送・8席reloadへ拡張。Worker計22試験・browser計2試験・型チェック・台帳validator成功。不足27行、Step2継続。詳細は [B7軽減条項進捗](../../operations/evidence/2026-09-12-b7-defense-progress.json)。

2026-09-12 B7続行: S04のsource/title・source/when・acceptance-correspondenceの3行を追加束縛。既存canonical fixtureで2,3→4,4の丸ごと振り直し・同一roll ID・履歴をbrowser全席reloadで検証し、DOは毎操作保存再送へ拡張。共有試験を参照するG07の宣言ハッシュも再束縛。Worker1試験・browser4試験・型チェック・台帳validator成功。不足24行、Step2継続。詳細は [B7 S04進捗](../../operations/evidence/2026-09-12-b7-s04-progress.json)。

2026-09-12 B7続行: G08効果値確定後の気合拒否へ既存DO/browser試験を追加束縛。browserは全席reload後の効果Lv6・気合の選択肢なし・手札不変と完了時damage5を追加検証。Worker4試験・browser4試験・型チェック・台帳validator成功。不足23行（C16とC04）、Step2継続。詳細は [B7 G08進捗](../../operations/evidence/2026-09-12-b7-g08-progress.json)。

2026-09-12 B7続行: C16公開情報だけの対象候補1行を追加束縛。既存複数対象禁止シナリオで非公開リーアを候補に含め、実正体公開後だけ除外することをDO毎操作保存再送とbrowser全席reloadで確認。儀式後は通常行動消費済みのためno-main-actionの束縛は保留。共有G09参照を更新し、Worker7試験・browser2試験・型チェック・台帳validator成功。不足22行、Step2継続。詳細は [B7 C16候補進捗](../../operations/evidence/2026-09-12-b7-c16-candidates-progress.json)。

2026-09-12 B7続行: C16禁止が通常行動を消費しない条項を追加束縛。儀式後から実コマンドで一巡し、次の自分のactionで禁止を宣言・解決してもPASS_ACTIONが受理されるDO/browserケースを追加。Worker毎操作保存再送・browser全席reloadを含む既存全体8/3試験、型チェック、台帳validator成功。不足21行、Step2継続。詳細は [B7通常行動進捗](../../operations/evidence/2026-09-12-b7-main-action-progress.json)。

2026-09-12 B7続行: C16祝福の指定済み公開状態候補1行を追加束縛。既存DO成功/失敗ケースに候補B限定と未指定Aの拒否・再送不変を追加し、browser全席reload後の選択肢が指定済みB/Dだけであることを確認。共有G09参照更新、Worker8試験・browser3試験・型チェック・台帳validator成功。不足20行、Step2継続。詳細は [B7祝福候補進捗](../../operations/evidence/2026-09-12-b7-blessing-candidates-progress.json)。

2026-09-12 B7続行: C16非公開対象による拒否なし・非公開免除対象の同一宣言transcriptの2行を追加束縛。既存DO比較に対応する2卓browser比較を追加し、通常シン/非公開リーアへ実宣言・各応答後の外部3席完全ビューが同一（独立player IDだけ正規化）、全8席reload後も同一で本人の適用だけ異なることを確認。Worker8試験・browser1試験・型チェック・台帳validator成功。不足18行、Step2継続。詳細は [B7非公開対象進捗](../../operations/evidence/2026-09-12-b7-hidden-target-progress.json)。

2026-09-12 B7続行: C16同一指定のみの拒否・指定累積の2行を追加束縛。実祝福の新回答機会でBのみ再指定を拒否・状態不変、Dのみ追加して元B指定を保持する既存DOケースを拡張し、同操作のbrowser全席reloadを追加。Worker8試験・browser1試験・型チェック・台帳validator成功。不足16行、Step2継続。詳細は [B7指定累積進捗](../../operations/evidence/2026-09-12-b7-designation-progress.json)。

2026-09-12 B7続行: C16自己指定後の追加宣言不可1行を追加束縛。既存fixtureから実自己指定・四席一巡後の新しい自手番へ進み、DOで宣言拒否・保存再送不変、browser全席reloadで自己禁止とボタン不在を確認。共有手番進行helperの既存ケースも含めWorker9試験・browser6試験・型チェック・台帳validator成功。不足15行、Step2継続。詳細は [B7自己指定進捗](../../operations/evidence/2026-09-12-b7-self-ban-progress.json)。

2026-09-12 B7続行: C16空・重複・不存在対象拒否1行を追加束縛。既存DO不正対象ケースを拡張し、browser実WSでINVALID_COMMAND/INVALID_ACTION、各拒否後の保存状態・全席reloadビュー不変、最後に有効指定が成功することを確認。Worker9試験・browser1試験・型チェック・台帳validator成功。不足14行、Step2継続。詳細は [B7不正対象進捗](../../operations/evidence/2026-09-12-b7-invalid-target-progress.json)。

2026-09-12 B7続行: C16再指定で有効な祝福が消えない条項1行を追加束縛。既存成功ケースを実C/D手番進行→次のヴァンミール手番のA/B指定まで延長し、DO祝福記録完全一致、B解除維持・新A禁止、browser全席reload後の解除表示を確認。共有G09参照更新、Worker9試験・browser1試験・型チェック・台帳validator成功。不足13行、Step2継続。詳細は [B7再指定進捗](../../operations/evidence/2026-09-12-b7-redesignation-progress.json)。

2026-09-12 B7続行: C16祝福元のG15死亡入口失効1行を追加束縛。残HP1と弓を用意したfixtureで実禁止・祝福・次手番致死攻撃を行い、pending-deathで手札廃棄前に祝福消滅・対象禁止復帰をDO毎操作再送/browser全席reloadで確認。Worker10試験・browser1試験・型チェック・台帳validator成功。不足12行、復活条項は別途継続。詳細は [B7祝福死亡進捗](../../operations/evidence/2026-09-12-b7-blessing-death-progress.json)。

2026-09-12 B7続行: C16復活で旧祝福が戻らない・発生元の生世代保存の2行を追加束縛。既存canonical-lia-life DOケースに対応するbrowserを追加し、実死亡→復活→再配置後も対象禁止が残り、新生での再祝福だけ解除することを全席reloadで確認。DOは新lifeIdと保存sourceLifeIdを確認。Worker1試験・browser1試験・型チェック・台帳validator成功。不足10行、Step2継続。詳細は [B7祝福復活進捗](../../operations/evidence/2026-09-12-b7-blessing-revival-progress.json)。

2026-09-12 B7続行: C16 G15で禁止を早期解除しない条項1行を追加束縛。既存canonical-vanmil-death DO試験にbrowser操作を対応させ、実禁止→致死攻撃→pending-deathの全席reloadで指定維持・対象禁止・結果未確定、最終reloadでC13結果を確認。Worker1試験・browser1試験・型チェック・台帳validator成功。不足9行、Step2継続。詳細は [B7ヴァンミール死亡進捗](../../operations/evidence/2026-09-12-b7-vanmil-death-progress.json)。

2026-09-12 B7続行: C16 禁止対象の死亡・復活後も指定を維持する1行を追加束縛。既存DO実遷移へ死亡・新life時の指定一致と毎操作再接続の全席表示比較を追加し、browserでも実禁止→致死攻撃→死亡→復活を操作。各境界で指定維持と全席reload前後一致を確認した。Worker3試験・browser1試験・型チェック・台帳validator成功。不足8行、Step2継続。詳細は [B7禁止対象復活進捗](../../operations/evidence/2026-09-12-b7-target-revival-progress.json)。

2026-09-12 B7続行: C16 非公開免除対象にも同じ祝福判定・解除記録を残し、成功応答で従前の実効禁止を明かさない2行を追加束縛。正体だけ異なる2卓の実禁止→祝福で、Worker ACK/全外部席表示、browser各回答後表示を比較。判定・試行消費・未消費の通常行動・保存解除記録と全席reloadを確認した。Worker1試験・browser1試験・型チェック・台帳validator成功。不足6行、Step2継続。詳細は [B7祝福の秘密情報進捗](../../operations/evidence/2026-09-12-b7-blessing-privacy-progress.json)。

2026-09-12 B7続行: C16 祝福がヴァンミール由来の禁止だけを解除する1行を追加束縛。実禁止→錯乱/催眠の実攻撃→後続手番の祝福で、別原因の能力禁止・停止が残ることを確認。Worker毎操作保存再送・全席投影比較と共通能力ゲート、browser全席reload・保存状態読取りを検証した。Worker2試験・browser2試験・型チェック・台帳validator成功。不足5行、Step2継続。詳細は [B7祝福と状態異常進捗](../../operations/evidence/2026-09-12-b7-blessing-status-progress.json)。

2026-09-12 B7続行: C04 各対象・各ヒット一度と従者開始後の選択禁止1行を追加束縛。実グリフォン2ヒットで巨神の使用/取消後は次ヒットに新機会、従者開始後は解決終了まで選択不可を確認。Worker毎操作保存再送・全席投影と旧機会拒否、browser全席reloadを検証した。Worker3試験・browser3試験・型チェック・台帳validator成功。不足4行、Step2継続。詳細は [B7グリフォン防御進捗](../../operations/evidence/2026-09-12-b7-griffin-defense-progress.json)。

2026-09-12 再開後B7: リーア人物同一性喪失1行を構造的保存境界として追加束縛。実禁止・祝福成立後の人物だけをfixtureで変更し、同じ生世代の旧leaseを保存。DO全席投影と実PASS_ACTIONによる失効・保存再送、browser全席reloadで禁止復帰とlease消滅を確認。通常変身経路の成功ではない。Engine既存35件、Worker1件、browser1件、型検査・台帳validator成功。対応版Chromium 153.0.8010.12の新headlessを採用。不足3行、Step2継続。詳細は [人物同一性境界の証跡](../../operations/evidence/2026-09-12-b7-identity-progress.json)。

2026-09-12 B7完了: 残3行に実錯乱/催眠/裂界7ケースと構造的流浪保存境界3ケースを追加。実禁止・祝福成立後の指定/lease/生世代維持をDO毎操作保存再送とbrowser全席reloadで確認。流浪の発生経路を実コマンドと偽らず、境界入力と明記。人物同一性回帰を含むWorker11件・browser11件、型検査・台帳validator成功。初期39行の不足0、Step2完了。semantic pending2はB8凍結直前まで維持。詳細は [B7完了証跡](../../operations/evidence/2026-09-12-b7-complete-progress.json)。

### Task B8: 候補固定・全実行・昇格・readiness

**Files:**
- Create: `docs/operations/evidence/2026-09-11-candidate-run.json`（Task A4）
- Create: `docs/operations/evidence/acceptance/*.json`（Task A6 が生成）
- Modify: `data/second-edition/runtime-coverage.json`、`packages/catalog/src/selected/readiness.json`
- Create: `scripts/run_candidate.sh`

- [x] **Step 1: 全実行スクリプトを書く**

```bash
#!/usr/bin/env bash
# scripts/run_candidate.sh — run every suite with JSON reports and record one bound run receipt.
set -uo pipefail
mkdir -p .cache/run
python3 scripts/apply_ledger_bindings.py --bindings docs/operations/evidence/2026-09-11-d4-not-applicable-bindings.json || exit 1
python3 scripts/record_runtime_run.py --freeze-output .cache/run/snapshot.json || exit 1
STATUS=0
pnpm exec vitest run --reporter=json --outputFile=.cache/run/unit.json || STATUS=1
pnpm --filter @madou/worker exec vitest run --reporter=json --outputFile=../../.cache/run/worker.json || STATUS=1
pnpm exec playwright test --reporter=json > .cache/run/browser.json || STATUS=1
python3 scripts/record_runtime_run.py \
  --snapshot .cache/run/snapshot.json --vitest .cache/run/unit.json --vitest .cache/run/worker.json --playwright .cache/run/browser.json \
  --command "pnpm exec vitest run" --command "pnpm --filter @madou/worker exec vitest run" --command "pnpm exec playwright test" \
  --exit-code "$STATUS" --output "${1:-docs/operations/evidence/$(date +%F)-candidate-run.json}"
exit "$STATUS"
```

2026-09-12: `scripts/run_candidate.sh` を実装。clean作業木を確認し、D4適用→凍結→全Engine/Web・Worker・browser→run記録を直列実行する。Vitestは同時実行を2 workerに制限し、全件対象を維持。記録失敗も終了1以上で伝播する。現在のブラウザは `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/madou-playwright`、競合回避は `PLAYWRIGHT_PORT=18787` を使う。両envをスクリプト起動に渡す。2nd原本2点は作者配布ページから再取得し、resources/manifest.jsonのSHA-256と照合後に246画像を再生成・検査した。`.serena/` はローカルLSP設定としてgitignoreに追加し、ファイルは維持した。

Worker の vitest 設定が `--outputFile` の相対パスを `apps/worker` 基準で解決することを確認する（`apps/worker/package.json` の test スクリプトと `vitest.config` を見る）。Playwright の JSON reporter は stdout に出るので上記のようにリダイレクトする。

- [x] **Step 2: 作業木が clean であることを確認して全実行（所要時間は長い。`run_in_background` で回し、ログを `.cache/run/candidate.log` に残す）**

Run: `git status --porcelain | wc -l` → 0 を確認し `bash scripts/run_candidate.sh docs/operations/evidence/2026-09-11-candidate-run.json 2>&1 | tee .cache/run/candidate.log`
Expected: 終了0。失敗があれば原因を直し、直したファイルを含む候補で **最初から** 再実行する（run は候補 hash に束縛されるため部分再実行は使えない）。

2026-09-12: 初回全実行は失敗。Engine/Web 7,963成功・1失敗、Worker 2,551成功・7失敗。スリープ記録と失敗時刻が重なり、変更なしの対象再実行はEngine2件・Worker175件成功。Browserは159成功・1失敗時点で修正のため中断（残り未受け入れ）。獣取得後の回収・lifecycle回答を画面から進める手順を追加し、対象Browser8件が成功。詳細は [初回失敗記録](../../operations/evidence/2026-09-12-b8-initial-failure.json)。候補全再実行と昇格は未完了。再実行は `caffeinate -i` で実行中のアイドルスリープを抑える。蓋閉じによるスリープを防ぐものとは扱わない。

- [x] **Step 3: 昇格**

Run: `python3 scripts/promote_ledger.py --run docs/operations/evidence/2026-09-11-candidate-run.json && python3 scripts/validate_runtime_coverage.py --require-accepted | cut -c1-200`
Expected: `valid: true`、`acceptanceRequired: true`。失敗行が出た場合はその行の `tests` が run の `cases` にあるか（タイトル整形・パラメータ）を確認し、束縛を直してから run を再実行する。

- [x] **Step 4: readiness 再生成と catalog 検査**

Run: `python3 scripts/generate_catalog_readiness.py && python3 scripts/generate_catalog_readiness.py --check --require-ready && pnpm verify:catalog`
Expected: `{"valid": true, "ready": true}`、catalog 検査成功

- [x] **Step 5: コミット（M2'）**

```bash
git add data packages/catalog docs scripts && git commit -m "data: 候補を固定し全条項をacceptedへ昇格、readiness ready=true"
```

`readiness.json` と receipt は候補 hash に束縛されるため、この後にソース・試験・データを変更した場合は Step 2〜5 をやり直す。Phase C の変更は試験追加を伴うので、Phase C 完了後に再度 B8 を実行する（Task C5）。

---

2026-09-12 B8第2回全実行は最後まで終了し、Engine 7,964成功・Worker 2,558成功、browser 2,155成功/9失敗/skip 0/flaky 0。browserの所要時間は約4時間8分。失敗は固定ポート2件、回収応答や入れ子の割り込み完了待ち5件、成功分岐を検証するfixtureの乱数設定2件。全失敗の修正案は別環境で個別検証済みで、終了後に本作業木へ適用した。変更されたsemantic束縛4行を更新し、関連browser 55件成功、baseURL設定確認追加後の2件再実行と全型検査も成功。notApplicable 2行は成功した現在候補runが未成立のためvalidatorが拒否しており、昇格・readinessは未完了。詳細は [第2回実行と修正の証跡](../../operations/evidence/2026-09-12-b8-second-progress.json)。

2026-09-13 B8第3回全実行は終了0、Engine 7,964・Worker 2,558・browser 2,164件すべて成功（skip/flaky 0）。昇格は4,633 acceptedに留まり、Vitestタイトル整形の相違と旧related参照3種が原因と判明。整形を実際のVitest表示へ修正し、10条項の旧参照を既存の具体的試験に整理。診断照合はactive 6,536参照／distinct 6,461一致／未一致0。変更後候補の受け入れは未成立のため全semanticをimplemented 5,257／notApplicable 2へ戻し、第4回全実行で再検証する。旧原本と部分昇格receiptは `/private/tmp/madou-b8-third-success/` に保存。詳細は [束縛修正記録](../../operations/evidence/2026-09-13-b8-binding-resolution.json)。

## Phase C: 正式開始と一戦（R7）

2026-09-13 B8第4回全実行は終了0、Engine/Web 7,964・Worker 2,558・browser 2,164件すべて成功（skip/flaky 0）。runの参照6,461件一致、失敗0。昇格も終了0でsemantic 5,257 accepted／2 notApplicableとなった。厳格validatorは終了1でaggregate 825行すべてのcovers未設定を報告。semantic自体の未受け入れエラーは0だが、集約元段落から具体条項への対応が必要であり、readinessは未生成。aggregateのpending状態を維持しながらmanifestのcoversを完成させ、変更後候補の全検証をやり直す。B8全体は未完了。詳細は [第4回進捗](../../operations/evidence/2026-09-13-b8-fourth-progress.json)。

2026-09-13 集約対応開始: T01休息の2段落とT02黒翼天翔剣の印刷条件1段落を既存semantic条項へ対応付けた。休息の上限超過・支払札非返却・構造的最大値変更・死亡予定境界の12件、型検査が成功。aggregate未対応822件。候補変更によりsemanticの現在状態はimplemented 5,257／notApplicable 2へ戻し、第4回受け入れ証跡を `/private/tmp/madou-b8-fourth-success/` に保管。詳細は [集約対応進捗](../../operations/evidence/2026-09-13-aggregate-mapping-progress.json)。

### Task C1: 合法手ボット（Engine）

**Files:**
- Create: `packages/engine/src/bot/legal-commands.ts`, `packages/engine/src/bot/policy.ts`, `packages/engine/src/bot/index.ts`
- Test: `packages/engine/test/bot-legal-commands.test.ts`, `packages/engine/test/bot-full-game.test.ts`
- Read: `packages/engine/src/commands.ts`（Command 共用体）、`packages/engine/src/view.ts`（PlayerView の option 群）、`packages/engine/src/transition.ts`

**Interfaces:**
- `legalCommands(view: PlayerView): Command[]` — 本人の投影だけから、現在その席が送れる候補コマンドを列挙する。秘密情報を使わない。列挙は view の各 `*Options`（`turnCardOptions`, `anytimeCardOptions`, `turnChoiceCardOptions`, `virtualBladeOptions`, `shadowJumpCost`、回答窓の pass 系、setup の `PASS_SETUP`、手番の `START_TURN` / `CHOOSE_DRAW` / `ATTACK` / `CHANT` / `END_TURN` 相当）から作る。
- `choose(view: PlayerView, seed: number): Command` — 決定的方針: (1) 必須選択があればその先頭、(2) 自手番の action 段階で敵に届く攻撃があれば最大ダメージの技、(3) 回答窓は pass 系、(4) それ以外は手番終了。`seed` は同点時のタイブレークにのみ使う。
- `playToOutcome(state: GameState, entropy: Entropy, seed: number, maxSteps = 5000): {state: GameState; steps: number}` — 各席の view に対し `choose` を適用し `transition` を回す。`outcome` が付くか `maxSteps` で止まる。ボットが選んだコマンドが `INVALID_ACTION` になった場合はその view と command を例外に含めて止める（列挙器の不備は隠さない）。

- [x] **Step 1: 失敗する試験を書く**

```ts
// packages/engine/test/bot-legal-commands.test.ts
import {describe, expect, it} from 'vitest';
import {createGame} from '../src/setup.js';
import {transition} from '../src/transition.js';
import {viewFor} from '../src/view.js';
import {legalCommands, choose, playToOutcome} from '../src/bot/index.js';
import {seededEntropy} from './fixtures.js';

describe('legal command enumeration', () => {
  it('every enumerated command is accepted by transition for every seat across a seeded game', () => {
    const entropy = seededEntropy(7);
    let state = createGame([{id: 'A', name: 'A'}, {id: 'B', name: 'B'}, {id: 'C', name: 'C'}, {id: 'D', name: 'D'}], entropy);
    for (let step = 0; step < 300 && !state.outcome; step++) {
      for (const actorId of Object.keys(state.players)) {
        for (const command of legalCommands(viewFor(state, actorId))) {
          const result = transition(state, {actorId, command}, entropy);
          expect(result.ok, `${actorId} ${JSON.stringify(command)}`).toBe(true);
        }
      }
      const next = playOneStep(state, entropy);
      state = next;
    }
  });
});

describe('deterministic play', () => {
  it.each([4, 6, 8, 10])('%i seats reach an outcome within the step budget', count => {
    const players = Array.from({length: count}, (_, i) => ({id: `P${i}`, name: `P${i}`}));
    const {state, steps} = playToOutcome(createGame(players, seededEntropy(count)), seededEntropy(count), count);
    expect(state.outcome).toBeDefined();
    expect(steps).toBeLessThan(5000);
    expect(Object.values(state.players).flatMap(p => [...p.hand, ...p.discard]).length + state.deck.length).toBe(220);
  });
});
```

`seededEntropy` が `fixtures.ts` に無い場合は、`Entropy` 型（`apps/worker/src/rooms/room.ts` の `entropy()` を参照）を満たす決定的PRNG（mulberry32）で追加する。`playOneStep` は `playToOutcome` の1周分を export した関数。220 枚の保存 assert は物理カードの実領域（手札・捨て札・山札・設置・予約）に合わせて修正する（`packages/engine/test` の既存 220 枚検査を流用する）。

- [x] **Step 2: 失敗を確認**

Run: `pnpm exec vitest run packages/engine/test/bot-legal-commands.test.ts`
Expected: モジュール未定義で失敗

- [x] **Step 3: `legal-commands.ts` を実装する**

view の各 option 配列をそのまま Command に写す。判断の必要な箇所（対象選択・カード選択）は option が既に列挙している候補を1つずつ Command 化する。view に無い情報（他人の手札・伏せ人物）は絶対に使わない。`transition` が拒否するコマンドを列挙した場合は Step 1 の試験が失敗するので、拒否理由（`code`）から列挙条件を絞る。

- [x] **Step 4: `policy.ts` と `playToOutcome` を実装し、試験を成功させる**

Run: `pnpm exec vitest run packages/engine/test/bot-legal-commands.test.ts`
Expected: 全件成功。`maxSteps` に達する場合は方針を「攻撃可能なら必ず攻撃」に寄せ、それでも終わらない席数があれば、その状態列を `docs/operations/evidence/2026-09-11-bot-stalemate.json` に保存して原因（合法手の循環か、終了判定の不足か）を切り分ける。終了判定の不足はルール実装の不具合なので engine を直し、R6 の終了判定試験を再実行する。

- [x] **Step 5: 型検査とコミット**

Run: `pnpm typecheck`

```bash
git add packages/engine && git commit -m "engine: 本人投影だけから合法手を列挙する決定的ボットを追加する"
```

### Task C2: e2e Worker の固定entropy と正式START

**Files:**
- Modify: `apps/worker/test/fixtures/e2e-worker.ts`（`__test/rooms/:id/entropy` で seed を保存し `commandEntropy()` が seed 済み PRNG を返す）
- Modify: `apps/worker/test/lobby.test.ts`（既存 R7 4/6/8/10 START 試験に「seed 設定後の正式 START が `RULESET_NOT_READY` ではなく成功する」ケースを追加）
- Read: `apps/worker/src/rooms/room.ts` 200〜205 行（START gate）

- [x] **Step 1: 失敗する試験を書く（lobby.test.ts）**

```ts
it.each([4, 6, 8, 10])('R7 %i seats start a real game through the normal START command when readiness is ready', async count => {
  const room = await createRoomWithSeats(count);
  for (const seat of room.seats) await room.command(seat, {type: 'READY', ready: true});
  const started = await room.command(room.owner, {type: 'START'});
  expect(started.ok).toBe(true);
  const snapshot = await room.snapshot(room.owner);
  expect(snapshot.game?.phase).toBe('setup');
  expect(Object.keys(snapshot.game!.players)).toHaveLength(count);
  const late = await room.joinNewSession();
  expect(late.ok).toBe(false);
  const stale = await room.command(room.owner, {type: 'START'}, {expectedRevision: 0});
  expect(stale.ok).toBe(false);
});
```

`createRoomWithSeats` 等は lobby.test.ts の既存ヘルパー名に合わせる。この試験は Task B8 で `readiness.ready=true` になって初めて成功する。それまでは `RULESET_NOT_READY` で失敗するのが正しいので、B8 完了後に実行する。

- [x] **Step 2: e2e-worker に seed エンドポイントを追加**

```ts
// e2e-worker.ts の __test ルート分岐に追加
if (match[2] === 'entropy' && request.method === 'POST') {
  const {seed} = await request.json() as {seed: number};
  this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS browser_fixture_seed (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), seed INTEGER NOT NULL, calls INTEGER NOT NULL)');
  this.ctx.storage.sql.exec('INSERT OR REPLACE INTO browser_fixture_seed (singleton, seed, calls) VALUES (1, ?, 0)', seed);
  return new Response(null, {status: 204});
}
```

`commandEntropy()` は seed テーブルがあれば `calls` を進めながら mulberry32 で `dice` / `shuffle` を生成する（`Entropy` 型の全フィールドを埋める）。正規表現 `(scenario|game)` に `entropy` を加える。本番エントリポイント（`apps/worker/src/index.ts`）には export しない。

- [x] **Step 3: Worker 試験を実行しコミット**

Run: `pnpm --filter @madou/worker exec vitest run test/lobby.test.ts`
Expected: readiness 未成立の間は新規ケースだけ `RULESET_NOT_READY` で失敗し、他は成功。B8 後に全件成功。

```bash
git add apps/worker && git commit -m "worker(test): e2e卓のentropyをseedで固定し、正式STARTの人数別試験を追加する"
```

### Task C3: `tests/e2e/full-game.spec.ts` — 4/6/8/10 席の一戦完走

**Files:**
- Create: `tests/e2e/full-game.spec.ts`, `tests/e2e/bot-client.ts`
- Read: `tests/e2e/helpers.ts`（`tableFixture`, `observe`, `passUntil`）、`apps/web/src/game/commands.ts`（WS envelope の作り方）、`packages/protocol/src`（`parseClientEnvelope`）

**Interfaces:**
- `bot-client.ts`: `class BotClient { constructor(baseURL: string, cookie: string, roomId: string); connect(): Promise<void>; view(): PlayerView | null; send(command: Command): Promise<{ok: boolean; code?: string}>; close(): void }`。Node の `WebSocket`（Playwright の `request` コンテキストから Cookie を取り出して接続）で、サーバー投影を受信し `expectedRevision` と `commandId`（UUID）を自動で付ける。
- 席は Playwright のブラウザコンテキストでログイン・参加・準備完了・START までを **画面操作** で行い、その後の対局は `BotClient` が同じ Cookie で WS から進める。ブラウザ側は各席 1 ページを開いたままにし、対局終了後に全席 reload して結果表示を確認する。

- [x] **Step 1: 失敗する試験を書く**

```ts
import {test, expect} from '@playwright/test';
import {tableFixture} from './helpers';
import {BotClient} from './bot-client';
import {choose} from '@madou/engine/bot';

for (const count of [4, 6, 8, 10]) {
  test(`${count} seats start through the normal API and play to an outcome with fixed entropy`, async ({browser, request}) => {
    test.setTimeout(20 * 60 * 1000);
    const table = await tableFixture(browser, request, undefined, count);
    try {
      expect((await request.post(`/__test/rooms/${table.roomId}/entropy`, {data: {seed: count}})).status()).toBe(204);
      for (const page of table.pages) { await page.goto(table.url); await page.getByRole('button', {name: '準備完了', exact: true}).click(); }
      await table.pages[0]!.getByRole('button', {name: '対戦を始める', exact: true}).click();
      for (const page of table.pages) await expect(page.getByRole('region', {name: '自分の手札', exact: true})).toBeVisible();
      const bots = await Promise.all(table.contexts.map(async (context, i) => {
        const cookie = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
        const bot = new BotClient('http://localhost:8787', cookie, table.roomId); await bot.connect(); return bot;
      }));
      let steps = 0;
      while (steps < 5000) {
        const views = bots.map(b => b.view());
        if (views[0]?.outcome) break;
        let acted = false;
        for (const [i, bot] of bots.entries()) {
          const view = views[i]; if (!view || !view.canAct) continue;
          const result = await bot.send(choose(view, count));
          expect(result.ok, `seat ${i} step ${steps} ${result.code}`).toBe(true);
          acted = true; steps++; break;
        }
        if (!acted) await new Promise(r => setTimeout(r, 50));
      }
      expect(bots[0]!.view()?.outcome).toBeDefined();
      for (const page of table.pages) { await page.reload(); await expect(page.getByRole('status', {name: '対戦結果'})).toBeVisible(); }
      const stale = await bots[0]!.send({type: 'END_TURN'} as never);
      expect(stale.ok).toBe(false);
      bots.forEach(b => b.close());
    } finally { await table.close(); }
  });
}
```

`view.canAct`（自席が今送れる状態か）と `view.outcome` は `PlayerView` の実フィールド名に合わせる。「対戦結果」の role/name は `apps/web/src/game` の終了表示コンポーネントの実装に合わせ、無ければ `Board.tsx` に `role="status" aria-label="対戦結果"` の表示を追加する（勝者名と自席の結果を出す）。

- [x] **Step 2: `bot-client.ts` を実装し、試験を実行**

Run: `pnpm exec playwright test tests/e2e/full-game.spec.ts`
Expected: 4 件成功。合計時間を記録する。

- [x] **Step 3: 型検査（e2e tsconfig）とコミット**

Run: `pnpm typecheck:e2e`

```bash
git add tests apps/web && git commit -m "e2e: 正式STARTからの4/6/8/10席の一戦を固定entropyで完走する"
```

### Task C4: `tests/e2e/failure-recovery.spec.ts` — 全員切断・未ACK再送・終了後再読込・合意終了

**Files:**
- Create: `tests/e2e/failure-recovery.spec.ts`
- Read: `tests/e2e/reconnect.spec.ts`（既存の切断復帰の書き方）、`apps/worker/test/room-lifecycle.test.ts`（合意終了 `CLOSE` 系コマンド名）

- [x] **Step 1: 失敗する試験を書く（4席・seed 固定・50手進めた状態から）**

```ts
test('all seats disconnect mid-game, the table survives, and an unacknowledged command is not applied twice', async ({browser, request}) => {
  // 1. Task C3 と同じ手順で 4 席を開始し、bot で 50 手進める
  // 2. 全 BotClient を close し、全ページを閉じる（context.close）
  // 3. 新しい context で同じ Cookie を使って再ログインせず /rooms/:id を開く → 手札 region が見える、revision が同じ
  // 4. bot を再接続し、同じ commandId で同じコマンドを 2 回送る → 2 回目は ACK が同じ revision を返し状態が変わらない（snapshot API で比較）
  // 5. 終了まで進め、全席 reload → 結果表示。その後「卓を閉じる」に全員が同意 → 卓一覧から消える
});
```

コメントの各段階を実コードにする。`commandId` の再送は `BotClient.send(command, {commandId})` で指定できるようにする（Task C3 の `send` にオプション引数を追加）。

- [x] **Step 2: 実行・コミット**

Run: `pnpm exec playwright test tests/e2e/failure-recovery.spec.ts`
Expected: 成功

```bash
git add tests && git commit -m "e2e: 全員切断・未ACK再送・終了後再読込・合意終了を確認する"
```

### Task C5: R7 候補の固定と全検査（M3'）

- [x] **Step 1: 完成計画 R7 の4項目を、上記の証跡（lobby.test.ts の R7 ケース、full-game.spec.ts、failure-recovery.spec.ts）へのリンク付きで `[x]` にする。C1〜C4 で追加した試験のうち台帳の semantic 条項に対応するもの（正式START・全員切断・再送）は束縛ファイル `docs/operations/evidence/2026-09-11-r7-bindings.json` で束縛する。対応する semantic 行は無く `bindings` は空。第4項目（全検査）は Step 2 の B8 再実行が残る。**

- [x] **Step 2: Task B8 の Step 2〜5 を再実行する（候補が変わったため）**

Run: `bash scripts/run_candidate.sh docs/operations/evidence/2026-09-11-candidate-run.json && python3 scripts/promote_ledger.py --run docs/operations/evidence/2026-09-11-candidate-run.json && python3 scripts/validate_runtime_coverage.py --require-accepted | cut -c1-160 && python3 scripts/generate_catalog_readiness.py && pnpm verify:catalog && pnpm verify:assets && pnpm typecheck && pnpm build`
Expected: 全て終了0、`ready: true`

- [x] **Step 3: 候補記録を書く**

`docs/operations/evidence/2026-09-11-release-candidate.md` に: コミットID、`git status --porcelain` が空であること、run receipt のパスと sha256、readiness の sha256、台帳の statuses、`pnpm build` 成果物（`apps/web/dist` と Worker bundle）の sha256 一覧（`find apps/web/dist -type f | sort | xargs shasum -a 256`）。

- [x] **Step 4: コミット**

```bash
git add docs data packages/catalog && git commit -m "docs,data: R7候補を固定し、全条項accepted・正式START・一戦の証跡を記録する"
```

---

## Phase D: Cloudflare 公開（R8）

### Task D1: 認証（ユーザー操作）

- [x] **Step 1: ユーザーがこのセッションで `! pnpm --filter @madou/worker exec wrangler login` を実行し、ブラウザで承認する。エージェントは `pnpm --filter @madou/worker exec wrangler whoami` の終了コードだけを確認し、アカウント名・IDを文書に書かない**

Expected: 終了0

### Task D2: staging リソース作成と設定

**Files:**
- Modify: `apps/worker/wrangler.jsonc`（`env.staging.d1_databases[0].database_id`, `env.production.d1_databases[0].database_id`）
- Modify: `docs/operations/deploy.md`（実施記録）

- [x] **Step 1: D1 を作成し UUID を設定する**

```bash
pnpm --filter @madou/worker exec wrangler d1 create madou-senki-staging
pnpm --filter @madou/worker exec wrangler d1 create madou-senki-production
```

出力の `database_id` を `wrangler.jsonc` の各 env に書く（UUID は秘密値ではないので設定ファイルに入れてよい。アカウントIDは書かない）。

- [x] **Step 2: migration と dry-run**

```bash
pnpm --filter @madou/worker exec wrangler d1 migrations apply DB --remote --env staging
pnpm --filter @madou/worker exec wrangler deploy --env staging --dry-run --outdir dist-staging
```

Expected: 両方終了0

- [ ] **Step 3: コミット**

```bash
git add apps/worker/wrangler.jsonc && git commit -m "worker: staging/productionのD1を設定する"
```

### Task D3: staging 配備と実測

**Files:**
- Create: `tests/remote/smoke.spec.ts`（`PLAYWRIGHT_BASE_URL` で対象 origin を切り替える。`webServer` を使わない別 config `playwright.remote.config.ts`）
- Create: `docs/operations/evidence/2026-09-11-staging.md`

- [ ] **Step 1: 配備**

```bash
pnpm build && pnpm --filter @madou/worker exec wrangler deploy --env staging
```

出力の Worker URL（`*.workers.dev`）を staging origin として記録する。

- [ ] **Step 2: リモート smoke（fixture 無し）を書いて実行する**

```ts
// tests/remote/smoke.spec.ts
import {test, expect} from '@playwright/test';
test('invite, ready, start and reload on the remote origin', async ({browser}) => {
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  for (const [i, page] of pages.entries()) { await page.goto('/'); await page.getByLabel('表示名').fill(`遠隔${i}`); await page.getByRole('button', {name: 'はじめる', exact: true}).click(); }
  const owner = pages[0]!;
  await owner.getByLabel('卓名', {exact: true}).fill('staging確認'); await owner.getByLabel('招待限定', {exact: true}).check();
  await owner.getByRole('button', {name: '卓を作る', exact: true}).click();
  await owner.getByRole('button', {name: '招待リンクを発行', exact: true}).click();
  const link = await owner.getByLabel('招待リンク', {exact: true}).inputValue();
  for (const page of pages.slice(1)) { await page.goto(link); await page.getByRole('button', {name: 'この卓に参加する', exact: true}).click(); }
  for (const page of pages) await page.getByRole('button', {name: '準備完了', exact: true}).click();
  await owner.getByRole('button', {name: '対戦を始める', exact: true}).click();
  for (const page of pages) await expect(page.getByRole('region', {name: '自分の手札', exact: true})).toBeVisible();
  await pages[2]!.reload(); await expect(pages[2]!.getByRole('region', {name: '自分の手札', exact: true})).toBeVisible();
  await Promise.all(contexts.map(c => c.close()));
});
```

Run: `PLAYWRIGHT_BASE_URL=<staging origin> pnpm exec playwright test -c playwright.remote.config.ts`
Expected: 成功。fixture 投入 API（`/__test`）は本番エントリポイントに無いので、`fetch('<origin>/__test/rooms/x/scenario')` が 404 であることも smoke で確認する。

- [ ] **Step 3: DO 休止復帰**

上記の卓を開始後、全ブラウザを閉じて **15 分以上** 待つ（`Monitor` か `sleep 960` を `run_in_background` で）。その後同じ Cookie で `/rooms/:id` を開き、手札 region と revision が保存時と一致することを確認。結果を `2026-09-11-staging.md` に記録。

- [ ] **Step 4: 再配備中の試合維持**

対局中に `wrangler deploy --env staging` をもう一度実行し、配備前後で同じ卓に同じ revision で復帰できることを確認する。

- [ ] **Step 5: 負荷試験（10卓×10人）**

`scripts/load_test.ts`（Node、`tsx` で実行）: 100 セッションを作成（`POST /api/sessions`）、10 卓を作り各 10 人参加・準備・START、各席が `BotClient`（Task C3）で 200 手ずつ進める。1 手ごとの ACK 往復時間を記録し、p50/p95/p99、失敗率、切断回数を JSON に出す。

Run: `PLAYWRIGHT_BASE_URL=<staging origin> pnpm exec tsx scripts/load_test.ts > docs/operations/evidence/2026-09-11-staging-load.json`
Expected: 失敗率 0、p95 を記録。Cloudflare ダッシュボードの使用量（Requests / DO duration）を数値で `2026-09-11-staging.md` に写す（料金の推定はしない）。

- [ ] **Step 6: コミット**

```bash
git add tests scripts playwright.remote.config.ts docs && git commit -m "ops: stagingの配備・休止復帰・再配備・負荷の実測を記録する"
```

### Task D4: production 配備（M4）

- [ ] **Step 1: 候補が staging と同一であることを確認**

Run: `git status --porcelain | wc -l` → 0、`git rev-parse HEAD` が Task C5 の候補記録のコミットIDと一致（Task D2/D3 のコミットは `wrangler.jsonc` と tests/remote・docs のみなので、`candidate_files` の対象外である `docs` 以外の差分が無いことを `git diff <候補コミット> HEAD --stat -- packages apps/web apps/worker/src data scripts tests/e2e` で確認する。`apps/worker/wrangler.jsonc` の UUID 追加は候補 hash を変えるので、D2 の後に Task C5 Step 2 の全実行を **もう一度** 行い、その receipt を production 候補とする）

- [ ] **Step 2: 配備**

```bash
pnpm --filter @madou/worker exec wrangler d1 migrations apply DB --remote --env production
pnpm --filter @madou/worker exec wrangler deploy --env production
```

- [ ] **Step 3: production smoke**

Run: `PLAYWRIGHT_BASE_URL=<production origin> pnpm exec playwright test -c playwright.remote.config.ts`
Expected: 成功

- [ ] **Step 4: 記録**

`docs/operations/deploy.md` の「候補と配備先の記録」に: 候補コミットID、run receipt sha256、readiness sha256、Worker 名、D1 UUID、公開 origin、配備ID、実施日時、既知の制限（招待制、対人評価未実施）、復旧方法（recovery.md へのリンク）。`docs/operations/playtest-results.md` に「公開後の対人記録（M5）待ち」の見出しを作る。

- [ ] **Step 5: コミットと PR**

```bash
git add docs && git commit -m "ops: productionへ配備し、候補・配備先・既知の制限を記録する"
```

`worktree-release-run` から `main` への PR を作る（`/pr`）。本文に M2'/M3'/M4 の証跡リンクと、M5 が未実施であることを書く。

### Task D5: 公開後（M5）の入口

- [ ] **Step 1: ユーザーへ渡すもの: production origin、招待リンクの発行手順（卓を作る→招待限定→招待リンクを発行）、`playtest-guide.md` の M5 節、問題発生時の `recovery.md`**

- [ ] **Step 2: 対人結果が届いたら `playtest-results.md` へ追記し、R3 の残2項目と M5 を閉じる。画面の不明瞭さは該当コンポーネントに限定して直し、候補変更として Task C5→D3→D4 を再実行する**

---

## 工程の順序と並行性

1. Phase A（A2〜A7）は順に行う。所要は短い。
2. Phase B は B1→B2→B3→B4→B5→B6→B7 の順。B2/B3/B4 は互いに独立だが、束縛ファイルの適用は台帳を直列に書き換えるため 1 タスクずつコミットする。
3. B8 は Phase B の全コミット後に 1 回。Phase C の追加後に C5 でもう 1 回。D2 の設定変更後にもう 1 回。
4. Phase C は B8 の `ready=true` に依存する（正式 START の gate）。C1 の Engine ボットだけは B8 前に作れる。
5. Phase D は D1（ユーザー操作）が唯一の外部待ち。D1 は Phase B の途中でも実施してよく、早く済ませるほど良い。

## 進捗報告の単位

- Phase A 完了、B の各タスク完了ごとに `python3 scripts/ledger_report.py` の数値、B8 で `ready=true`、C5 で候補記録、D4 で公開 origin を報告する。
- 「実装済み」「束縛済み」「accepted」「配備済み」を混ぜない。
