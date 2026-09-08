import { ConditionalAbilityPanel } from './ConditionalAbilityPanel.js';
import { DrawControl, RevealControl, SpiritExpiryNotice } from './OptionalTurnControls.js';
import { InspectionPanel } from './InspectionPanel.js';
import { DeclarationStatus } from './DeclarationStatus.js';
import { DeclarationFields } from './DeclarationFields.js';
import { applyDeclarationSelection, candidateFor, type DeclarationCommand } from './declaration-input.js';
import { CurrentGoals } from './CurrentGoals.js';
import { PendingFatalNotice } from './PendingFatalNotice.js';
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
import { useState } from 'react';
import { CardDialog } from './CardDialog.js';
import { buildCardCommand, discardRequirement, eligibleChantCards, hasOptionalChant, techniqueVariants, toggleSelection } from './commands.js';
import { FollowerEditor } from './FollowerEditor.js';
import { initialFollowerCommand } from './follower-input.js';
import { MagicGatePanel } from './MagicGatePanel.js';
import { Hand } from './Hand.js';
import { OwnCardZone } from './OwnCardZone.js';
import { PublicLog } from './PublicLog.js';
import { PublicCardLinks } from './PublicCardLinks.js';
import { RollPanel } from './RollPanel.js';
import { StatusList } from './StatusList.js';
import { ReactionPanel } from './ReactionPanel.js';
import { LifecyclePanel, lifecycleCommands } from './LifecyclePanel.js';
import { ResultPanel, presenceLabels } from './ResultPanel.js';
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
const commandNames:Record<string,string>={REVEAL_CHARACTER:'正体を公開',PASS_SETUP:'従者を置かず進む',PLACE_INITIAL_FOLLOWER:'従者を置く',START_TURN:'手番を始める',PASS_ACTION:'行動を終える',REST:'休息',CHANT:'詠唱',PLAY_TURN_CARD:'カードを使う',APPROACH:'接近',WITHDRAW:'離脱',PASS_WITHDRAWAL:'離脱しない'};

