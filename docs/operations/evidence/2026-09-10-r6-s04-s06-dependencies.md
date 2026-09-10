# R6 S04〜S06 依存登録

[対応表](2026-09-10-r6-s04-s06-dependencies.json)。再振り、強制失敗、確定後の気合い拒否の部分条項3件をimplementedに追加してシナリオへ接続。

S04はcontinueActionが同じtargetRollのgenerationを進め、throwRollが2個全体を新しいfacesへ置換してattemptを追加する。実[2,3]→[4,4]とJSON保存後の同一ID、Worker保存直後の再送で第三試行なし、browser再読込を対応した。同じcommand再送の受付は既存Worker層の責務であり、この計算ハンドラー単体が冪等とはしない。

S05はthrowRollの成功条件が!forcedFailureを要求する。実命運凶変で失敗済みの判定を成功値[4,4]へ振り直してもforcedFailure=true/success=falseが残る。3層caseの既存宣言を対応した。

S06はeffectFrozenを見て気合いを候補から除き、validActionModifierも確定後に適用を許さない。実Lv6防御窓で気合い要求を拒否し、hand/used/rolls不変のEngine caseを対応した。G08の計算窓固定とS06期待結果を併記してsourceを明確にした。S09修正で共有DO宣言が変わったため、S06の歴史的source indexをそのまま新条項に流用していない。最新DO成功記録は既存S09修正証跡に保持する。

登録した宣言hashは現行ASTと一致。旧候補の成功を現在候補に書き換えない。runtime/test本文変更なし、型・ゲーム試験再実行なし。レビューなし。

台帳機械検査終了0、12148行valid / pending8390 / implemented3758。ログ `/tmp/madou-r6-s04-s06-dependencies-ledger.log`。

これでS01〜S32のacceptance-correspondenceに少なくとも部分依存がある。依存全量・裁定全文・現在固定候補の受け入れは未完であり、R6全体を完了扱いにしない。次の実装作業はR4-Cで未証明のFury自身の弓反撃の合法経路を扱う（R4計画493行）。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s04-s06-dependencies-readiness.log`）。今回の全プロセス終了。
