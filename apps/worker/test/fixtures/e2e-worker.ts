import { isTurnInformationScenario } from './turn-information-scenarios.js';
import { isDeclarationScenario } from './declaration-scenarios.js';
import { isMentalProtectionScenario } from './mental-protection-scenarios.js';
import { isMentalDefenseScenario } from './mental-defense-scenarios.js';
import { isNamedResponseScenario } from './named-response-scenarios.js';
import { isRollingDefenseScenario } from './rolling-defense-scenarios.js';
import { isReceivedDefenseScenario } from './received-defense-scenarios.js';
import { isAttackPropertyScenario } from './attack-property-scenarios.js';
import { isBeastCaptureScenario } from './beast-capture-scenarios.js';
import { isFollowerDestructionScenario } from './follower-destruction-scenarios.js';
import { isTechniqueValueScenario } from './technique-value-scenarios.js';
import { isFollowerEntryScenario } from './follower-entry-scenarios.js';
import { isFollowerGroupScenario } from './follower-group-scenarios.js';
import { isFollowerAttackScenario } from './follower-attack-scenarios.js';
import { isFollowerScenario } from './follower-scenarios.js';
import { isCombinationScenario } from './combination-scenarios.js';
import { isAbilityScenario } from './ability-scenarios.js';
import { isLifetimeScenario } from './lifetime-scenarios.js';
import { isLifecycleScenario } from './lifecycle-scenarios.js';
import application from '../../src/index.js';
import { Room } from '../../src/rooms/room.js';
import { HttpError, json, readJson } from '../../src/http.js';
import { projectDirectory } from '../../src/rooms/types.js';
import { makeScenario, type ScenarioName } from './game-scenarios.js';

/** Local browser-test entrypoint only. Never exported by src/index.ts or production wrangler.jsonc. */
export class BrowserFixtureRoom extends Room {
  async seedScenario(name: ScenarioName) {
    const result = await this.ctx.storage.transaction(async () => {
      const current = this.current();
      if (!current || current.state.status !== 'lobby' || Object.keys(current.state.members).length !== current.state.capacity) throw Error('FIXTURE_NOT_FULL_LOBBY');
      const game = makeScenario(name, Object.values(current.state.members).map(({ id, name: displayName }) => ({ id, name: displayName })));
      const next = { ...current.state, status: 'playing' as const, game };
      const result = this.store.commit({ actorId: next.ownerId, commandId: `fixture-${crypto.randomUUID()}`, expectedRevision: current.revision,
        request: JSON.stringify({ fixture: name }), state: next, events: [{ kind: 'lobby', type: 'STARTED', actorId: next.ownerId, at: Date.now() }], projection: projectDirectory(next) });
      if (!result.ok) throw Error('FIXTURE_COMMIT_FAILED');
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      return { roomId: next.roomId, revision: result.revision };
    });
    await this.ctx.storage.sync(); this.broadcast(); return result;
  }

  inspectGame() {
    return structuredClone(this.current()?.state.game ?? null);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const match = /^\/__test\/rooms\/([A-Za-z0-9_-]+)\/(scenario|game)$/.exec(new URL(request.url).pathname);
    if (!match) return application.fetch(request, env, ctx);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) return json({ error: 'LOCAL_TEST_ONLY' }, 403);
    try {
      const stub = env.ROOMS.getByName(match[1]!) as unknown as DurableObjectStub<BrowserFixtureRoom>;
      if (match[2] === 'game') {
        if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
        return json(await stub.inspectGame());
      }
      if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
      const body = await readJson(request);
      if (typeof body.name !== 'string' || !isTurnInformationScenario(body.name) && !isDeclarationScenario(body.name) && !isMentalProtectionScenario(body.name) && !isMentalDefenseScenario(body.name) && !isNamedResponseScenario(body.name) && !isRollingDefenseScenario(body.name) && !isReceivedDefenseScenario(body.name) && !isAttackPropertyScenario(body.name) && !isBeastCaptureScenario(body.name) && !isFollowerDestructionScenario(body.name) && !isTechniqueValueScenario(body.name) && !isFollowerEntryScenario(body.name) && !isFollowerGroupScenario(body.name) && !isFollowerAttackScenario(body.name) && !isFollowerScenario(body.name) && !isCombinationScenario(body.name) && !isAbilityScenario(body.name) && !isLifetimeScenario(body.name) && !isLifecycleScenario(body.name) && !['setup', 'combat', 'combat-ready', 'chanted-ready', 'dedicated-defense', 'optional-chant-ready', 'lance-variant-ready', 'lancelot-variant-ready', 'dedicated-chant-defense', 'magic-bypass', 'magic-dedicated-defense', 'magic-restricted-defense', 'roll-check', 'roll-recovery', 'roll-damage', 'nightmare-damage', 'stopped-defense', 'stopped-reveal', 'silenced-chant', 'reflected-stop-withdrawal', 'ability-disabled-defense', 'third-party-interrupt', 'prayer-effect-level', 'follower-defense-started', 'multi-target-multi-hit'].includes(body.name)) throw new HttpError(400, 'INVALID_FIXTURE');
      return json(await stub.seedScenario(body.name as ScenarioName));
    } catch (cause) { return json({ error: cause instanceof HttpError ? cause.code : 'FIXTURE_FAILED' }, cause instanceof HttpError ? cause.status : 500); }
  },
} satisfies ExportedHandler<Env>;
