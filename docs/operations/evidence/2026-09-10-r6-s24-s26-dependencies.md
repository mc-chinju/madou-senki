# R6 S24〜S26 依存登録

[個別対応](2026-09-10-r6-s24-s26-dependencies.json)。S24に名称別通常回収1条項、S26に流浪の返却先・復帰時再セットアップ2条項をimplementedで登録。S25は既存チャム能力3条項に接続し、状態の昇格はしていない。

S24は実ジルの同名封傷X/Yを使用するEngine caseを通常枠依存へ対応した。baseClaimsは正規化名称のbaseSpentを確認し、commitReclaimも同じ名称へ記録する。既存の追加・無制限DO/browserはその権利の選択・保存を扱い、別物理札Yの通常枠拒否をそのまま証明しないため新条項へ流用していない。

S25は任意手札1枚、使用中札を除く残存手札、印刷贈与との併用と二重移動拒否へ依存する。chamGiftOptionはpending-deathの本人手札だけを候補とし、resolveChamGiftは選択札がまだ手札にあることを確認して移動する。既存実死亡caseはGOOD/EVILと能力先/印刷札先の4条件で移動済み札の再選択拒否、独立した権利、残存札廃棄を扱う。関連14具体case参照の宣言hash一致を確認した。既存のカード側証跡は保持する。

S26は保護対象Cの実死亡でBの手札・従者を山札へ返し、Cの札は捨て札へ送る。settleProtectionは保護対象復活時にbeginResetupを呼ぶ。実専用復活後、C→Bの再セットアップと新しい従者配置、停止していた手番への復帰を扱う4具体caseを両条項へ対応した。詠唱/公開設置の全挙動や復活による全能力継承はこの部分条項では証明しない。

登録対象のAST宣言hashを既存source indexと比較した。歴史的成功を現行固定候補へ変更していない。全裁定の分解・全依存・最終受け入れは未完。

台帳機械検査終了0、12135行valid / pending8390 / implemented3745。ログ `/tmp/madou-r6-s24-s26-dependencies-ledger.log`。runtime/test本文の変更なし、型・ゲーム試験の再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s24-s26-dependencies-readiness.log`）。今回の全プロセス終了。
