// Browser bridge: credentials travel via postMessage to a nonce-bound GAS frame,
// never through query strings, JSONP URLs, logs or profile-only shortcuts.
(() => {
 const googleOrigin=value=>/^https:\/\/(?:script\.google\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(value||'');
 const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
 const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 window.SecureGAS={nonce,hash,
  request(gasUrl,action,payload){return new Promise((resolve,reject)=>{
   const channel=nonce(),frame=document.createElement('iframe'),url=new URL(gasUrl);let source=null,origin='';
   url.searchParams.set('secure_bridge','1');url.searchParams.set('channel',channel);
   frame.style.cssText='position:fixed;width:1px;height:1px;left:-5px;bottom:0;border:0;opacity:0;pointer-events:none';frame.setAttribute('aria-hidden','true');frame.referrerPolicy='no-referrer';
   const clean=()=>{clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();};
   const receive=event=>{const data=event.data;if(!googleOrigin(event.origin)||!data||data.channel!==channel)return;
    if(data.type==='gugo-secure-bridge-ready'&&!source){source=event.source;origin=event.origin;source.postMessage({type:'gugo-secure-bridge-request',channel,action,payload},origin);}
    else if(data.type==='gugo-secure-bridge-result'&&event.source===source&&event.origin===origin){clean();if(data.error)reject(new Error(data.error));else resolve(data.result);}
   };
   const timer=setTimeout(()=>{clean();reject(new Error('驗證連線逾時，請重新登入。'));},45000);
   window.addEventListener('message',receive);frame.src=url.toString();document.body.append(frame);
  });},
  connectApp(gasUrl,frame,profile,onExpired,onLogout,onNavigation){
   const channel=nonce(),url=new URL(gasUrl);url.searchParams.set('auth_channel',channel);frame.referrerPolicy='no-referrer';
   let source=null,sourceOrigin='',connected=true,canGoBack=false;
   // A shell never receives a destination or credentials for Android Back.
   // It may only ask the already-bound workspace to handle its own current UI.
   const goBack=()=>{if(connected&&canGoBack&&source)source.postMessage({type:'gugo-member-navigation-back',channel},sourceOrigin);};
   const receive=event=>{const data=event.data;if(!connected||!googleOrigin(event.origin)||!data||data.channel!==channel)return;
    if(data.type==='gugo-app-ready'&&!source&&event.source&&typeof event.source.postMessage==='function'){source=event.source;sourceOrigin=event.origin;source.postMessage({type:'gugo-app-session',channel,sessionToken:profile.sessionToken},sourceOrigin);}
    if(data.type==='gugo-auth-expired'&&event.source===source){onExpired&&onExpired();}
    if(data.type==='gugo-member-logout'&&event.source===source){onLogout&&onLogout();}
    if(data.type==='gugo-member-navigation-state'&&source&&event.source===source&&event.origin===sourceOrigin&&typeof data.canGoBack==='boolean'&&typeof onNavigation==='function'){
     canGoBack=data.canGoBack;onNavigation(canGoBack,goBack);
    }
   };
   window.addEventListener('message',receive);frame.src=url.toString();return ()=>{connected=false;canGoBack=false;window.removeEventListener('message',receive);};
  }
 };
})();
