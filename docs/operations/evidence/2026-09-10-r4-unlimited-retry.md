# R4 無制限回収の取消後再試行

実カードの使用から回収を宣言し、命運凶変による実取消を経た6能力について、元の回収回答窓へ戻った後にJSON保存復帰する試験を追加した。元の所有者と次の回答者による同じclaimの再要求は拒否され、状態全文・4人の投影は不変。試行履歴は一回、対象札は捨て札に一枚、通常枠は未消費で終了する。

対象はランスロット、吟遊詩人、歌う船/飛竜の能力、グリフォン、アンデッド、狼牙等の無制限回収6能力。各能力の代表札を使う具体的パラメータは `2026-09-10-r4-unlimited-retry-bindings.json` に保存した。全指定札の取消組合せを網羅したという意味ではない。

これは実際に到達する回答窓での拒否を証明する。元所有者の回答順を人為的に戻して内部の再試行ガードだけを通す試験ではない。ランタイム変更なし。

- `pnpm exec vitest run packages/engine/test/reuse-abilities.test.ts`: 80件成功。ログ `/tmp/madou-r4-unlimited-retry-engine.log`。
- `pnpm typecheck`: 成功。ログ `/tmp/madou-r4-unlimited-retry-types.log`。
- `python3 scripts/validate_runtime_coverage.py`: valid、12,158行（pending 8,363 / implemented 3,795）。ログ `/tmp/madou-r4-unlimited-retry-ledger.log`。

G11の同イベント再試行禁止の条件をimplementedとして登録し、無制限回収14条項から依存させた。全条項の受け入れ・完成候補の受け入れは未達。レビューは行っていない。公開transcriptと弓反撃、受け入れ方針についての未回答の条件変更案は維持する。
