# R5 実接近・通常回収履歴の儀式後保持

Engineで通ったritual-historyの実接近→呪殺詠唱/攻撃→通常回収→次手番の儀式を、DO・ブラウザへ追加した。新しいゲーム処理は追加していない。

DOは全command後にevictionし、同じreceiptを再送して保存状態不変を確認。初期値と異なる距離、呪殺baseSpent=true、同じlifeId、used、手札（儀式だけ除外）、配置・設置等が実変身後にも保持され、全本人投影も一致する。

ブラウザは実接近、対立陣営ランカスターへの呪殺、通常回収ボタン、自己手番の儀式を操作。回収後の札1枚、変身直後の距離・手札・従者・詠唱・装着保持、全員reload後の距離と札1枚・儀式一回廃棄を確認した。PlayerViewはbaseSpent/lifeId/usedを公開していないため、ブラウザがこれらを直接読んだとは扱わず、内部履歴はEngine/DOの証拠と区別する。

- DO1成功: `/tmp/madou-ritual-history-do.log`
- browser1成功: `/tmp/madou-ritual-history-browser.log`
- 全型成功: `/tmp/madou-ritual-history-transport-types.log`
- 台帳valid、12,178行、pending8,360/implemented3,818: `/tmp/madou-ritual-history-transport-ledger.log`

retain-zones-distance-once-historyへ具体2参照を追加し、同経路のDO/browser不足注記を候補受け入れ未完へ更新。status昇格なし。R5の人物能力無効中の実儀式、親項目、全goalは未完。
