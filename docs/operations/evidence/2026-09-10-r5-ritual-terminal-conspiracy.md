# R5 実個人勝利退場から終末まで

既存6人の実儀式→下僕転向経路に、Fアルセイル本人の公開・陰謀選択を追加した。覚醒窓で本人へ優先権が来てから公開し、同窓へ戻って陰謀を使う。退場確定後もEガイナスとCランカスターが対立するので全体終了しない。

退場直後はFがexited、individualResultsがF:won、全体outcomeなし。その後Cの実専用詠唱・全手番・竜殺天空槍でVanmilが実死亡し、pending-death中は全員outcomeなし。親の反応終了後、勝者はF/C/Eの各一回で、Fのexitedと個人勝利記録も保持される。B/Dの下僕は勝者に入らない。

Fは非Vanmil陣営のままであり、退出後の陣営を書き換えるような成立不明の状態は作っていない。今回の証拠は実個人勝利の保持・重複なしで、死亡/流浪済み勝者の証拠ではない。

Engineは全commandのJSON保存復帰一致・物理220枚一意性・死亡と終了の各一回を確認。DOは公開と陰謀を含む全commandでeviction・同一receipt再送・保存不変と全員の投影を確認。ブラウザは公開・陰謀の実ボタンを操作して退場後reloadし、後続戦闘と全員の終了後reloadでも記録と勝敗が保持されることを確認した。

検証（既存4人/6人不退場を含む）:
- Engine3成功: `/tmp/madou-ritual-terminal-conspiracy-engine.log`
- DO3成功: `/tmp/madou-ritual-terminal-conspiracy-do.log`
- browser3成功: `/tmp/madou-ritual-terminal-conspiracy-browser.log`
- 全型成功: `/tmp/madou-ritual-terminal-conspiracy-types.log`
- 台帳valid、12,178行、pending8,363/implemented3,815: `/tmp/madou-ritual-terminal-conspiracy-ledger.log`

新規3試験参照を該当8条項へ追加し、既存4参照の宣言hashを現在のものへ差替。statusは維持した。新しいハンドラーは追加していない。

未完: 実死亡/流浪済み勝者の同じ儀式→終末経路、人物全条項対応、R5親項目と全goal。
