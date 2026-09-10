import type {GameState} from '../state.js';
import type {LifecycleTask} from './types.js';

/** Capture the causal parent while it still exists; do not rediscover it at release time. */
function currentRoots(s:GameState):string[] {
  const task=s.lifecycle?.at(-1);
  if (task?.rootEventIds) return [...task.rootEventIds];
  if (task?.kind==='declaration') {
    const a=s.actions?.[task.actionId]; if(a) return [a.eventId];
  }
  const roots=new Set<string>();
  let w=s.windows?.at(-1);
  const visited=new Set<string>();
  while (w && !visited.has(w.id)) {
    visited.add(w.id); roots.add(w.eventId);
    const c=w.continuation;
    if(c.kind==='action') { const a=s.actions?.[c.id];if(a)roots.add(a.eventId); }
    if(c.kind==='group') { const g=s.groups?.[c.id];const a=g&&s.actions?.[g.actionId];if(a)roots.add(a.eventId); }
    if(c.kind==='roll') { const r=s.rolls?.find(r=>r.id===c.id);if(r)roots.add(r.eventId); }
    if(c.kind==='lifecycle') for(const id of s.lifecycle?.find(t=>t.id===c.id)?.rootEventIds??[])roots.add(id);
    w=s.windows?.find(parent=>parent.id===w!.parentId);
  }
  return [...roots];
}

export function enqueueLifecycle(s:GameState,...tasks:LifecycleTask[]):void {
  const roots=currentRoots(s);
  const discardRoots=s.discardOccurrences?.filter(d=>d.stage!=='closed').map(d=>d.parentEventId)??[];
  for(const task of tasks) (s.lifecycle??=[]).push({...task,rootEventIds:[...new Set([...(task.rootEventIds??roots),...discardRoots])]});
}
