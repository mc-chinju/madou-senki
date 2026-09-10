# R6 原典例・組み合わせ受け入れ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. 各群を独立レビューで閉じる。無断のcommit/stashは行わない。

**Goal:** 原典S01〜S32を指定された値・操作順で検証し、保存復帰とカード保存則を含めて条項台帳へ対応付ける。

**Architecture:** 既存の `transition` / `viewFor`、Engine固定乱数試験とSQLite DO試験を使う。R4/R5で追加する公開コマンド以外のテスト専用入力を製品へ導入しない。原典が抽象数値を与えるS13/S32は解決器試験として明記する。

**Tech Stack:** TypeScript、Vitest、Cloudflare Workers test pool、Playwright、Python台帳検証器。

**Spec:** [原典32例](../../../data/second-edition/scenarios.json)、[採用裁定](../../rules/second-edition/rulings.md)、[能力裁定](../../rules/second-edition/rulings-characters.md)、[完了計画R6](2026-09-08-completion-plan.md)、[R4](2026-09-08-r4-suppression-reclaim.md)、[R5](2026-09-08-r5-combat-cards.md)、`data/second-edition/runtime-obligations.json` と `runtime-coverage.json`。R5 Appendix Bの既存試験一覧は探索の入口であり、現在の合格証跡ではない。

## Global Constraints

- 行動220枚・人物26枚・固有能力110件、2ndのみ。
- 実際のproducerがない場合はR4/R5の担当群へ戻す。能力・状態・回収履歴を直接注入して実カード経路の合格としない。
- 開始fixtureの配札・人物配置は許容するが、試験対象の中間効果は合法なコマンドから発生させる。前提の死亡・流浪等が試験対象ならその原因も実行する。
- `act`（`packages/engine/test/combat-helpers.ts`）は既にJSON復帰の同値と220枚保存を検査する。機能の重複した試験補助層を作らない。
- EngineのJSON複製を実DOの切断復帰と同一視しない。再送試験は元のcommandId・expectedRevision・窓参照をそのまま再送する。
- 明示パスと無期限の回答待ちを維持する。試験のstep上限到達は診断でありゲームの自動終了条件ではない。
- 同じソースのbrowser試験中は関連ソース・fixtureを凍結する。対象ファイルの所有者を作業台帳に記録する。
- R6完了はR7の正式START許可でも対人確認の代替でもない。

## Task 1: 介入・ロール・世代 S01〜S07

**Files:** Modify `packages/engine/test/reactions.test.ts`, `task7d-rolls.test.ts`, `declaration-modifier-numerics.test.ts`; Create `apps/worker/test/room-canonical-scenarios.test.ts`, `apps/worker/test/fixtures/canonical-scenarios.ts`, `apps/worker/test/fixtures/canonical-room.ts`; Modify `apps/worker/test/fixtures/game-scenarios.ts`, `store-worker.ts`, `apps/worker/src/rooms/room.ts`。

**Interfaces:** Engine `transition(state, {actorId, command}, entropy)`、`activeWindowRef(state)`。DOは既存 `openTestRoom(scenario)` の `command`, `stored`, `restart`, `snapshotFor` を使う。新しいfixture名は `canonical-S01`, `canonical-S04`。有限入力は既存の `PASS`, `PLAY_REACTION`, `CANCEL_REACTION`。

現在Roomは各受理コマンドで内部の `entropy()` を呼ぶため、fixtureの初期乱数だけではS04のDO再振り値を固定できない。テスト可能な境界としてRoomに `protected commandEntropy(): Entropy { return entropy(); }` を設け、既存2呼出しを `this.commandEntropy()` に置き換える。乱数生成の本番実装はこの既存関数のままにする。テスト専用 `canonical-room.ts` の `CanonicalRoom extends Room` は `setNextEntropy(value:Entropy):void` と `commandEntropy()` を持ち、次の一回だけ固定値を使って消去する。`store-worker.ts` だけで `CanonicalRoom as Room` をexportし、製品entrypoint・本番wranglerへは追加しない。

