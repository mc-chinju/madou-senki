import type {GameState} from './state.js';

/** Copy the growing, data-only event history without serializing it on every move. */
export function cloneGameState(state: GameState): GameState {
  return {
    ...structuredClone({...state, events: []}),
    events: state.events.map(event => ({
      ...event,
      ...(event.audience !== 'public' ? {audience: {...event.audience}} : {}),
      ...(event.death ? {death: {...event.death}} : {}),
      ...(event.targetIds ? {targetIds: [...event.targetIds]} : {}),
      ...(event.roll ? {roll: {...event.roll, faces: [...event.roll.faces]}} : {}),
      ...(event.status ? {status: {...event.status}} : {}),
    })),
  };
}
