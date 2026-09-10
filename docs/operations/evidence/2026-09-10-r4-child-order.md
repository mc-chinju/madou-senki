# R4 子判定後の未回答席への復帰

勇気の実使用後、A/BがパスしCレスターが回収判定を要求する。失敗した判定へDが実際に神性介入を使用し、振り直しも失敗する。子処理の各回答前にJSON保存復帰し、元の回収窓がDの回答へ戻ることを追加試験で確認した。A/B/Cによる再回答は状態全文・全員の投影を変えず拒否される。Dの一回のパスで当該窓が閉じ、勇気は一枚だけ廃棄される。判定は同じ一件、試行は二回に保たれる。

- `packages/engine/test/printed-reclaim-adapters.test.ts`: 24件成功。ログ `/tmp/madou-r4-child-order-engine.log`。
- `pnpm typecheck`: 成功。ログ `/tmp/madou-r4-child-order-types.log`。
- 台帳valid、12,160行（pending 8,363 / implemented 3,797）。ログ `/tmp/madou-r4-child-order-ledger.log`。

G11の子判定失敗後の回答済み席維持をimplementedとして登録した。具体的な宣言とハッシュは `2026-09-10-r4-child-order-bindings.json`。成功後の受益者辞退、公開不参加、切断待機は別条件であり、この試験では完了扱いにしない。ランタイム変更・レビューなし。計画全体の受け入れは未達。
