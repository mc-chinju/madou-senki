# R4 他人の使用札と同席の排他的な回収

`owned-reclaim.test.ts` に実際の二つの封傷の使用を追加した。Aシェリムが使用した札について、封傷を持ち技に持つ公開済みBジルにも回収選択肢はない。Bの回答席で通常claimを偽造しても状態全文・全投影を変えず拒否される。次のBの実手番で別の封傷を使うと通常権を選べ、一枚だけ戻って通常枠を消費する。他人札の拒否で本人の予算は消費されない。

競合終了には既存 `Actual Lester Courage selects one of two same-seat rights: %s` のbase/printed二ケースを登録した。実レスターが同じ回答席で持つ二つの権利の一方を選んだ後、他方の再要求は拒否される。別々の二人が独立した権利を持つ経路の証拠にはしていない。

- 新規対象Engineファイル12件成功: `/tmp/madou-r4-foreign-owned-engine.log`。
- 既存勇気二ケースは直近の関連118件成功実行に含まれる: `/tmp/madou-r4-beneficiary-decline-engine.log`。
- 型検査成功: `/tmp/madou-r4-foreign-owned-types.log`。
- 台帳valid、12,168行（pending 8,363 / implemented 3,805）: `/tmp/madou-r4-foreign-owned-ledger.log`。

具体的対応は `2026-09-10-r4-foreign-owned-bindings.json`。G11の他人札の通常権除外と同席の成立後排他性をimplementedで登録した。ランタイム変更・レビューなし。独立した複数権利者の経路、全条項・完成候補の受け入れは未完。
