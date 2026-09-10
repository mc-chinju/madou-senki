# R6 S08の実反撃依存

S08出典は転移チェック失敗後・従者開始前に別の合法な反撃を受け入れ、失敗した転移の再試行は許さないことを要求する。

既存scenario-s06-s10.test.tsのS08宣言は実失敗6/6を持つ転移を再使用しようとして状態不変拒否、実閃光槍の通常PLAY_DEFENSEで反撃、最終A5/B0、両札廃棄、groups空を確認する。fixtureはr6-defense-scenarios.tsで実PLAY_DEFENSEとPASSを使って前提を作る。

S08 acceptance-correspondenceに閃光槍の通常counter-capable・damage、およびG06 physical-card-once-per-eventを依存登録。転移の具体的物理コピーの条項、G13防御開始境界の正確な依存、一般的な別札防御許可の網羅は今回未完。3依存を全量とはしない。候補runの再実行やstatus昇格なし。

## 再試行拒否の受け入れ範囲

S07/S08は特定のALREADY_USEDエラーコードを要求していない。CARD_NOT_IN_HAND等も含め、実入力が拒否され状態が変わらず、後の合法な入力が通るという観測結果で判定する。ALREADY_USEDだけを通す目的で予約札を手札へ注入する追加試験は不要。前回のG06 remainingがその分岐単独の試験を追加条件と読めるため、受け入れ文へ修正した。これは一般ルールの全経路を確認済みとする変更ではない。

台帳機械検査終了0、12115行valid/pending8392/implemented3723（`/tmp/madou-r6-s08-dependencies-ledger.log`）。runtime/test本文変更なしのため、試験・型検査の反復なし。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s08-dependencies-readiness.log`）。全プロセス終了。

## 転移と防御境界の依存追加

takeCardはactionCards.findで最初の名称一致を選び、catalogはsource配列順を維持する。該当転移はa2-p06-r1c1。user-spirit-checkとsuccess-cancel-selfをS08依存へ追加した。

既存採用本文から個別semanticとして次を追加（全てpending、handler/test対応待ち）。

- ruling:G06#semantic/different-physical-defense-allowed（段落003）
- ruling:G04#semantic/normal-defense-before-follower-start（表の段落010）
- ruling:G13#semantic/higher-counter-replaces-hit-in-range（段落002）

S08の依存は計8条項。G13の同値相殺・射程外や反射全条件、G04の従者開始後の禁止、G06全再試行規則をこれら3行で網羅したとはしない。aggregate coversの全量やS08の全source欄対応も未完。新裁定や試験状態の注入は行っていない。

台帳機械検査終了0、12118行valid/pending8395/implemented3723（`/tmp/madou-r6-s08-defense-dependencies-ledger.log`）。runtime/test本文は変更していないため再実行なし。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s08-defense-dependencies-readiness.log`）。全プロセス終了。

## 実装/試験対応

新3条項へS08の既存Engine/DO/browser宣言を登録。ASTで現在の宣言hashが歴史的証跡と一致することを確認。[対応表](2026-09-10-r6-s08-defense-bindings.json)。別札防御・従者前境界はtransitionCombatとnextDefense、上回る反撃のヒット生成はcontinueActionのcounter条件へ対応する。

台帳statusMeaningのimplementedは到達可能なhandlerがあり、条項/試験/現在の実行証跡が未検証の段階を示す。3行をpendingからimplementedへ変更した。一般範囲・現在候補の受け入れはremainingとして保持し、verified/acceptedへは進めない。

台帳機械検査終了0、12118行valid/pending8392/implemented3726（`/tmp/madou-r6-s08-defense-implemented-ledger.log`）。runtime・試験本文変更なし、旧候補runを現在成功へ書き換えていない。ゲーム試験/型検査の反復なし。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s08-defense-bindings-readiness.log`）。全プロセス終了。
