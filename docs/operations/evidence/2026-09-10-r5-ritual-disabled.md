# R5 人物能力無効と行動停止の儀式境界

初期配置から通常の儀式準備を実行し、後続Dシンの手番で公開ウーノスへ普通錯乱または催眠を実使用。実抵抗判定と次のウーノス手番の回復判定を失敗させる。初期の人物/配札以外に状態を直接設定していない。

- 錯乱: ability-disabledを保持し、策謀の能力候補はない。それでも物理儀式を自己主行動として使用でき、公開Vanmil/damage0/耐久25へ変身。無効statusは保持し、儀式は一回捨札、手札からは儀式だけが減る。
- 催眠: stoppedを保持し、回復失敗後はAの手番全体が飛んでBのturn-startへ移る。主行動や手札調整を捏造しない。そこでの儀式要求はEngineでWRONG_PHASE、WorkerでINVALID_ACTIONに正規化されて拒否され、保存状態と全投影は不変。ブラウザでは儀式ボタンがなく、未使用の儀式札が残る。

Engineは全commandのJSON保存復帰一致と物理220枚一意性、DOは全commandのeviction/同一receipt再送/保存と投影一致を確認。拒否commandも再送して同じ拒否と状態不変を確認。ブラウザは実精神攻撃から手番遷移・儀式まで操作し、reloadで結果が保たれることを確認した。試験scenarioの乱数だけ6固定。

初期の停止ケースはAのaction、次いでhand-adjustmentを待って失敗した。turn-continuationsの既存処理と実遷移に合わせ、AのSTART_TURN後にBのturn-startへ移ることを確認する試験へ修正。DOの拒否期待値もEngine内部コードからWorkerのINVALID_ACTIONへ修正。本番処理の変更なし。

検証:
- Engine2成功: `/tmp/madou-ritual-disabled-engine-final2.log`
- 関連儀式18成功: `/tmp/madou-ritual-disabled-engine.log`（この初回ログでは新停止ケースが失敗、既存18と新無効ケースは成功）
- DO無効ケース成功: `/tmp/madou-ritual-disabled-do-final.log`（停止の期待コードのみ失敗）
- DO停止ケース修正後1成功: `/tmp/madou-ritual-stopped-do-final.log`（無効ケースは選択範囲外）
- browser2成功: `/tmp/madou-ritual-disabled-browser.log`
- 全型成功: `/tmp/madou-ritual-disabled-types-final.log`
- 台帳valid: `/tmp/madou-ritual-disabled-ledger.log`

6具体参照をown-turn-ritual-card-useへ追加。status昇格なし。既存の条項対応表、history-transport、terminal/absence/otherworld/conspiracyの証拠と合わせ、計画の「ウーノス復活の儀式とVanmil終末の全条項照合・不足検証」項目を完了とする。台帳全件accepted、R5の残カード条項、R6以降、全goalは未完。