テストは `runInDurableObject` でそのインスタンスへ固定entropyを設定し、次に通常WebSocketで最後のPASSを送る。設定した値が**実DO内の結果生成**に到達することを、実結果[4,4]とoverride消費回数1で先に検証する。各fixtureの部屋は独立し、`afterEach(reset)`で破棄する。再送対象 `originalEnvelope/originalAck` は神性介入宣言ではなく、[4,4]を生成・保存した最後のPASSの組。evict後の再送でprovider呼出しも新しいattemptも発生しない。タスク3の固定抵抗値もこのテスト専用境界を使用する。

- [x] S01: 席A→B→C→D、C優先の同じrevisionでDを先に送って拒否・保存状態不変、続けてCを受理。HTTP/WSもCの正当な優先権を示す。D先着によるロール・補充は0回。
  - 証跡: `docs/operations/evidence/2026-09-10-r6-s01-http-ws.json`。HTTP本人投影/参加者認可・DO拒否不変/同revision受理・画面優先権を確認。R6全体は未完。
- [x] S02: A/Bパス→C介入→子取消→親cursor0/全パス消去。同じ親IDでも旧generationのPASSは拒否し、新generationのAのPASSは受理。
  - 証跡: `docs/operations/evidence/2026-09-10-r6-s02-child-cancellation.json`。実C神性介入→D命運取消、親リセット・旧世代拒否・新AパスをEngine/DO/UIで確認。
- [x] S03: Bの任意時機札宣言→即時1枚補充→Cの命運凶変で取消。物理札消費、補充維持、行動/回数非返却を同じ状態列で確認。
- [x] S04: 実2d6[2,3]→神性介入→[4,4]の保存直後にDOをevictし、元コマンド再送。ACKと保存状態が一致し、attemptsは2回、roll IDは同一、ゾロ目フラグも同一。
  - S03/S04証跡: `docs/operations/evidence/2026-09-10-r6-canonical-entropy.json`。指定のcommandEntropy境界・実結果保存PASS再送を確認。canonical fixture名の統合は残る。
- [x] S05: 命運凶変の強制失敗→成功値への全2d6再振りでもsuccess=false。出目と強制成否の独立を検査。
  - 証跡: `docs/operations/evidence/2026-09-10-r6-canonical-fixtures-s05.json`。成功値8/閾値9への全再振りでも強制失敗を維持。canonical-S01/S04入口も統合済み。
- [x] S06: 実攻撃を効果Lv6で防御比較まで進め、気合いを遅れて要求。拒否時に精神・使用回数・手札・乱数消費・状態全体が変わらない。
  - 証跡: `docs/operations/evidence/2026-09-10-r6-s06-s07-progress.json`。S06 Engine/DO/UI成功。S07はEngineのみ追加済み、transport未完。
- [x] S07: 実リーアの必勝の祈りを予約領域へ移し、同じ技への同一物理札再使用を拒否。親終了で戻った後、後の独立した技では同じ札を使用できる。途中の札を手札へ直接移動しない。
  - 証跡: `docs/operations/evidence/2026-09-10-r6-s07-prayer-transport.json`。実2イベントの予約/拒否/返却/再使用をDO/UIまで確認。Task1指定Engine57件は初回56成功＋既存窓仮定修正1成功。

DOの再送検査は次の形を使い、`before`は最初の成功後に読む。

```ts
const before = await room.stored();
await room.restart();
expect(await room.command(actorId, originalEnvelope)).toEqual(originalAck);
expect(await room.stored()).toEqual(before);
```

Run: `pnpm exec vitest run packages/engine/test/reactions.test.ts packages/engine/test/task7d-rolls.test.ts packages/engine/test/declaration-modifier-numerics.test.ts` と `pnpm test:worker -- room-canonical-scenarios.test.ts`。新しい必須assertionの失敗を先に保存し、必要な修正は対象の既存機構に限定する。

