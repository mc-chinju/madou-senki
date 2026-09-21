# 後回しにした分の実装（捨て札の出どころ・戦記の拡充・任せるの範囲） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a planning deliverable; it does not authorize production deploy by itself.

**Goal:** [捨て札と戦記](2026-09-16-public-record.md) の第2段と、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md) の「後段」を、戦記そのものの読みやすさと合わせて片づける。戦記だけを読めば「誰が誰に何をして、判定がどうなったか」を追えるようにし、自分が捨てた札を見返せるようにし、伏せたまま捨てた札・従者防御・回収・再シャッフルを残す。長い対戦でも絞り込みとページ取得で追える。「任せる」を手番単位まで広げ、決着後は全員の手札と正体を開示する。

**Architecture:** 捨て札へ積む処理を1つの関数に集約し、札ごとに「誰が捨てたか」「表向きだったか」を持つ。これが自分の捨て札一覧と、伏せた札の記録の両方の土台になる。公開・非公開の線は変えない（その時点で表向きに場へ出たかで決める）。戦記の投影は既存の `logView` の許可リストのまま広げる。

**Spec:** 本計画。前提は [捨て札と戦記](2026-09-16-public-record.md)（第1段は main の `5b61a019`）、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md)（PR A・B とも main）、[オンライン設計 §5・§6・§8](../specs/2026-09-07-online-game-design.md)、[G03](../../rules/second-edition/rulings.md)（優先権と同時入力）、[G11](../../rules/second-edition/rulings.md)（回収）。

**Worktree / ブランチ:** `/Users/chinju/git/madou-senki-record2`（ブランチ `deferred-followups`、main の `2cc32530` 上）。main への merge はユーザーが行う。

## この文書について

親計画 `2026-09-19-deferred-followups.md` の PR 4 の部分だけを抜き出したもの。PR 0（#15）・PR 1（#16）・PR 2（#17）・PR 3（#18）の上に積む。Task 7・8（PR 5）は親計画にあり、この run の範囲外。

## 現状（PR 4 に関係する部分）

- `stableOutcome` で `state.outcome` が入るだけで、手札・捨て札・未公開の正体はそのまま隠れている
- 投影は `packages/engine/src/view.ts` の `viewFor`。他席は `handCount` / 裏向きの枚数 / `revealed:false` しか見えない
- PR 1 で `GameState.discard` は `DiscardEntry[]`（`{cardInstanceId, ownerId?, faceUp}`）になり、自分の捨て札は `self.discardedCardInstanceIds` で見える
- PR 3 で `PlayerView.logs` は最新50件の窓になり、過去は `LOG_PAGE` で取る。決着後も取れることが要件
- PR 3 で「知ったことは記録ではなく state に置く」方針を採り、`inspectionHistory` と `wishHistory` がある

## Task 6: 決着後の全公開

- [x] 裁定: オンライン設計 §8 の表に「決着後は全員の正体・手札・捨て札・山札を開示する」を足す。原文に規定は無く、感想戦のためのオンライン補完であることを明記する
- [x] `view.ts`: `state.outcome` があるときだけ、全席の人物・手札・伏せた詠唱・裏向き従者と、捨て札・山札の中身を出す。それ以外は現状維持
- [x] 進行中に漏れないことを試験で固定する（`outcome` が無い状態では従来どおり）
- [x] 画面: 結果画面で全員の正体・手札・捨て札を見られるようにする。戦記も全件見られる（既存）
- [x] bot の全試合で、決着の1手前までは秘密が出ないことを確かめる
- コミット: `feat: open every hand and identity once the game ends`

### 実装で決めたこと

- 開示は `PlayerView` に足した `reveal` 1本に集約した（`packages/engine/src/endgame-reveal.ts`）。既存の `players` / `self` / `logs` は触っていないので、「それ以外は現状維持」が1式の有無だけで確かめられる。`view.ts` の該当箇所は `reveal:state.outcome?endgameReveal(state):null` だけ
- 戦記は開示で書き換えない。決着後も「その時点で見えたもの」のまま。画面の文面にもそう書いた
- 画面は結果パネルの直下に「全員の手の内」（`apps/web/src/game/EndgameRevealPanel.tsx`）。席ごとに正体・手札・従者・詠唱・捨て札、最後に持ち主のいない捨て札と山札（195枚あるので `details` で畳む）
- `tests/e2e/public-record.spec.ts` の socket 監査は、決着後の1回だけ逆向き（秘密が届いていること）に読む。決着前の監査は従来どおり

