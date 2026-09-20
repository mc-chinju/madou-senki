# 後回しにした分の実装（捨て札の出どころ・戦記の拡充・任せるの範囲） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a planning deliverable; it does not authorize production deploy by itself.

**Goal:** [捨て札と戦記](2026-09-16-public-record.md) の第2段と、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md) の「後段」を、戦記そのものの読みやすさと合わせて片づける。戦記だけを読めば「誰が誰に何をして、判定がどうなったか」を追えるようにし、自分が捨てた札を見返せるようにし、伏せたまま捨てた札・従者防御・回収・再シャッフルを残す。長い対戦でも絞り込みとページ取得で追える。「任せる」を手番単位まで広げ、決着後は全員の手札と正体を開示する。

**Architecture:** 捨て札へ積む処理を1つの関数に集約し、札ごとに「誰が捨てたか」「表向きだったか」を持つ。これが自分の捨て札一覧と、伏せた札の記録の両方の土台になる。公開・非公開の線は変えない（その時点で表向きに場へ出たかで決める）。戦記の投影は既存の `logView` の許可リストのまま広げる。

**Spec:** 本計画。前提は [捨て札と戦記](2026-09-16-public-record.md)（第1段は main の `5b61a019`）、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md)（PR A・B とも main）、[オンライン設計 §5・§6・§8](../specs/2026-09-07-online-game-design.md)、[G03](../../rules/second-edition/rulings.md)（優先権と同時入力）、[G11](../../rules/second-edition/rulings.md)（回収）。

**Worktree / ブランチ:** `/Users/chinju/git/madou-senki-record2`（ブランチ `deferred-followups`、main の `2cc32530` 上）。main への merge はユーザーが行う。

## この文書について

親計画 `2026-09-19-deferred-followups.md` の PR 1 の部分だけを抜き出したもの。PR 0（戦記の読みやすさ）は #15 で、このブランチはその上に積む。Task 3〜8（PR 2〜5）は親計画にあり、この run の範囲外。

## 現状（PR 1 に関係する部分）

- `PlayerView` は `discardCount` だけを送る。中身は誰にも送らない（第1段）
- `GameState.discard` は札IDの配列。誰が・表向きで捨てたかを持たない
- 捨て札へ積む処理は `packages/engine/src` の10ファイルに散らばる。`discardPhysical`（`discard.ts`）を通るのは10か所で、残りは `s.discard.push(...)` を直接呼ぶ
- 山札切れと大陸の夜明けで `s.discard=[]` になる（`lifecycle/advance.ts`）
- 保存済みの卓の読み替えは、PR A の `pending` の読み替え（`apps/worker/src/rooms/room.ts` の `current()`）が前例

## Task 1: 捨て札の出どころを1か所にまとめる

- [x] `packages/engine/src/discard.ts` に `moveToDiscard(state, cardInstanceId, { ownerId, faceUp })` を作る。`GameState.discard` を `{ cardInstanceId, ownerId?, faceUp }[]` に替え、札IDだけが要る箇所のための `discardIds(state)` を出す
- [x] `s.discard.push(...)` の直接呼び出し10か所を `moveToDiscard` に替える。各呼び出しで `faceUp` を決める根拠をコメントに1行残す（使用済みの行動札＝表、手札調整・死亡時の手札・伏せた詠唱・裏向き従者＝裏）
- [x] `state.ts` の全札の突き合わせ（`return [...state.deck, ...state.discard, ...]`）、`reclaim.ts` の `s.discard.includes(...)`、`lifecycle/advance.ts` の再シャッフル（`s.discard=[]`）を新しい形に合わせる
- [x] 保存済みの卓の読み替え: `apps/worker/src/rooms/room.ts` の `current()` で、`discard` が文字列の配列なら `{ cardInstanceId, faceUp: true }` に読み替える（PR A の `pending` の読み替えと同じ形。読み込みだけでは永続 revision を変えない）。表向き扱いにするのは、過去分の出どころが復元できないため。読み替えた卓では自分の捨て札一覧が空になることを受け入れる
- [x] 試験: 10か所それぞれで `ownerId` と `faceUp` が入る、再シャッフルで空になる、回収で捨て札から抜ける、保存済みの文字列配列が読み替わる
- コミット: `refactor: record who discarded each card and whether it was face up`

## Task 2: 自分の捨て札一覧

- [ ] `view.ts`: `self.discardedCardInstanceIds`（自分が捨てて今も捨て札にある札、捨てた順）を足す。他者には `discardCount` のみ（現状維持）
- [ ] 試験（先に書く）: 他視点にこの配列が出ない、山札へ戻したら消える、回収で手札に戻したら消える、死亡で捨てた手札が本人には見える、bot の全試合で他者の札IDが混ざらない
- [ ] 画面: 見出しの「捨て札 N」をボタンにし、ダイアログで自分の捨て札を出す。新しい順と、同名をまとめた表示を切り替えられる。札名から既存の `CardDialog` を開ける。キーボードで開閉できる
- [ ] `apps/web/test` に表示試験
- コミット: `feat: let a seat review the cards it discarded`