## Task 2: 防御・距離・数値 S08〜S17、S31〜S32

- [x] 対応するDO/browser20参照を具体名・tupleへ束縛。DO8・browser13件成功。旧S10画面のfixture指定不整合1件を修正。証跡: `docs/operations/evidence/2026-09-10-r6-task2-transport-task3-progress.json`。

- [x] S31実詠唱→専用攻撃13点、S32抽象値/最終丸め/nullを確認。S08〜S17/S31/S32のEngine16参照を具体的tupleへ束縛。指定5suite125件・全型・台帳成功。DO/browser参照の台帳反映は次。レビューはユーザー指示により実施しない。証跡: `docs/operations/evidence/2026-09-10-r6-task2-engine-bindings.json`。

- [x] S15/S16は既存新Engine3条件に続きDO3/browser3を確認。実同陣営公開前後0/4と実0ダメージ命中公開、全入力再送/再読込。証跡: `docs/operations/evidence/2026-09-10-r6-s15-s16-transport.json`。

- [x] S14/S17の実到達条件をEngine/DO/UIで確認。S15同陣営実人物の公開前後2件とS16実0ダメージ命中はEngineまで追加、transportは未完。証跡: `docs/operations/evidence/2026-09-10-r6-s14-s17-progress.json`。

- [x] S08/S11/S12の実札条件とS13抽象数値条件を確認。Engine5・DO3・browser3・型成功。S12は残2発の別防御窓を明示。S13は抽象解決器、実天地百撃斬producerを別に保持。証跡: `docs/operations/evidence/2026-09-10-r6-s08-s11-s13.json`。

- [x] S09/S10指定producerの数値・距離・取消範囲をEngine/DOで確認。画面2件は実カード操作/再読込を確認（祈り1固定はEngine/DO）。証跡: `docs/operations/evidence/2026-09-10-r6-s09-s10-canonical.json`。

**Files:** Modify `packages/engine/test/combat.test.ts`, `distance.test.ts`, `multi-hit.test.ts`, `task7b-techniques.test.ts`, `action-value-arithmetic.test.ts`。

**Interfaces:** `act`, `finish`, `closeWindow`, `ready`, `handCard`, `character`を既存ファイルから使用する。解決器試験のみ `composeValue` と従者snapshot関数を直接呼ぶ。

| ID | 同じ試験本文で必要な結果 |
|---|---|
| S08 | 転移失敗後・従者受け前、別の実反撃札を受理。転移自体は消費済みで再試行不可。 |
| S09 | 実効果Lv6攻撃の2対象のうちBがLv6反撃。B宛元ヒットと反撃を消し、C宛ヒットは残す。 |
| S10 | 遠距離のLv5に近Lv7反撃。元ヒット消去・返りダメージなし。元値をLv3/5で代替しない。 |
| S11 | B/C各間合い1枚へA踏み込み1枚、3物理札が各1回消費され、元の距離関係は不変。 |
| S12 | 実3ヒットの1発目だけ間合い。残る2発の独立した防御と命中を確認。 |
| S13 | 抽象Lv5/損害6×3/前列Lv3 HP2→[4,4,4]合計12。snapshotは1回、物理従者破棄も1回。別の実天地百撃斬試験をproducer証拠として保持。 |
| S14 | 従者受け開始後、手札にある合法防御札を拒否する一方、第三者の合法な介入は受理。 |
| S15 | 友好対象の公開が従者受け前なら消失、開始後なら消失しない。両方とも実攻撃から進める。 |
| S16 | 実数値0ダメージの命中で人物公開。`null`ダメージ試験と区別して残す。 |
| S17 | 実二者反射後の同一系統再帰を拒否し、未使用の別防御は継続可能。手札を直接復元する試験は系統判定単体と明記し、回収の証拠にしない。 |
| S31 | 専用noChecksを持つ実札で、能力の詠唱免除なしでは必須詠唱を省略できない。正しい所有者の専用使用成立も確認。 |
| S32 | 抽象base5、+1、×2、×0.5→6。丸めは最後、nullはnull。存在しない印刷コンボを作らない。 |

