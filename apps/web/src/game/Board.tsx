import {printedTechniqueAllowed} from '@madou/engine';
import {canSelectDedicated,techniqueFor} from '@madou/engine';
import {SadLovePanel} from './SadLovePanel.js';
import {ShadowJumpPanel} from './ShadowJumpPanel.js';
import {VirtualBladePanel} from './VirtualBladePanel.js';
import {PrintedCombinationFields,withPrintedComponents} from './PrintedCombinationFields.js';
import {WishPanel} from './WishPanel.js';
import {AllArmyPanel} from './AllArmyPanel.js';
import {DispelFields,withDispel} from './DispelFields.js';
import {InformationHistoryPanel} from './InformationHistoryPanel.js';
import {TurnChoiceCardPanel} from './TurnChoiceCardPanel.js';
import {TurnCardPanel} from './TurnCardPanel.js';
import {AnytimeCardPanel} from './AnytimeCardPanel.js';
import { ReclaimPanel } from './ReclaimPanel.js';
import { SuppressionPanel } from './SuppressionPanel.js';
import { ConditionalAbilityPanel } from './ConditionalAbilityPanel.js';
import { DrawControl, RevealControl, SpiritExpiryNotice } from './OptionalTurnControls.js';
import { InspectionPanel } from './InspectionPanel.js';
import { DeclarationStatus } from './DeclarationStatus.js';
import { DeclarationFields } from './DeclarationFields.js';
import { applyDeclarationSelection, candidateFor, type DeclarationCommand } from './declaration-input.js';
import { CurrentGoals } from './CurrentGoals.js';
import { PendingFatalNotice } from './PendingFatalNotice.js';
import {DistanceExchangeSummary} from './DistanceExchangeSummary.js';
import { MaaiDefenseSummary } from './MaaiDefenseSummary.js';
import { ReceivedTechniqueSummary } from './ReceivedTechniqueSummary.js';
import { BeastCapturePanel } from './BeastCapturePanel.js';
import { FollowerDestructionSummary } from './FollowerDestructionSummary.js';
import { FollowerEntrySummary } from './FollowerEntrySummary.js';
import { ActionCalculationSummary } from './ActionCalculationSummary.js';
import { FollowerBundlePanel } from './FollowerBundlePanel.js';
import { FollowerBundleSummary } from './FollowerBundleSummary.js';
import { FollowerAttackPanel } from './FollowerAttackPanel.js';
import { getAction, getCharacter, type ActionCard, type CharacterCard } from '@madou/catalog';
import type { ClientEnvelope, TechniqueVariant } from '@madou/protocol';
import type { RoomView } from '../../../worker/src/rooms/types.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CardDialog } from './CardDialog.js';
import { OwnDiscardDialog } from './OwnDiscardDialog.js';
import { buildCardCommand, discardRequirement, eligibleChantCards, hasOptionalChant, techniqueVariants, toggleSelection } from './commands.js';
import { FollowerEditor } from './FollowerEditor.js';
import { initialFollowerCommand } from './follower-input.js';
import { SetupCommandStatus, SetupPanel, SetupPositionChoice, setupSeatLabel } from './SetupPanel.js';
import { MagicGatePanel } from './MagicGatePanel.js';
import { Hand } from './Hand.js';
import { OwnCardZone } from './OwnCardZone.js';
import { PublicLog, type LogHistoryControl } from './PublicLog.js';
import { PublicCardLinks } from './PublicCardLinks.js';
import { RollPanel } from './RollPanel.js';
import { StatusList } from './StatusList.js';
import { ReactionPanel, reactionPanelHandles } from './ReactionPanel.js';
import { WindowStatus, decisionPanelKey, showsWindowSeatLabel, windowSeatLabel } from './WindowStatus.js';
import { LifecyclePanel, lifecycleCommands } from './LifecyclePanel.js';
import { ResultPanel, presenceLabels } from './ResultPanel.js';
import { EndgameRevealPanel } from './EndgameRevealPanel.js';
import { LifetimeDecisionPanel } from './LifetimeDecisionPanel.js';
import { TurnTechniquePanel } from './TurnTechniquePanel.js';
import { lifetimeCommands, turnTechniqueIds } from './lifetime-input.js';
import { abilityCommands } from './ability-input.js';
import { AbilityPanel } from './AbilityPanel.js';
import { ActionSummary } from './ActionSummary.js';
import { AttackCostFields, CombinationPanel } from './CombinationPanel.js';
import { attackWithCosts, combinationCommands, type CoSource } from './combination-input.js';

