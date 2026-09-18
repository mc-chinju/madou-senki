import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ClientEnvelope } from '@madou/protocol';
import { RoomConnection, clearPendingDeparture } from './connection/client.js';
import { Board } from './game/Board.js';
import { Lobby } from './lobby/Lobby.js';
import { LoginScreen } from './login/LoginScreen.js';
import { WaitingRoom } from './room/WaitingRoom.js';
import { api, getCurrentSession, UNAUTHENTICATED_MESSAGE, type Session } from './session.js';

const statusLabel={stopped:'停止中',connecting:'接続中',reconnecting:'再接続中',syncing:'同期中',ready:'接続済み','read-only':'閲覧のみ'} as const;
const errorLabel:Record<string,string>={FORBIDDEN:'この操作は許可されていません',ROOM_FULL:'卓は満席です',ROOM_NOT_OPEN:'この卓は募集を終了しています',NOT_READY:'開始条件が揃っていません',RULESET_NOT_READY:'対戦ルールを準備中です',READ_ONLY_CONNECTION:'別のタブが操作中です。この画面は閲覧専用です',STALE_REVISION:'卓が更新されました。再同期しています',STALE_WINDOW:'状況が変わりました。もう一度判断してください',INVALID_ACTION:'現在はその操作を実行できません',CLIENT_STORAGE_ERROR:'操作の復旧情報を保存できません',INTERNAL_ERROR:'サーバーとの同期をやり直しています'};

export function App(){
 const [session,setSession]=useState<Session|null|undefined>(undefined);const [startupError,setStartupError]=useState('');const [offerPasskey,setOfferPasskey]=useState(false);
 useEffect(()=>{void getCurrentSession().then(setSession,reason=>{if(!(reason instanceof Error&&reason.message===UNAUTHENTICATED_MESSAGE))setStartupError(reason instanceof Error?reason.message:'ログイン状態を確認できません');setSession(null);})},[]);
 if(session===undefined)return <><div className="center"><p role="status">ログイン状態を確認しています…</p></div><SiteCredits/></>;
 // Room URLs stay in place: after login the same /rooms/:id renders the seat check.
 if(!session)return <><SiteHeader/><LoginScreen startupError={startupError} onSignedIn={(next,viaCode)=>{setOfferPasskey(viaCode);setSession(next)}}/><SiteCredits/></>;
 const roomMatch=location.pathname.match(/^\/rooms\/([^/]+)\/?$/);return <><SiteHeader/>{roomMatch?<RoomRoute session={session} roomId={decodeURIComponent(roomMatch[1]!)} />:<Lobby session={session} offerPasskey={offerPasskey}/>}<SiteCredits/></>;
}
function SiteHeader(){return <header className="site-header"><a href="/" className="brand"><span>魔導戦記</span><small>2nd</small></a><span className="prototype">検証版</span></header>}
function SiteCredits(){return <footer className="site-credits" aria-label="クレジット"><p>原作カードゲーム: 魔導戦記カードゲーム 2nd edition</p><p>作者: 夢祭遙 · <a href="https://note.com/dreamfv/n/nb58307ec682c" target="_blank" rel="noopener noreferrer">作者配布ページ（新しいタブで開く）</a></p></footer>}

function RoomRoute({session,roomId}:{session:Session;roomId:string}){
 const [seated,setSeated]=useState<boolean|null>(null);const [error,setError]=useState('');const [joining,setJoining]=useState(false);
 useEffect(()=>{let active=true;void api<{seated:boolean}>(`/api/rooms/${encodeURIComponent(roomId)}/seat`).then(result=>{if(active){if(!result.seated)clearPendingDeparture(sessionStorage,session.id,roomId);setSeated(result.seated)}},reason=>{if(active)setError(reason instanceof Error?reason.message:'着席状態を確認できません')});return()=>{active=false}},[roomId,session.id]);
 async function join(){setJoining(true);setError('');const invite=new URLSearchParams(location.hash.slice(1)).get('invite');try{await api(`/api/rooms/${encodeURIComponent(roomId)}/join`,{method:'POST',body:JSON.stringify(invite?{inviteToken:invite}:{})});history.replaceState(null,'',location.pathname);setSeated(true)}catch(reason){setError(reason instanceof Error?reason.message:'卓に参加できません');setJoining(false)}}
 if(error)return <main className="page narrow"><p role="alert" className="error">{error}</p><a className="button secondary" href="/">卓一覧へ</a></main>;
 if(seated===null)return <main className="page narrow"><p role="status">着席状態を確認しています…</p></main>;
 if(!seated)return <main className="page narrow"><section className="panel"><p className="eyebrow">卓への参加</p><h1>この卓に着席しますか？</h1><p>参加後、待機室で準備完了を選べます。</p><button disabled={joining} onClick={()=>void join()}>{joining?'参加中…':'この卓に参加する'}</button></section></main>;
 return <ConnectedRoom session={session} roomId={roomId}/>;
}
function ConnectedRoom({session,roomId}:{session:Session;roomId:string}){
 const connection=useMemo(()=>{const ws=new URL(`/api/rooms/${encodeURIComponent(roomId)}/ws`,location.origin);ws.protocol=location.protocol==='https:'?'wss:':'ws:';return new RoomConnection({actorId:session.id,roomId,url:ws.toString(),storage:sessionStorage})},[roomId,session.id]);
 useEffect(()=>{connection.start();return()=>connection.stop()},[connection]);const state=useSyncExternalStore(connection.subscribe,connection.getSnapshot,connection.getSnapshot);
 useEffect(()=>{if(state.lastAck?.commandType==='LEAVE')location.assign('/')},[state.lastAck]);const send=(command:ClientEnvelope['command'])=>connection.send(command);
 return <><div className={`connection ${state.status}`} role="status"><span aria-hidden="true"/>{statusLabel[state.status]}{state.pending?' · 操作を確認中':''}</div>{state.error?<div className="global-error" role="alert">{errorLabel[state.error]??'操作を完了できませんでした'}</div>:null}{state.view?(state.view.game?<Board room={state.view} actorId={session.id} disabled={state.status!=='ready'} send={send}/>:<WaitingRoom view={state.view} actorId={session.id} disabled={state.status!=='ready'} send={send}/>):<main id="main-content" className="page narrow"><p role="status">卓の状態を受信しています…</p></main>}</>;
}
