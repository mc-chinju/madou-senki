# R4 成功後の受益者辞退で残りの回答席を維持

勇気の回収判定成功時、回答窓を受益者一人に置き換えたまま辞退処理へ渡していた。このため回収が成立していなくても、未回答の公開席を省略して窓を閉じていた。G11段落010の全参加者への明示回答と最初の成立回収で競合終了する条件に対し、追加4ケースが失敗することを確認した。

`reclaim.ts` は受益者選択へ移る前の参加者・カーソル・回答済み席を `responseResume` に保存する。辞退ではこれを復元して判定者の次へ進める。`combat/attack.ts` の受益者選択中のPASSも同じ辞退処理へ接続した。通常回収窓のPASSは従来の経路を使う。

Engineでは判定者と受益者が同一/別人の各場合に、CHOOSE_RECLAIMの辞退とPASSを検証。JSON保存復帰後も残席を一つずつ回答してから閉じ、通常枠を消費しない。Workerでは成功時の退避復帰、辞退のACK再送、最後のD席の保存を検証。ブラウザでは受益者再読込→辞退→D席の表示→D席再読込→明示回答まで確認した。

- 失敗確認: Engine追加4件失敗/既存24件成功。`/tmp/madou-r4-beneficiary-decline-red.log`。
- Engine関連3ファイル118件成功。`/tmp/madou-r4-beneficiary-decline-engine.log`。
- Worker `room-reclaim.test.ts` 39件成功。`/tmp/madou-r4-beneficiary-decline-do.log`。
- ブラウザ追加1件成功。`/tmp/madou-r4-beneficiary-decline-browser.log`。
- 最終型検査成功。`/tmp/madou-r4-beneficiary-decline-types-final.log`。

G11の該当条件をimplementedで登録し、A09の受益者選択条項へ依存を追加した。具体的な宣言ハッシュは `2026-09-10-r4-beneficiary-decline-bindings.json`。旧実装が既に受益者選択へ変換済みで元の回答順を保存していないスナップショットの移行は、この検証には含めない。全条項・完成候補の受け入れは未達。レビューなし。
