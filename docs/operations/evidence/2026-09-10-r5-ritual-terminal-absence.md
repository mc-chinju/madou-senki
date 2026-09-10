# R5 実死亡・流浪済みの終末勝者

6人の実儀式でAウーノスが全快Vanmilへ変身。下僕を選ばずBディア/DヨーツルムはEVILを保持する。Cランカスターの実専用詠唱・竜殺天空槍でEガイナス（初期耐久20）を倒し、保護対象の死亡によりFアルセイルが流浪する。B/DとCの対立が残るため全体終了しない。

Cは同じ物理槍を通常回収で一回取得し、実手番・手札調整・再詠唱・全手番を経て、今度はAを実攻撃で倒す。Aのpending-death中には全員outcomeなし。終末ではB/C/D/E/Fが勝者となり、EのdeadとFのwanderingが保持される。Eの先の死亡eventは増えず、A死亡と終了は各一回、儀式と槍は各一回だけ捨札にある。

Engineは全commandのJSON保存復帰一致と物理220枚一意性、DOは全command後のeviction・同一receipt再送・保存不変と全本人投影を確認。新規ハンドラーや人物状態の直接書換はない。ブラウザは同じ儀式・二度の詠唱と攻撃・通常回収を実操作する。

ブラウザ初回は撃破報酬後の手札調整で45秒タイムアウト。traceの最終待機は「選んだ0枚を捨てて手番を終える」で、Engine/DOは実際の超過枚数を捨てて進んでいた。試験側を本人の手札上限から超過枚数を求めて槍以外を選ぶ操作へ修正した。待機上限の延長やゲームルールの変更はしていない。

検証ログ:
- Engine: `/tmp/madou-ritual-terminal-absence-engine.log`
- DO: `/tmp/madou-ritual-terminal-absence-do.log`
- browser初回: `/tmp/madou-ritual-terminal-absence-browser.log`
- browser修正後: `/tmp/madou-ritual-terminal-absence-browser-final.log`
- 型: `/tmp/madou-ritual-terminal-absence-types-final.log`

人物全条項対応と、実死亡以外のVanmil不在で終末を起こさない条件は未完。R5親項目と全goalは未完。

最終結果: Engine/DO/browser各1件・全型成功。台帳はunverified行に残件注記が必要という機械チェックの指摘に従い、3行へcurrent-candidate acceptance未完を明記して再検証しvalid。12,178行、pending8,360/implemented3,818。3参照を5条項へ追加、生存/死亡/流浪勝者3行のみimplemented、accepted昇格0。台帳ログ `/tmp/madou-ritual-terminal-absence-ledger-final.log`。
