# R4-B G11予約寿命の共有条項

[対応表](2026-09-10-r4-reclaim-lifetime-bindings.json)。G11 paragraph/012から親と子の完了待ち、同生命の異界返却、同生命の流浪返却、復活した新生命への旧予約禁止、退場時廃棄を5つの部分条項としてimplementedに登録。再使用10能力の回収効果19条項から、この共有5条件へ依存を追加した。

reserveReclaimCardはownerLifeIdとeventIdを保存する。eventPendingはそのeventに属する未完の回収回答、行動、能力、窓、未適用ロール、覗き、rootEventIdsを持つlifecycle等を確認する。releaseReclaimReservationsは親が未完なら解放せず、完了後に生命ID一致と生存を確認する。異界・流浪は生存に含め、pending-death/dead/exitedと死亡予定は除く。別生命は現在生存していても廃棄する。

既存4実producerを使用:

- 実裂界でリーアの予約祈り所有者が異界へ移り、同生命で親終了時に1枚返る。
- 実保護対象死亡でランスロットが流浪し、予約した実反撃札が親終了時に1枚返る。通常枠の使用履歴も維持。
- 実多対象死亡・死亡時贈与取消補充・伏線復活が同じ親の中で発生し、旧生命の予約祈りを新生命に返さず1回廃棄する。
- 実復活の儀式・自己取消した命運の回収予約・ヴァンミール覚醒・アルセイルの実退出が同じ親の中で進み、予約札を1回廃棄し使用履歴を維持。

各Engine/Worker/browserの12具体宣言は現行AST hashと既存証跡の一致を確認した。各試験は保存・再送・再読込など既存の実行記録を保持し、現在の全固定候補成功へ更新しない。実テストの少数例を全能力の全組合せ成功とは扱わない。

予約領域と山札再構成の全経路、親イベント帰属の全組合せ、未返却の死亡予定条件全種類、名称別の全履歴条件、G11全文の受け入れは残る。aggregate coversを部分だけで閉じていない。

台帳機械検査終了0、12153行valid / pending8363 / implemented3790。ログ `/tmp/madou-r4-reclaim-lifetime-bindings-ledger.log`。今回runtime/test本文変更なし、型・ゲーム試験再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r4-reclaim-lifetime-bindings-readiness.log`）。今回の全プロセス終了。
