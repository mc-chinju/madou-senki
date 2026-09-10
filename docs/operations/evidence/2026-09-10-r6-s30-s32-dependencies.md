# R6 S30〜S32 依存登録

[対応表](2026-09-10-r6-s30-s32-dependencies.json)。既存採用裁定の部分条項4件をimplementedとして追加し、S30〜32 acceptance-correspondenceへ接続。

S30の実裂界はBの手札・従者・詠唱・付属札を保持する。祈願2枚のhand/public候補と啓示の対象候補からBを除き、直接要求もINVALID_TARGETで拒否して状態と4人の投影を変えない。実取得した大陸の夜明けで同じ生命・所持品・ダメージのまま帰還し、復活イベントを発生させない既存4具体caseを対応した。他者の全効果や帰還時の別停止の全組合せまでは閉じない。

S31は実フューリー専用星流弓でnoChecks=trueかつchant=trueを確認し、手札からの直接攻撃をCHANT_REQUIREDで拒否、実CHANT後に使用するEngine case。resolveTechniqueSelectionの詠唱条件はチェック免除とは独立する。全専用カードの網羅をこの1例から主張しない。

S32はcomposeValueの純粋計算例。数値5+1に倍率2と0.5で6、5+0.5に0.5と2で最後だけ切り捨て5、nullに加算と倍率を掛けてもnullを扱う。数値2例とnull1例を別条項へ対応し、既存structural-resolver区分を保持する。実カード複合効果の成立経路に置き換えない。

現行AST宣言hashと既存source indexの一致を確認。旧候補の成功は歴史的記録のまま保持し、現在候補の受け入れは未完。

台帳機械検査終了0、12142行valid / pending8390 / implemented3752。ログ `/tmp/madou-r6-s30-s32-dependencies-ledger.log`。runtime/test本文変更なし、型・ゲーム試験再実行なし。レビューなし。

依存が空のacceptance-correspondenceはS01〜S06。次はこの6件を対応する。S07〜S32に依存があることだけでは全依存・全原文・固定候補の受け入れ完了を意味しない。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s30-s32-dependencies-readiness.log`）。今回の全プロセス終了。
