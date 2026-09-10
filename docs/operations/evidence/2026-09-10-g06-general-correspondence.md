# G06 物理札のイベント制限と回収後の再使用

physical-card-once-per-event、recovery-after-parent-event、physical-card-reuse-later-attackの3条項をimplementedへ進めた。[機械対応](2026-09-10-g06-general-correspondence.json)。G06全段落の能力回数・全producerの網羅やacceptedを意味しない。

`transitionCombat` は反応先のroll/ability/actionが持つeventIdと人物・物理札を使用キーにし、既存キーを拒否する。返却予約は札を手札・捨て札から隔離し、`eventPending` が元イベントのaction、ability、窓、判定、inspection、lifecycle、回収・廃棄処理の残りを確認する。`transition` の後処理が予約の解放を呼び、別イベントでは別の使用キーになる。

既存S07の3層参照を保持し、Engine8具体参照を追加した。リーアの祈りに加えて、実反撃の子処理後も元攻撃の廃棄が終わるまで回収を待つケース、別の実攻撃で無制限権利を使うケース、振り直しによる元判定の維持を対応した。

`reactions.test.ts` の既存取消ケースに、命運凶変の実支払い・補充・アルセイルによる取消後、再開した親宣言で使用キーが残り、同じ札の再使用が状態を変えず拒否される確認を追加した。札を手札へ戻す注入はしていない。変更宣言に対応する既存台帳参照1件を新しいhashへ付け直し、過去の証跡は変更していない。

一般のALREADY_USED分岐試験は使用済み履歴を注入する。反撃中の士気判定試験は神性介入を手札へ戻して元イベントのガードを直接検査する。死亡境界試験は命中前に被害者の損害を調整する。これら3件はstructural-resolverとして区別し、完全な実producerとは扱わない。S07の拒否は特定エラーコードを要求しない。

今回の対象Engine9成功、追加確認後の取消ケース1成功、DO1成功、browser1成功、全型検査成功。DO/browserは既存のS07経路で、保存再開・同イベント中の予約・後の実攻撃での再使用を担う。一般条件すべてを3層で実行したとはしない。製品コード・原文は変更していない。

固定候補receipt、G06全原文の受け入れ、独立受け入れは未完。レビューは実施していない。

台帳は12,178行valid（pending8,349 / implemented3,829）、readinessはvalid=true / ready=false。宣言済みS01–S32の依存閉包にpendingはないが、これは登録済みの辺だけの結果であり原文網羅の証明ではない。全検証プロセス終了。
