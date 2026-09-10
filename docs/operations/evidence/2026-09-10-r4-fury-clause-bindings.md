# R4-C フューリー3条項の実装対応

[具体関数・試験宣言](2026-09-10-r4-fury-clause-bindings.json)。c2-p02-r1c2-ab03の効果d6、独立ダメージd6、持ち技追加回収をpendingからimplementedへ変更した。受け入れ済み・検証済みへは昇格していない。

- 効果d6: actionModifierOptionsの弓条件、resolveActionModifierの数値判定、effectPreviewとfreezeEffectLevelの加算・固定を対応。
- ダメージd6: prepareModifierDamageが選択した同じ能力に別rollIdを保存し、damagePreviewとfreezeDamageがその確定値を加算。効果の出目をダメージとして再利用しない。
- 追加回収: reuseClaimsの持ち技名・能力所有・生存/禁止・使用履歴、beginReuseの宣言受理時追加枠消費、resolveReuseの再確認とcommitReclaimを対応。実弓の数値2ロールから同じ能力IDの追加回収まで進む試験を登録。

fury-bow.test.tsの具体宣言をASTから取得し、数値2条項へ関連する正規経路と構造試験を区分して登録。構造の反射コピー・自動従者origin・null・仮想継承bundleはstructural-resolverを明示し、実カード経路として扱わない。既存DO/browserの数値2ロール保存・再振り宣言も数値条項へ対応。前回追加した反撃拒否試験を反撃成功の証拠へ流用しない。

古い不足理由「回収の資格判定・有限選択・使用履歴の実装なし」は、この3行からだけ除去した。共有note本体や他行は変更していない。現在候補の実行と全条項/交差条件、弓反撃条件の回答、受け入れは残る。歴史的実行記録2026-09-09-r4-fury-bow.jsonは保持し、現在候補へ更新していない。

台帳検査終了0、12148行valid / pending8387 / implemented3761（`/tmp/madou-r4-fury-clause-bindings-ledger.log`）。今回runtime/test本文の変更なし、型・ゲーム試験の再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r4-fury-clause-bindings-readiness.log`）。今回の全プロセス終了。
