
(() => {
  try {
    const FLAG_CON='__ka_console_patched__';
    if (!window[FLAG_CON]){
      window[FLAG_CON]=true;
      const orig={log:console.log,info:console.info,warn:console.warn,error:console.error};
      const send=(prev,curr)=>{ 
        // injected.js runs in page context and cannot call extension APIs.
        // Post message to the page; the content script will forward to background.
        console.log('[Otimiza Ext] Sending QUEUE_UPDATE (page):', {prev, curr});
        window.postMessage({__ka:true,type:'QUEUE_UPDATE',prev,curr},'*');
      };
      let tempPrev=null, tempTime=0;
      function tryParseArgs(args){
        const text=args.map(a=>{try{return typeof a==='string'?a:JSON.stringify(a);}catch{return String(a);}}).join(' ');
        const both=/Qtd\s*Fila\s*Anteriormente\s*:?\s*(\d+).*?Qtd\s*Fila\s*Atual\s*:?\s*(\d+)/i.exec(text);
        if (both){ send(Number(both[1]), Number(both[2])); return; }
        const p=/Qtd\s*Fila\s*Anteriormente\s*:?\s*(\d+)/i.exec(text); if (p){ tempPrev=Number(p[1]); tempTime=Date.now(); }
        const c=/Qtd\s*Fila\s*Atual\s*:?\s*(\d+)/i.exec(text); if (c){ const curr=Number(c[1]); if(tempPrev!==null && Date.now()-tempTime<5000){ send(tempPrev,curr); tempPrev=null; } else { send(null,curr); } }
      }
      function wrap(fn){ return function(...args){ tryParseArgs(args); return fn.apply(this,args); }; }
      console.log=wrap(orig.log); console.info=wrap(orig.info); console.warn=wrap(orig.warn); console.error=wrap(orig.error);
    }
  } catch(e) {}

  const PING_FLAG='__otz_ext_ping_active__';
  if (window[PING_FLAG]){ console.log('[Otimiza Ext] injected.js já ativo—evitando duplicidade.'); return; }
  window[PING_FLAG]=true;

  const CONFIG={minMs:120000,maxMs:300000,firstDelayMs:3000};
  const now=()=>Date.now();
  const fmt=(d)=>d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const randDelay=()=>Math.floor(Math.random()*(CONFIG.maxMs-CONFIG.minMs+1))+CONFIG.minMs;
  let tId=null,nextTs=null;
  const post=(p)=>window.postMessage(Object.assign({__ka:true},p),'*');

  const KA = {
    fetchHead: () => fetch(location.href.split('#')[0], { method: 'HEAD', mode: 'no-cors', cache: 'no-cache', keepalive: true }),
    imgPing: () => new Promise((resolve) => { const img=new Image(); img.onload=img.onerror=()=>resolve(); img.src=`${location.origin}/favicon.ico?ka=${Date.now()}`; }),
    beacon: () => { try{ const url = `${location.origin}/api/keep-alive`; return navigator.sendBeacon(url,'ka')?Promise.resolve():Promise.reject(); } catch { return Promise.reject(); } }
  };

  const keepAlive = async () => { try{ await KA.fetchHead(); return; } catch{} try{ await KA.imgPing(); return; } catch{} try{ await KA.beacon(); return; } catch{} };

  let isPaused = true; // Começa PAUSADO até receber comando do content script
  const logNext=(ms)=>{ if (isPaused) return; const target=new Date(now()+ms); const secs=Math.round(ms/1000); console.log(`[Otimiza Ext] próximo ping (page) em ${secs}s às ${fmt(target)} (2–5 min aleatório)`); post({type:'NEXT_PING',etaMs:ms,targetTs:target.getTime()}); };
  const schedule=(ms)=>{ if (isPaused) return; clearTimeout(tId); nextTs=now()+ms; logNext(ms); tId=setTimeout(fire,ms); };
  const fire=()=>{ if (isPaused) return; keepAlive(); console.log(`[Otimiza Ext] ping (page) ${fmt(new Date())} (previsto: ${fmt(new Date(nextTs))})`); post({type:'PING',ts:now()}); schedule(randDelay()); };
  const pause=()=>{ isPaused=true; clearTimeout(tId); console.log('[Otimiza Ext] Keep-alive PAUSADO'); };
  const resume=()=>{ isPaused=false; console.log('[Otimiza Ext] Keep-alive RETOMADO'); schedule(CONFIG.firstDelayMs); };
  
  // Escutar comandos de pause/resume do content script
  window.addEventListener('message', (ev) => {
    const d = ev?.data;
    if (d && d.__ka && d.type === 'PAUSE_PINGS') pause();
    if (d && d.__ka && d.type === 'RESUME_PINGS') resume();
  });
  
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && nextTs && now()>=nextTs && !isPaused) fire(); });

  if (!document.getElementById('otz-ext-injected-script')){ const m=document.createElement('meta'); m.id='otz-ext-injected-script'; document.head.appendChild(m); }
  console.log('[Otimiza Ext] injected.js carregado - aguardando ativação do content script');
  // NÃO iniciar pings automaticamente - aguardar RESUME_PINGS do content script
})();
