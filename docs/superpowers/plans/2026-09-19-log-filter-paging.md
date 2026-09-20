# 後回しにした分の実装（捨て札の出どころ・戦記の拡充・任せるの範囲） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a planning deliverable; it does not authorize production deploy by itself.

**Goal:** [捨て札と戦記](2026-09-16-public-record.md) の第2段と、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md) の「後段」を、戦記そのものの読みやすさと合わせて片づける。戦記だけを読めば「誰が誰に何をして、判定がどうなったか」を追えるようにし、自分が捨てた札を見返せるようにし、伏せたまま捨てた札・従者防御・回収・再シャッフルを残す。長い対戦でも絞り込みとページ取得で追える。「任せる」を手番単位まで広げ、決着後は全員の手札と正体を開示する。

**Architecture:** 捨て札へ積む処理を1つの関数に集約し、札ごとに「誰が捨てたか」「表向きだったか」を持つ。これが自分の捨て札一覧と、伏せた札の記録の両方の土台になる。公開・非公開の線は変えない（その時点で表向きに場へ出たかで決める）。戦記の投影は既存の `logView` の許可リストのまま広げる。

**Spec:** 本計画。前提は [捨て札と戦記](2026-09-16-public-record.md)（第1段は main の `5b61a019`）、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md)（PR A・B とも main）、[オンライン設計 §5・§6・§8](../specs/2026-09-07-online-game-design.md)、[G03](../../rules/second-edition/rulings.md)（優先権と同時入力）、[G11](../../rules/second-edition/rulings.md)（回収）。

**Worktree / ブランチ:** `/Users/chinju/git/madou-senki-record2`（ブランチ `deferred-followups`、main の `2cc32530` 上）。main への merge はユーザーが行う。

## この文書について

親計画 `2026-09-19-deferred-followups.md` の PR 3 の部分だけを抜き出したもの。PR 0（#15）・PR 1（#16）・PR 2（#17）の上に積む。Task 6〜8（PR 4・5）は親計画にあり、この run の範囲外。

## 現状（PR 3 に関係する部分）

- 戦記（`apps/web/src/game/PublicLog.tsx`）は全件スクロール、手番ごとの見出し、パスのまとめ、新しい順 / 古い順の切り替えまで入っている。絞り込みは無い
- PR 2 で本人だけに見える記録が、卓の行に「（自分だけに見えています：…）」として合流するようになった。絞り込みはこの合流を壊さないこと
- `PlayerView.logs` は毎回全件送る。PR 0 の時点で bot の6席1試合が公開イベント1278件・公開ログ106KB で、第1段の目安（公開ログ100KB / 1回のスナップショット200KB）を既に超えていた。PR 2 で記録が増えているので、まず測り直す
- 計測は `scripts/measure_public_record.ts`（`node --experimental-transform-types --no-warnings --import ./scripts/ts-resolve-hook.mjs scripts/measure_public_record.ts`）

## Task 4: 戦記の絞り込み

- [x] 画面: 全員 / 自分に関係する記録 / 参加者別。選択は同じ卓の再読み込みで保つ（`sessionStorage`）
- [x] 「自分に関係する」は、自分が行為者、自分が対象、自分の札が動いた記録とする。判定基準を1か所に置き、試験で固定する
- [x] 絞り込み中に新しい記録が来たときの追従は、第1段の規則（追従中は末尾に留まる、上へ戻ると「最新へ」）のまま
- [x] 受け入れ条件（数値）: bot の4人対戦で測り、**攻撃1回あたりの実質行数**（宣言からその攻撃の結末の行までに描画される行数）を数える。PR 0 時点は13行で、うちパス行が7行（54%。2026-09-20 に bot 4人対戦の3手番で実測）。絞り込みを「自分に関係する記録」にしたとき、自分が関わる攻撃1回あたり**7行以下**にする。測り方と実測値をコミットに書く
- [x] `apps/web/test` に試験
- コミット: `feat: filter the public record by seat and relevance`

## Task 5: 過去分のページ取得

- [x] まず計測する。`scripts/measure_public_record.ts` を Task 3 の後に実行し、公開ログとスナップショットの大きさを記録する。攻撃の多い卓を模した種でも測る
- [x] 目安（公開ログ 100KB / 1回のスナップショット 200KB）を下回るなら、この Task は実装せず計測値を残して閉じる。判断と数値をコミットに書く
- [x] 超えるなら: `PlayerView.logs` を最新50件と `logStart`（先頭のイベントID）にし、`packages/protocol` に `LOG_PAGE { beforeId, limit }`（1回最大200件）の要求と応答を足す。`room.ts` は `viewFor` と同じ投影で返す。閲覧専用の接続でも取れる
- [x] 試験: 他者の秘密札名がページ応答に出ない、`beforeId` の境界、上限件数、再接続後に続きから取れる、決着後も取れる
- [x] 画面: 上端までスクロールしたら過去分を読み、読み込み中と先頭に達したことを示す
- コミット: `feat: page the public record over the room socket`

### 実装の記録（2026-09-20）

- 計測（実装前）: `scripts/measure_public_record.ts` を `4 6 10 6:31 6:47 8:53` で実行。6席・seed 17 で公開ログ **108,499 B**、攻撃の多い 8席・seed 53（攻撃46回）で公開ログ **215,045 B** / スナップショット **235,798 B**。公開ログ 100KB とスナップショット 200KB の両方を超えたので実装した
- 計測（実装後）: 公開ログは卓の長さによらず **約 4.2KB**（最大 4,295 B）、スナップショットは最大 **21,913 B**。8席・seed 53 では 215,045 → 4,129 B、235,798 → 21,913 B
- 設計の変更: 投影は `viewFor` と `LOG_PAGE` で共通の `logPage()`（`packages/engine/src/view.ts`）を通す。`privateLogs` も同じ窓に合わせて切る。合わせないと、本人だけに見える古い行が卓の行のない場所に残り、PR 2 の合流が壊れる。先頭ページだけは、最初の公開イベントより古い本人の記録も一緒に載せる
- `LOG_PAGE` は commit を伴わない読み取りなので、envelope を持たず generation も見ない。閲覧専用の接続でも取れる
- 過去分を読み込んでも「新着」に数えない。読み手のいた行が動かないよう、増えた高さのぶん scroll 位置を戻す
- 追随: `tests/e2e/public-record.spec.ts` は再読み込み後に窓の分しか持たないので、「過去の記録を読む」で最初まで遡る手順を足した
- 期待値を変えた既存試験: `packages/engine/test/public-record-events.test.ts` の `record()` は、記録全体を見る意図なのでページを遡って組み立てるようにした（窓の 50 件では 3 件が落ちていた）。`apps/worker/test/lobby.test.ts` と `tests/e2e/bot-client.ts` は `log-page` を待ち受けの対象から外しただけ
