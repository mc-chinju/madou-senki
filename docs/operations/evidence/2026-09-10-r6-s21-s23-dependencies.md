# R6 S21〜S23 境界依存

[登録内容](2026-09-10-r6-s21-s23-dependencies.json)。既存採用裁定のsource参照を使い、4つの部分条項をimplementedとして登録した。S21〜23 acceptance-correspondenceに依存を追加した。

- S21: 絶対結界の不使用と、強制公開前の秘密保持を分けた。evaluateReceivedReservationsは予約された能力だけを評価するため、不使用なら閾値内でも6ダメージを受ける。viewForは本人の候補と他人向け情報を分ける。実白光のEngine caseは本人の候補あり・不使用・非公開中の他人投影・命中後の強制公開を確認し、別人物対照も命中前の投影とパス順が一致する。Workerの保存再開とbrowserのHTTP/WS/DOM caseを対応した。命中後の人物公開まで禁止する条項にはしていない。
- S22: advanceLifecycleはdraw taskを保持し、OPENを手札に足さずrevealOpenへ渡す。伏線の子選択が完了してから同じdrawへ戻る。実取消札の補充で伏線→大陸の夜明けを公開し、通常札を1枚取得する。元の親window IDを保持し、再開時にrevisionが進み、解決中札は最後に1回だけ捨てる既存caseを対応した。OPEN全種類・全取得経路の網羅は主張しない。
- S23: advanceLifecycleのdrawは山札が空の時にs.discardだけをshuffleする。解決中領域を入力に含めない。実秘伝の書の3枚取得で山札1枚→捨て札2枚、書はresolutionに残り、取得完了後に1回廃棄される3層caseを対応した。双方空の不足や他の非捨て札領域全種類はこの例の証明範囲外。

既存11宣言のAST hash一致を確認。旧候補の実行履歴を保持し、現在候補へ昇格しない。裁定全文の分解、全依存、固定候補の最終受け入れは未完。

台帳機械検査終了0、12132行valid / pending8390 / implemented3742。ログ `/tmp/madou-r6-s21-s23-dependencies-ledger.log`。runtime/test本文変更なし、型・ゲーム試験再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s21-s23-dependencies-readiness.log`）。今回の全プロセス終了。
