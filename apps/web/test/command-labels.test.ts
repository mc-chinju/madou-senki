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
 *  name, so the sweep is taken from the source rather than repeated here. The two bars are told apart by the
 *  branch that builds them: `if(!active)` is the command bar, everything else can stand beside a window. */
function offeredChoices(): { bar: Set<string>; window: Set<string> } {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  // The parser's switch is the one exhaustive list of command types, so it tells the commands on those lines
  // apart from the factions and window kinds that stand next to them.
  const commands = new Set([...read('../../../packages/protocol/src/validation.ts').matchAll(/case '([A-Z][A-Z0-9_]+)'/g)].map(([, name]) => name!));
  const bar = new Set<string>(), window_ = new Set<string>();
  for (const line of read('../../../packages/engine/src/view.ts').split('\n')) {
    if (!line.includes('legalChoices')) continue;
    const into = line.includes('if(!active)') ? bar : window_;
    for (const [, name] of line.matchAll(/'([A-Z][A-Z0-9_]{2,})'/g)) if (commands.has(name!)) into.add(name!);
  }
  return { bar, window: window_ };
}
const ownedByPanel = (choice: string, own: Set<string>) =>
  own.has(choice) || lifecycleCommands.has(choice) || lifetimeCommands.has(choice) || abilityCommands.has(choice) || combinationCommands.has(choice);

test('every choice a seat can be offered reaches the screen with a name of its own', () => {
  const { bar, window: inWindow } = offeredChoices();
  // A scan that stopped finding the choices would pass while saying nothing, so it has to find the known ones.
  expect(bar.size).toBeGreaterThan(10);
  expect(inWindow.size).toBeGreaterThan(20);
  for (const choice of ['ATTACK', 'PASS_ACTION', 'END_TURN']) expect(bar).toContain(choice);
  for (const choice of ['PASS', 'PLAY_DEFENSE', 'SET_CONDITIONAL_ABILITY']) expect(inWindow).toContain(choice);

  for (const choice of bar) {
    if (ownedByPanel(choice, otherPanelCommands)) continue;
    // END_TURN names the cards it discards, so its text is built where the count is known.
    expect(commandNames[choice] ?? (choice === 'END_TURN' ? '手番を終える' : undefined), `command bar: ${choice}`).toBeDefined();
  }
  for (const choice of inWindow) {
    if (ownedByPanel(choice, otherPanelChoices)) continue;
    expect(choiceLabels[choice], `decision bar: ${choice}`).toBeDefined();
  }
});
