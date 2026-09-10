# S29 アーネス仮想従者の有効期間

`c2-p03-r2c2-ab02#group-lifetime` に4 handlerと7具体試験を接続し、implementedへ進めた。[機械対応](2026-09-10-s29-group-lifetime.json)。原文・裁定・試験本文・製品コードは変更していない。

C07の同じ攻撃グループ内の保持と後処理での消去に対応する。`freezeFollowerSnapshot` はgroup/target由来IDを持つ仮想源を一度だけ固定する。`resolveFollowerSnapshot` はその同じ源で各ヒットを処理し、物理従者への要約から除外する。`nextDefense` は全対象の処理後にgroupを削除し、行動の終了処理へ進む。`virtualGuardWillEnter` は生成時点の任意選択と有効性を判定する。

Engineの実ディア小人族3発×祝福有無は、同一sourceIdで各発HP1を軽減し、最終損害15、物理220枚一意、仮想札の回収・手札混入なし、終了後の表示消去を検証する。別の実手番を経た攻撃では異なるIDを生成し、実反射の子攻撃でも新しい防御を選択できる。固定後の能力無効の試験は状態注入を含む。グループ削除自体の対応はhandler本文によるもので、表示消去だけを全保存領域消去の直接試験とは扱わない。

今回の実行はEngine5成功、DO1成功、browser1成功。DOは選択直後・固定後・終了後の再起動と同じ命令の再送を扱う。browserは明示選択、固定後再読込、3発の軽減表示と終了後消去を扱う。初期条件を投入する既存fixtureであり、正式STARTの証拠ではない。メタデータのみの変更のため型検査は再実行していない。

全条項・依存のaccepted、固定候補の実行receipt、独立受け入れは未完。レビューは実施していない。

台帳機械検査は12,178行valid（pending8,354 / implemented3,824）、readinessはvalid=true / ready=false。S29の宣言済み依存閉包8件にpendingはないが、原文網羅の証明とはしない。全検証プロセス終了。