export function Board({room,actorId,disabled:connectionDisabled,send}:{room:RoomView;actorId:string;disabled:boolean;send:(command:Command)=>boolean}){
 const disabled=connectionDisabled||room.status!=='playing'; const view=room.game!; const [selected,setSelected]=useState<string[]>([]); const [targets,setTargets]=useState<string[]>([]); const [inspect,setInspect]=useState<ActionCard|CharacterCard|null>(null); const [dedicated,setDedicated]=useState(false); const [variant,setVariant]=useState<TechniqueVariant|''>(''); const character=getCharacter(view.self.characterId); const activeCard=selected.length===1?getAction(selected[0]!):undefined; const discard=discardRequirement(view.self.hand.length,view.self.stats.handLimit,selected); const votes=new Set(room.closeVotes); const variants=techniqueVariants(activeCard?.id,character?.name,dedicated); const chosenVariant=variants.find(option=>option.value===variant)?.value??variants[0]?.value;
 const [coSource,setCoSource]=useState<CoSource|undefined>(); const [advanceCosts,setAdvanceCosts]=useState<string[]>([]);
 const [declarationIds,setDeclarationIds]=useState<string[]>([]);
 const baseAttack=activeCard?.category==='follower'?null:attackWithCosts(view,buildCardCommand('ATTACK',{cardId:activeCard?.id,targetIds:targets,dedicated,techniqueVariant:chosenVariant}),coSource,advanceCosts);
 const declarationCandidate=candidateFor(view,activeCard?{type:'ATTACK',cardInstanceId:activeCard.id,targetIds:targets,dedicated,...(chosenVariant?{techniqueVariant:chosenVariant}:{}),...(coSource?{coSource}:{})}:null);
 const attackCommand=applyDeclarationSelection(view,baseAttack as DeclarationCommand|null,declarationIds);
 function clearAttackCosts(){setCoSource(undefined);setAdvanceCosts([]);setDeclarationIds([]);}
 const silenced=view.players[view.self.id]!.statuses.some(status=>status.kind==='silenced');
 const silenceBlocksAttack=silenced&&Array.isArray(activeCard?.stats?.attributes)&&activeCard.stats.attributes.includes('魔');
 function act(choice:string){let command:Command|null=null;const cardId=selected[0];if(choice==='ATTACK')command=attackCommand;else if(choice==='APPROACH'||choice==='WITHDRAW')command=buildCardCommand(choice,{cardId,targetId:targets[0]});else if(choice==='PLACE_INITIAL_FOLLOWER')command=cardId?initialFollowerCommand(view,cardId):null;else if(choice==='CHANT')command=buildCardCommand(choice,{cardId,...(dedicated&&hasOptionalChant(cardId,character?.name)?{dedicated:true}:{})});else if(choice==='REST'||choice==='PLAY_TURN_CARD')command={type:choice,cardInstanceIds:selected};else if(choice==='END_TURN')command=discard.valid?{type:'END_TURN',discardIds:selected}:null;else if(['REVEAL_CHARACTER','PASS_SETUP','START_TURN','PASS_ACTION','PASS_WITHDRAWAL'].includes(choice))command={type:choice} as Command;if(command&&send(command)){setSelected([]);setTargets([]);clearAttackCosts();}}
 return <main id="main-content" className="board"><header className="board-header"><div><p className="eyebrow">{phaseNames[view.phase]??view.phase}</p><h1>戦場</h1></div><div>山札 {view.deckCount} · 捨て札 {view.discard.length}</div></header>
 <ResultPanel view={view}/>
 <PendingFatalNotice players={view.seatOrder.map(id=>view.players[id]!)}/>
 <section className="self panel"><div>{character?<button className="portrait-button" aria-label="自分の人物カードを確認" onClick={()=>setInspect(character)}><img className="portrait" src={character.assetId} alt="" width="400" height="560"/><span>人物の詳細</span></button>:null}</div><div><p className="eyebrow">自分の配役</p><h2>{character?.name??'未確認'}</h2><p><span className="tag">{view.self.faction}</span></p><CurrentGoals objective={view.self.objective} currentObjective={view.self.currentObjective} defeatCondition={view.self.defeatCondition}/><dl className="stats"><div><dt>戦士</dt><dd>{view.self.stats.warrior_level}</dd></div><div><dt>魔法</dt><dd>{view.self.stats.magic_level}</dd></div><div><dt>精神</dt><dd>{view.self.stats.spirit}</dd></div><div><dt>耐久</dt><dd>{view.self.stats.endurance}</dd></div><div><dt>損傷</dt><dd>{view.self.damage}</dd></div></dl></div></section>
 <SpiritExpiryNotice value={view.spiritExpiry} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <RevealControl key={`reveal:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <section className="players" aria-label="参加者の公開状態">{view.seatOrder.map(id=>{const p=view.players[id]!;const person=p.revealed&&p.characterId?getCharacter(p.characterId):undefined;const shown=(cards:typeof p.followers)=>cards.length?cards.map((card,index)=><span key={card.position}>{index?'、':''}{card.face==='front'?<PublicCardLinks ids={[card.cardInstanceId]} onInspect={setInspect}/>: '裏向き'}</span>):'なし';return <article className={`player panel ${id===view.seatOrder[view.turnSeat]?'current':''}`} key={id}><h2>{p.name}</h2><p className="tag">{presenceLabels[p.presence]}</p><p>{person?<button className="card-link" onClick={()=>setInspect(person)} aria-label={`${person.name}の人物カードを見る`}>{person.name}</button>:p.revealed?'公開済み':'正体非公開'} · 損傷 {p.damage} · 手札 {p.handCount}</p><dl className="public-zones"><div><dt>従者</dt><dd>{shown(p.followers)}</dd></div><div><dt>詠唱</dt><dd>{shown(p.chants)}</dd></div><div><dt>OPEN</dt><dd><PublicCardLinks ids={p.open} onInspect={setInspect}/></dd></div><div><dt>強化</dt><dd><PublicCardLinks ids={p.attachments} onInspect={setInspect}/></dd></div></dl><StatusList player={p} own={id===view.self.id}/>{id!==view.self.id?<><p>距離: {view.distances[view.self.id]?.[id]==='near'?'近距離':'遠距離'}</p><label className="target"><input type="checkbox" disabled={disabled||p.presence!=='active'} checked={targets.includes(id)} onChange={()=>setTargets(value=>toggleSelection(value,id))}/> 対象に選ぶ</label></>:null}</article>})}</section>
 <DeclarationStatus selection={view.declarationSelection}/>
 <ActionSummary action={view.currentAction} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <ActionCalculationSummary value={view.actionCalculation} currentAction={view.currentAction} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <ReceivedTechniqueSummary attack={view.currentAttack} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <FollowerBundleSummary bundle={view.followerBundle} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <FollowerEntrySummary entry={view.followerEntry} sources={view.virtualFollowerDefense} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <FollowerDestructionSummary attack={view.currentAttack} results={view.followerDefenseResults} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <RollPanel view={view}/>
 <section className="zones-own"><OwnCardZone title="自分の従者" cards={view.self.followers} onInspect={setInspect}/><OwnCardZone title="自分の詠唱" cards={view.self.chants} onInspect={setInspect} selected={selected} onSelect={id=>{setSelected(value=>value.includes(id)?[]:[id]);clearAttackCosts();}} disabled={disabled||!view.legalChoices.includes('ATTACK')}/><div className="panel"><h2>距離標</h2><p>{view.distanceMarkers.length?view.distanceMarkers.map(marker=>`${view.players[marker.a]?.name}―${view.players[marker.b]?.name}（${view.players[marker.ownerId]?.name}）`).join(' / '):'なし'}</p></div></section>
 <Hand ids={view.self.hand} selected={selected} disabled={disabled} onSelect={id=>{setSelected(value=>toggleSelection(value,id));clearAttackCosts();}} onInspect={setInspect}/>
 {activeCard||targets.length?<section className="confirmation panel" aria-label="操作の確認"><h2>選択内容</h2><p>カード: {activeCard?.name??'未選択'} / 対象: {targets.map(id=>view.players[id]?.name).join('、')||'未選択'}</p>{activeCard?<p>{activeCard.printed_text}</p>:null}{silenceBlocksAttack?<p className="hint">沈黙中はこの魔法技の攻撃・新規詠唱はできません。</p>:null}<label className="inline"><input type="checkbox" checked={dedicated} onChange={event=>{setDedicated(event.target.checked);clearAttackCosts();}}/> 専用技として使う</label>{variants.length>1?<label>専用効果の選択<select value={chosenVariant} onChange={event=>{setVariant(event.target.value as TechniqueVariant);setDeclarationIds([]);}}>{variants.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>:null}{activeCard?<AttackCostFields view={view} cardId={activeCard.id} dedicated={dedicated} coSource={coSource} advances={advanceCosts} disabled={disabled} onCoSource={source=>{setCoSource(source);setDeclarationIds([]);}} onAdvances={setAdvanceCosts}/>:null}<DeclarationFields candidate={declarationCandidate} selected={declarationIds} disabled={disabled} onChange={setDeclarationIds}/></section>:null}
 {view.legalChoices.includes('ARRANGE_FOLLOWERS')?<FollowerEditor key={view.revision} view={view} disabled={disabled} confirm={command=>send(command)}/>:null}
 {view.phase==='hand-adjustment'?<p className={discard.valid?'hint':'error'} role="status">手札上限は{view.self.stats.handLimit}枚です。{discard.required}枚を捨て札として選択してください（現在 {selected.length}枚）。</p>:null}
 <DrawControl key={`draw:${view.revision}`} view={view} disabled={disabled} send={send}/>
 {!view.activeWindow?<section className="command-bar" aria-label="現在できる操作">{view.legalChoices.flatMap(choice=>choice==='SET_CONDITIONAL_ABILITY'||choice==='CHOOSE_DRAW'||choice==='ARRANGE_FOLLOWERS'||choice==='REVEAL_CHARACTER'||(lifecycleCommands.has(choice)||lifetimeCommands.has(choice)||abilityCommands.has(choice)||combinationCommands.has(choice))?[]:[<button key={choice} disabled={disabled||(choice==='PLACE_INITIAL_FOLLOWER'&&!initialFollowerCommand(view,selected[0]??''))||(choice==='END_TURN'&&!discard.valid)||(choice==='CHANT'&&(selected.length!==1||!eligibleChantCards(view.self.hand,character?.name,dedicated,silenced).includes(selected[0]!)||view.self.chants.length>=view.self.stats.chantLimit))||(['ATTACK','APPROACH','WITHDRAW','PLACE_INITIAL_FOLLOWER'].includes(choice)&&selected.length!==1)||(choice==='ATTACK'&&(!attackCommand||!targets.length||silenceBlocksAttack||turnTechniqueIds.has(activeCard?.id??'')))} onClick={()=>act(choice)}>{choice==='END_TURN'?`選んだ${discard.required}枚を捨てて手番を終える`:commandNames[choice]??(choice==='ATTACK'?'攻撃を確認して実行':choice)}</button>])}</section>:null}
 <CombinationPanel key={`combination:${view.revision}`} view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send}/>
 <ConditionalAbilityPanel key={`conditional:${view.revision}`} view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send}/>
 <AbilityPanel key={`ability:${view.activeWindow?.windowId??view.phase}:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <FollowerAttackPanel key={`follower-attack:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <FollowerBundlePanel key={`follower-bundle:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <MagicGatePanel key={`magic-gate:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <TurnTechniquePanel key={`turn-technique:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <LifetimeDecisionPanel view={view} disabled={disabled} send={send}/>
 <LifecyclePanel key={`lifecycle:${view.activeWindow?.windowId??view.phase}:${view.revision}`} view={view} disabled={disabled} send={send}/>
 <BeastCapturePanel view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send}/>
 <MaaiDefenseSummary progress={view.maaiDefense} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))}/>
 <InspectionPanel view={view} names={Object.fromEntries(view.seatOrder.map(id=>[id,view.players[id]!.name]))} disabled={disabled} send={send} onInspect={setInspect}/>
 <ReactionPanel key={`${view.activeWindow?.windowId??'none'}:${view.activeWindow?.windowRevision??0}`} view={view} disabled={disabled} send={send}/><PublicLog view={view}/>
 <section className="panel quiet" aria-label="対戦卓の管理"><h2>卓の管理</h2><p>閉卓への同意: {votes.size} / {room.members.length}人</p><div className="button-row"><button className="secondary" disabled={connectionDisabled||room.status==='closed'} onClick={()=>send({type:'CLOSE_BY_AGREEMENT',agree:!votes.has(actorId)})}>{votes.has(actorId)?'閉卓への同意を取り消す':'閉卓に同意する'}</button><a className="button secondary" href="/">卓一覧へ戻る</a></div><p className="hint">対戦中の席は保持されます。全員が同意すると保存された卓を閉じます。</p></section>
 <CardDialog card={inspect} onClose={()=>setInspect(null)}/></main>;
}
