# R6 S27〜S29 依存登録

[個別対応](2026-09-10-r6-s27-s29-dependencies.json)。S27全滅引分とS28変身先別の2結果をimplementedとして登録し、S29は既存5条項へ依存を追加した。

S27の実詠唱破壊は最後のA/Bを同じdeath-batchで死亡予定にする。Aだけ死亡確定した途中でも勝敗は未確定、Bと子処理を終えた後に全員draw、GAME_COMPLETEDは1回。stableOutcomeはlifecycle/windows/actions/groups/resolution/reclaimReservations等が残る間は評価しない。既存3層caseに対応し、個別勝利特例・異界など他の終了条件全てを証明したとはしない。

S28のtransformはランスロットⅡで旧人物と新人物の能力元を保持しdamageを変更しない。ヴァンミールは新人物だけを能力元にしてdamage=0とする。各Engine caseのdamage4保持/4→0とabilityCharacterIdsの正確な結果を対応した。既存browser/DOは変身選択・保存等の経路が主であり、この正確な数値・全旧能力の直接検証として新条項へ登録していない。手札・設置・全履歴・上限変更など元段落の残りは別途受け入れが必要。

S29は任意仮想源、物理札なし、group lifetime、HP1、同時各発の従者HP軽減に依存。Engineの祝福false/trueは同じsourceIdの仮想従者が3発それぞれをHP1軽減し、最終15ダメージ。全遷移で物理220枚と一意性を保持し、仮想IDは物理札・手札・回収候補へ入らず、group終了後に消える。既存Worker/browserも選択・保存を扱う。カード側の既存状態・証跡を保持した。

対応した現行AST宣言hashと既存source indexの一致を確認。旧候補成功runを現在候補へ更新していない。全原文・全依存・固定候補の最終受け入れは未完。

台帳機械検査終了0、12138行valid / pending8390 / implemented3748。ログ `/tmp/madou-r6-s27-s29-dependencies-ledger.log`。runtime/test本文変更なし、型・ゲーム試験の再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s27-s29-dependencies-readiness.log`）。今回の全プロセス終了。
