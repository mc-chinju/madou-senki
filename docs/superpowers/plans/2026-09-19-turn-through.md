# 後回しにした分の実装（捨て札の出どころ・戦記の拡充・任せるの範囲） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a planning deliverable; it does not authorize production deploy by itself.

**Goal:** [捨て札と戦記](2026-09-16-public-record.md) の第2段と、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md) の「後段」を、戦記そのものの読みやすさと合わせて片づける。戦記だけを読めば「誰が誰に何をして、判定がどうなったか」を追えるようにし、自分が捨てた札を見返せるようにし、伏せたまま捨てた札・従者防御・回収・再シャッフルを残す。長い対戦でも絞り込みとページ取得で追える。「任せる」を手番単位まで広げ、決着後は全員の手札と正体を開示する。

**Architecture:** 捨て札へ積む処理を1つの関数に集約し、札ごとに「誰が捨てたか」「表向きだったか」を持つ。これが自分の捨て札一覧と、伏せた札の記録の両方の土台になる。公開・非公開の線は変えない（その時点で表向きに場へ出たかで決める）。戦記の投影は既存の `logView` の許可リストのまま広げる。

**Spec:** 本計画。前提は [捨て札と戦記](2026-09-16-public-record.md)（第1段は main の `5b61a019`）、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md)（PR A・B とも main）、[オンライン設計 §5・§6・§8](../specs/2026-09-07-online-game-design.md)、[G03](../../rules/second-edition/rulings.md)（優先権と同時入力）、[G11](../../rules/second-edition/rulings.md)（回収）。

**Worktree / ブランチ:** `/Users/chinju/git/madou-senki-record2`（ブランチ `deferred-followups`、main の `2cc32530` 上）。main への merge はユーザーが行う。

## この文書について

親計画 `2026-09-19-deferred-followups.md` の PR 5 の部分だけを抜き出したもの。PR 0（#15）・PR 1（#16）・PR 2（#17）・PR 3（#18）・PR 4（#19）の上に積む。これが最後の PR。

## 現状（PR 5 に関係する部分）

- `GameState.standingPasses` は `{ rootEventId, actorIds }` の1件で、行動1つが終わるまで。介入・正体公開で消え、窓が全部閉じても消える（`transition.ts`）
- 「この行動は任せる」は `PASS_ACTION_THROUGH` / `CANCEL_PASS_THROUGH`。画面は `apps/web/src/game/WindowStatus.tsx` の判断バー
- 戦記は PR 0〜3 で大きく変わった。記録は `packages/engine/src/public-record.ts`、投影は `view.ts` の `logView`、画面は `PublicLog.tsx`（絞り込み・並び順・ページ取得つき）
- `SET_CONDITIONAL_ABILITY` は `apps/web/src/game/Board.tsx` の `choiceNames` に訳が無く、内部名のまま画面に出る
- 初期配置バーは `SetupPanel.tsx`、反応窓のバーは `WindowStatus.tsx`。ピルとハイライトの規則が揃っていない
- 秘密漏れの E2E は `tests/e2e/public-record.spec.ts`。PR 4 で決着前の掃き出しに山札が入った

## Task 7: 手番単位の「任せる」

- [x] G03 に追記: 「任せる」には行動単位と手番単位がある。手番単位はその手番が終わるまで有効で、解除条件（介入・正体公開）は行動単位と同じ。手番が変わったら必ず消える
- [x] `standingPasses` を `{ scope: 'action'; rootEventId } | { scope: 'turn'; turnNumber }` にし、`actorIds` は据え置き。`transition.ts` の消去条件に手番の変化を足す
- [x] `PASS_ACTION_THROUGH` に `scope` を足す（省略時 `action`）。protocol の検証試験も足す
- [x] 試験: 手番単位で押すと次の攻撃でも自動パスになる、介入で消えて聞き直される、手番が変わると消える、行動単位と同時に押されたときの優先、bot は使わない
- [x] 画面: 「この行動は任せる」の隣に「この手番は任せる」。注記に「この手番のあいだ、割り込みの機会は流れます。誰かが動いたら聞き直します」と、回収の回答も含むことを書く。任せている範囲を状態行に出す
- コミット: `feat: let a seat pass through a whole turn`

### 実装で決めたこと（Task 7）

- `standingPasses` は**1件ではなく配列**（`StandingPass[]`）にした。計画の型は1件だが、席ごとに範囲が違いうる以上（「行動単位と同時に押されたときの優先」）、1件だと片方の席の範囲をもう片方が書き換えてしまう。範囲ごとに1件持ち、席はそのどれか1つにだけ載る。広げたいときは解除して押し直す
- 手番単位の解除条件は「窓が開いている状態で、パス以外の入力が受理された」か「正体公開」。窓が開いていないところで手番の席が次の行動を始めるのは介入に数えない（数えると「次の攻撃でも自動パス」が成り立たない）
- 戦記の記録は範囲で分けた（`action-through` / `turn-through`）。画面は「この行動を任せました」「この手番を任せました」と読み分ける
- 公開ビューの `standingPassActorIds` は `standingPasses: {actorId, scope}[]` に置き換えた（範囲を席ごとに見せるため）
- 注記は、計画の文をそのまま2つ並べるのをやめた（動かして直した分）。範囲ごとに1行ずつ「どこまで届くか」だけを先に書き、2つに共通する代償（出目や防御を見てから割り込めない・続く回収の回答も含む・誰かが動いたら聞き直す）は下に1行でまとめた。同じ2文を両方に繰り返すと、読み比べたい1点の違いが埋もれ、帯も縦に伸びるため
- 席のピル（`任せる`）は、窓が開いていない間も出す。手番単位は行動と行動のあいだ（手番の席が次の行動を選んでいる間、窓が1つも無い）も生きているので、そこで消えると「誰が飛ばされるか」が卓から見えなくなる

## Task 8: 見送っていた指摘

- [x] S001: 同じ行動で「任せる」→解除→再度「任せる」を繰り返しても、戦記は最後の状態を1行で表す
- [x] P010: `SET_CONDITIONAL_ABILITY` に日本語名を足す。`choiceLabels` に無い内部名が画面へ出ていないか、全コマンドを走査する試験を足す
- [x] P008: 初期配置バーのピルとハイライトを、反応窓のバーと同じ規則にそろえる（どちらかへ寄せる）
- [x] R004: 秘密漏れの E2E を、40手ごとではなく全フレームの検査にする（受信のたびに検査する形）。時間が伸びる場合は席数を減らして全フレーム検査にする
- コミット: `fix: finish the deferred review findings`

### 実装で決めたこと（Task 8）

- P010: `SET_CONDITIONAL_ABILITY` は専用の「継続する特殊能力」パネルが全部日本語で持っている。反応バーに出ていたのは同じ指示の二重表示で、押しても有効なコマンドを組み立てられない死んだボタンだった。日本語名を足すのではなく、パネルが持つ選択肢として反応バーから外した。走査試験（`apps/web/test/command-labels.test.ts`）は engine の `view.ts` と protocol の検証器を読んで「席に出しうる全コマンド」を作り、どちらのバーでも内部名のまま出ないことを見る。同じ形の漏れを `DISCARD_HIT_CHANTS`・`CHOOSE_FOLLOWER_BYPASS` などでも拾ったので、所有するパネルの一覧に集約した
- P008: 揃える規則は2つ。進行が動いたときのハイライト（`useProgressFlash`）を反応窓のバーにも付け、ピルの地色を両方 `--paper` にした（どちらも同じ sticky 背景の上に載るため）