type Command = ClientEnvelope['command'];
const phaseNames:Record<string,string>={setup:'初期配置','turn-start':'手番開始',draw:'ドロー',action:'行動','hand-adjustment':'手札調整',combat:'戦闘',withdrawal:'離脱'};
export const commandNames:Record<string,string>={REVEAL_CHARACTER:'正体を公開',PASS_SETUP:'配置を終える',PLACE_INITIAL_FOLLOWER:'従者を置く',START_TURN:'手番を始める',PASS_ACTION:'行動を終える',REST:'休息',CHANT:'詠唱',PLAY_TURN_CARD:'カードを使う',APPROACH:'接近',WITHDRAW:'離脱',PASS_WITHDRAWAL:'離脱しない',ATTACK:'攻撃を確認して実行'};
/** Choices a panel of its own owns; the command bar leaves them to it rather than drawing a bare button. */
export const otherPanelCommands=new Set(['PLAY_ANYTIME_CARD','SET_CONDITIONAL_ABILITY','CHOOSE_DRAW','ARRANGE_FOLLOWERS','REVEAL_CHARACTER']);

export function Board({room,actorId,disabled:connectionDisabled,send,logHistory}:{room:RoomView;actorId:string;disabled:boolean;send:(command:Command)=>boolean;logHistory?:LogHistoryControl}){
 const disabled=connectionDisabled||room.status!=='playing'; const view=room.game!; const [selected,setSelected]=useState<string[]>([]); const [targets,setTargets]=useState<string[]>([]); const [inspect,setInspect]=useState<ActionCard|CharacterCard|null>(null); const [dedicated,setDedicated]=useState(false); const [variant,setVariant]=useState<TechniqueVariant|''>(''); const character=getCharacter(view.self.characterId); const activeCard=selected.length===1?getAction(selected[0]!):undefined; const discard=discardRequirement(view.self.hand.length,view.self.stats.handLimit,selected); const votes=new Set(room.closeVotes); const variants=techniqueVariants(activeCard?.id,character?.name,dedicated); const chosenVariant=variants.find(option=>option.value===variant)?.value??variants[0]?.value;
 const [coSource,setCoSource]=useState<CoSource|undefined>(); const [advanceCosts,setAdvanceCosts]=useState<string[]>([]);
 const [dispelTarget,setDispelTarget]=useState('');
 const [placement,setPlacement]=useState<'front'|'back'>('back');
 const [withdrawAbility,setWithdrawAbility]=useState<{revision:number;abilityId:string}|null>(null);
 const selectedWithdrawAbility=withdrawAbility?.revision===view.revision?view.maaiAbilityOptions.find(o=>o.abilityId===withdrawAbility.abilityId)?.abilityId:undefined;
 const [printedComponents,setPrintedComponents]=useState<string[]>([]);
 const [declarationIds,setDeclarationIds]=useState<string[]>([]);
 const [showOwnDiscard,setShowOwnDiscard]=useState(false);
 const baseAttack=activeCard?.category==='follower'||dedicated&&!canSelectDedicated(activeCard?.id??'',character?.name)?null:attackWithCosts(view,buildCardCommand('ATTACK',{cardId:activeCard?.id,targetIds:targets,dedicated,techniqueVariant:chosenVariant}),coSource,advanceCosts);
 const declarationCandidate=candidateFor(view,activeCard?{type:'ATTACK',cardInstanceId:activeCard.id,targetIds:targets,dedicated,...(chosenVariant?{techniqueVariant:chosenVariant}:{}),...(coSource?{coSource}:{})}:null);
 const chantSource=coSource??{cardInstanceId:activeCard?.id??'',dedicated,techniqueVariant:chosenVariant};
 const unpreparedPrintedChant=!declarationCandidate&&techniqueFor(chantSource.cardInstanceId,character?.name,chantSource.dedicated,chantSource.techniqueVariant)?.chant&&!view.self.chants.some(card=>card.cardInstanceId===chantSource.cardInstanceId);
 const selectedPrintedTechnique=techniqueFor(activeCard?.id??'',character?.name,dedicated,chosenVariant);
 const forbiddenPrintedAttack=selectedPrintedTechnique&&!printedTechniqueAllowed(view.self,selectedPrintedTechnique);
 const declaredAttack=unpreparedPrintedChant||forbiddenPrintedAttack?null:applyDeclarationSelection(view,baseAttack as DeclarationCommand|null,declarationIds);
 const attackCommand=withPrintedComponents(view,withDispel(declaredAttack,view.self.hand,dispelTarget),printedComponents);
 function clearAttackCosts(){setWithdrawAbility(null);setPrintedComponents([]);setDispelTarget('');setCoSource(undefined);setAdvanceCosts([]);setDeclarationIds([]);}
 const canPlaceFollower=view.phase==='setup'&&view.self.hand.some(id=>!!initialFollowerCommand(view,id));
 const placingSetup=view.phase==='setup'&&setupSeatLabel(view,view.self.id)==='配置中';
 // Finishing with a placeable follower left is final for the initial placement, so the first press only arms it (no browser dialog).
 const finishKey=`${view.pending?.round}:${view.self.followers.length}:${view.self.hand.length}`;
 const [armedFinish,setArmedFinish]=useState<string|null>(null); const finishArmed=placingSetup&&canPlaceFollower&&armedFinish===finishKey;
 // Keyboard focus would fall to <body> when the placed card leaves the hand or the bar empties.
 const refocus=useRef<{kind:'place';cardId:string}|{kind:'ready';round:number|undefined}|null>(null);
 useEffect(()=>{const wanted=refocus.current;if(!wanted)return;
  if(wanted.kind==='place'?view.self.hand.includes(wanted.cardId):view.phase==='setup'&&view.pending?.round===wanted.round&&!view.pending?.readyIds.includes(view.self.id))return;
  refocus.current=null;const active=document.activeElement as HTMLButtonElement|null;if(active&&active!==document.body&&!active.disabled&&active.isConnected)return;
  const root=document.getElementById('main-content');if(!root)return;
  const nextIndex=view.self.hand.findIndex(id=>!!initialFollowerCommand(view,id));
  const target=wanted.kind==='place'?(nextIndex>=0?root.querySelectorAll<HTMLElement>('#own-hand .card-face')[nextIndex]:root.querySelector<HTMLElement>('[data-choice="PASS_SETUP"]')):root.querySelector<HTMLElement>('.setup-status [role="status"]')??root.querySelector<HTMLElement>('.command-bar button:not(:disabled)');
  target?.focus();
 },[view]);
 // The sticky bar's real height feeds scroll-margin so a focused control is never scrolled underneath it.
 const barObserver=useRef<ResizeObserver|null>(null);
 const barRef=useCallback((bar:HTMLElement|null)=>{barObserver.current?.disconnect();barObserver.current=null;const root=document.getElementById('main-content');
  if(!bar||!root||typeof ResizeObserver==='undefined'){root?.style.removeProperty('--command-bar-h');return;}
  const update=()=>root.style.setProperty('--command-bar-h',`${Math.ceil(bar.getBoundingClientRect().height)}px`);update();
  barObserver.current=new ResizeObserver(update);barObserver.current.observe(bar);},[]);
 const showHand=()=>{const hand=document.getElementById('own-hand');if(!hand)return;hand.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});hand.querySelector<HTMLElement>('.card-face:not(:disabled)')?.focus({preventScroll:true});};
 const silenced=view.players[view.self.id]!.statuses.some(status=>status.kind==='silenced');
 const silenceBlocksAttack=silenced&&Array.isArray(activeCard?.stats?.attributes)&&activeCard.stats.attributes.includes('魔');
 function act(choice:string){if(choice==='PASS_SETUP'&&placingSetup&&canPlaceFollower&&!finishArmed){setArmedFinish(finishKey);return;}let command:Command|null=null;const cardId=selected[0];if(choice==='ATTACK')command=attackCommand;else if(choice==='APPROACH'||choice==='WITHDRAW'){command=buildCardCommand(choice,{cardId,targetId:targets[0]});if(command?.type==='WITHDRAW'&&selectedWithdrawAbility&&selectedWithdrawAbility!=='c2-p02-r2c1-ab03')command={...command,abilityId:selectedWithdrawAbility};}else if(choice==='PLACE_INITIAL_FOLLOWER')command=cardId?initialFollowerCommand(view,cardId,placement):null;else if(choice==='CHANT')command=buildCardCommand(choice,{cardId,...(dedicated&&hasOptionalChant(cardId,character?.name)?{dedicated:true}:{})});else if(choice==='REST'||choice==='PLAY_TURN_CARD')command=choice==='REST'?{type:'REST',cardInstanceIds:selected}:{type:'PLAY_TURN_CARD',cardInstanceIds:selected};else if(choice==='END_TURN')command=discard.valid?{type:'END_TURN',discardIds:selected}:null;else if(['REVEAL_CHARACTER','PASS_SETUP','START_TURN','PASS_ACTION','PASS_WITHDRAWAL'].includes(choice))command={type:choice} as Command;if(command&&send(command)){if(view.phase==='setup'&&!view.activeWindow)refocus.current=command.type==='PLACE_INITIAL_FOLLOWER'?{kind:'place',cardId:command.cardInstanceId}:command.type==='PASS_SETUP'?{kind:'ready',round:view.pending?.round}:null;setArmedFinish(null);setSelected([]);setTargets([]);clearAttackCosts();}}
 return <main id="main-content" className="board"><header className="board-header"><div><p className="eyebrow">{phaseNames[view.phase]??view.phase}</p><h1>戦場</h1></div><div>山札 {view.deckCount} · <button className="card-link pile-link" aria-haspopup="dialog" aria-label={`自分の捨て札を見る（捨て札 ${view.discardCount}枚）`} onClick={()=>setShowOwnDiscard(true)}>捨て札 {view.discardCount}</button></div></header>
 <OwnDiscardDialog ids={view.self.discardedCardInstanceIds} count={view.discardCount} open={showOwnDiscard} onClose={()=>setShowOwnDiscard(false)} onInspect={setInspect}/>
 <ResultPanel view={view}/>
 <EndgameRevealPanel view={view} onInspect={setInspect}/>
 <PendingFatalNotice players={view.seatOrder.map(id=>view.players[id]!)}/>
 <section className="self panel"><div>{character?<button className="portrait-button" aria-label="自分の人物カードを確認" onClick={()=>setInspect(character)}><img className="portrait" src={character.assetId} alt="" width="400" height="560"/><span>人物の詳細</span></button>:null}</div><div><p className="eyebrow">自分の配役</p><h2>{character?.name??'未確認'}</h2><p><span className="tag">{view.self.faction}</span></p><CurrentGoals objective={view.self.objective} currentObjective={view.self.currentObjective} defeatCondition={view.self.defeatCondition}/><dl className="stats"><div><dt>戦士</dt><dd>{view.self.stats.warrior_level}</dd></div><div><dt>魔法</dt><dd>{view.self.stats.magic_level}</dd></div><div><dt>精神</dt><dd>{view.self.stats.spirit}</dd></div><div><dt>耐久</dt><dd>{view.self.stats.endurance}</dd></div><div><dt>損傷</dt><dd>{view.self.damage}</dd></div></dl></div></section>
 <SpiritExpiryNotice value={view.spiritExpiry} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <RevealControl key={`reveal:${view.activeWindow?decisionPanelKey(view):view.revision}`} view={view} disabled={disabled} send={send}/>
 <SetupPanel view={view}/>
 <section className="players" aria-label="参加者の公開状態">{view.seatOrder.map(id=>{const p=view.players[id]!;const person=p.revealed&&p.characterId?getCharacter(p.characterId):undefined;const shown=(cards:typeof p.followers)=>cards.length?cards.map((card,index)=><span key={card.position}>{index?'、':''}{card.face==='front'?<PublicCardLinks ids={[card.cardInstanceId]} onInspect={setInspect}/>: '裏向き'}</span>):'なし';return <article className={`player panel ${id===view.seatOrder[view.turnSeat]?'current':''}`} key={id}><h2>{p.name}</h2><p className="tag">{presenceLabels[p.presence]}</p>{view.phase==='setup'?<p className={`tag ${setupSeatLabel(view,id)==='準備完了'?'ready':setupSeatLabel(view,id)==='対象外'?'outside':''}`}>{setupSeatLabel(view,id)}</p>:null}{showsWindowSeatLabel(view,id)?<p className={`tag ${windowSeatLabel(view,id)==='判断中'?'':windowSeatLabel(view,id)==='対象外'?'outside':'ready'}`}>{windowSeatLabel(view,id)}</p>:null}<p>{person?<button className="card-link" onClick={()=>setInspect(person)} aria-label={`${person.name}の人物カードを見る`}>{person.name}</button>:p.revealed?'公開済み':'正体非公開'} · 損傷 {p.damage} · 手札 {p.handCount}</p><dl className="public-zones"><div><dt>従者{p.followers.length>1?<small className="hint">（左が最前線）</small>:null}</dt><dd>{shown(p.followers)}</dd></div><div><dt>詠唱</dt><dd>{shown(p.chants)}</dd></div><div><dt>OPEN</dt><dd><PublicCardLinks ids={p.open} onInspect={setInspect}/></dd></div><div><dt>強化</dt><dd><PublicCardLinks ids={p.attachments} onInspect={setInspect}/></dd></div></dl><StatusList player={p} own={id===view.self.id}/>{id!==view.self.id?<><p>距離: {view.distances[view.self.id]?.[id]==='near'?'近距離':'遠距離'}</p><label className="target"><input type="checkbox" disabled={disabled||p.presence!=='active'} checked={targets.includes(id)} onChange={()=>setTargets(value=>toggleSelection(value,id))}/> 対象に選ぶ</label></>:null}</article>})}</section>
 {!view.activeWindow&&view.legalChoices.includes('ATTACK')?<DispelFields hand={view.self.hand} targets={targets} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} targetId={dispelTarget} disabled={disabled} onChange={setDispelTarget}/>:null}
 <PrintedCombinationFields view={view} command={declaredAttack} selected={printedComponents} disabled={disabled} onChange={setPrintedComponents}/>
 <DeclarationStatus selection={view.declarationSelection}/>
 <ActionSummary action={view.currentAction} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <ActionCalculationSummary value={view.actionCalculation} currentAction={view.currentAction} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <ReceivedTechniqueSummary attack={view.currentAttack} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <FollowerBundleSummary bundle={view.followerBundle} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <FollowerEntrySummary entry={view.followerEntry} sources={view.virtualFollowerDefense} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <FollowerDestructionSummary attack={view.currentAttack} results={view.followerDefenseResults} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <RollPanel view={view}/>
 <section className="zones-own"><OwnCardZone title="自分の従者" cards={view.self.followers} onInspect={setInspect} frontLabel="最前線"/><OwnCardZone title="自分の詠唱" cards={view.self.chants} onInspect={setInspect} selected={selected} onSelect={id=>{setSelected(value=>value.includes(id)?[]:[id]);clearAttackCosts();}} disabled={disabled||!view.legalChoices.includes('ATTACK')}/><div className="panel"><h2>距離標</h2><p>{view.distanceMarkers.length?view.distanceMarkers.map(marker=>`${view.players[marker.a]?.name}―${view.players[marker.b]?.name}（${view.players[marker.ownerId]?.name}）`).join(' / '):'なし'}</p></div></section>
 {view.phase!=='setup'?<Hand ids={view.self.hand} selected={selected} disabled={disabled} onSelect={id=>{setSelected(value=>toggleSelection(value,id));clearAttackCosts();}} onInspect={setInspect}/>:null}
 {view.phase!=='setup'&&(activeCard||targets.length)?<section className="confirmation panel" aria-label="操作の確認"><h2>選択内容</h2><p>カード: {activeCard?.name??'未選択'} / 対象: {targets.map(id=>view.players[id]?.name).join('、')||'未選択'}</p>{activeCard?<p>{activeCard.printed_text}</p>:null}{silenceBlocksAttack?<p className="hint">沈黙中はこの魔法技の攻撃・新規詠唱はできません。</p>:null}<label className="inline"><input type="checkbox" checked={dedicated} onChange={event=>{setDedicated(event.target.checked);clearAttackCosts();}}/> 専用技として使う</label>{variants.length>1?<label>専用効果の選択<select value={chosenVariant} onChange={event=>{setVariant(event.target.value as TechniqueVariant);setDeclarationIds([]);}}>{variants.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>:null}{activeCard?<AttackCostFields view={view} cardId={activeCard.id} dedicated={dedicated} coSource={coSource} advances={advanceCosts} disabled={disabled} onCoSource={source=>{setCoSource(source);setDeclarationIds([]);}} onAdvances={setAdvanceCosts}/>:null}<DeclarationFields candidate={declarationCandidate} selected={declarationIds} disabled={disabled} onChange={setDeclarationIds}/></section>:null}
 {view.legalChoices.includes('ARRANGE_FOLLOWERS')?<FollowerEditor key={view.revision} view={view} disabled={disabled} confirm={command=>send(command)}/>:null}
 {view.phase==='hand-adjustment'?<p className={discard.valid?'hint':'error'} role="status">手札上限は{view.self.stats.handLimit}枚です。{discard.required}枚を捨て札として選択してください（現在 {selected.length}枚）。</p>:null}
 <DrawControl key={`draw:${view.revision}`} view={view} disabled={disabled} send={send}/>
 {!view.activeWindow&&view.legalChoices.includes('WITHDRAW')&&view.maaiAbilityOptions.length?<label>離脱の間合いに添える能力<select disabled={disabled} value={selectedWithdrawAbility??''} onChange={e=>setWithdrawAbility({revision:view.revision,abilityId:e.target.value})}><option value="">使わない</option>{view.maaiAbilityOptions.map(o=><option key={o.abilityId} value={o.abilityId}>{o.name}</option>)}</select></label>:null}
 {view.phase==='setup'?<Hand ids={view.self.hand} selected={placingSetup?selected:[]} disabled={disabled||!placingSetup} onSelect={id=>{setArmedFinish(null);setSelected(value=>value.includes(id)?[]:[id]);clearAttackCosts();}} onInspect={setInspect}/>:null}
 {!view.activeWindow?<section className="command-bar" aria-label="現在できる操作" ref={barRef}>{finishArmed?<p className="error setup-warning" role="alert">まだ置ける従者があります。このまま終えると、初期配置ではもう置けません。</p>:null}{<SetupCommandStatus view={view} canPlace={canPlaceFollower} selected={placingSetup&&activeCard?{name:activeCard.name,placeable:!!initialFollowerCommand(view,activeCard.id)}:undefined} onShowHand={showHand}/>}{view.legalChoices.flatMap(choice=>otherPanelCommands.has(choice)||(lifecycleCommands.has(choice)||lifetimeCommands.has(choice)||abilityCommands.has(choice)||combinationCommands.has(choice))?[]:choice==='PASS_SETUP'&&finishArmed?[<button key="keep-placing" className="secondary" onClick={()=>setArmedFinish(null)}>やめる</button>,<button key={choice} className="danger" data-choice={choice} disabled={disabled} onClick={()=>act(choice)}>置かずに終える</button>]:[<button key={choice} data-choice={choice} className={choice==='PASS_SETUP'&&view.phase==='setup'?'secondary':undefined} disabled={disabled||(choice==='PLACE_INITIAL_FOLLOWER'&&!initialFollowerCommand(view,selected[0]??''))||(choice==='END_TURN'&&!discard.valid)||(choice==='CHANT'&&(selected.length!==1||!eligibleChantCards(view.self.hand,character?.name,dedicated,silenced,view.self.faction).includes(selected[0]!)||view.self.chants.length>=view.self.stats.chantLimit))||(['ATTACK','APPROACH','WITHDRAW','PLACE_INITIAL_FOLLOWER'].includes(choice)&&selected.length!==1)||(choice==='ATTACK'&&(!attackCommand||!targets.length||silenceBlocksAttack||turnTechniqueIds.has(activeCard?.id??'')))} onClick={()=>act(choice)}>{choice==='END_TURN'?`選んだ${discard.required}枚を捨てて手番を終える`:commandNames[choice]??choice}</button>])}<SetupPositionChoice view={view} canPlace={canPlaceFollower} position={placement} disabled={disabled} onPosition={setPlacement}/></section>:null}
 <CombinationPanel key={`combination:${view.revision}`} view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send}/>
 <SadLovePanel view={view} disabled={disabled} send={send}/>
 <ConditionalAbilityPanel key={`conditional:${view.revision}`} view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send}/>
 <InformationHistoryPanel view={view}/>
 <TurnChoiceCardPanel view={view} disabled={disabled} send={send}/>
 <WishPanel view={view} disabled={disabled} send={send}/>
 <VirtualBladePanel key={`virtual-blade:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <AllArmyPanel key={`all-army:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <TurnCardPanel view={view} disabled={disabled} send={send}/>
 <AnytimeCardPanel view={view} disabled={disabled} send={send}/>
 <ReclaimPanel view={view} disabled={disabled} send={send}/>
 <SuppressionPanel view={view} disabled={disabled} send={send}/>
 <ShadowJumpPanel key={`shadow-jump:${view.activeWindow?.windowId}`} view={view} disabled={disabled} send={send}/>
 <AbilityPanel key={`ability:${view.activeWindow?decisionPanelKey(view):`${view.phase}:${view.revision}`}`} view={view} disabled={disabled} send={send}/>
 <FollowerAttackPanel key={`follower-attack:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <FollowerBundlePanel key={`follower-bundle:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <MagicGatePanel key={`magic-gate:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <TurnTechniquePanel key={`turn-technique:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <LifetimeDecisionPanel view={view} disabled={disabled} send={send}/>
 <LifecyclePanel key={`lifecycle:${view.activeWindow?decisionPanelKey(view):`${view.phase}:${view.revision}`}`} view={view} disabled={disabled} send={send}/>
 <BeastCapturePanel view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send}/>
 <DistanceExchangeSummary progress={view.distanceExchange} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <MaaiDefenseSummary progress={view.maaiDefense} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <InspectionPanel view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send} onInspect={setInspect}/>
 {!reactionPanelHandles(view)?<WindowStatus view={view} disabled={disabled} send={send}/>:null}
 <ReactionPanel key={decisionPanelKey(view)} view={view} disabled={disabled} send={send}/><PublicLog view={view} onInspect={setInspect} {...(logHistory?{logHistory}:{})}/>
 <section className="panel quiet" aria-label="対戦卓の管理"><h2>卓の管理</h2><p>閉卓への同意: {votes.size} / {room.members.length}人</p><div className="button-row"><button className="secondary" disabled={connectionDisabled||room.status==='closed'} onClick={()=>send({type:'CLOSE_BY_AGREEMENT',agree:!votes.has(actorId)})}>{votes.has(actorId)?'閉卓への同意を取り消す':'閉卓に同意する'}</button><a className="button secondary" href="/">卓一覧へ戻る</a></div><p className="hint">対戦中の席は保持されます。全員が同意すると保存された卓を閉じます。</p></section>
 <CardDialog card={inspect} onClose={()=>setInspect(null)}/></main>;
}
