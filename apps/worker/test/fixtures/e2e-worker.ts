import {isRevealBoundaryScenario} from './reveal-boundary-scenarios.js';
import {isCanonicalScenario} from './canonical-scenarios.js';
import {isAdvanceRemainingScenario} from './advance-remaining-physical-scenarios.js';
import {isLightKingScenario} from './light-king-physical-scenarios.js';
import {isPlantBindScenario} from './plant-bind-physical-scenarios.js';
import {isNightmareScenario} from './nightmare-physical-scenarios.js';
import {isWolfFangScenario} from './wolf-fang-physical-scenarios.js';
import {isStarBowScenario} from './star-bow-physical-scenarios.js';
import {isLightBowScenario} from './light-bow-physical-scenarios.js';
import {isBlastSwordScenario} from './blast-sword-physical-scenarios.js';
import {isHundredSlashScenario} from './hundred-slash-physical-scenarios.js';
import {isSlayingFistScenario} from './slaying-fist-physical-scenarios.js';
import {isWorldFistScenario} from './world-fist-physical-scenarios.js';
import {isWhirlwindKickScenario} from './whirlwind-kick-physical-scenarios.js';
import {isKiBurstScenario} from './ki-burst-physical-scenarios.js';
import {isBloodFlowScenario} from './blood-flow-physical-scenarios.js';
import {isDragonKingScenario} from './dragon-king-physical-scenarios.js';
import {isVoidSwordScenario} from './void-sword-physical-scenarios.js';
import {isBlackDragonScenario} from './black-dragon-physical-scenarios.js';
import {isBlackBreakScenario} from './black-break-physical-scenarios.js';
import {isBeastKingScenario} from './beast-king-physical-scenarios.js';
import {isKiSlashScenario} from './ki-slash-physical-scenarios.js';
import {isShadowCardScenario} from './shadow-card-physical-scenarios.js';
import {isUraSwordScenario} from './ura-sword-physical-scenarios.js';
import {isShurikenScenario} from './shuriken-physical-scenarios.js';
import {isAsfeltSwordsScenario} from './asfelt-swords-physical-scenarios.js';
import {isSkyWingScenario} from './sky-wing-physical-scenarios.js';
import {isBlackWingScenario} from './black-wing-physical-scenarios.js';
import {isBlackBowScenario} from './black-bow-physical-scenarios.js';
import {isMaaiOtherScenario} from './maai-other-physical-scenarios.js';
import {isRitualPhysicalScenario} from './ritual-physical-scenarios.js';
import {isMotherTruthPhysicalScenario} from './mother-truth-physical-scenarios.js';
import {isWishPhysicalScenario} from './wish-physical-scenarios.js';
import {isFarseeingPhysicalScenario} from './farseeing-physical-scenarios.js';
import {isDinonPhysicalScenario} from './dinon-physical-scenarios.js';
import {isConversionPhysicalScenario} from './conversion-physical-scenarios.js';
import {isTrainingPhysicalScenario} from './training-physical-scenarios.js';
import {isAttributeJewelsPhysicalScenario} from './attribute-jewels-physical-scenarios.js';
import {isSecretBookPhysicalScenario} from './secret-book-physical-scenarios.js';
import {isDeathGiftPhysicalScenario} from './death-gift-physical-scenarios.js';
import {isDispelPhysicalScenario} from './dispel-physical-scenarios.js';
import {isHostagePhysicalScenario} from './hostage-physical-scenarios.js';
import {isSubstitutePhysicalScenario} from './substitute-physical-scenarios.js';
import {isRevelationPhysicalScenario} from './revelation-physical-scenarios.js';
import {isPeacePhysicalScenario} from './peace-physical-scenarios.js';
import {isCouragePhysicalScenario} from './courage-physical-scenarios.js';
import {isAmuletPhysicalScenario} from './amulet-physical-scenarios.js';
import {isKeilPhysicalScenario} from './keil-physical-scenarios.js';
import {isTragedyPhysicalScenario} from './tragedy-physical-scenarios.js';
import {isHajaPhysicalScenario} from './haja-physical-scenarios.js';
import {isOpenBlessingPhysicalScenario} from './open-blessing-physical-scenarios.js';
import {isGodsBloodPhysicalScenario} from './gods-blood-physical-scenarios.js';
import {isDawnPhysicalScenario} from './dawn-physical-scenarios.js';
import {isFusenPhysicalScenario} from './fusen-physical-scenarios.js';
import {isWaterDragonPhysicalScenario} from './water-dragon-physical-scenarios.js';
import {isGuardianPhysicalScenario} from './guardian-physical-scenarios.js';
import {isDeathKnightPhysicalScenario} from './death-knight-physical-scenarios.js';
import {isWyvernPhysicalScenario} from './wyvern-physical-scenarios.js';
import {isGroundDragonPhysicalScenario} from './ground-dragon-physical-scenarios.js';
import {isFlameDragonPhysicalScenario} from './flame-dragon-physical-scenarios.js';
import {isAngelPhysicalScenario} from './angel-physical-scenarios.js';
import {isPalaceGuardPhysicalScenario} from './palace-guard-physical-scenarios.js';
import {isDevilPhysicalScenario} from './devil-physical-scenarios.js';
import {isMetalGolemPhysicalScenario} from './metal-golem-physical-scenarios.js';
import {isFairyFolkPhysicalScenario} from './fairy-folk-physical-scenarios.js';
import {isShariaPhysicalScenario} from './sharia-physical-scenarios.js';
import {isDragonCultPhysicalScenario} from './dragon-cult-physical-scenarios.js';
import {isDwarfPhysicalScenario} from './dwarf-physical-scenarios.js';
import {isFemaleGuardPhysicalScenario} from './female-guard-physical-scenarios.js';
import {isDarkSaintPhysicalScenario} from './dark-saint-physical-scenarios.js';
import {isWingedFolkPhysicalScenario} from './winged-folk-physical-scenarios.js';
import {isRoyalKnightsPhysicalScenario} from './royal-knights-physical-scenarios.js';
import {isWightPhysicalScenario} from './wight-physical-scenarios.js';
import {isFactionCastlesPhysicalScenario} from './faction-castles-physical-scenarios.js';
import {isGriffinPhysicalScenario} from './griffin-physical-scenarios.js';
import {isStoneGolemPhysicalScenario} from './stone-golem-physical-scenarios.js';
import {isSmallAngelPhysicalScenario} from './small-angel-physical-scenarios.js';
import {isSingingShipPhysicalScenario} from './singing-ship-physical-scenarios.js';
import {isKnightOrdersPhysicalScenario} from './knight-orders-physical-scenarios.js';
import {isMercenaryPhysicalScenario} from './mercenary-physical-scenarios.js';
import {isZombiePhysicalScenario} from './zombie-physical-scenarios.js';
import {isCastleImpPhysicalScenario} from './castle-imp-physical-scenarios.js';
import {isBorderWoodPhysicalScenario} from './border-wood-physical-scenarios.js';
import {isSkeletonPhysicalScenario} from './skeleton-physical-scenarios.js';
import {isOrcFortPhysicalScenario} from './orc-fort-physical-scenarios.js';
import {isCommonFollowersPhysicalScenario} from './common-followers-physical-scenarios.js';
import {isDeathSongPhysicalScenario} from './death-song-physical-scenarios.js';
import {isLesterSongsPhysicalScenario} from './lester-songs-physical-scenarios.js';
import {isMadKingPhysicalScenario} from './mad-king-physical-scenarios.js';
import {isShockPhysicalScenario} from './shock-physical-scenarios.js';
import {isCloseEarthPhysicalScenario} from './close-earth-physical-scenarios.js';
import {isSilencePhysicalScenario} from './silence-physical-scenarios.js';
import {isJudgmentPhysicalScenario} from './judgment-physical-scenarios.js';
import {isYotsurmMagicPhysicalScenario} from './yotsurm-magic-physical-scenarios.js';
import {isWhiteMagicPhysicalScenario} from './white-magic-physical-scenarios.js';
import {isPlaguePhysicalScenario} from './plague-physical-scenarios.js';
import {isGatePhysicalScenario} from './gate-physical-scenarios.js';
import {isPetrifyPhysicalScenario} from './petrify-physical-scenarios.js';
import {isScythePhysicalScenario} from './scythe-physical-scenarios.js';
import {isRiftPhysicalScenario} from './rift-physical-scenarios.js';
import {isDiaLifetimePhysicalScenario} from './dia-lifetime-physical-scenarios.js';
import {isHealingPhysicalScenario} from './healing-physical-scenarios.js';
import {isPrisonPhysicalScenario} from './prison-physical-scenarios.js';
import {isResurrectionPhysicalScenario} from './resurrection-physical-scenarios.js';
import {isCursePhysicalScenario} from './curse-physical-scenarios.js';
import {isMekaiPhysicalScenario} from './mekai-physical-scenarios.js';
import {isLeafDefenseScenario} from './leaf-defense-scenarios.js';
import {isAlseilStatusScenario} from './alseil-status-scenarios.js';
import {isWaterStatusScenario} from './water-status-scenarios.js';
import {isIceWolfScenario} from './ice-wolf-scenarios.js';
import {isIceMagicScenario} from './ice-magic-scenarios.js';
import {isStormMagicScenario} from './storm-magic-scenarios.js';
import {isWindMagicScenario} from './wind-magic-scenarios.js';
import {isEarthMagicScenario} from './earth-magic-scenarios.js';
import {isHeavyFireScenario} from './heavy-fire-scenarios.js';
import {isFireMagicScenario} from './fire-magic-scenarios.js';
import {isMountainBreakerScenario} from './mountain-breaker-scenarios.js';
import {isAnnihilationAxeScenario} from './annihilation-axe-scenarios.js';
import {isRambaAxesScenario} from './ramba-axes-scenarios.js';
import {isWhiteDragonScenario} from './white-dragon-scenarios.js';
import {isDragonSpearScenario} from './dragon-spear-scenarios.js';
import {isSpearMountainScenario} from './spear-mountain-scenarios.js';
import {isWolfLanceScenario} from './wolf-lance-scenarios.js';
import {isBarrierPhysicalScenario} from './barrier-physical-scenarios.js';
import {isReflectLimitScenario} from './reflect-limit-scenarios.js';
import {isIceMirrorScenario} from './ice-mirror-scenarios.js';
import {isTeleportPhysicalScenario} from './teleport-physical-scenarios.js';
import {isEvadePhysicalScenario} from './evade-physical-scenarios.js';
import {isBasicAttachmentScenario} from './basic-attachment-scenarios.js';
import {isR6Scenario} from './r6-scenarios.js';
import {isSharedReclaimScenario} from './shared-reclaim-scenarios.js';
import {isMandatoryFieldsScenario} from './mandatory-fields-scenarios.js';
import {isVirtualBladeScenario} from './virtual-blade-scenarios.js';
import {isMaaiScenario} from './r5-distance-scenarios.js';
import { isReclaimScenario } from './reclaim-scenarios.js';
import { isSuppressionScenario } from './suppression-scenarios.js';
import { isConditionalScenario } from './conditional-ability-scenarios.js';
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
import type { Entropy } from '@madou/engine';
import application from '../../src/index.js';
import { Room } from '../../src/rooms/room.js';
import { displayText, HttpError, json, readJson } from '../../src/http.js';
import { projectDirectory } from '../../src/rooms/types.js';
import { makeScenario, type ScenarioName } from './game-scenarios.js';
import { createTestSession } from './test-session.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const OUTBOX = 'CREATE TABLE IF NOT EXISTS browser_fixture_outbox (email TEXT NOT NULL, text TEXT NOT NULL, sent_at INTEGER NOT NULL)';

