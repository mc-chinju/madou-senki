# R5 復活の儀式・終末の条項対応

対象は人物能力 `c2-p05-r1c1-ab04` と `c2-p07-r1c2-ab05` のsemantic12条項。別能力や人物全員の再調査は行っていない。各handlerと具体test IDは同名JSONに保存した。

| 条項 | 実装・証拠 | 残件 |
| --- | --- | --- |
| own-turn-ritual-card-use | transitionLifecycleCommandによる札支払/主行動、ritual-physicalの実使用/不使用/取消 | 人物能力無効中の実使用交差 |
| transform-Vanmil | resolveLifecycleAction→transform、物理儀式4ケースと後続終末経路 | 候補受け入れ |
| full-heal | 同上、実被弾からdamage0/耐久25 | 候補受け入れ |
| retain-zones-distance-once-history | 物理配置・装着の保持、今回の実接近/呪殺通常回収消費後の保持 | 新履歴経路のDO/browser |
| no-Uonos-inheritance | transformのabilityCharacterIds置換、物理儀式4ケースの旧能力候補なし | 候補受け入れ |
| awakening-boundary | 専用窓、物理儀式4ケースの下僕/陰謀選択・不選択、確定前outcomeなし | 候補受け入れ |
| actual-death-trigger | disposeDeath、実儀式後の致死竜殺天空槍、裂界退去では発火なし | 候補受け入れ |
| mandatory-end | stableOutcome、pending-death/親未解決時に終了せず、解決後一回終了 | 候補受け入れ |
| retain-prior-individual-win | 実公開アルセイルの陰謀勝利退場後、後続終末でも勝利記録維持・重複なし | 候補受け入れ |
| nonVanmil-active-winners | 4人通常/6人下僕選択で非Vanmilだけ勝利 | 候補受け入れ |
| nonVanmil-dead-winners | 実ガイナス死亡後、同一槍回収/再詠唱でVanmil死亡、死亡者も勝利 | 候補受け入れ |
| nonVanmil-wandering-winners | 上記ガイナス死亡による実アルセイル流浪後、流浪者も勝利 | 候補受け入れ |

今回の追加は `ritual-history.test.ts`。初期5枚以内の配札、実接近で初期値と異なる距離、呪殺の実詠唱/攻撃/通常回収でbaseSpent=trueを作る。その後の自己手番で実儀式を行い、lifeId・reclaimUsage・距離・used・手札（儀式を除く）・配置/設置等を保持。直接の距離/履歴書換はない。

初回は追加の初期札が6枚となり、fixtureのtrimHandが保持対象しかない手札から女衛士を外した。historyケースでは不要な初期兵士を配らず5枚へ修正。次の試行は公開同陣営への攻撃を拒否されたため、初期Cを対立陣営のランカスターへ変更。最終Engine1＋既存18、全型成功。既存の基本儀式fixtureの既定挙動は維持した。汎用trimHandの変更は行っていない。

- Engine: `/tmp/madou-ritual-history-engine-final2.log`
- 型: `/tmp/madou-ritual-history-types.log`
- 台帳: `/tmp/madou-ritual-clause-map-ledger.log` valid、12,178行、pending8,360/implemented3,818

物理儀式の既存4具体ケースを人物6条項へ追加対応。終末6条項に残っていた「実致死/異界退去の証拠なし」という旧注記は、追加済み三層証拠に合わせ候補受け入れ未完へ更新した。status昇格なし。R5親項目は履歴のtransportと人物能力無効中の実使用が残るため未完。
