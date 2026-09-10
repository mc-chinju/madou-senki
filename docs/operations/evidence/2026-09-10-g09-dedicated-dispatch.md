# G09 専用dispatchの分類と対応

| 入口 | コマンド | G09との関係 |
| --- | --- | --- |
| transitionSuppression | USE_ABILITY | 本人の候補・対象・機会を検証して能力宣言を開始 |
| transitionConditionalAbility | SET_CONDITIONAL_ABILITY | 明示ONは取消可能な宣言、OFFは保存選択を解除 |
| transitionChamGift | CHAM_DEATH_GIFT | 死亡判断の本人が残手札・対象を選んで宣言 |
| transitionFollowerBundle | USE_FOLLOWER_ATTACK | 本人が従者と各対象を選んで物理支払い・宣言 |
| transitionSadLove | USE_ABILITY | 本人がaura/substituteを明示選択、OFFは独立解除 |
| transitionBeastCapture | CHOOSE_BEAST_CAPTURE | 標準USE_ABILITYで選んだ能力が実ダメージ後に得た候補の追加選択 |

6種を分類し、既存の具体14宣言を明示使用条項へ接続した。秘匿条項へは直接その範囲をassertする5宣言だけを接続した。例示の人物・カード配置や一部機会の直接設定を含むので、全経路を正式STARTで生成した証明とはしない。

初回の限定Engine実行は13成功・1失敗。獣捕獲の古い試験は、捕獲時にactionsが空であると期待していた。実状態は親の回収窓と物理札のdispositionを保存し、捕獲後には戦闘報酬の公開窓も続く。completeActionは回収decisionがclosedになるまで削除を保留するため、即時削除の期待が現行仕様と一致しなかった。

この試験を親回収窓の同一性、捕獲後の報酬窓通過、最終的なactions消去・攻撃札の一回廃棄まで検証する形へ更新した。同ファイルの全26件を実行すると、捕獲直後のwithdrawalやlifecycleタスク一覧を古い順序に固定する追加6ケースも失敗した。捕獲結果・死亡前の取得順は保持したまま、残る公開窓を通過して終了を確認する形に修正した。最終26件成功、全型成功。本体変更なし。診断用出力は除去済み。

既存台帳の変更した宣言hashと参照IDも再接続した。歴史的な実行証跡は書き換えていない。今回DO/browserは実行していない。専用抑制・従者束の完全な不使用経路、専用入口の既存transport対応は次の作業として残し、G09はpending維持。