S09の実producerはA=小人のランバの専用 `死戦斧 a2-p11-r3c2`（効果6、ダメージ10、詠唱なし・使用チェックなし）をB/Cへ宣言し、B=侍大将のシンが通常 `受け流し a2-p12-r1c3`（受けた戦士技の効果Lv6）で反撃する。Bの必要な使用チェックは固定[1,1]、他の能力・加算・間合いを選ばず、Cの10点を確認する。S10はA=アーネスの通常 `黒流弓 a2-p07-r3c3` を単一Bへ効果5で使い、遠距離のB=ランスロットが専用 `妖撃破山剣 a2-p11-r1c2`（効果6、詠唱不要・反撃チェック不要）に自分の `必勝の祈り a2-p05-r2c3` のd6=1を足して効果7にする。攻撃側の黒弓能力や追加補正は選ばない。祈りは反撃の効果確定窓へ合法に宣言し、距離を変更する札は使わない。

- [x] 表の値に一致する実札と合法な印刷修正をcatalogから選ぶ。成立しない組合せをfixtureで固定値上書きして通さず、原典抽象値の解決器試験と実producer試験に明示的に分ける。
- [x] 既存の関連試験へ不足assertionを追加できる場合は重複させない。S番号と役割をliteral test名へ含め、台帳は具体的なparameter tupleまで束縛する。
- [ ] 各変更の失敗→修正→対象suite成功を記録し、表の全条件について独立レビューする。

Run: `pnpm exec vitest run packages/engine/test/combat.test.ts packages/engine/test/distance.test.ts packages/engine/test/multi-hit.test.ts packages/engine/test/task7b-techniques.test.ts packages/engine/test/action-value-arithmetic.test.ts`。

## Task 3: 精神効果と秘密 S18〜S21

- [x] S20同一回復列とS21白光5/6・命中前対照同値を確認。Engine3/DO1/browser1・全型・台帳成功、S18〜S21の12具体参照を束縛。S21旧命中後秘密のブロッカーは現行の命中前条件に該当しない。証跡: `docs/operations/evidence/2026-09-10-r6-s20-s21-bindings.json`。

- [x] 指定4suite＋S18専用suiteは303件成功（初回293成功/10失敗、支払い回収窓の試験進行修正後mental-protection161成功）。S18陣営不変を追加。全型・台帳成功。証跡: `docs/operations/evidence/2026-09-10-r6-task2-transport-task3-progress.json`。S20/S21・具体参照は継続。

**Files:** Modify `packages/engine/test/mental-received-defenses.test.ts`, `mental-protection.test.ts`, `task7e-status-defenses.test.ts`, `received-defense-abilities.test.ts`; extend canonical Worker fixtures/test from Task 1。

**Interfaces:** 既存精神防御の有限選択とactionカードの回復継続を使う。S18は人物能力魔詩、S20は行動カード魔詩 `a2-p17-r1c1` であり、別のproducer。

- [x] S18: 実天地百撃斬で2対象×3ヒットを発生。B=レスターの魔詩に対する攻撃者の抵抗判定は1回、その通常失敗でB宛3発のみ取消、C宛3発は残す。停止状態・陣営変更が誤発生しない。DOは魔詩回答前と抵抗確定後を保存再開。
- [x] S19: ジルの実精神力・[6,6]失敗・選択した信仰心により陣営変更/停止を防ぎ、通常失敗によるB宛取消は維持。高精神力の成功値で置き換えない。
- [x] S20: 行動カード魔詩命中から回復 `nextCheck=1` へ。次の-2判定に失敗し、その後-1判定に成功する同一状態列を実行。各ターンの補充/行動停止・復帰を確認し、途中保存から同じ乱数で同じ結果へ戻す。
- [x] S21: 非公開シェリム（c2-p01-r1c1）へ通常 `白光 a2-p14-r1c2` の効果5・従者前ダメージ6を与え、本人の絶対結界が候補にあることを確認して不使用にし、実命中6点を確認。別の非公開人物との対照世界で、実命中による正当な公開が起きる前まで他人向け候補・窓/待機順・HTTP/WS投影が同一。不使用の能力IDをログ/DOMへ出さない。
- [x] 上記4例を具体的test名と束縛し、元例と異なる既存試験はrelatedのまま残す。

