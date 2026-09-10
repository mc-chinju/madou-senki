# R4 死亡・流浪・退出後の公開回答

既存の実カード経路を強化した。共通補助 `reclaim-public-absence-helpers.ts` は公開参加者順、全員の同一回答者、不参加者の選択肢なし、直接PASSの拒否、拒否時の状態全文と全投影の不変を確認する。

- 死亡: 必勝の祈りを予約したBが実死亡した後、攻撃札の回収はA/C/Dの順に進む。各回答を保存復帰し、従来の一括finishと同じ終状態になる。
- 退出: ヴァンミール実覚醒後、アルセイルBが実退出した後の儀式札回収はA/C/Dの順。予約命運の一回廃棄と履歴保持も維持する。
- 流浪: 実リーア死亡でBが流浪、Cが死亡した後、次のDの実手番に封傷を使用してD/E/F/Aの順を確認。元の弓札の回収は保護対象死亡より早く終わるため、その窓を流浪後の証拠にはしない。

流浪の元4人fixtureは死亡後に試合が終了する。続く実手番の検証には6人を用い、追加席E/Fの人物・陣営・目的を初期条件として設定した。手番進行中のpresenceやoutcomeの書換えはしていない。fixtureのsetupパスを引数の全員へ適用するよう拡張した。既存4人呼出しの順序は同じ。Engineの過去4人実行と今回6人実行を区別する。

検証:
- 死亡・退出のEngine2件成功: `/tmp/madou-r4-public-absence-engine.log`。同ログの流浪1件は不成立だったため成功に数えない。
- 修正後の流浪Engine1件成功: `/tmp/madou-r4-public-absence-wandering-names.log`。
- 最終型検査成功: `/tmp/madou-r4-public-absence-types-final.log`。
- 台帳valid、12,165行（pending 8,363 / implemented 3,802）: `/tmp/madou-r4-public-absence-ledger.log`。

流浪経路の途中失敗ログは `/tmp/madou-r4-public-absence-wandering-{fixed,final,six,live}.log`。原因は試合終了、6人setup未完、初期人物名の誤りであり、ランタイムの不参加条件を緩和していない。

3つのG11条件をimplementedで登録。変更した既存宣言への現行台帳参照2件を更新し、過去証跡は保持した。対応は `2026-09-10-r4-public-absence-bindings.json`。追加した公開回答条件はEngineの証拠であり、以前のDO/browser実行を今回の証拠として流用しない。切断待機・全条項・完成候補の受け入れは未完。レビューなし。
