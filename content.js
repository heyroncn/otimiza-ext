(() => {
  // Evitar execução em iframes (duplicação): apenas no topo
  if (window.top !== window.self) { return; }
  
  // ====== DEFINIR FUNÇÕES UTILITÁRIAS PRIMEIRO ======
  // Função para remover duplicatas de painéis (defensive)
  const dedupePanels = function() {
    try {
      const statusPanels = document.querySelectorAll('#otz-ext-status');
      console.log('[Otimiza Ext] dedupePanels - found #otz-ext-status count:', statusPanels.length);
      if (statusPanels.length > 1) {
        for (let i = 1; i < statusPanels.length; i++) {
          console.log('[Otimiza Ext] Removing duplicate #otz-ext-status', i);
          statusPanels[i].remove();
        }
      }
      const shells = document.querySelectorAll('#otz-ext-stratus');
      console.log('[Otimiza Ext] dedupePanels - found #otz-ext-stratus count:', shells.length);
      if (shells.length > 1) {
        for (let i = 1; i < shells.length; i++) {
          console.log('[Otimiza Ext] Removing duplicate #otz-ext-stratus', i);
          shells[i].remove();
        }
      }
    } catch (e) { console.log('[Otimiza Ext] dedupePanels error:', e); }
  };

  // Função para remover toda a UI quando extensão é desligada
  const removeAllUI = function() {
    try {
      const shell = document.getElementById('otz-ext-stratus');
      if (shell) { shell.remove(); console.log('[Otimiza Ext] UI removida (extensão OFF)'); }
      const overlay = document.getElementById('otz-ext-blink');
      if (overlay) overlay.remove();
      const toast = document.getElementById('otz-ext-toast');
      if (toast) toast.remove();
    } catch {}
  };
  
  console.log('[Otimiza Ext] Utility functions defined');
  
  const path = location.pathname;
  const isDomain = location.hostname === '0730.otimiza.sicredi.net';
  const isChat = isDomain && path.startsWith('/atendimento/chat');
  const isPendList = isDomain && path.startsWith('/atendimento/pendente/') && !path.includes('/23');
  const isPendDetail = isDomain && path.startsWith('/atendimento/pendente/23');

  // Detectar navegador (Chrome vs Edge) para logs e possíveis ajustes
  const ua = navigator.userAgent || '';
  const isEdge = ua.includes('Edg/');
  const isChrome = !isEdge && ua.includes('Chrome/');
  const browserName = isEdge ? 'Edge' : (isChrome ? 'Chrome' : 'Chromium');
  try { console.log('[Otimiza Ext] Browser detected:', browserName, ua); } catch {}

  // ====== Guard para evitar múltiplas inicializações em SPA ======
  if (window.__OTZ_CONTENT_ACTIVE) {
    try { console.log('[Otimiza Ext] content.js já ativo — evitando duplicidade de inicialização.'); } catch {}
  } else {
    window.__OTZ_CONTENT_ACTIVE = true;
  }

  // Inject page script once (fonte dos eventos em qualquer rota)
  // Chrome: mantém injeção via <script> para simplicidade
  // Edge: pede ao background para injetar via chrome.scripting (MAIN world) — contorna CSP
  (function injectPageScript(){
    try {
      if (isEdge) {
        // solicitar injeção via scripting
        if (!window.__OTZ_PAGE_SCRIPT_REQUESTED) {
          window.__OTZ_PAGE_SCRIPT_REQUESTED = true;
          chrome.runtime?.sendMessage({ type: 'INJECT_PAGE_SCRIPT' }, () => {
            if (chrome.runtime?.lastError) {
              console.log('[Otimiza Ext] Edge scripting injection lastError:', chrome.runtime.lastError);
            } else {
              console.log('[Otimiza Ext] Edge requested scripting injection for injected.js');
            }
          });
          // Loop independente do callback para detectar meta e enviar RESUME_PINGS
          let edgeLoopAttempts = 0;
          const edgeMaxAttempts = 18; // ~12s (intervalo 700ms)
          const edgeLoop = setInterval(() => {
            edgeLoopAttempts++;
            const meta = document.getElementById('otz-ext-injected-script');
            if (meta) {
              chrome.storage?.local.get('otz_ext_sound_enabled', o => {
                const en = (o && o['otz_ext_sound_enabled'] !== undefined) ? !!o['otz_ext_sound_enabled'] : true;
                if (en) {
                  console.log('[Otimiza Ext] (Edge) meta encontrado, enviando RESUME_PINGS');
                  window.postMessage({ __ka: true, type: 'RESUME_PINGS' }, '*');
                } else {
                  console.log('[Otimiza Ext] (Edge) meta encontrado mas extensão OFF');
                }
              });
              // Se já recebeu NEXT_PING não precisa continuar
              const etaEl = document.querySelector('#ext-eta');
              if (etaEl && /Próximo ping: \d+s/.test(etaEl.textContent)) {
                console.log('[Otimiza Ext] (Edge) ETA preenchido — encerrando loop de resume');
                clearInterval(edgeLoop);
                return;
              }
              // Continuar mais algumas vezes para garantir
              if (edgeLoopAttempts > 6) {
                console.log('[Otimiza Ext] (Edge) loop pós-meta suficiente, parando');
                clearInterval(edgeLoop);
                return;
              }
            } else {
              // Re-tentar injeção a cada 3 tentativas se ainda não carregou
              if (edgeLoopAttempts % 3 === 0) {
                console.log('[Otimiza Ext] (Edge) meta não encontrado tentativa', edgeLoopAttempts, 're-solicitando injeção');
                chrome.runtime?.sendMessage({ type: 'INJECT_PAGE_SCRIPT' }, () => {});
              }
            }
            if (edgeLoopAttempts >= edgeMaxAttempts) {
              console.warn('[Otimiza Ext] (Edge) loop encerrou sem meta/NEXT_PING');
              clearInterval(edgeLoop);
            }
          }, 700);
        }
      } else {
        if (!document.getElementById('otz-ext-injected-loader')) {
          const s = document.createElement('script');
          s.id = 'otz-ext-injected-loader';
          s.src = chrome.runtime.getURL('injected.js');
          (document.documentElement || document.head).appendChild(s);
          console.log('[Otimiza Ext] injected.js appended via <script>');
          // Aguardar script carregar e enviar comando de resume se extensão estiver ativa
          s.addEventListener('load', () => {
            setTimeout(() => {
              chrome.storage?.local.get('otz_ext_sound_enabled', o => {
                const en = (o && o['otz_ext_sound_enabled'] !== undefined) ? !!o['otz_ext_sound_enabled'] : true;
                if (en) {
                  console.log('[Otimiza Ext] Enviando RESUME_PINGS inicial');
                  window.postMessage({__ka:true, type:'RESUME_PINGS'}, '*');
                }
              });
            }, 100);
          });
        }
      }
    } catch (e) { console.log('[Otimiza Ext] injectPageScript error:', e); }
  })();

  // Preferência de ativação global (controla som, pings, fila, UI)
  const KEY = 'otz_ext_sound_enabled'; // mantém nome por compatibilidade
  const setPref = (v) => localStorage.setItem(KEY, String(!!v));
  const getPref = () => (localStorage.getItem(KEY) === null ? true : localStorage.getItem(KEY) === 'true');
  let extensionEnabled = true;
  try {
    chrome.storage?.local.get(KEY, o => { 
      const en = (o && o[KEY] !== undefined) ? !!o[KEY] : true; 
      setPref(en); 
      extensionEnabled = en;
      if (!en) {
        console.log('[Otimiza Ext] Extension is DISABLED');
        removeAllUI();
        window.postMessage({__ka:true, type:'PAUSE_PINGS'}, '*');
      } else {
        window.postMessage({__ka:true, type:'RESUME_PINGS'}, '*');
      }
    });
  } catch {}
  
  // ==== REGISTRAR LISTENER DE STORAGE LOGO NO INÍCIO ====
  let lastCount = null;
  let toastTimeout = null;
  chrome.storage?.onChanged.addListener((changes, areaName) => {
    console.log('[Otimiza Ext] Storage changed:', { areaName, changes });
    if (areaName === 'local' && changes['__otz_ext_queue_curr']) {
      const curr = changes['__otz_ext_queue_curr'].newValue;
      console.log('[Otimiza Ext] Queue update from storage:', { curr, isPendList, isPendDetail, isChat });
      if (typeof curr === 'number' && !isChat && (isPendList || isPendDetail)) {
        console.log('[Otimiza Ext] Updating queue count to:', curr);
        // Sempre atualiza a exibição
        updateQueueCount(curr);

        // Se a fila aumentou, adiciona ao histórico e notifica
        if (lastCount !== null && curr > lastCount) {
          console.log('[Otimiza Ext] Queue increased from', lastCount, 'to', curr);
          pushHistoryLine(`+${curr - lastCount} na fila às ${formatHHmmss(new Date())}`);
          chrome.runtime?.sendMessage({ type: 'QUEUE_ALERT', title: 'Fila aumentou', message: `De ${lastCount} para ${curr}` });
          playSound();
          try { if (isPendDetail) showImageToast(); } catch (e) { }
        }

        lastCount = curr;
      }
    }
  });
  
  chrome.storage?.onChanged.addListener((c, a) => { 
    if (a === 'local' && c[KEY]) {
      const newVal = !!c[KEY].newValue;
      setPref(newVal);
      extensionEnabled = newVal;
      console.log('[Otimiza Ext] Extension toggled:', newVal ? 'ON' : 'OFF');
      if (!newVal) {
        removeAllUI();
        stopChatAlerts();
        window.postMessage({__ka:true, type:'PAUSE_PINGS'}, '*');
      } else {
        window.postMessage({__ka:true, type:'RESUME_PINGS'}, '*');
        // Recriar UI se estiver em página válida
        if (!isChat && (isPendList || isPendDetail)) {
          ensureStatusPanel();
        }
      }
    }
  });

  // Áudio + unlock
  let audioEl = document.getElementById('otz-audio');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'otz-audio';
    audioEl.src = chrome.runtime.getURL('assets/notify.wav');
    audioEl.preload = 'auto';
    audioEl.style.display = 'none';
    document.documentElement.appendChild(audioEl);
  }
  const playSound = async () => { if (!getPref()) return; try { audioEl.currentTime = 0; await audioEl.play(); } catch (e) {} };
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioEl.play().then(() => { audioEl.pause(); audioEl.currentTime = 0; audioUnlocked = true; }).catch(() => {});
  }
  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

  // ==== Helper de montagem: inserir DENTRO de <div class="layout-content-inner"> como primeiro filho ====
  // Isso faz o painel herdar o mesmo fluxo/layout do container principal e alinha automaticamente
  function mountAboveLayoutContentInner(el) {
    const target = document.querySelector('.layout-content-inner');
    if (target) {
      // inserir como primeiro filho para manter o alinhamento com o conteúdo
      if (target.firstChild) target.insertBefore(el, target.firstChild);
      else target.appendChild(el);
      return true;
    }
    return false;
  }

  // ==== Painéis (somente em pendente e pendente/23) ====
  function ensureStatusShell() {
    // SEMPRE verificar primeiro se já existe
    let wrap = document.getElementById('otz-ext-stratus');
    if (wrap) {
      console.log('[Otimiza Ext] ensureStatusShell - já existe, retornando existente');
      return wrap;
    }
    console.log('[Otimiza Ext] ensureStatusShell - criando novo');
    wrap = document.createElement('div');
    wrap.id = 'otz-ext-stratus';

    // tenta inserir imediatamente
    if (!mountAboveLayoutContentInner(wrap)) {
      // Se não existe ainda (SPA), observa até aparecer
      const obs = new MutationObserver(() => {
        if (mountAboveLayoutContentInner(wrap)) {
          obs.disconnect();
        }
      });
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }
    return wrap;
  }

  function ensureStatusPanel() {
    // SEMPRE verificar primeiro se já existe
    let b = document.getElementById('otz-ext-status');
    if (b) {
      console.log('[Otimiza Ext] ensureStatusPanel - já existe, retornando existente');
      return b;
    }
    console.log('[Otimiza Ext] ensureStatusPanel - criando novo');
    const shell = ensureStatusShell();
    b = document.createElement('div');
    b.id = 'otz-ext-status';

    // Simplificar markup para remover espaços em branco: usar apenas uma coluna com ETA
    b.innerHTML = `
      <div class="single">
        <div class="eta" id="ext-eta">Próximo ping: —</div>
      </div>`;
    shell.appendChild(b);
    return b;
  }

  function updateTheme(n) {
    const box = document.querySelector('#otz-ext-status .current');
    if (!box) return;
    box.classList.toggle('ok', n === 0);
    box.classList.toggle('alert', n > 0);
  }
  function updateQueueCount(n) {
    if (!extensionEnabled) return;
    const box = ensureStatusPanel();
    const el = box.querySelector('#ext-queue-count');
    if (el) el.textContent = String(n);
    updateTheme(n);
  }
  function pushHistoryLine(text) {
    if (!(isPendDetail || isPendList)) return;
    const ul = document.querySelector('#otz-ext-status #ext-queue-hist');
    if (!ul) return;
    const li = document.createElement('li');
    li.textContent = text;
    ul.insertBefore(li, ul.firstChild);
  }

  // ==== ALERT OVERLAY: overlay + som; usado em pendente/23 ====
  function ensureBlinkOverlay() {
    let o = document.getElementById('otz-ext-blink');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'otz-ext-blink';
    o.innerHTML = '<div class="blink-inner">NOVO ATENDIMENTO NA FILA</div>';
    (document.body || document.documentElement).appendChild(o);
    return o;
  }
  let blinkTick = null, beepTick = null, blinkRed = true;
  function startChatAlerts() {
    if (blinkTick || beepTick) return; // começa imediatamente
    try { playSound(); } catch {}
    const el = ensureBlinkOverlay();
    el.style.display = 'flex';
    el.setAttribute('data-color', 'red');
    blinkTick = setInterval(() => {
      const el = ensureBlinkOverlay();
      el.style.display = 'flex';
      el.setAttribute('data-color', (blinkRed ? 'green' : 'red'));
      blinkRed = !blinkRed;
    }, 1000); // pisca 1s alternando vermelho/verde
    beepTick = setInterval(() => { try { playSound(); } catch {} }, 15000); // som a cada 15s
  }
  function stopChatAlerts() {
    if (blinkTick) { clearInterval(blinkTick); blinkTick = null; }
    if (beepTick) { clearInterval(beepTick); beepTick = null; }
    const el = document.getElementById('otz-ext-blink');
    if (el) el.style.display = 'none';
  }

  // ==== Toast de imagem (canto inferior direito) ====
  function ensureImageToast() {
    let t = document.getElementById('otz-ext-toast');
    if (t) return t;
    t = document.createElement('img');
    t.id = 'otz-ext-toast';
    t.alt = 'notificação';
    t.style.display = 'none';
    t.style.pointerEvents = 'none';
    t.src = chrome.runtime.getURL('assets/designer.png');
    (document.body || document.documentElement).appendChild(t);
    return t;
  }

  // Observer to move toast inside the overlay if/when the overlay appears (fix stacking issues)
  (function setupToastMover(){
    try{
      const obs = new MutationObserver((records, o)=>{
        const overlay = document.getElementById('otz-ext-blink');
        const toast = document.getElementById('otz-ext-toast');
        if (overlay && toast && toast.parentNode !== overlay){
          try{
            overlay.appendChild(toast);
            toast.style.position = 'absolute';
            toast.style.right = '24px';
            toast.style.bottom = '24px';
            toast.style.zIndex = '99999';
          }catch(e){}
          o.disconnect();
        }
      });
      obs.observe(document.documentElement || document.body, { childList:true, subtree:true });
      // Also attempt an immediate move in case overlay already exists
      const overlayNow = document.getElementById('otz-ext-blink');
      const toastNow = document.getElementById('otz-ext-toast');
      if (overlayNow && toastNow && toastNow.parentNode !== overlayNow){
        try{ overlayNow.appendChild(toastNow); toastNow.style.position='absolute'; toastNow.style.right='24px'; toastNow.style.bottom='24px'; toastNow.style.zIndex='99999'; obs.disconnect(); }catch(e){}
      }
    }catch(e){}
  })();

  function showImageToast() {
    const el = ensureImageToast();
    console.log('[Otimiza Ext] showImageToast() called; isPendDetail=', isPendDetail);
    try { if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; } } catch (e) {}
    // If the overlay exists, attach the toast inside it as an absolutely positioned child
    // so it renders above the red/green full-screen background. Otherwise append to body as fixed.
    let overlay = document.getElementById('otz-ext-blink');
    let overlayPrevZ = null;
    try {
      if (overlay) {
        // append into overlay and position absolute
        try { overlay.appendChild(el); } catch (e) { try { (document.body || document.documentElement).appendChild(el); } catch (e) {} }
        el.style.position = 'absolute';
        el.style.right = '24px';
        el.style.bottom = '24px';
        el.style.zIndex = '99999';
      } else {
        try { (document.body || document.documentElement).appendChild(el); } catch (e) {}
        el.style.position = 'fixed';
        el.style.right = '24px';
        el.style.bottom = '24px';
        el.style.zIndex = '2147483646';
      }
      // also try to lower overlay stacking while toast is visible (best-effort)
      if (overlay) {
        overlayPrevZ = overlay.style.zIndex || window.getComputedStyle(overlay).zIndex || null;
        try { overlay.style.zIndex = '2147483630'; } catch (e) { }
      }
    } catch (e) { overlay = null; overlayPrevZ = null; }
    el.style.display = 'block';
    el.classList.remove('otz-fade-out');
    el.classList.add('otz-fade-in');
    // esconder após 3s
    toastTimeout = setTimeout(() => {
      el.classList.remove('otz-fade-in');
      el.classList.add('otz-fade-out');
      // aguardar animação de 300ms antes de esconder
      setTimeout(() => { el.style.display = 'none'; }, 350);
      toastTimeout = null;
      // restaurar z-index do overlay
      try { if (overlay) { if (overlayPrevZ === null || overlayPrevZ === 'null' || overlayPrevZ === '') overlay.style.zIndex = '2147483647'; else overlay.style.zIndex = overlayPrevZ; } } catch (e) {}
      // restore toast to fixed body placement for future shows
      try {
        el.style.position = 'fixed';
        el.style.zIndex = '2147483646';
        try { (document.body || document.documentElement).appendChild(el); } catch (e) {}
      } catch (e) {}
    }, 3000);
  }

  // ==== Utilitários de tempo e extração (para enriquecer histórico quando possível) ====
  function two(n) { return String(n).padStart(2, '0'); }
  function formatHHmmss(d) { return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; }
  function parseHHMMSSToSeconds(h) {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(h || '');
    if (!m) return null; const [, hh, mm, ss] = m; return (+hh) * 3600 + (+mm) * 60 + (+ss);
  }
  function extractFromCard(card) {
    let ag = null, nome = null, elapsedHHMMSS = null, nomeAtendente = '—';
    const nodes = card.querySelectorAll('span,div,p,strong,b,small');
    for (const el of nodes) {
      const t = (el.textContent || '').trim();
      const m = t.match(/^AG\s+(\d+)\s+(.+)$/i);
      if (m) { ag = m[1]; nome = m[2]; break; }
    }
    for (const el of nodes) {
      const t = (el.textContent || '').trim();
      if (t.startsWith('Tempo na fila:')) {
        const m = t.match(/Tempo na fila:\s*(\d{2}:\d{2}:\d{2})/);
        if (m) { elapsedHHMMSS = m[1]; break; }
      }
    }
    for (const el of nodes) {
      const t = (el.textContent || '').trim();
      if (/Atendente\s*Responsável/i.test(t) && t.includes(':')) {
        const parts = t.split(':');
        const val = parts.slice(1).join(':').trim();
        if (val) nomeAtendente = val; break;
      }
    }
    return { ag, nome, elapsedHHMMSS, nomeAtendente };
  }
  function currentCards() { return Array.from(document.querySelectorAll('otz-user-card')); }

  // Message listener - recebe tanto postMessage quanto mensagens do background.js
  window.addEventListener('message', (ev) => {
    const d = ev?.data; if (!d || !d.__ka) return;
    if (!extensionEnabled) return; // Ignorar mensagens quando desligado
    console.log('[Otimiza Ext] Message received:', d);
    if (d.type === 'QUEUE_UPDATE') {
      if (typeof d.curr === 'number') {
        const curr = d.curr;
        console.log('[Otimiza Ext] QUEUE_UPDATE - curr:', curr, 'isChat:', isChat, 'isPendList:', isPendList, 'isPendDetail:', isPendDetail);
          // Forward to background so other tabs receive this update
          try { chrome.runtime?.sendMessage({ type: 'QUEUE_UPDATE_BROADCAST', curr: curr, prev: d.prev }); } catch (e) { console.log('[Otimiza Ext] error sending to BG:', e); }

        // Sempre atualiza a exibição com o valor atual recebido
        if (!isChat) {
          updateQueueCount(curr);
        }

        // Se a fila aumentou, adiciona ao histórico e notifica
        if (lastCount !== null && curr > lastCount) {
          console.log('[Otimiza Ext] Queue increased from', lastCount, 'to', curr);
          pushHistoryLine(`+${curr - lastCount} na fila às ${formatHHmmss(new Date())}`);
          chrome.runtime?.sendMessage({ type: 'QUEUE_ALERT', title: 'Fila aumentou', message: `De ${lastCount} para ${curr}` });
          // Reproduzir som SOMENTE em /pendente/23 para evitar duplicação entre abas
          if (isPendDetail) {
            playSound();
            try { showImageToast(); } catch (e) { }
          }
        }

  // Se estamos na página de detalhe pendente (/atendimento/pendente/23), usar overlay + som
  if (isPendDetail) { if (curr > 0) startChatAlerts(); else stopChatAlerts(); }

        lastCount = curr;
      }
    }
    if (d.type === 'NEXT_PING') {
      const secs = Math.round((d.etaMs || 0) / 1000);
      const target = new Date(d.targetTs);
      console.log('[Otimiza Ext] NEXT_PING received - secs:', secs, 'target:', target, 'isPendDetail:', isPendDetail, 'browser:', browserName);
      // Garantir que o painel existe antes de tentar atualizar
      if (isPendDetail || isPendList) {
        ensureStatusPanel();
        const etaEl = document.querySelector('#ext-eta');
        console.log('[Otimiza Ext] #ext-eta element:', etaEl);
        if (etaEl) {
          etaEl.textContent = `Próximo ping: ${secs}s · ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
          console.log('[Otimiza Ext] Updated ETA display:', etaEl.textContent);
        } else {
          console.warn('[Otimiza Ext] #ext-eta not found in DOM');
        }
      }
    }
  }, false);

  // Listener para mensagens do background.js
  chrome.runtime?.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Otimiza Ext] Message from BG:', msg);
    if (!extensionEnabled && msg?.type !== 'OTZ_TOGGLE_SOUND') return; // Permitir toggle mesmo quando OFF
    if (msg?.type === 'QUEUE_UPDATE_FROM_BG') {
      const curr = msg.curr;
      console.log('[Otimiza Ext] QUEUE_UPDATE_FROM_BG - curr:', curr, 'isChat:', isChat, 'isPendList:', isPendList, 'isPendDetail:', isPendDetail);
      
      if (typeof curr === 'number' && !isChat && (isPendList || isPendDetail)) {
        console.log('[Otimiza Ext] Updating from BG to:', curr);
        // Sempre atualiza a exibição
        updateQueueCount(curr);

        // Detectar aumento: preferir prev do próprio broadcast, cair para lastCount quando disponível
        let increased = false;
        if (typeof msg.prev === 'number') {
          if (curr > msg.prev) increased = true;
        } else if (lastCount !== null) {
          if (curr > lastCount) increased = true;
        } else {
          // sem lastCount nem prev: se curr>0 assumimos aumento (primeiro valor conhecido)
          if (curr > 0) increased = true;
        }

        if (increased) {
          console.log('[Otimiza Ext] Queue increased (bg) to', curr, 'prev:', msg.prev, 'lastCount:', lastCount);
          // histórico usa diferença quando possível
          const diff = (typeof msg.prev === 'number') ? (curr - msg.prev) : (lastCount !== null ? (curr - lastCount) : curr);
          pushHistoryLine(`+${diff} na fila às ${formatHHmmss(new Date())}`);
          chrome.runtime?.sendMessage({ type: 'QUEUE_ALERT', title: 'Fila aumentou', message: `De ${lastCount ?? msg.prev ?? 0} para ${curr}` });
          // Reproduzir som SOMENTE em /pendente/23 para evitar duplicação entre abas
          if (isPendDetail) {
            playSound();
            try { showImageToast(); } catch (e) { }
          }
        }

        // Se estamos na página de detalhe pendente (/atendimento/pendente/23), ativar overlay + som
        if (isPendDetail) {
          if (curr > 0) startChatAlerts(); else stopChatAlerts();
        }

        lastCount = curr;
      }
    }
  });

  // Monta painéis somente nas páginas de pendentes (lista e detalhe /23)
  if (extensionEnabled && !isChat && (isPendList || isPendDetail)) { 
    ensureStatusPanel();
    setTimeout(() => { if (typeof dedupePanels === 'function') dedupePanels(); }, 100);
    // Sincronização inicial: solicitar ao background o último valor conhecido da fila
    try {
      chrome.runtime?.sendMessage({ type: 'GET_LAST_QUEUE' }, (resp) => {
        if (chrome.runtime?.lastError) { /* ignore */ }
        try {
          const curr = resp?.curr;
          console.log('[Otimiza Ext] Initial sync from BG:', curr, 'browser:', browserName);
          if (typeof curr === 'number') {
            updateQueueCount(curr);
            // Ativar overlay conforme valor
            if (isPendDetail) { if (curr > 0) startChatAlerts(); else stopChatAlerts(); }
            lastCount = curr;
          }
        } catch {}
      });
    } catch (e) { console.log('[Otimiza Ext] GET_LAST_QUEUE error:', e); }
  }
    // Se estamos em /chat, remover qualquer painel residual (evitar ver duplicado após navegação SPA)
    try {
      const shell = document.getElementById('otz-ext-stratus');
      if (shell) { shell.remove(); console.log('[Otimiza Ext] Painel removido em rota /chat'); }
      const overlay = document.getElementById('otz-ext-blink');
      if (overlay) { overlay.remove(); }
    } catch {}

  // ====== Hook de mudanças de rota SPA (pushState/replaceState/popstate) ======
  if (!window.__OTZ_HISTORY_HOOKED) {
    window.__OTZ_HISTORY_HOOKED = true;
    function onRouteChange() {
      const p = location.pathname;
      const pendListNow = p.startsWith('/atendimento/pendente/') && !p.includes('/23');
      const pendDetailNow = p.startsWith('/atendimento/pendente/23');
      const chatNow = p.startsWith('/atendimento/chat');
      if (!chatNow && (pendListNow || pendDetailNow)) {
        ensureStatusPanel();
        setTimeout(() => { if (typeof dedupePanels === 'function') dedupePanels(); }, 100);
      } else {
        try { const s = document.getElementById('otz-ext-stratus'); if (s) s.remove(); } catch {}
        try { const o = document.getElementById('otz-ext-blink'); if (o) o.remove(); } catch {}
      }
    }
    const hook = (name) => {
      const orig = history[name];
      history[name] = function(...args){ const r = orig.apply(this, args); setTimeout(onRouteChange, 60); return r; };
    };
    hook('pushState'); hook('replaceState');
    window.addEventListener('popstate', () => setTimeout(onRouteChange, 60));
  }

  // Executar dedupe defensivo inicial
  if (typeof dedupePanels === 'function') {
    dedupePanels();
  } else {
    console.error('[Otimiza Ext] dedupePanels is not a function:', typeof dedupePanels);
  }
})();