Run: `pnpm exec vitest run packages/engine/test/mental-received-defenses.test.ts packages/engine/test/mental-protection.test.ts packages/engine/test/task7e-status-defenses.test.ts packages/engine/test/received-defense-abilities.test.ts`、変更したDO suite。

## Task 4: 補充・回収・死亡・異界 S22〜S30

- [x] S30の4具体参照を束縛。Engine1/DO1/browser2・全型・台帳成功。継続種別ごとの保存前後/再送の最終対応は残る。証跡: `docs/operations/evidence/2026-09-10-r6-s30-bindings.json`。

- [x] S28/S29の8具体参照を束縛。指定Engine4suite133件・DO1/browser4・全型・台帳成功。S28 exact損害4はEngine、画面は実変身操作の証拠。証跡: `docs/operations/evidence/2026-09-10-r6-s28-s29-bindings.json`。

- [x] S26/S27の7具体参照を束縛。S27先行1人死亡確定時の全員向け勝敗なしを追加。Engine2/DO2/browser3・全型・台帳成功。証跡: `docs/operations/evidence/2026-09-10-r6-s26-s27-bindings.json`。

- [x] S24/S25の14 transport参照を具体化。DO6/browser8・全型・台帳成功。Engine9参照と合わせ条件確認済み。証跡: `docs/operations/evidence/2026-09-10-r6-s24-s25-transport-bindings.json`。

- [x] S24/S25 Engine9参照を具体名/tupleへ束縛。関連5suite115件成功、S25贈与確定後のpending-death/勝敗未確定を追加して4件成功。全型・台帳成功。transport参照は継続。証跡: `docs/operations/evidence/2026-09-10-r6-s24-s25-engine-bindings.json`。

- [x] S22/S23の7具体参照を束縛。Engine対象3件（空山札関連を含む）・DO2・browser3・全型・台帳成功。本体変更なし。証跡: `docs/operations/evidence/2026-09-10-r6-s22-s23-bindings.json`。Task4指定suite群は区切りで残る。

**Files:** Modify `packages/engine/test/open.test.ts`, `task7f-lifecycle.test.ts`, `task7g-lifetime.test.ts`, `follower-entry-abilities.test.ts`; R4/R5で作成する回収/贈与/祈願試験とcanonical Worker suite。

**Interfaces:** R4の確定した回収claim契約、R5の贈与/祈願/啓示契約を使用する。計画段階の型名を別途再定義しない。

