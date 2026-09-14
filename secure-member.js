(() => {
 const gasUrl='https://script.google.com/macros/s/AKfycbxu_ke2CmB51jhdgOP05yb6mBfqwdAIPUQL_IfHmmXwlzaDH3sModbISVHiHUgZToBeWg/exec';
 const status=document.getElementById('status-text');let profile=null,disconnect=null;
 const logout=document.createElement('button');logout.textContent='登出';logout.hidden=true;logout.style.cssText='position:fixed;top:0;right:8px;z-index:50;border:0;border-radius:10px;background:#173a67;color:white;padding:10px;font:inherit';document.body.append(logout);
 async function start(){
  try{
   await liff.init({liffId:'2009054335-tUPGk28q'});
   if(!liff.isLoggedIn()){liff.login({redirectUri:location.origin+location.pathname});return;}
   status.textContent='正在由伺服器驗證 LINE 登入…';
   profile=await SecureGAS.request(gasUrl,'login',{idToken:liff.getIDToken&&liff.getIDToken(),accessToken:liff.getAccessToken&&liff.getAccessToken()});
   const container=document.getElementById('ios-container');container.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;z-index:10';
   const frame=document.createElement('iframe');frame.title='會員預約系統';frame.allow='web-share; clipboard-write';container.replaceChildren(frame);
   disconnect=SecureGAS.connectApp(gasUrl,frame,profile,()=>{container.style.display='none';status.textContent='登入已過期，請關閉後重新使用 LINE 登入。';document.getElementById('loader').style.display='block';});
   logout.hidden=false;document.getElementById('loader').style.display='none';
  }catch(_){status.textContent='LINE 驗證未完成。請確認網路並重新從官方入口登入。';}
 }
 logout.addEventListener('click',async()=>{logout.disabled=true;logout.textContent='登出中…';try{await SecureGAS.request(gasUrl,'logout',{sessionToken:profile.sessionToken});if(disconnect)disconnect();liff.logout();document.getElementById('ios-container').replaceChildren();document.getElementById('ios-container').style.display='none';logout.hidden=true;document.getElementById('loader').style.display='block';status.textContent='已登出。請重新從官方 LINE 入口登入。';}catch(_){logout.disabled=false;logout.textContent='重試登出';}});
 window.addEventListener('load',start);
})();
