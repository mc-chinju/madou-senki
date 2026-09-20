import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { commandNames, otherPanelCommands } from '../src/game/Board.js';
import { choiceLabels, otherPanelChoices } from '../src/game/ReactionPanel.js';
import { lifecycleCommands } from '../src/game/LifecyclePanel.js';
import { lifetimeCommands } from '../src/game/lifetime-input.js';
import { abilityCommands } from '../src/game/ability-input.js';
import { combinationCommands } from '../src/game/combination-input.js';

/** Every command the engine can put in `legalChoices`, read off the one place that builds them. The list a
 *  seat is offered grows with the rules, and an entry with no Japanese name reaches the screen as its internal
 *  name, so the sweep is taken from the source rather than repeated here.
 *
 *  Which bar a choice can reach is decided by what the branch that pushes it needs. Only two shapes settle it:
 *  `if(!active)` can run only with no window, so the command bar is the only bar that can draw it, and a
 *  branch guarded by the open window (`if(active…`, or an answer built from `hasPriority?`) can only stand
 *  beside one. Everything else — the abilities, the rituals, the reveal, the anytime card — is pushed either
 *  way and has to carry a name in both. Reading the guard instead of assuming one keeps the sweep from
 *  quietly shrinking: classifying by a literal that happens to sit on the line put every one of those into the
 *  window bucket, and `commandNames` was then never looked at. A branch can run on past its own line, so an
 *  `if(active…)` block is followed by the braces it opened. */
function offeredChoices(): { bar: Set<string>; window: Set<string> } {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  // The parser's switch is the one exhaustive list of command types, so it tells the commands on those lines
  // apart from the factions and window kinds that stand next to them.
  const commands = new Set([...read('../../../packages/protocol/src/validation.ts').matchAll(/case '([A-Z][A-Z0-9_]+)'/g)].map(([, name]) => name!));
  const bar = new Set<string>(), window_ = new Set<string>();
  let depth = 0, windowBlock: number | null = null;
  for (const raw of read('../../../packages/engine/src/view.ts').split('\n')) {
    const line = raw.trim();
    // A line that takes choices away names the ones it removes, which is the opposite of offering them.
    const offers = line.includes('legalChoices') && !/legalChoices=legalChoices\.filter/.test(line) && !line.includes('legalChoices: string[]');
    if (offers) {
      const barOnly = line.startsWith('if(!active)');
      const windowOnly = windowBlock !== null || line.startsWith('if(active') || /legalChoices=hasPriority\?/.test(line);
      const into = barOnly ? [bar] : windowOnly ? [window_] : [bar, window_];
      for (const [, name] of line.matchAll(/'([A-Z][A-Z0-9_]{2,})'/g)) if (commands.has(name!)) for (const set of into) set.add(name!);
    }
    const opens = (line.match(/\{/g) ?? []).length, closes = (line.match(/\}/g) ?? []).length;
    if (windowBlock === null && line.startsWith('if(active') && opens > closes) windowBlock = depth;
    depth += opens - closes;
    if (windowBlock !== null && depth <= windowBlock) windowBlock = null;
  }
  return { bar, window: window_ };
}
/** Choices the sweep cannot keep out of the command bar's bucket, though nothing can put them there. Each is
 *  pushed under a guard built on another line (`techniqueDecision`, `lifetimeDecision`, `beastCapture`,
 *  `shadowJumpCost`), all of which are `hasPriority && active` behind a name, so the line that pushes the
 *  choice does not say that it needs an open window. The command bar is drawn only where `view.activeWindow`
 *  is null (`Board.tsx`), so none of these can reach it. Proving that from the source would mean following
 *  each guard back to its definition, which is the kind of reading that let this sweep shrink to nothing
 *  before; erring towards the command bar costs an entry here and never costs a missing name. */
const cannotReachTheCommandBar = new Set(['PASS', 'PAY_SHADOW_JUMP', 'CHOOSE_BEAST_CAPTURE']);
const ownedByPanel = (choice: string, own: Set<string>) =>
  own.has(choice) || lifecycleCommands.has(choice) || lifetimeCommands.has(choice) || abilityCommands.has(choice) || combinationCommands.has(choice);

test('every choice a seat can be offered reaches the screen with a name of its own', () => {
  const { bar, window: inWindow } = offeredChoices();
  // A scan that stopped finding the choices would pass while saying nothing, so it has to find the known ones.
  expect(bar.size).toBeGreaterThan(10);
  expect(inWindow.size).toBeGreaterThan(20);
  for (const choice of ['ATTACK', 'PASS_ACTION', 'END_TURN']) expect(bar).toContain(choice);
  for (const choice of ['PASS', 'PLAY_DEFENSE', 'SET_CONDITIONAL_ABILITY']) expect(inWindow).toContain(choice);
  // The choices that are pushed whether or not a window is open have to reach the command bar's bucket too,
  // or the map it draws from is never asked about them.
  for (const choice of ['PLAY_ANYTIME_CARD', 'SET_CONDITIONAL_ABILITY', 'USE_ABILITY', 'PAY_SHADOW_JUMP',
    'TRANSFER_RITUAL', 'USE_REVIVAL_RITUAL', 'REVEAL_CHARACTER']) expect(bar, choice).toContain(choice);

  for (const choice of bar) {
    if (cannotReachTheCommandBar.has(choice) || ownedByPanel(choice, otherPanelCommands)) continue;
    // END_TURN names the cards it discards, so its text is built where the count is known.
    expect(commandNames[choice] ?? (choice === 'END_TURN' ? '手番を終える' : undefined), `command bar: ${choice}`).toBeDefined();
  }
  for (const choice of inWindow) {
    if (ownedByPanel(choice, otherPanelChoices)) continue;
    expect(choiceLabels[choice], `decision bar: ${choice}`).toBeDefined();
  }
});
