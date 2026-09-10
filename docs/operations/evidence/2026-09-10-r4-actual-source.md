# R4 手番・任意時機・従者死亡の実回収

G11段落009へ、既存の実経路を3条件として登録した。

- 手番技: 封傷を実使用した持ち技所有者/非所有者の非公開2世界で、第三者の公開窓が同一。JSON保存復帰しつつ全席がパスして物理札を廃棄する。`reclaim-privacy.test.ts` の該当宣言。
- 任意時機: 実レスターが勇気を対象能力へ使用し、本人の通常権を選んで回収する。`printed-reclaim-adapters.test.ts` の `Actual Lester Courage selects one of two same-seat rights: %s` のbaseケースだけを通常権の証拠にする。
- 従者死亡: 実際に配置した女神官のシャリアが実攻撃で死亡し、持ち従者の通常権を選んで予約、親終了後に一枚戻る。`owned-reclaim.test.ts` の実従者死亡宣言。

最初の2宣言は関連118件成功の `/tmp/madou-r4-beneficiary-decline-engine.log`、従者死亡は12件成功の `/tmp/madou-r4-foreign-owned-engine.log` に含まれる。宣言ハッシュは現在のASTから `2026-09-10-r4-actual-source-bindings.json` に保存した。

今回はコード・試験コードの変更がないためゲーム試験と型検査を繰り返していない。台帳は再検証しvalid、12,174行（pending 8,363 / implemented 3,811）。ログ `/tmp/madou-r4-actual-source-ledger.log`。

全カードの発生経路を網羅した証明ではなく、段落集約のcoversは未確定のまま。全条項・完成候補の受け入れは未達。レビューなし。
