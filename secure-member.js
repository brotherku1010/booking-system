// Member LIFF web entry. Android may suspend it or return LINE login in a new
// browser tab. Credentials stay in private storage/postMessage, never the URL.
(() => {
 const gasUrl='https://script.google.com/macros/s/AKfycbxu_ke2CmB51jhdgOP05yb6mBfqwdAIPUQL_IfHmmXwlzaDH3sModbISVHiHUgZToBeWg/exec';
 const sessionKey='gugo-member-session-v3',logoutKey='gugo-member-explicit-logout',intentKey='gugo-member-login-intent';
 const sharedIntentKey='gugo-member-login-intent-v2',pendingLogoutKey='gugo-member-logout-pending-v1',logoutGenerationKey='gugo-member-logout-generation-v1';
 const intentLifetime=600000,initTimeout=20000,requestTimeout=50000;
 const status=document.getElementById('status-text'),loader=document.getElementById('loader'),spinner=document.querySelector('.spinner'),loginButton=document.getElementById('line-login-button'),container=document.getElementById('ios-container');
 const memory={localStorage:Object.create(null),sessionStorage:Object.create(null)},unpersisted={localStorage:new Set(),sessionStorage:new Set()};
 let profile=null,disconnect=null,busy=false,liffReady=false,initPromise=null,action=null,waitingForLine=false,appEpoch=0,authEpoch=0;
 const storage=name=>{try{return globalThis[name];}catch(_){return null;}};
 const read=(name,key)=>{if(unpersisted[name].has(key))return memory[name][key]??null;try{const store=storage(name);return store?store.getItem(key):memory[name][key]??null;}catch(_){return memory[name][key]??null;}};
 const write=(name,key,value)=>{
  if(value===null)delete memory[name][key];else memory[name][key]=String(value);
  try{const store=storage(name);if(!store)throw new Error('storage unavailable');value===null?store.removeItem(key):store.setItem(key,String(value));unpersisted[name].delete(key);return true;}catch(_){unpersisted[name].add(key);return false;}
 };
 const persistent=(()=>{const key='gugo-member-storage-probe-'+Math.random().toString(36).slice(2);try{const store=storage('localStorage');if(!store)return false;store.setItem(key,'1');const ok=store.getItem(key)==='1';store.removeItem(key);return ok;}catch(_){return false;}})();
 const online=()=>typeof navigator==='undefined'||navigator.onLine!==false;
 const isExpired=error=>/登入已失效|登入憑證/.test(String(error&&error.message));
 const validToken=value=>value&&/^[a-f0-9]{64}$/.test(String(value.sessionToken||''));
 const isSession=value=>validToken(value)&&Number(value.expiresAt)>Date.now();
 function storedRecord(key){try{const value=JSON.parse(read('localStorage',key)||'null');return validToken(value)?value:null;}catch(_){return null;}}
 function bounded(promise,ms,label){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const error=new Error(label);error.timeoutStage=label;reject(error);},ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
 function clearIntent(){write('sessionStorage',intentKey,null);write('localStorage',sharedIntentKey,null);waitingForLine=false;}
 function hasIntent(){
  const now=Date.now(),generation=read('localStorage',logoutGenerationKey);
  const valid=raw=>{try{
   const item=JSON.parse(raw||'null'),startedAt=typeof item==='number'?item:item&&item.startedAt;
   const intentGeneration=typeof item==='number'?null:((item&&item.generation)??null);
   return Number.isFinite(startedAt)&&startedAt>0&&startedAt<=now&&now-startedAt<intentLifetime&&intentGeneration===generation;
  }catch(_){return false;}};
  return valid(read('sessionStorage',intentKey))||valid(read('localStorage',sharedIntentKey));
 }
 function rememberIntent(){const value=JSON.stringify({startedAt:Date.now(),generation:read('localStorage',logoutGenerationKey)});write('sessionStorage',intentKey,value);write('localStorage',sharedIntentKey,value);}
 function message(text,working=false,label='',callback=null){
  loader.hidden=false;loader.style.display='block';loader.setAttribute('aria-busy',String(working));spinner.hidden=!working;status.textContent=text;
  loginButton.hidden=!label;loginButton.textContent=label;loginButton.disabled=false;action=callback;
 }
 function navigationGuard(){
  const history=window.history,marker='member-nav-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  let canBack=false,back=null,armed=false,ignorePop=false,pendingPop=false,baseState=null;
  const own=()=>{try{return !!(history&&history.state&&history.state.gugoMemberNavigation===marker);}catch(_){return false;}};
  const push=()=>{if(!history||typeof history.pushState!=='function'||own())return;try{baseState=history.state;history.pushState({gugoMemberNavigation:marker},'');armed=true;}catch(_){}};
  const update=(allowed,goBack)=>{
   canBack=allowed===true;back=typeof goBack==='function'?goBack:null;
   if(ignorePop)return;pendingPop=false;
   if(canBack&&back){if(own())armed=true;else push();}
   else if(own()){
    armed=false;ignorePop=true;
    try{history.back();}catch(_){ignorePop=false;try{history.replaceState(baseState,'');}catch(_){} }
   }else armed=false;
  };
  window.addEventListener('popstate',()=>{
   if(ignorePop){ignorePop=false;if(canBack&&back)push();return;}
   if(own()){armed=canBack&&!!back;if(!canBack){try{history.replaceState(baseState,'');}catch(_){}}return;}
   if(!armed||pendingPop||!canBack||!back)return;
   armed=false;pendingPop=true;try{back();}catch(_){pendingPop=false;}
  });
  return {update,clear(){canBack=false;back=null;armed=false;pendingPop=false;if(own()){try{history.replaceState(baseState,'');}catch(_){}}}};
 }
 const navigation=navigationGuard();
 function updateViewport(){
  const viewport=window.visualViewport;
  if(!profile||!viewport||!Number.isFinite(viewport.height)||viewport.height<=0||Math.abs(Number(viewport.scale||1)-1)>.02)return;
  container.style.height=Math.round(viewport.height)+'px';container.style.top=Math.max(0,Math.round(Number(viewport.offsetTop)||0))+'px';container.style.bottom='auto';
 }
 function closeApp(){appEpoch++;navigation.clear();if(disconnect)disconnect();disconnect=null;container.replaceChildren();container.style.display='none';}
 function showLogin(text='已登出'){closeApp();message(text,false,'使用 LINE 登入',()=>start(true));}
 function openApp(value){
  if(!isSession(value))throw new Error('登入憑證回覆不完整');
  if(profile&&profile.sessionToken===value.sessionToken&&disconnect)return;
  closeApp();profile=value;write('localStorage',sessionKey,JSON.stringify(value));write('localStorage',logoutKey,null);clearIntent();
  const epoch=appEpoch;
  container.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block;z-index:10';updateViewport();
  const frame=document.createElement('iframe');frame.title='會員預約系統';frame.allow='web-share; clipboard-write';container.append(frame);
  disconnect=SecureGAS.connectApp(gasUrl,frame,profile,()=>{
   if(epoch!==appEpoch)return;write('localStorage',sessionKey,null);profile=null;showLogin('登入已過期');
  },()=>epoch===appEpoch?logout():undefined,(canGoBack,goBack)=>{if(epoch===appEpoch&&profile&&!storedRecord(pendingLogoutKey))navigation.update(canGoBack,goBack);});
  loader.hidden=true;loader.style.display='none';
 }
 function showPendingLogout(){closeApp();message('上次登出尚未確認完成，請連線後重試。',false,'重試登出',logout);}
 async function start(explicit=false,resumed=false){
  if(busy)return;
  const pending=storedRecord(pendingLogoutKey);if(pending){profile=pending;showPendingLogout();return;}
  if(profile)return; // Android focus/pageshow must never discard an active form.
  const intended=hasIntent(),allowLogoutIntent=read('localStorage',logoutKey)==='1'&&(explicit||intended);
  if(read('localStorage',logoutKey)==='1'&&!explicit&&!intended){showLogin();return;}
  if(!persistent&&!explicit&&!intended){showLogin('此瀏覽器無法保存登入狀態，請點選 LINE 登入；關閉後需再次登入。');return;}
  if(!online()){message('目前未連上網路，請連線後重試。',false,'重新連線並登入',()=>start(explicit));return;}
  const epoch=++authEpoch,generation=read('localStorage',logoutGenerationKey);
  const current=()=>epoch===authEpoch&&generation===read('localStorage',logoutGenerationKey)&&!storedRecord(pendingLogoutKey)&&(read('localStorage',logoutKey)!=='1'||allowLogoutIntent&&hasIntent());
  busy=true;message('正在確認登入狀態…',true);
  try{
   if(explicit)rememberIntent();
   const record=storedRecord(sessionKey);
   if(record&&read('localStorage',logoutKey)!=='1'){
    if(isSession(record)){
     try{const value=await bounded(SecureGAS.request(gasUrl,'session',{sessionToken:record.sessionToken}),requestTimeout,'登入連線等候逾時');if(!current())return;openApp(value);return;}
     catch(error){if(!current())return;if(!isExpired(error))throw error;}
    }
    if(!current())return;write('localStorage',sessionKey,null);
   }
   if(typeof liff==='undefined'||typeof liff.init!=='function'){
    message('LINE 登入元件未載入，請確認網路後重新載入此頁。',false,'重新載入登入頁',()=>location.reload());return;
   }
   if(!liffReady){
    if(!initPromise)initPromise=Promise.resolve(liff.init({liffId:'2009054335-tUPGk28q'})).catch(error=>{initPromise=null;throw error;});
    await bounded(initPromise,initTimeout,'LINE 登入等候逾時');if(!current())return;liffReady=true;
   }
   if(!current())return;
   if(!liff.isLoggedIn()){
    if(resumed){message('若 LINE 授權已完成，請點選繼續登入；尚未授權也可重新開始。',false,'繼續 LINE 登入',()=>start(true));return;}
    waitingForLine=true;message('請完成 LINE 登入，返回此頁後可繼續。',false,'繼續 LINE 登入',()=>start(true));
    liff.login({redirectUri:location.origin+location.pathname});return;
   }
   message('正在確認 LINE 登入…',true);
   const value=await bounded(SecureGAS.request(gasUrl,'login',{idToken:liff.getIDToken&&liff.getIDToken(),accessToken:liff.getAccessToken&&liff.getAccessToken()}),requestTimeout,'登入連線等候逾時');
   if(current())openApp(value);
  }catch(error){
   if(current()){
    if(error&&error.timeoutStage==='LINE 登入等候逾時')message('LINE 登入元件等候逾時，請確認網路後重新載入此頁。',false,'重新載入登入頁',()=>location.reload());
    else message(!online()?'目前未連上網路，請連線後重試。':'登入暫時未完成，若已完成 LINE 授權，請點選繼續登入。',false,'繼續 LINE 登入',()=>start(true));
   }
  }
  finally{if(epoch===authEpoch)busy=false;}
 }
 function finishLogout(target){
  if(liffReady){try{if(liff.isLoggedIn())liff.logout();}catch(_){} }
  if(storedRecord(sessionKey)?.sessionToken===target.sessionToken)write('localStorage',sessionKey,null);
  if(storedRecord(pendingLogoutKey)?.sessionToken===target.sessionToken)write('localStorage',pendingLogoutKey,null);
  clearIntent();profile=null;showLogin();
 }
 async function logout(){
  if(busy)return;
  profile=profile||storedRecord(pendingLogoutKey)||storedRecord(sessionKey);
  if(!profile){write('localStorage',logoutKey,'1');clearIntent();showLogin();return;}
  authEpoch++;busy=true;const target=profile;
  write('localStorage',logoutGenerationKey,Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  write('localStorage',logoutKey,'1');write('localStorage',pendingLogoutKey,JSON.stringify(target));clearIntent();
  closeApp();message('登出中…',true);
  try{
   if(!online())throw new Error('offline');
   const result=await bounded(SecureGAS.request(gasUrl,'logout',{sessionToken:target.sessionToken}),requestTimeout,'登出連線等候逾時');
   if(!result||result.success!==true)throw new Error('登出尚未確認');finishLogout(target);
  }catch(error){if(isExpired(error))finishLogout(target);else message('登出尚未完成，請重試。',false,'重試登出',logout);}
  finally{busy=false;}
 }
 function resume(){
  updateViewport();if(document.hidden||profile||busy||storedRecord(pendingLogoutKey))return;
  if(waitingForLine||hasIntent()||storedRecord(sessionKey))start(false,true);
 }
 loginButton.addEventListener('click',()=>{if(action)action();});
 window.addEventListener('load',()=>start());
 window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);window.addEventListener('online',resume);
 document.addEventListener('visibilitychange',resume);
 window.addEventListener('storage',event=>{
  if((event.key===logoutKey&&event.newValue==='1')||event.key===logoutGenerationKey){authEpoch++;busy=false;profile=null;showLogin('已於其他分頁登出');return;}
  if(event.key===sessionKey&&!profile)resume();
 });
 if(window.visualViewport){window.visualViewport.addEventListener('resize',updateViewport);window.visualViewport.addEventListener('scroll',updateViewport);}
})();
