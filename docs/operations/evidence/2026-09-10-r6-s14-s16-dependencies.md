# R6 S14〜S16 境界依存

[個別条項/実装/試験](2026-09-10-r6-s14-s16-dependencies.json)を登録した。

- S14: G04の従者開始後の通常防御拒否。transitionCombatで対象のfollowerStarted/normalDefenseClosedまたはgroup followersを確認し、DEFENSE_WINDOW_CLOSEDで拒否。実初期従者と神性介入を使う既存試験は、拒否後もCの士気ロール振り直しを受け入れる。
- S15: G04とS15期待結果のsource両方を参照して、味方公開の従者開始前後を個別条項にした。revealCharacterが開始前の味方ヒットだけを防御済みにする。before/afterの各層具体parameterを保持する。
- S16: G15の数値0ダメージ命中による公開。applyHitsは未防御hitが本人へ届けば公開し、0を非命中として扱わない。実精神力0の気斬試験を3層へ対応する。nullダメージ全経路も同時に証明したとはしない。

新3条項はimplemented。ASTで現行宣言hashと既存成功証跡の宣言hash一致を確認。runは旧候補の履歴として保持し、現行固定候補の成功やacceptedへ置換しない。カード固有の判定/効果の依存全量、各scenario source全欄、全条項最終受け入れは未完。

台帳機械検査終了0、12127行valid/pending8392/implemented3735（`/tmp/madou-r6-s14-s16-dependencies-ledger.log`）。runtime/test本文は変更していないため、型検査・ゲーム試験の再実行なし。レビューなし。

readiness生成結果は valid=true / ready=false（`/tmp/madou-r6-s14-s16-dependencies-readiness.log`）。再開時に完了出力を確認。
