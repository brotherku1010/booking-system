(() => {
 const gasUrl='https://script.google.com/macros/s/AKfycbxu_ke2CmB51jhdgOP05yb6mBfqwdAIPUQL_IfHmmXwlzaDH3sModbISVHiHUgZToBeWg/exec';
 const sessionKey='gugo-member-session-v3',logoutKey='gugo-member-explicit-logout',intentKey='gugo-member-login-intent';
 const status=document.getElementById('status-text'),loader=document.getElementById('loader'),spinner=document.querySelector('.spinner'),loginButton=document.getElementById('line-login-button'),container=document.getElementById('ios-container');
 let profile=null,disconnect=null,busy=false,liffReady=false,action=null;
 const read=(store,key)=>{try{return store.getItem(key);}catch(_){return null;}};
 const write=(store,key,value)=>{try{value===null?store.removeItem(key):store.setItem(key,value);}catch(_){}};
 function message(text,working=false,label='',callback=null){
  loader.hidden=false;loader.style.display='block';spinner.hidden=!working;status.textContent=text;
  loginButton.hidden=!label;loginButton.textContent=label;loginButton.disabled=false;action=callback;
 }
 function closeApp(){if(disconnect)disconnect();disconnect=null;container.replaceChildren();container.style.display='none';}
 function showLogin(text='已登出'){closeApp();message(text,false,'使用 LINE 登入',()=>start(true));}
 function openApp(value){
  profile=value;write(localStorage,sessionKey,JSON.stringify(value));write(localStorage,logoutKey,null);write(sessionStorage,intentKey,null);
  closeApp();container.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;z-index:10';
  const frame=document.createElement('iframe');frame.title='會員預約系統';frame.allow='web-share; clipboard-write';container.append(frame);
  disconnect=SecureGAS.connectApp(gasUrl,frame,profile,()=>{write(localStorage,sessionKey,null);profile=null;showLogin('登入已過期');},logout);
  loader.hidden=true;loader.style.display='none';
 }
 async function start(explicit=false){
  if(busy)return;
  const intended=Number(read(sessionStorage,intentKey))>Date.now()-10*60*1000;
  if(read(localStorage,logoutKey)==='1'&&!explicit&&!intended){showLogin();return;}
  busy=true;message('正在確認登入狀態…',true);
  try{
   if(explicit)write(sessionStorage,intentKey,String(Date.now()));
   const saved=read(localStorage,sessionKey);
   if(saved&&!explicit&&read(localStorage,logoutKey)!=='1'){
    let record;try{record=JSON.parse(saved);}catch(_){}
    if(record&&/^[a-f0-9]{64}$/.test(String(record.sessionToken||''))&&record.expiresAt>Date.now()){
     try{openApp(await SecureGAS.request(gasUrl,'session',{sessionToken:record.sessionToken}));return;}
     catch(error){if(!/登入已失效|登入憑證/.test(String(error.message)))throw error;}
    }
    write(localStorage,sessionKey,null);
   }
   if(!liffReady){await liff.init({liffId:'2009054335-tUPGk28q'});liffReady=true;}
   if(!liff.isLoggedIn()){liff.login({redirectUri:location.origin+location.pathname});return;}
   message('正在確認 LINE 登入…',true);
   openApp(await SecureGAS.request(gasUrl,'login',{idToken:liff.getIDToken&&liff.getIDToken(),accessToken:liff.getAccessToken&&liff.getAccessToken()}));
  }catch(_){message('登入暫時未完成，請再試一次。',false,'使用 LINE 登入',()=>start(true));}
  finally{busy=false;}
 }
 async function logout(){
  if(busy||!profile)return;busy=true;
  write(localStorage,logoutKey,'1');write(localStorage,sessionKey,null);write(sessionStorage,intentKey,null);
  message('登出中…',true);container.style.display='none';
  try{
   await SecureGAS.request(gasUrl,'logout',{sessionToken:profile.sessionToken});
   if(liffReady&&liff.isLoggedIn())liff.logout();profile=null;showLogin();
  }catch(_){message('登出尚未完成，請重試。',false,'重試登出',logout);}
  finally{busy=false;}
 }
 loginButton.addEventListener('click',()=>{if(action)action();});
 window.addEventListener('load',()=>start());
})();
