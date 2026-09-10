# R4 レスター自身の勇気に重なる回収権

`printed-reclaim-adapters.test.ts`の `Actual Lester Courage selects one of two same-seat rights: %s`（base/printed）を追加。実レスターを使用者として、実弓攻撃→ディアの魅了→実勇気による取消→回収枠→レスター公開を実行。通常枠と印刷判定の2つだけが同一席に提示される。

base選択は判定なしで通常枠を消費する。printed選択は実回収判定→本人beneficiary-choiceで回収し、通常枠を残す。両方とも他方の古いclaimは状態不変で拒否され、最終勇気は本人手札に一枚、捨て札・予約にはなく、回収判定は選択時だけ一回。機会でJSON復帰後に選択する。runtime変更なし。

対象実行終了0、2成功・21件対象外skip（`/tmp/madou-r4-lester-two-rights.log`）。この試験は同一席の2権利選択を証明し、異なる席の2権利者や辞退後の順次選択を証明しない。

## 計画との残る差

計画の `Two explicit claimants share one card and saved finite priority` はfirst declineでnext claimへ進むことを要求する。現行 `chooseReclaim` のdeclineは `advanceResponse` により席全体を進める。通常権は使用者本人だけ、勇気の印刷判定はレスターだけなので、実レスターの勇気では同一席に重なる。印刷権を別人へ移したfixtureは作成しない。

この差を解消したとは扱わず、集合チェックを維持する。辞退を権利単位へ変更するには、公開参加者スケジュール・権利秘匿・一席一応答の採用条件との整合が必要。今回そのルール変更は行っていない。台帳登録・Worker/browserでの同経路は未実施。

全型終了0（`/tmp/madou-r4-lester-two-rights-types.log`）。台帳機械検査終了0（`/tmp/madou-r4-lester-two-rights-ledger.log`）。台帳・readiness変更なし、全実行プロセス終了。

## Worker・Browser接続と登録

`shared-a09-self`を既存shared fixtureに追加。初期Aレスター/Bジル/Cディアで、準備・攻撃・魅了・勇気を実transitionで進めた回収入口。重複人物や回収権注入なし。

- `room-lester-two-rights.test.ts`: base/printedの2成功。各コマンド後に220実ID、保存再起動、同envelope同ACK・保存不変、4席投影一致。選ばなかった古いclaimを新commandIdで送って拒否・保存不変も確認。ログ `/tmp/madou-r4-lester-two-rights-do.log`。
- `lester-two-rights.spec.ts`: base/printedの2成功。実公開と回収選択、判定中/受益者選択前/回収後/最終全席reload、本人手札一枚・他席不在、判定回数差を確認。既存BrowserFixtureRoomのシナリオ別entropyで当該名だけ出目1。初回ログ `/tmp/madou-r4-lester-two-rights-browser.log`。台帳で識別できる静的test名へ変更後、2件再実行成功 `/tmp/madou-r4-lester-two-rights-browser-static.log`。
- 全型終了0: `/tmp/madou-r4-lester-two-rights-final-types.log`。DOとbrowserの重複実行なし。
- 6つの具体caseを `a2-p01-r3c3 / semantic/return/user-choice` に追加。implemented維持。[参照・ハッシュ](2026-09-10-r4-lester-two-rights-bindings.json)。台帳機械検査終了0、12112行valid/pending8389/implemented3723（`/tmp/madou-r4-lester-two-rights-bindings-ledger.log`）。

runtime・採用ルール変更なし。辞退→次権利、異席の複数権利者、独立レビュー、全acceptedをこの結果で閉じない。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r4-lester-two-rights-readiness.log`）。全プロセス終了。
