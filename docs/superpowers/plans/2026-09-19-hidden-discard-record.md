# 後回しにした分の実装（捨て札の出どころ・戦記の拡充・任せるの範囲） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document is a planning deliverable; it does not authorize production deploy by itself.

**Goal:** [捨て札と戦記](2026-09-16-public-record.md) の第2段と、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md) の「後段」を、戦記そのものの読みやすさと合わせて片づける。戦記だけを読めば「誰が誰に何をして、判定がどうなったか」を追えるようにし、自分が捨てた札を見返せるようにし、伏せたまま捨てた札・従者防御・回収・再シャッフルを残す。長い対戦でも絞り込みとページ取得で追える。「任せる」を手番単位まで広げ、決着後は全員の手札と正体を開示する。

**Architecture:** 捨て札へ積む処理を1つの関数に集約し、札ごとに「誰が捨てたか」「表向きだったか」を持つ。これが自分の捨て札一覧と、伏せた札の記録の両方の土台になる。公開・非公開の線は変えない（その時点で表向きに場へ出たかで決める）。戦記の投影は既存の `logView` の許可リストのまま広げる。

**Spec:** 本計画。前提は [捨て札と戦記](2026-09-16-public-record.md)（第1段は main の `5b61a019`）、[初期配置の同時化と反応窓](2026-09-16-concurrent-ready.md)（PR A・B とも main）、[オンライン設計 §5・§6・§8](../specs/2026-09-07-online-game-design.md)、[G03](../../rules/second-edition/rulings.md)（優先権と同時入力）、[G11](../../rules/second-edition/rulings.md)（回収）。

**Worktree / ブランチ:** `/Users/chinju/git/madou-senki-record2`（ブランチ `deferred-followups`、main の `2cc32530` 上）。main への merge はユーザーが行う。

## この文書について

親計画 `2026-09-19-deferred-followups.md` の PR 2 の部分だけを抜き出したもの。PR 0（戦記の読みやすさ、#15）と PR 1（捨て札の出どころ、#16）の上に積む。Task 4〜8（PR 3〜5）は親計画にあり、この run の範囲外。

## 現状（PR 2 に関係する部分）

- PR 1 で `GameState.discard` は `DiscardEntry[]`（`{cardInstanceId, ownerId?, faceUp}`）になり、捨て札へ積む処理は `moveToDiscard`（`packages/engine/src/discard.ts`）と `discardPhysical` に集約されている。`faceUp` は「卓が既に見た面か」で、新たな公開ではない
- PR 0 で戦記に、手番・カード使用・能力・判定・ダメージ・状態・距離・パス・攻撃の結末・判定不要が記録されている。記録関数は `packages/engine/src/public-record.ts`、投影は `view.ts` の `logView`（種類ごとの許可リスト）、画面は `apps/web/src/game/PublicLog.tsx`
- 未記録: 伏せたまま捨てた札、詠唱と従者の配置・並べ替え、表になった従者の防御と士気判定、回収、捨て札を山札へ戻す処理
- 本人だけに見せる記録は `audience: {playerId}` で、`PlayerView.privateLogs` に入る。戦記の画面は `logs`（公開）だけを描いている

## Task 3: 伏せた札・従者防御・回収・再シャッフルの記録

- [x] `GameEvent.type` に足す: `CARDS_DISCARDED`（全員には枚数、本人には札名。Task 1 の `faceUp:false` の経路）、`CHANTED`、`FOLLOWERS_ARRANGED`、`FOLLOWER_DEFENDED`、`MORALE_CHECKED`、`CARD_RECLAIMED`、`DECK_RESHUFFLED`
- [x] 記録は `moveToDiscard` と、従者防御・士気判定・回収の確定処理で行う。コマンドの入口ごとに書かない
- [x] `logView` の許可リストに種類ごとの出してよいフィールドを足す。伏せた札は全員向けに枚数だけ
- [x] 試験: 手札調整で捨てた札が他者には枚数だけ・本人には札名、死亡時の手札、命中時の詠唱破棄、従者防御と士気判定の並び、回収した札名、大陸の夜明けと山札切れ、`public-record-privacy.test.ts` が通る
- [x] 画面: 新しい種類の文言。本人向けの記録は「自分だけに見えています」と分かる形で混ぜる
- コミット: `feat: record face-down discards, follower defense, reclaims and reshuffles`

### 実装で決めたこと

- **伏せた札は1枚1件で記録する。** `moveToDiscard` は1枚ずつ呼ばれ、どこが「ひとつの行為」かを知らない。過去の件に枚数を足し込むと、確定済みの手の記録を後から書き換えることになる。engine は `count:1` の公開1件と本人向け1件を積み、画面が同じ席の連続を1行にまとめて枚数を合算する（`publicLogSections` の `discards`）
- **本人向けの記録は `audience:{playerId}` の別イベントにした。** 同じ1件を `logView` で読み手ごとに削る手もあるが、それだと本人の `logs`（公開記録）に自分の伏せ札が載り、「公開記録は表になった札しか名指さない」という `public-record-privacy.test.ts` の不変条件を崩す。`privateLogs` に分けておけば線がそのまま残る
- **捨て札の山は公開ではない。** 回収の記録が札名を全員に出すのは `resolution`（場に表で出ていた）から取ったときだけ。山から取るふぇありぃそぅどは本人向けの記録だけが名指す
- **`FOLLOWER_DEFENDED` は素通りと士気失敗では記録しない。** 素通りは従者が何もしていない。士気失敗は `MORALE_CHECKED` が同じことを言っているので、2行に割れない
- **画面は `privateLogs` を id 順に混ぜる。** 本人向けの行には「自分だけに見えています」を添える（`.log-own`）。引いた札・配役の確認も同じ扱いで戦記に並ぶ
- **詠唱と従者の並べ替えも本人向けに札名を残す。** 依頼の合意事項が「事実と枚数を全員に、札名を本人に」なので、`CHANTED` は `cardInstanceId`、`FOLLOWERS_ARRANGED` は `cardInstanceIds` を `audience:{playerId}` の別イベントで積む。盤面を見れば分かる情報でも、戦記だけを読み返して自分が何を伏せたか辿れる形にする
- **卓の1件と本人の1件は画面で1行にまとめる。** `CHANTED`・`FOLLOWERS_ARRANGED`・`CARD_RECLAIMED` は公開1件と本人1件が隣り合うので、`CARDS_DISCARDED` と同じく1つの行為を1行で見せる。全体を「自分だけに見えています」にすると卓が見た枚数まで私的に見えるため、札名だけを行末の `.log-own` に添える
- **`DECK_RESHUFFLED` の枚数は「山札へ戻した枚数」。** 大陸の夜明けは山札が残ったまま起きるので、混ぜた後の山札の枚数を数えると意味が変わる。戻す前の捨て札の枚数を数え、戻す札が無ければ記録しない
- **従者の防御は、複数ヒットのうち実際に応じた結末を記録する。** 互換用の `followerResults` は最後のヒットの結末を持つが、後のヒットで無視されたことは前のヒットを防いだ事実を取り消さない。記録は最初の「素通りでない」結末を採る

