# R4 名称列挙従者死亡回収のWorker/UI経路

7種の実配置・次の実手番の攻撃を行う共通fixture `named-follower-death-scenario.ts` を追加し、既存reclaimシナリオの登録機構へ接続した。fixtureは通常防御窓で停止する。以後の死亡・回収宣言・予約・親終了はWorkerまたはブラウザから実コマンドで進める。飛竜には実必勝の祈りを使う。全fixture遷移で保存復帰の同一結果と物理220枚の一意性を確認する。

Workerは7種それぞれで、実死亡前の退避復帰、回収宣言のACK再送、予約後の復帰、親終了後の旧ACK再送を確認する。取得は一枚、通常枠は未消費。ブラウザは実死亡後の回収ボタンを選び、能力宣言中・予約中・受取後に再読込する。予約中は手札/捨て札から除かれ、最後に一枚戻る。

- Worker7件成功: `/tmp/madou-r4-named-death-do.log`。
- ブラウザ7件成功: `/tmp/madou-r4-named-death-browser.log`。
- 型検査成功: `/tmp/madou-r4-named-death-transport-types.log`。
- 台帳valid: `/tmp/madou-r4-named-death-transport-ledger.log`。

7従者の能力条項とG11実死亡条件へ、Worker/UIの14参照を追加した。宣言・パラメータは `2026-09-10-r4-named-death-transport-bindings.json`。台帳行数は12,178のまま（pending 8,363 / implemented 3,815）。同経路のEngine93件成功は `2026-09-10-r4-named-death.md` に記録済み。今回の変更は試験用fixture・試験・台帳のみで本番ランタイムに変更なし。実死亡回収の取消/不使用/禁止をこの成功経路から推定しない。全条項・完成候補の受け入れは未達。レビューなし。