- [x] S22: 一つの任意時機札補充中にOPENを2枚連続公開し、必要な子選択を終え、2枚が公開領域へ残り、通常札1枚が手札へ補充されたことを確認して同じ親宣言へ戻る。setupで2枚引く試験では代替しない。
- [x] S23: 山札1・捨て札2・解決領域1で3枚要求。最初の1枚→捨て札2枚のみshuffle→残り2枚、解決中の札は山札へ混ざらない。空山札で債務を残さない既存試験を保持。
- [x] S24: 正規所有名Xの物理札を回収し、同名別物理Yの通常権利を拒否。追加1回/無制限は独立に成立。取消・予約・実取得の予算時点はR4採用裁定どおり。
- [x] S25: 実チャム死亡から任意の手札1枚を贈与し、同じ札を死亡カードでも渡す要求は拒否。最終捨て札と勝敗前に移動し、他人への投影で私的な贈与内容を漏らさない。
- [x] S26: 実保護対象死亡→被保護者流浪→実復活→被保護者復帰/初期配札・従者処理。死者/流浪を直接注入した既存試験とは区別。
- [x] S27: 残る二者が実同時死亡して、両者の死亡窓/贈与・子効果が閉じた後だけ全滅引分けを確定。片方確定時の勝者は存在しない。
- [x] S28: 二つの独立fixtureでランスロットとウーノスに各損害4を与える。ランスロット変身後の損害4/履歴/旧能力継承と、実復活の儀式によるウーノス→ヴァンミールの損害0/非継承を別々に束縛。
- [x] S29: 実ディア小人族3発を同じ仮想従者HP1で毎発軽減。物理札生成/捨て札/通常回収なし、終了後仮想源消去、220枚一意。
- [x] S30: 実裂界で異界へ移したBへ、実祈願と実啓示を使おうとして拒否・不変。その後実大陸の夜明けで復帰。異界者の手札/人物を候補・エラーから推測できない。
- [x] 必須選択前/確定直後のDO再開と元receipt再送を、異なる継続種別ごとに確認する。対応表と変身DO補完: `docs/operations/evidence/2026-09-10-r6-task4-continuations.json`。

Run: 対応する上記Engine各suite、R4/R5の変更対象suite、canonical Worker suite。関連する既存リグレッションを外さない。

## Task 5: 組み合わせ・到達可能な状態列と台帳閉鎖

- [x] Vanmil実死亡/C13終末の別列をEngine/DOへ追加。指定保持/未確定→1回の終末、全入力再起動再送。Engine2/DO1・全型・台帳成功。証跡: `docs/operations/evidence/2026-09-10-r6-canonical-vanmil-terminal.json`。

- [x] 上記Lia実列を共有fixtureと計画指定canonical-combinationsへ移し、実DO全入力再起動/元receipt再送を追加。Engine23（最終対象1）/DO1・全型・台帳成功。証跡: `docs/operations/evidence/2026-09-10-r6-canonical-lia-life.json`。他の組合せは未完。

- [x] 生存Vanmil/Asfelt継続値/Lia実死亡・復活・再祝福の同一Engine列を既存suppression-blessing試験へ拡張。23件・全型・台帳成功。DO/指定artifact/正式束縛は未完。証跡: `docs/operations/evidence/2026-09-10-r6-lia-life-engine.json`。

**Files:** Create `packages/engine/test/canonical-combinations.test.ts`; extend `apps/worker/test/room-canonical-scenarios.test.ts`; Modify `data/second-edition/runtime-coverage.json`, `docs/rules/coverage.md`, `docs/checkpoints/2026-09-08-implementation.md`。

**Interfaces:** 公開入力列と固定entropyで進める。入力待ちは `viewFor` の有限候補から選び、保存後にも同じ入力列を再生する。正式START全人数・ブラウザ通しはR7/R8の担当。

- [x] 生存ヴァンミールによる能力禁止→継続値停止→リーアの祝福成功→実リーアのG15死亡処理入口で解除失効→合法なリーア復活→新たな祝福成功を実行し、life ID・永久報酬・公開範囲を確認。対局継続に必要な他陣営の生存者を残す。
- [x] ヴァンミール自身の実G15死亡は別の列にし、死亡前の指定保持と死亡確定時のC13終末を確認する。終末後の復活や再選択を列に含めない。
- [x] 同じ物理札について回収claim→取消→OPEN補充→山札再構成→親終了の列を実行。予約中の取得・重複所属・秘密による窓省略は拒否。
- [x] 実全体多段→対象別反撃→従者軽減→同時死亡を実行し、子の発生元/対象/ヒット数とG15の確定順を確認。
- [x] 各受理ステップで下記を検査。拒否ステップでは入力前のJSONと乱数消費を比較。終了は未解決actions/groups/lifecycle/windowsが閉じた安定点のみ許可。

