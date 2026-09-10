# R5 儀式から終末までの4人・6人経路

実儀式→全快Vanmil→後続ランカスターの専用竜殺天空槍の詠唱→全手番→実致死攻撃→pending-death→C13を、Engine・DO・ブラウザで確認した。

- 4人: 下僕不選択、非VanmilのB/C/Dが勝利。
- 6人: 実下僕選択でBディア/Dヨーツルムを転向。Cランカスター、Eガイナス、Fアルセイルの対立を残すので儀式直後に通常終了しない。実Vanmil死亡後はC/E/Fだけが勝利し下僕は勝者に入らない。アルセイルは陰謀を使わず、全員それまでactiveである。

6人fixtureは初期人物・札の配置だけを追加し、初期配置と追加2席の実手番もコマンドで進める。4人既定fixtureは維持。openTestRoomの人数を任意の席リストで設定可能にし、既定4席は維持した。新しい効果ハンドラーは追加していない。

DOは全コマンド後のeviction・同一receipt再送・保存全体不変と全本人投影を確認。Engineは各コマンドのJSON保存復帰一致と物理220枚一意性、DOでも220枚を確認。ブラウザは実操作のみで儀式・専用詠唱・攻撃を行い、変身後/詠唱後/攻撃後/pending-death/終了後にreload。pending-deathでは全員outcomeなし、終了後は全員同じ結果。Engine/DOでは終了eventと死亡eventが一回、全層で儀式と槍の一回廃棄を確認した。

検証:
- Engine2＋既存儀式18成功: `/tmp/madou-ritual-terminal-six-engine.log`
- DO2成功: `/tmp/madou-ritual-terminal-six-do.log`
- browser2成功: `/tmp/madou-ritual-terminal-six-browser.log`
- 全型成功: `/tmp/madou-ritual-terminal-six-types.log`
- 台帳valid、12,178行、pending8,363/implemented3,815: `/tmp/madou-ritual-terminal-transport-ledger.log`

6具体試験参照を既存7条項へ登録、古い単独Engine宣言は現在のパラメーター宣言へ差替。過去証跡は保存。status昇格なし。

残り: 実死亡/流浪済み勝者、実個人勝利退場との同一儀式→終末経路、人物全条項の対応。R5親チェックと全goalは未完。
