import type { GameCommand } from '@madou/protocol';
import type { PlayerView } from '@madou/engine';
import { useEffect, useRef, useState } from 'react';

export type WindowStatusView = Pick<PlayerView, 'activeWindow' | 'standingPassActorIds' | 'legalChoices'> & {
  players: Record<string, { name: string }>;
  self: { id: string };
};

/** Public per-seat progress of the open reaction window (G03). */
export function windowSeatLabel(view: WindowStatusView, id: string): '判断中' | '回答済み' | '任せる' | '対象外' {
  const w = view.activeWindow;
  if (!w) return '対象外';
  // A standing pass outlives the window that took it, so it is public even where the seat is not asked.
  if (view.standingPassActorIds.includes(id)) return '任せる';
  if (!w.participantIds.includes(id)) return '対象外';
  return w.passedActorIds.includes(id) ? '回答済み' : '判断中';
}

/** Remount the decision panel when the situation changed, not when another seat passes ahead. */
export function decisionPanelKey(view: { activeWindow: { windowId: string; windowRevision: number } | null }): string {
  return `${view.activeWindow?.windowId ?? 'none'}:${view.activeWindow?.windowRevision ?? 0}`;
}

/** Per-seat answers are public only on a pass-ahead window; a standing pass is public on every window. */
export function showsWindowSeatLabel(view: WindowStatusView, id: string): boolean {
  const w = view.activeWindow;
  return !!w && (w.passAhead || view.standingPassActorIds.includes(id));
}

/** What the seat may press about the window as a whole, next to whatever the decision panel offers. */
export function passAheadControls(view: WindowStatusView) {
  const w = view.activeWindow;
  const mine = w?.pendingActorId === view.self.id;
  // The seat holding priority passes from its own decision panel; this is the pass given ahead of turn.
  const canPass = !!w?.passAhead && !mine && view.legalChoices.includes('PASS');
  // Only a pass-ahead window can be left ahead of turn; taking it back is offered on any window.
  const canLeave = !!w?.passAhead && view.legalChoices.includes('PASS_ACTION_THROUGH');
  const canCancel = !!w && view.legalChoices.includes('CANCEL_PASS_THROUGH');
  return { canPass, canLeave, canCancel, any: canPass || canLeave || canCancel };
}

/** One compact line, like the setup round status: who decides now, how far the window got, who is still out. */
export function WindowRoster({ view }: { view: WindowStatusView }) {
  const w = view.activeWindow;
  if (!w || !w.passAhead) return null;
  const name = (id: string) => view.players[id]?.name ?? id;
  const mine = w.pendingActorId === view.self.id;
  const waiting = w.participantIds.filter(id => !w.passedActorIds.includes(id) && id !== w.pendingActorId && id !== view.self.id);
  const standing = view.standingPassActorIds.includes(view.self.id);
  const answered = w.passedActorIds.includes(view.self.id);
  const others = view.standingPassActorIds.filter(id => id !== view.self.id);
  return <section className="window-roster" aria-label="この確認の回答状況">
    <p role="status">
      <strong>{mine ? 'あなたの判断です' : `いま ${name(w.pendingActorId)}さん`}</strong>
      <span className="tag">回答 {w.passedActorIds.length} / {w.participantIds.length}席</span>
      <span>{mine ? '' :
        standing ? 'この行動は任せています。' :
        // Leaving the standing pass keeps this answer; the seat is asked again from the next window.
        answered ? 'この確認はパス済みです。次の確認から聞き直します。' :
        'カードを出す番はまだですが、先にパスできます。'}
        {waiting.length ? `未回答: ${waiting.map(name).join('、')}` : '他に未回答の席はありません'}</span>
    </p>
    {others.length ? <p className="hint">この行動を任せている席: {others.map(name).join('、')}</p> : null}
  </section>;
}

/** The pass a respondent may give before its turn, and leaving the whole action to the others. */
export function PassAheadButtons({ view, disabled, send }: {
  view: WindowStatusView; disabled: boolean; send: (command: GameCommand) => boolean;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const [followUp, setFollowUp] = useState(false);
  const w = view.activeWindow;
  const { canPass, canLeave, canCancel, any } = passAheadControls(view);
  // Pressing 「この行動は任せる」 replaces the button; keep the keyboard on its successor.
  useEffect(() => { if (followUp && canCancel) { cancel.current?.focus(); setFollowUp(false); } }, [followUp, canCancel]);
  if (!w || !any) return null;
  const passLabel = w.kind === 'reclaim' ? '回収せずに進む' : 'パス（この確認だけ）';
  // The standing pass also answers the reclaim that closes the action (G11), so say so wherever it is offered.
  const leaveHint = w.kind === 'reclaim'
    ? 'この行動に続く回収の回答もまとめて済ませます'
    : '出目や防御を見てから割り込むことはできなくなり、この行動に続く回収の回答もまとめて済ませます';
  const answeredHere = w.passedActorIds.includes(view.self.id);
  return <>
    <div className="button-row">
      {canPass ? <button type="button" disabled={disabled} onClick={() => send({ type: 'PASS' })}>{passLabel}</button> : null}
      {canLeave ? <button type="button" className="secondary" disabled={disabled} onClick={() => { setFollowUp(true); send({ type: 'PASS_ACTION_THROUGH' }); }}>この行動は任せる</button> : null}
      {canCancel ? <button ref={cancel} type="button" className="secondary" disabled={disabled} onClick={() => send({ type: 'CANCEL_PASS_THROUGH' })}>任せるのをやめる</button> : null}
    </div>
    {canLeave ? <p className="hint">「この行動は任せる」: {leaveHint}。誰かが動いたら聞き直します。</p> : null}
    {canCancel ? <p className="hint">{w.passAhead ? '' : 'この行動は任せています。'}「任せるのをやめる」: 次の確認から聞き直します{answeredHere ? '。この確認は回答済みのままです' : ''}。</p> : null}
  </>;
}

/** The same bar for the windows the decision panel does not own (reclaim, wish, a granted attack…). */
export function WindowStatus({ view, disabled, send }: {
  view: WindowStatusView; disabled: boolean; send: (command: GameCommand) => boolean;
}) {
  if (!view.activeWindow) return null;
  if (!view.activeWindow.passAhead && !passAheadControls(view).any) return null;
  return <aside className="decision" aria-label="現在の判断">
    <WindowRoster view={view} />
    <PassAheadButtons view={view} disabled={disabled} send={send} />
  </aside>;
}
