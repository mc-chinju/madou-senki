# R6 S17 反射系譜の依存

[登録内容](2026-09-10-r6-s17-dependencies.json)。G13 paragraph/004の物理札部分をimplementedとして登録し、S17 acceptance-correspondenceから参照した。別の物理防御を許すG06と実際に使用する転移の精神判定・本人防御成功にも依存する。

実fixtureは沈黙→ミラーシールドX→氷鏡Yを通常コマンドで成立させる。Engineは系譜[X,Y]を確認し、使用済みX拒否後に未使用の転移で完了する。手札へXを移す独立した構造challengeでALREADY_USEDと状態不変を確認する。この部分だけをstructural-resolverとして新条項へ対応した。実回収producerを証明したものではない。

Workerのreflection=trueは保存再開・再送を伴うX拒否と転移継続、browserは転移と再読込の継続を扱う。これらを手札復元時の系譜guard直接検証として登録していない。3層の既存宣言hashはASTで一致確認したが、旧候補の成功を現在候補へ昇格していない。

人物能力・従者の系譜、反射の全属性継承、カード固有の全依存、G13全文の受け入れはこの部分登録では閉じない。レビューなし。

台帳機械検査終了0、12128行valid、pending8392 / implemented3736。ログ `/tmp/madou-r6-s17-dependencies-ledger.log`。runtime/test本文の変更なし、型・ゲーム試験の再実行なし。

readiness生成終了0、valid=true / ready=false。ログ `/tmp/madou-r6-s17-dependencies-readiness.log`。今回の全プロセス終了。