/** Keeps login mail in the test D1 instead of sending it, so login.spec can type the code from the screen flow. */
function capturedEmail(db: D1Database): SendEmail {
  return { async send(message: { to: string; text?: string }) {
    await db.prepare(OUTBOX).run();
    await db.prepare('INSERT INTO browser_fixture_outbox (email, text, sent_at) VALUES (?, ?, ?)').bind(message.to, message.text ?? '', Date.now()).run();
    return { messageId: crypto.randomUUID() };
  } } as unknown as SendEmail;
}

/** Local-only sign-in and mail inspection. The production entrypoint has neither route. */
async function accountFixture(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/__test/session') {
    if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
    const name = displayText((await readJson(request)).name, 24);
    if (!name) throw new HttpError(400, 'INVALID_FIXTURE');
    // Scenario specs seat several tables with the same fixed names; each seat needs its own account.
    // Only this local test database drops the index. Real registration still refuses duplicates in the hook.
    await env.DB.prepare('DROP INDEX IF EXISTS user_name').run();
    const session = await createTestSession(env, request, name);
    return json({ id: session.id, name: session.name }, 201, { 'Set-Cookie': session.setCookie });
  }
  await env.DB.prepare(OUTBOX).run();
  const email = new URL(request.url).searchParams.get('email')?.toLowerCase() ?? '';
  if (request.method === 'DELETE') {
    // Lets one browser test sign in twice without waiting out the 60-second send limit.
    await env.DB.batch([env.DB.prepare('DELETE FROM auth_attempt WHERE key IN (?, ?)').bind(`send:${email}`, `verify:${email}`),
      env.DB.prepare('DELETE FROM browser_fixture_outbox WHERE email = ?').bind(email)]);
    return new Response(null, { status: 204 });
  }
  if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
  const row = await env.DB.prepare('SELECT text FROM browser_fixture_outbox WHERE email = ? ORDER BY sent_at DESC LIMIT 1').bind(email).first<{ text: string }>();
  const otp = row ? /\b(\d{6})\b/.exec(row.text)?.[1] : undefined;
  if (!otp) throw new HttpError(404, 'NO_MAIL');
  return json({ otp });
}

