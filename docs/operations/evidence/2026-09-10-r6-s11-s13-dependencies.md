# R6 S11〜S13 依存と配札の修正

S11のmakeR6MaaiScenarioはB/Cの間合いを同じ名称でtakeCardし、同関数が常に先頭IDを選ぶため、初期配札で同じ物理IDを移し直していた。B=a2-p07-r1c1、C=a2-p07-r1c2を明示するよう修正。明示maaiCardInstanceIdの呼出しでも他方へ別コピーを配る。以後の実詠唱・手番経過・攻撃・間合い/踏み込みは既存の実コマンド経路を保持する。

- Engine対象4成功（`/tmp/madou-r6-s11-distinct-maai-engine.log`）。S11実共有踏み込み、S12一発だけの間合いと次発の別窓、S13抽象算術を含む。
- Worker対象2成功（`/tmp/madou-r6-s11-distinct-maai-do.log`）。各支払い保存/restart/同ACK再送。
- Browser対象2成功（`/tmp/madou-r6-s11-distinct-maai-browser.log`）。DO終了後に実行。
- 全型終了0（`/tmp/madou-r6-s11-distinct-maai-types.log`）。

[4条件の対応](2026-09-10-r6-s11-s13-dependencies.json)を作成。G12防御応酬による距離不変、共有踏み込みの各対象相殺、G14間合いの発単位、従者HPの各同時ヒット軽減を個別条項へ分け、各シナリオacceptance-correspondenceの依存へ追加した。到達可能な実装と具体的宣言があるためimplementedとし、最終受け入れはremainingに残した。

S13はLv5/damage6の3発とLv3/HP2を明示した抽象resolver試験。兵士/弓の印刷値や実カードの成立経路の証拠へ変更しない。カード用途条項、G12/G14全段落、source全欄、現在の固定候補受け入れはこれら4条件で全て閉じたとはしない。

台帳機械検査終了0、12124行valid/pending8392/implemented3732（`/tmp/madou-r6-s11-s13-dependencies-ledger.log`）。過去candidate receiptのmanifest/hash一括更新なし。レビュー・accepted昇格なし。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s11-s13-dependencies-readiness.log`）。全プロセス終了。