```ts
const ids = allCardInstanceIds(state);
expect(ids).toHaveLength(220);
expect(new Set(ids).size).toBe(220);
expect([...ids].sort()).toEqual(actionCards.map(card => card.id).sort());
```

- [x] 入力を待っているだけの合法状態は保存・再投影できれば成立とする。進行可能な入力が消えた状態と区別して失敗時traceに最後の窓/候補を残す。
- [ ] S01〜S32各例について出典全文と最終test本文を独立照合し、値・手順・全assertion・具体的tuple・実行結果を記録。成功した関連試験だけでacceptedへ進めない。
- [ ] 現在のソース集合を固定する実行証跡、台帳/実行に結び付いた独立レビュー証跡を作り、acceptedに必要な依存条項を検査する。

Run: 対象Engine/Worker suite、`pnpm typecheck`、`python3 scripts/validate_runtime_coverage.py`。群ごとの限定成功を全件成功と呼ばず、R7で全ゲートを実行する。

2026-09-10 S09修正: 旧受け流し経路は同値counter比較の証拠ではなかったため、通常妖撃破山剣+ガーウィン剣匠の実Lv6反撃へ修正。使用チェック成功、Bのみ相殺/C12を3層で確認。[修正・検証証跡](../../operations/evidence/2026-09-10-r6-s09-real-counter.md)。旧候補のS09完了根拠は流用しない。

- [x] S28のG16変身条件へ、完了した人物儀式の変身/全回復/非継承3条項を依存接続し、実物理儀式4具体試験を補足登録。元のdamage4比較は維持。宣言済み8依存行の機械追跡で共通G09の任意使用/不使用時秘密2条項が未接続と確認。台帳valid、status昇格なし。[証跡](../../operations/evidence/2026-09-10-r6-s28-ritual-dependencies.md)。出典全条件・独立レビュー・acceptedは未完。
- [x] S28宣言依存8行のG09対応後の状態を機械記録。8行implemented、verified/acceptedなし。出典全条件や独立受け入れは未証明のまま。[証跡](../../operations/evidence/2026-09-10-r6-s28-g09-progress.md)。次はS25のチャム贈与3条項。
- [x] S25依存のチャム残手札贈与3条項をhandler/具体試験へ接続しimplementedへ更新。Engine10＋最終両順序2・DO4・browser4・型成功。使用済み物理贈与札の候補除外/偽装拒否を追加。独立受け入れは未完。[証跡](../../operations/evidence/2026-09-10-s25-cham-gift.md)。

- [x] S29依存アーネスgroup-lifetimeを生成/保持/終了の4 handlerと7具体試験に接続しimplementedへ。Engine5・DO1・browser1成功。宣言済み依存8件は全implemented、全原文/独立受け入れは未完。[証跡](../../operations/evidence/2026-09-10-s29-group-lifetime.md)。

- [x] S19の実精神力・[6,6]失敗・選択した信仰心を3 handlerとEngine/DO具体参照へ接続しimplementedへ。Engine1・DO3（S19は1）・browser1成功。固定候補/独立受け入れは未完。[証跡](../../operations/evidence/2026-09-10-s19-correspondence.md)。

- [x] S24の名称単位の通常回収と独立した印字回収を7 handlerに接続しimplementedへ。既存9具体参照を保持、Engine4・DO2・browser4成功。同名X/Y拒否の直接証拠はEngine。固定候補/独立受け入れは未完。[証跡](../../operations/evidence/2026-09-10-s24-correspondence.md)。

- [x] G06物理札3依存を共通イベント/予約処理と追加Engine8具体参照へ接続しimplementedへ。実Fate取消後の再使用拒否追加、Engine9＋最終1・DO1・browser1・型成功。宣言済S01–S32依存にpendingなし、全原文/acceptedは未完。[証跡](../../operations/evidence/2026-09-10-g06-general-correspondence.md)。