function mulberryTape(seed: number, calls: number): Entropy {
  let t = (Math.imul(seed, 0x9E3779B9) + calls) >>> 0;
  const next = () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const random: number[] = [];
  const dice: number[] = [];
  for (let i = 0; i < 8192; i++) {
    random.push(next());
    dice.push(1 + Math.floor(next() * 6));
  }
  return { now: 1000, dice, random };
}

/** Local browser-test entrypoint only. Never exported by src/index.ts or production wrangler.jsonc. */
export class BrowserFixtureRoom extends Room {
  async setEntropySeed(seed: number) {
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS browser_fixture_seed (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), seed INTEGER NOT NULL, calls INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO browser_fixture_seed (singleton, seed, calls) VALUES (1, ?, 0)', seed);
    await this.ctx.storage.sync();
  }

  protected commandEntropy() {
    const seeded = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'browser_fixture_seed'").toArray().length > 0
      ? this.ctx.storage.sql.exec<{ seed: number; calls: number }>('SELECT seed, calls FROM browser_fixture_seed WHERE singleton = 1').toArray()[0]
      : undefined;
    if (seeded) {
      this.ctx.storage.sql.exec('UPDATE browser_fixture_seed SET calls = ? WHERE singleton = 1', seeded.calls + 1);
      return mulberryTape(seeded.seed, seeded.calls);
    }
    const entropy = super.commandEntropy();
    const exists = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'browser_fixture_entropy'").toArray().length > 0;
    if (!exists) return entropy;
    const fixture = this.ctx.storage.sql.exec<{ scenario: string }>('SELECT scenario FROM browser_fixture_entropy WHERE singleton = 1').toArray()[0];
    if(fixture?.scenario.startsWith('suppression-persist-')) {
      const roll=this.current()?.state.game?.rolls?.at(-1);
      return {...entropy,dice:Array(100).fill(roll?.stage==='before-roll'&&roll.purpose==='status-resistance'?6:1) as number[]};
    }
    // These physical scenarios assert the successful teleport branch, as do their Worker tests.
    if(fixture && isCloseEarthPhysicalScenario(fixture.scenario)) return {...entropy,dice:Array(100).fill(1) as number[]};
    if(fixture?.scenario==='canonical-S04')return {...entropy,dice:Array(100).fill(4) as number[]};
    if(fixture?.scenario==='ritual-otherworld'||fixture?.scenario==='ritual-disabled'||fixture?.scenario==='ritual-stopped')return {...entropy,dice:Array(100).fill(6) as number[]};
    if(fixture?.scenario==='suppression-blessing-paired'||fixture?.scenario==='suppression-blessing-exempt')return {...entropy,now:1000,dice:Array(100).fill(1) as number[]};
    return (fixture?.scenario === 'suppression-blessing-confusion' || fixture?.scenario === 'suppression-blessing-hypnosis' || fixture?.scenario === 'lia-prayer-revival' || fixture?.scenario === 'fury-royal-reflection' || fixture?.scenario === 'shared-a09-self' || fixture?.scenario === 'canonical-lia-life' || fixture?.scenario === 'canonical-vanmil-death') ? { ...entropy, dice: Array(100).fill(1) as number[] } : entropy;
  }
  async seedScenario(name: ScenarioName) {
    const result = await this.ctx.storage.transaction(async () => {
      const current = this.current();
      if (!current || current.state.status !== 'lobby' || Object.keys(current.state.members).length !== current.state.capacity) throw Error('FIXTURE_NOT_FULL_LOBBY');
      const game = makeScenario(name, Object.values(current.state.members).map(({ id, name: displayName }) => ({ id, name: displayName })));
      const next = { ...current.state, status: 'playing' as const, game };
      const result = this.store.commit({ actorId: next.ownerId, commandId: `fixture-${crypto.randomUUID()}`, expectedRevision: current.revision,
        request: JSON.stringify({ fixture: name }), state: next, events: [{ kind: 'lobby', type: 'STARTED', actorId: next.ownerId, at: Date.now() }], projection: projectDirectory(next) });
      if (!result.ok) throw Error('FIXTURE_COMMIT_FAILED');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS browser_fixture_entropy (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), scenario TEXT NOT NULL)');
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO browser_fixture_entropy (singleton, scenario) VALUES (1, ?)', name);
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
    const url = new URL(request.url);
    if (url.pathname === '/__test/session' || url.pathname === '/__test/otp') {
      if (!LOCAL_HOSTS.includes(url.hostname)) return json({ error: 'LOCAL_TEST_ONLY' }, 403);
      try { return await accountFixture(request, env, url.pathname); }
      catch (cause) { return json({ error: cause instanceof HttpError ? cause.code : 'FIXTURE_FAILED' }, cause instanceof HttpError ? cause.status : 500); }
    }
    const match = /^\/__test\/rooms\/([A-Za-z0-9_-]+)\/(scenario|game|entropy)$/.exec(url.pathname);
    if (!match) return application.fetch(request, { ...env, EMAIL: capturedEmail(env.DB) }, ctx);
    if (!LOCAL_HOSTS.includes(url.hostname)) return json({ error: 'LOCAL_TEST_ONLY' }, 403);
    try {
      const stub = env.ROOMS.getByName(match[1]!) as unknown as DurableObjectStub<BrowserFixtureRoom>;
      if (match[2] === 'game') {
        if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
        return json(await stub.inspectGame());
      }
      if (match[2] === 'entropy') {
        if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
        const body = await readJson(request);
        if (typeof body.seed !== 'number' || !Number.isSafeInteger(body.seed)) throw new HttpError(400, 'INVALID_FIXTURE');
        await stub.setEntropySeed(body.seed);
        return new Response(null, { status: 204 });
      }
      if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
      const body = await readJson(request);
      if (typeof body.name !== 'string' || !isRevealBoundaryScenario(body.name) && body.name !== 'canonical-lia-life' && body.name !== 'canonical-vanmil-death' && body.name !== 'canonical-S09' && body.name !== 'canonical-S10' && body.name !== 'canonical-S07' && !isCanonicalScenario(body.name) && body.name !== 'r6-s02-cancel-child' && !isAdvanceRemainingScenario(body.name) && !isLightKingScenario(body.name) && !isPlantBindScenario(body.name) && !isNightmareScenario(body.name) && !isWolfFangScenario(body.name) && !isStarBowScenario(body.name) && !isLightBowScenario(body.name) && !isBlastSwordScenario(body.name) && !isHundredSlashScenario(body.name) && !isSlayingFistScenario(body.name) && !isWorldFistScenario(body.name) && !isWhirlwindKickScenario(body.name) && !isKiBurstScenario(body.name) && !isBloodFlowScenario(body.name) && !isDragonKingScenario(body.name) && !isVoidSwordScenario(body.name) && !isBlackDragonScenario(body.name) && !isBlackBreakScenario(body.name) && !isBeastKingScenario(body.name) && !isKiSlashScenario(body.name) && !isShadowCardScenario(body.name) && !isUraSwordScenario(body.name) && !isShurikenScenario(body.name) && !isAsfeltSwordsScenario(body.name) && !isSkyWingScenario(body.name) && !isBlackWingScenario(body.name) && !isBlackBowScenario(body.name) && !isMaaiOtherScenario(body.name) && !isRitualPhysicalScenario(body.name) && !isMotherTruthPhysicalScenario(body.name) && !isWishPhysicalScenario(body.name) && !isFarseeingPhysicalScenario(body.name) && !isDinonPhysicalScenario(body.name) && !isConversionPhysicalScenario(body.name) && !isTrainingPhysicalScenario(body.name) && !isAttributeJewelsPhysicalScenario(body.name) && !isSecretBookPhysicalScenario(body.name) && !isDeathGiftPhysicalScenario(body.name) && !isDispelPhysicalScenario(body.name) && !isHostagePhysicalScenario(body.name) && !isSubstitutePhysicalScenario(body.name) && !isRevelationPhysicalScenario(body.name) && !isPeacePhysicalScenario(body.name) && !isCouragePhysicalScenario(body.name) && !isAmuletPhysicalScenario(body.name) && !isKeilPhysicalScenario(body.name) && !isTragedyPhysicalScenario(body.name) && !isHajaPhysicalScenario(body.name) && !isOpenBlessingPhysicalScenario(body.name) && !isGodsBloodPhysicalScenario(body.name) && !isDawnPhysicalScenario(body.name) && !isFusenPhysicalScenario(body.name) && !isWaterDragonPhysicalScenario(body.name) && !isGuardianPhysicalScenario(body.name) && !isDeathKnightPhysicalScenario(body.name) && !isWyvernPhysicalScenario(body.name) && !isGroundDragonPhysicalScenario(body.name) && !isFlameDragonPhysicalScenario(body.name) && !isAngelPhysicalScenario(body.name) && !isPalaceGuardPhysicalScenario(body.name) && !isDevilPhysicalScenario(body.name) && !isMetalGolemPhysicalScenario(body.name) && !isFairyFolkPhysicalScenario(body.name) && !isShariaPhysicalScenario(body.name) && !isDragonCultPhysicalScenario(body.name) && !isDwarfPhysicalScenario(body.name) && !isFemaleGuardPhysicalScenario(body.name) && !isDarkSaintPhysicalScenario(body.name) && !isWingedFolkPhysicalScenario(body.name) && !isRoyalKnightsPhysicalScenario(body.name) && !isWightPhysicalScenario(body.name) && !isFactionCastlesPhysicalScenario(body.name) && !isGriffinPhysicalScenario(body.name) && !isStoneGolemPhysicalScenario(body.name) && !isSmallAngelPhysicalScenario(body.name) && !isSingingShipPhysicalScenario(body.name) && !isKnightOrdersPhysicalScenario(body.name) && !isMercenaryPhysicalScenario(body.name) && !isZombiePhysicalScenario(body.name) && !isCastleImpPhysicalScenario(body.name) && !isBorderWoodPhysicalScenario(body.name) && !isSkeletonPhysicalScenario(body.name) && !isOrcFortPhysicalScenario(body.name) && !isCommonFollowersPhysicalScenario(body.name) && !isDeathSongPhysicalScenario(body.name) && !isLesterSongsPhysicalScenario(body.name) && !isMadKingPhysicalScenario(body.name) && !isShockPhysicalScenario(body.name) && !isCloseEarthPhysicalScenario(body.name) && !isSilencePhysicalScenario(body.name) && !isJudgmentPhysicalScenario(body.name) && !isYotsurmMagicPhysicalScenario(body.name) && !isWhiteMagicPhysicalScenario(body.name) && !isPlaguePhysicalScenario(body.name) && !isGatePhysicalScenario(body.name) && !isPetrifyPhysicalScenario(body.name) && !isScythePhysicalScenario(body.name) && !isRiftPhysicalScenario(body.name) && !isDiaLifetimePhysicalScenario(body.name) && !isHealingPhysicalScenario(body.name) && !isPrisonPhysicalScenario(body.name) && !isResurrectionPhysicalScenario(body.name) && !isCursePhysicalScenario(body.name) && !isMekaiPhysicalScenario(body.name) && !isLeafDefenseScenario(body.name) && !isAlseilStatusScenario(body.name) && !isWaterStatusScenario(body.name) && !isIceWolfScenario(body.name) && !isIceMagicScenario(body.name) && !isStormMagicScenario(body.name) && !isWindMagicScenario(body.name) && !isEarthMagicScenario(body.name) && !isHeavyFireScenario(body.name) && !isFireMagicScenario(body.name) && !isMountainBreakerScenario(body.name) && !isAnnihilationAxeScenario(body.name) && !isRambaAxesScenario(body.name) && !isWhiteDragonScenario(body.name) && !isDragonSpearScenario(body.name) && !isSpearMountainScenario(body.name) && !isWolfLanceScenario(body.name) && !isBarrierPhysicalScenario(body.name) && !isReflectLimitScenario(body.name) && !isIceMirrorScenario(body.name) && !isTeleportPhysicalScenario(body.name) && !isEvadePhysicalScenario(body.name) && !isBasicAttachmentScenario(body.name) && !isR6Scenario(body.name) && !isSharedReclaimScenario(body.name) && !isMandatoryFieldsScenario(body.name) && !isVirtualBladeScenario(body.name) && !isMaaiScenario(body.name) && !isReclaimScenario(body.name) && !isSuppressionScenario(body.name) && !isConditionalScenario(body.name) && !isTurnInformationScenario(body.name) && !isDeclarationScenario(body.name) && !isMentalProtectionScenario(body.name) && !isMentalDefenseScenario(body.name) && !isNamedResponseScenario(body.name) && !isRollingDefenseScenario(body.name) && !isReceivedDefenseScenario(body.name) && !isAttackPropertyScenario(body.name) && !isBeastCaptureScenario(body.name) && !isFollowerDestructionScenario(body.name) && !isTechniqueValueScenario(body.name) && !isFollowerEntryScenario(body.name) && !isFollowerGroupScenario(body.name) && !isFollowerAttackScenario(body.name) && !isFollowerScenario(body.name) && !isCombinationScenario(body.name) && !isAbilityScenario(body.name) && !isLifetimeScenario(body.name) && !isLifecycleScenario(body.name) && !['scenario-s18-between','scenario-s18','lia-prayer','lia-prayer-second','lia-prayer-fatal','lia-prayer-otherworld','lia-prayer-revival','reclaim-wandering','reclaim-exit','fury-royal-reflection','death-reward-dia','death-reward-hunger','cham-death-gift','sad-love','sad-love-lethal','sad-love-aura','mandatory-fury','mandatory-fury-counter','zan','zan-maai','shadow-jump','setup', 'combat', 'combat-ready', 'chanted-ready', 'dedicated-defense', 'optional-chant-ready', 'lance-variant-ready', 'lancelot-variant-ready', 'dedicated-chant-defense', 'magic-bypass', 'magic-dedicated-defense', 'magic-restricted-defense', 'roll-check', 'roll-recovery', 'roll-damage', 'nightmare-damage', 'stopped-defense', 'stopped-reveal', 'silenced-chant', 'reflected-stop-withdrawal', 'ability-disabled-defense', 'third-party-interrupt', 'prayer-effect-level', 'follower-defense-started', 'multi-target-multi-hit'].includes(body.name)) throw new HttpError(400, 'INVALID_FIXTURE');
      return json(await stub.seedScenario(body.name as ScenarioName));
    } catch (cause) { return json({ error: cause instanceof HttpError ? cause.code : 'FIXTURE_FAILED' }, cause instanceof HttpError ? cause.status : 500); }
  },
} satisfies ExportedHandler<Env>;
