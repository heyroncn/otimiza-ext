
const KEY='otz_ext_sound_enabled';
function setBadge(on){ chrome.action.setBadgeText({text:on?'ON':'OFF'}); chrome.action.setBadgeBackgroundColor({color:on?'#84bd20':'#dc2626'}); }
chrome.runtime.onInstalled.addListener(async()=>{ const { [KEY]:v }=await chrome.storage.local.get(KEY); const en=(v===undefined)?true:!!v; await chrome.storage.local.set({[KEY]:en}); setBadge(en); });
chrome.runtime.onStartup.addListener(async()=>{ const { [KEY]:v }=await chrome.storage.local.get(KEY); setBadge((v===undefined)?true:!!v); });
chrome.action.onClicked.addListener(async()=>{ const { [KEY]:v }=await chrome.storage.local.get(KEY); const next=!(v===undefined?true:!!v); await chrome.storage.local.set({[KEY]:next}); setBadge(next); const tabs=await chrome.tabs.query({}); for(const t of tabs){ try{ chrome.tabs.sendMessage(t.id,{type:'OTZ_TOGGLE_SOUND',value:next}); }catch(e){} } });

let __lastQueueValue = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if (msg?.type==='QUEUE_ALERT'){
    chrome.notifications.create('',{ type:'basic', iconUrl:'icons/icon128.png', title:msg.title||'Fila aumentou', message:msg.message||'Você tem novos itens na fila', priority:2 });
  }
  // Retransmitir QUEUE_UPDATE para todas as abas de pendente/23
  if (msg?.type==='QUEUE_UPDATE_BROADCAST') {
    console.log('[Otimiza Ext BG] Broadcasting QUEUE_UPDATE:', msg);
    // persistir último valor em memória e também expo-lo para sincronização inicial
    const prev = __lastQueueValue;
    __lastQueueValue = msg.curr;
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        try {
          chrome.tabs.sendMessage(tab.id, { type: 'QUEUE_UPDATE_FROM_BG', curr: msg.curr, prev: (typeof msg.prev==='number' ? msg.prev : prev) }, (response) => {
            if (chrome.runtime.lastError) {
              // Ignore - aba pode não ter extension
            }
          });
        } catch (e) {}
      }
    });
  }
  // Injetar injected.js no contexto da página (MAIN) — útil para Edge quando <script> é bloqueado por CSP
  if (msg?.type==='INJECT_PAGE_SCRIPT') {
    try {
      const tabId = sender?.tab?.id;
      if (typeof tabId === 'number') {
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          files: ['injected.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.log('[Otimiza Ext BG] scripting injection error:', chrome.runtime.lastError);
          } else {
            console.log('[Otimiza Ext BG] injected.js executed via scripting on tab', tabId);
          }
        });
      }
    } catch (e) { console.log('[Otimiza Ext BG] INJECT_PAGE_SCRIPT error:', e); }
  }
  // Responder sincronização inicial na aba pendente/23
  if (msg?.type==='GET_LAST_QUEUE') {
    try { sendResponse({ curr: __lastQueueValue }); } catch {}
    return true;
  }
});

