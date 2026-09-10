# R5 実Vanmil異界退去では終末を起こさない

実setup・策謀・装着・被弾・従者再配置を経たウーノスが自己主行動で儀式を行い、全快の公開Vanmilへ変身。後続Cランカスターが普通裂界を実詠唱し、全手番を経てAを攻撃する。実抵抗判定失敗によりAはdamage8/otherworldになる。

裂界と親の反応終了後も、さらに次のC手番まで巡回してもAの存在状態と所持状態は不変。Engine/DOではVanmil死亡flagなし、A死亡eventなし、終了eventなし。全員の投影に勝敗なし。保存復帰やブラウザreload後もotherworldを保持する。儀式と裂界は各一回捨札、窓・resolution・予約は残らない。

乱数は試験用に固定。Engine/DOは実抵抗判定前だけ6、それ以外1。ブラウザは既存のscenario専用entropy分岐にritual-otherworldだけ6固定を追加した。人物や効果の本番値、判定ルール、保存済み存在状態を書き換えていない。通常裂界effect7は巨神のLv5以下無効の範囲外である。

この証拠は成立する異界退去経路に限定する。Vanmilの流浪やアルセイル型の個人勝利退出を直接設定して一般化していない。

検証:
- Engine1＋既存儀式18成功: `/tmp/madou-ritual-otherworld-engine.log`
- DO1（全command後eviction・同一receipt再送・全本人投影）成功: `/tmp/madou-ritual-otherworld-do.log`
- browser1（実儀式/詠唱/攻撃/巡回とreload）成功: `/tmp/madou-ritual-otherworld-browser.log`
- 全型成功: `/tmp/madou-ritual-otherworld-types.log`
- 台帳valid、12,178行、pending8,360/implemented3,818: `/tmp/madou-ritual-otherworld-ledger.log`

3具体試験を終末のactual-death-trigger/mandatory-endへ登録、status昇格なし。次は人物カードの全条項と既存証拠の対応。R5親項目・全goalは未完。
