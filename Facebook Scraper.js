// FB People Scraper — v17o_sticky_min2 (fix duplicate vars): sticky footer, min-height floor, header+footer-only minimize, narrower width, recenter hotkey
(async function FB_Export_Persons_UNIFIED_v17o_sticky_min2(){
  let MIN_PANEL_HEIGHT = 300;   // smallest non-minimized height
  const DEFAULT_W = 400, MIN_W = 340, DEFAULT_H = 500; // default non-minimized dimensions
  const PANEL_PADDING = '0 0 8px 0';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = ()=>performance.now();

  // ===== Tuning knobs =====
  const PAUSE = { likes: 1700, comments: 1900, shares: 2000 };
  const STABLE_LIMIT = 10, EMPTY_PASSES = 4;

  // ===== Politeness controls =====
  const LIMITS = { MAX_ACTIONS_PER_MIN: 28, SOFT_ROW_CAP: 2000, MAX_RUN_MS: 8*60*1000 };
  function jitter(ms, ratio=0.30){ const d=ms*ratio; return Math.max(0, Math.round(ms + (Math.random()*2-1)*d)); }
  async function yieldToBrowser(){ await new Promise(r=>requestAnimationFrame(r)); if('requestIdleCallback' in window){ await new Promise(r=>requestIdleCallback(r,{timeout:1200})); } }

  let pausedByUser = false;
  let pausedByHidden = document.hidden;
  document.addEventListener('visibilitychange', ()=>{ pausedByHidden = document.hidden; });

  const Throttle = (()=> {
    let pauseMult = 1;
    let tokens = LIMITS.MAX_ACTIONS_PER_MIN, maxTokens = LIMITS.MAX_ACTIONS_PER_MIN;
    setInterval(()=>{ tokens = Math.min(maxTokens, tokens + 1); }, 3000);
    function spend(){ if(tokens<=0) return false; tokens--; return true; }
    function backoff(hard=false){ pauseMult = Math.min(8, pauseMult * (hard ? 2.0 : 1.20)); }
    function ease(){ pauseMult = Math.max(1, pauseMult * 0.90); }
    async function politeWait(base){
      while(pausedByUser || pausedByHidden){ await new Promise(r=>setTimeout(r, 400)); }
      await new Promise(r=>setTimeout(r, jitter(base * pauseMult)));
      await yieldToBrowser();
    }
    return { spend, backoff, ease, politeWait };
  })();

  // ===== Throttle sensing =====
  let throttleSignal = false;
  (function monitorNetwork(){
    const origFetch = window.fetch;
    window.fetch = async (...args)=>{
      const res = await origFetch(...args);
      if(res && (res.status===429 || res.status===403)){ throttleSignal=true; toast('Server throttle detected. Backing off.', 2000); Throttle.backoff(true); }
      return res;
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...a){
      this.addEventListener('load', function(){
        if(this.status===429 || this.status===403){ throttleSignal=true; toast('Server throttle detected. Backing off.', 2000); Throttle.backoff(true); }
      });
      return origSend.apply(this, a);
    };
  })();

  // ===== Styles =====
  (function injectStyles(){
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fbp-pulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
      #fbp-panel, #fbp-panel * { box-sizing:border-box }
      #fbp-panel { display:flex; flex-direction:column; overflow:hidden }
      #fbp-panel button { transition: transform .06s ease, background-color .12s ease, border-color .12s ease, opacity .12s ease; }
      #fbp-panel button:active { transform: translateY(1px) scale(.99); }

      #fbp-head{
        position:sticky; top:0; z-index:3;
        background:#242526; color:#e4e6eb;
        height:38px; display:flex; align-items:center; gap:8px;
        padding:0 8px 6px 10px; cursor:grab;
        border-bottom:1px solid #3a3b3c;
      }
      #fbp-head:active{ cursor:grabbing; }
      #fbp-title{ font-weight:700; white-space:nowrap }
      #fbp-postkey{ flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
      #fbp-postkey a{ color:#8ab4ff !important; text-decoration:none }
      #fbp-postkey a:hover{ text-decoration:underline }

      .fbp-chip{ display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; border:1px solid #3a3b3c; background:#3a3b3c; color:#e4e6eb; cursor:pointer; user-select:none; }
      .fbp-chip:hover{ filter:brightness(1.05) }
      .fbp-chip.active{ border-color:#2374e1;background:#2374e1; color:#fff; box-shadow:none; }

      .fbp-btn{ border:1px solid #3a3b3c; background:#3a3b3c; color:#e4e6eb; border-radius:8px; padding:8px; cursor:pointer }
      .fbp-btn.primary{ border-color:#2374e1; background:#2374e1; color:#fff; font-weight:600 }
      .fbp-btn.green{ border-color:#42b72a; background:#42b72a; color:#fff; font-weight:600 }
      .fbp-btn.round{ border-radius:999px; padding:4px 10px; min-width:28px; text-align:center }
      .fbp-btn:hover{ filter:brightness(1.06) }
      .fbp-btn:disabled{ opacity:.65; cursor:not-allowed }

      #fbp-win{ display:flex; gap:6px; margin-left:auto }
      #fbp-win .winbtn{ width:36px; height:28px; flex:0 0 36px; display:grid; place-items:center; line-height:1; font-size:16px; font-weight:700; border-radius:8px; }
      #fbp-win .winbtn.close:hover{ background:#c42b1c; color:#fff; border-color:#7a1410 }

      /* Scrollable body */
      #fbp-body{ flex:1; display:flex; flex-direction:column; gap:8px; overflow:auto; min-height:0; padding:6px; }
      #fbp-panel table { width:100% }
      #fbp-panel table tr:hover td { background:#303031 }
      #fbp-prog { transition: width .2s ease }

      #fbp-prev{ border:1px solid #3a3b3c;border-radius:8px; }

      /* Footer: flex item normally, absolute when minimized */
      .fbp-bar{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:8px;
        background:#242526; border:1px solid #3a3b3c; border-radius:10px; padding:6px; box-shadow:0 4px 12px rgba(0,0,0,.2); z-index:2; }
      .fbp-bar.float-bottom{ position:absolute; left:8px; right:8px; bottom:8px; margin-top:0; z-index:4; }
      .fbp-bar .iconbtn{ flex:1 1 44px; min-width:32px; height:32px; display:grid; place-items:center; font-size:16px; border-radius:8px }
      .fbp-bar .grow{ flex:2 1 100px; min-width:80px; height:32px }
    `;
    document.head.appendChild(style);
  })();

  // Remove any old panel
  document.getElementById('fbp-panel')?.remove();

  // ===== UI panel =====
  const ui = Object.assign(document.createElement('div'), { id:'fbp-panel' });
  Object.assign(ui.style, {
    position:'fixed', right:'16px', top:'16px',
    width: DEFAULT_W+'px', minWidth: MIN_W+'px', maxWidth:'92vw',
    minHeight: MIN_PANEL_HEIGHT+'px', height: DEFAULT_H+'px',
    background:'#242526', color:'#e4e6eb', font:'12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    border:'1px solid #3a3b3c', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,.2)',
    zIndex:2147483647, padding:PANEL_PADDING,
    resize:'both', overflow:'hidden'
  });

  // restore size if saved
  try{
    const sz = JSON.parse(localStorage.getItem('fbp_ui_size')||'null');
    if(sz && sz.w && sz.h){
      ui.style.width  = Math.max(sz.w, MIN_W) + 'px';
      ui.style.height = Math.max(sz.h, MIN_PANEL_HEIGHT, DEFAULT_H) + 'px';
    }
  }catch{}

  ui.innerHTML =
    '<div id="fbp-head">' +
      '<div id="fbp-title">FB People Scraper</div>' +
      '<button id="fbp-copyurl" aria-label="Copy URL" title="Copy URL" class="fbp-btn round" style="height:28px;width:36px;padding:0;flex:0 0 36px">⧉</button>' +
      '<div id="fbp-postkey" title=""></div>' +
      '<div id="fbp-win">' +
        '<button id="fbp-min" aria-label="Minimize" title="Minimize" class="fbp-btn winbtn">–</button>' +
        '<button id="fbp-close" aria-label="Close" title="Close" class="fbp-btn winbtn close">×</button>' +
      '</div>' +
    '</div>' +
    '<div id="fbp-body">' +
      '<div>' +
        '<div style="font-size:11px;opacity:.8;margin-bottom:6px">1) Choose what to collect</div>' +
        '<div id="fbp-modes" style="display:flex;gap:6px;flex-wrap:wrap"></div>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;opacity:.8;margin-bottom:6px">2) Select panel & start</div>' +
        '<button id="fbp-go" class="fbp-btn primary" style="width:100%;padding:10px">Select Panel & Start</button>' +
        '<div id="fbp-status" style="font-size:11px;opacity:.75;margin-top:6px">Ready</div>' +
        '<div id="fbp-runind" style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
          '<div id="fbp-led" style="width:10px;height:10px;border-radius:50%;background:#666"></div>' +
          '<div id="fbp-runtext" style="font-size:11px;opacity:.8;min-width:56px">Idle</div>' +
          '<div style="flex:1;height:6px;background:#1a1f2b;border:1px solid #2b3344;border-radius:6px;overflow:hidden"><div id="fbp-prog" style="height:100%;width:0%;background:#3b7cff"></div></div>' +
          '<div id="fbp-ops" style="font-size:11px;opacity:.75;width:68px;text-align:right">0/min</div>' +
        '</div>' +
      '</div>' +
      '<div id="fbp-stats" style="display:flex;gap:6px;justify-content:space-between;flex-wrap:wrap">' +
        '<div style="flex:1;background:#141823;border:1px solid #293042;border-radius:8px;padding:8px;text-align:center;min-width:98px">' +
          '<div style="opacity:.65;font-size:11px;display:flex;gap:6px;justify-content:center;align-items:center">👍<span>Likes</span></div><div id="fbp-likec" style="font-weight:700">0</div>' +
        '</div>' +
        '<div style="flex:1;background:#141823;border:1px solid #293042;border-radius:8px;padding:8px;text-align:center;min-width:98px">' +
          '<div style="opacity:.65;font-size:11px;display:flex;gap:6px;justify-content:center;align-items:center">↗<span>Shares</span></div><div id="fbp-sharec" style="font-weight:700">0</div>' +
        '</div>' +
        '<div style="flex:1;background:#141823;border:1px solid #293042;border-radius:8px;padding:8px;text-align:center;min-width:98px">' +
          '<div style="opacity:.65;font-size:11px;display:flex;gap:6px;justify-content:center;align-items:center">💬<span>Comments</span></div><div id="fbp-commentc" style="font-weight:700">0</div>' +
        '</div>' +
      '</div>' +
      '<div id="fbp-preview-wrap">' +
        '<div style="font-size:11px;opacity:.8;margin:8px 0 6px;display:flex;justify-content:space-between;align-items:center">' +
          '<span>Preview (first 50)</span>' +
        '</div>' +
        '<div id="fbp-prev" style="height:80px;overflow:hidden;border:1px solid #293042;border-radius:8px"></div>' +
      '</div>' +
    '</div>' +
    '<div id="fbp-bar" class="fbp-bar">' +
      '<button id="fbp-pause" class="fbp-btn iconbtn" title="Pause">⏸</button>' +
      '<button id="fbp-stop" class="fbp-btn iconbtn" title="Stop">■</button>' +
      '<button id="fbp-dl" class="fbp-btn green grow" title="Download CSV">⬇ Download CSV</button>' +
      '<button id="fbp-reset" class="fbp-btn iconbtn" title="Reset">↻</button>' +
    '</div>';
  document.body.appendChild(ui);

  // adjust minimum panel height dynamically to keep controls visible
  try{
    const headH = ui.querySelector('#fbp-head')?.offsetHeight || 38;
    const barH  = ui.querySelector('#fbp-bar')?.offsetHeight || 46;
    MIN_PANEL_HEIGHT = Math.max(MIN_PANEL_HEIGHT, headH + barH + 20);
    ui.style.minHeight = MIN_PANEL_HEIGHT + 'px';
  }catch{}

  // ===== Always keep it visible + quick reset hotkey
  (function ensureVisible(){
    const m=8;
    function clamp(){
      const w=ui.offsetWidth||DEFAULT_W, h=ui.offsetHeight||MIN_PANEL_HEIGHT;
      const vw=innerWidth, vh=innerHeight;
      let top=parseInt(getComputedStyle(ui).top,10);    if(!Number.isFinite(top) || top < m || top > vh - 60) top = 16;
      let right=parseInt(getComputedStyle(ui).right,10);if(!Number.isFinite(right) || right < m || (vw - right - w) < 6) right = 16;
      ui.style.top = top+'px';
      ui.style.right = right+'px';
    }
    clamp();
    addEventListener('resize', clamp);
    addEventListener('keydown', e=>{
      if(e.altKey && e.shiftKey && (e.key.toLowerCase()==='f')){
        ui.style.top='16px'; ui.style.right='16px';
        localStorage.removeItem('fbp_ui_pos');
        localStorage.setItem('fbp_ui_min','0');
        const bodyEl = ui.querySelector('#fbp-body');
        if (bodyEl && bodyEl.style.display==='none'){ bodyEl.style.display='flex'; ui.style.resize='both'; moveBar(false); }
      }
    });
  })();

  // ===== Window controls / minimize
  ui.querySelector('#fbp-close').addEventListener('click', ()=>ui.remove());
  (function(){
    const bodyEl = ui.querySelector('#fbp-body');
    const headEl = ui.querySelector('#fbp-head');
    const barEl = ui.querySelector('#fbp-bar');
    const minBtn = ui.querySelector('#fbp-min');

    let minimized = localStorage.getItem('fbp_ui_min') === '1';
    let saved = null;
    try{ saved = JSON.parse(localStorage.getItem('fbp_ui_size')||'null'); }catch{}
    let lastSize = (saved && saved.w && saved.h)
      ? { w: Math.max(saved.w, MIN_W), h: Math.max(saved.h, DEFAULT_H) }
      : { w: parseInt(getComputedStyle(ui).width,10), h: parseInt(getComputedStyle(ui).height,10) };

    function moveBar(min){
      if(min){ barEl.classList.add('float-bottom'); }
      else   { barEl.classList.remove('float-bottom'); }
    }

    function applyMin(min){
      minimized = min;
      localStorage.setItem('fbp_ui_min', min ? '1' : '0');
      if(min){
        if(ui.style.width || ui.style.height){ lastSize = { w: ui.offsetWidth, h: ui.offsetHeight }; }
        bodyEl.style.display = 'none';
        ui.style.resize = 'none';
        ui.style.minHeight = '0';
        ui.style.padding = '0';
        moveBar(true);
        const headH = headEl.offsetHeight || 38;
        const barH  = barEl.offsetHeight || 46;
        ui.style.height = (headH + barH + 16) + 'px';
        ui.style.width = Math.max(MIN_W, Math.min(lastSize.w || DEFAULT_W, DEFAULT_W)) + 'px';
        minBtn.textContent = '▢'; minBtn.title = 'Restore';
      }else{
        bodyEl.style.display = 'flex';
        ui.style.resize = 'both';
        ui.style.minHeight = MIN_PANEL_HEIGHT + 'px';
        ui.style.padding = PANEL_PADDING;
        if(lastSize.w) ui.style.width  = Math.max(lastSize.w, MIN_W) + 'px';
        if(lastSize.h) ui.style.height = Math.max(lastSize.h, MIN_PANEL_HEIGHT, DEFAULT_H) + 'px';
        minBtn.textContent = '–'; minBtn.title = 'Minimize';
        moveBar(false);
      }
    }
    minBtn.addEventListener('click', ()=>applyMin(!minimized));
    applyMin(minimized);

    // Persist size and enforce floors
    const ro = new ResizeObserver(()=>{
      if(minimized) return;
      let w = Math.max(parseInt(getComputedStyle(ui).width,10), MIN_W);
      let h = Math.max(parseInt(getComputedStyle(ui).height,10), MIN_PANEL_HEIGHT);
      ui.style.width  = w + 'px';
      ui.style.height = h + 'px';
      localStorage.setItem('fbp_ui_size', JSON.stringify({w,h}));
      lastSize = { w, h };
    });
    ro.observe(ui);
  })();

  // ===== Toasts =====
  let toastWrap = document.getElementById('fbp-toastwrap');
  if(!toastWrap){
    toastWrap = Object.assign(document.createElement('div'), { id:'fbp-toastwrap' });
    Object.assign(toastWrap.style, { position:'fixed', right:'18px', bottom:'18px', display:'flex', flexDirection:'column', gap:'8px', alignItems:'flex-end', zIndex:2147483647 });
    document.body.appendChild(toastWrap);
  }
  function toast(msg, ms=1600){
    const t=document.createElement('div');
    Object.assign(t.style,{ background:'#2374e1', color:'#fff', padding:'10px 12px', borderRadius:'10px', boxShadow:'0 4px 12px rgba(0,0,0,.2)', font:'12px system-ui,-apple-system, Segoe UI, Roboto, sans-serif', maxWidth:'280px' });
    t.textContent=msg; toastWrap.appendChild(t);
    while(toastWrap.children.length>4){ toastWrap.firstChild.remove(); }
    setTimeout(()=>t.remove(), ms);
  }

  // ===== draggable (persist)
  ;(function(){
    const head = ui.querySelector('#fbp-head');
    const pos = JSON.parse(localStorage.getItem('fbp_ui_pos')||'{}');
    if(pos.top!=null && pos.right!=null){ ui.style.top=pos.top+'px'; ui.style.right=pos.right+'px'; }
    let sx=0, sy=0, startTop=0, startRight=0, dragging=false;
    head.addEventListener('mousedown', e=>{
      if(e.target.closest('#fbp-win')) return;
      dragging=true; sx=e.clientX; sy=e.clientY;
      startTop=parseInt(getComputedStyle(ui).top,10);
      startRight=parseInt(getComputedStyle(ui).right,10);
      e.preventDefault();
    }, true);
    window.addEventListener('mousemove', e=>{
      if(!dragging) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      ui.style.top = Math.max(8, startTop + dy) + 'px';
      ui.style.right = Math.max(8, startRight - dx) + 'px';
    }, true);
    window.addEventListener('mouseup', ()=>{
      if(!dragging) return;
      dragging=false;
      localStorage.setItem('fbp_ui_pos', JSON.stringify({
        top: parseInt(ui.style.top,10)||16,
        right: parseInt(ui.style.right,10)||16
      }));
    }, true);
  })();

  // ===== modes (Likes / Shares / Comments)
  const modes=[{key:'likes',label:'Likes'},{key:'shares',label:'Shares'},{key:'comments',label:'Comments'}];
  const modeWrap=ui.querySelector('#fbp-modes'); let activeMode='likes'; const modeButtons={};
  function setActiveMode(k){
    activeMode=k;
    Object.values(modeButtons).forEach(el=>el.classList.remove('active'));
    if(modeButtons[k]) modeButtons[k].classList.add('active');
  }
  modes.forEach(m=>{
    const b=document.createElement('div'); b.className='fbp-chip'; b.textContent=m.label; b.dataset.mode=m.key; b.setAttribute('role','button'); b.tabIndex=0;
    b.addEventListener('click',()=>setActiveMode(m.key));
    b.addEventListener('keydown',e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setActiveMode(m.key);} });
    modeWrap.appendChild(b); modeButtons[m.key]=b;
  });
  setActiveMode('likes');

  // ===== refs & utils (single, non-duplicated)
  const prevBox   = ui.querySelector('#fbp-prev');
  const likeC     = ui.querySelector('#fbp-likec');
  const commentC  = ui.querySelector('#fbp-commentc');
  const shareC    = ui.querySelector('#fbp-sharec');
  const statusEl  = ui.querySelector('#fbp-status');
  const led       = ui.querySelector('#fbp-led');
  const runtext   = ui.querySelector('#fbp-runtext');
  const prog      = ui.querySelector('#fbp-prog');
  const opsEl     = ui.querySelector('#fbp-ops');
  const btnPause  = ui.querySelector('#fbp-pause');
  const btnStop   = ui.querySelector('#fbp-stop');
  const btnDL     = ui.querySelector('#fbp-dl');
  const btnReset  = ui.querySelector('#fbp-reset');

  let POST_URL=location.href;
  function postKeyFromURL(u){ try{ const x=new URL(u); x.hash=''; return x.toString(); }catch(e){ return u; } }
  function setPostKeyLabel(){
    const postKeyEl=ui.querySelector('#fbp-postkey');
    const key=postKeyFromURL(POST_URL);
    const short=(key.length>42? (key.slice(0,42)+'…'):key);
    postKeyEl.innerHTML='<a href="'+key+'" target="_blank" title="'+key+'">'+short+'</a>';
  }
  setPostKeyLabel();
  (function(){
    function refreshPostKey(){ POST_URL = location.href; setPostKeyLabel(); }
    const _push = history.pushState, _replace = history.replaceState;
    history.pushState = function(){ const r=_push.apply(this, arguments); refreshPostKey(); return r; };
    history.replaceState = function(){ const r=_replace.apply(this, arguments); refreshPostKey(); return r; };
    addEventListener('popstate', refreshPostKey);
    let last = location.href; setInterval(()=>{ if(location.href!==last){ last=location.href; refreshPostKey(); } },1000);
  })();
  ui.querySelector('#fbp-copyurl').addEventListener('click', async ()=>{
    try{ await navigator.clipboard.writeText(POST_URL); toast('Post URL copied'); }
    catch{ toast('Could not copy URL'); }
  });

  // ===== store & helpers
  const store=new Map(); const counts={likes:0,comments:0,shares:0};
  function updateStats(){ likeC.textContent=counts.likes; commentC.textContent=counts.comments; shareC.textContent=counts.shares; }
  function resetForThisPost(){ store.clear(); counts.likes=counts.comments=counts.shares=0; updateStats(); renderPreview(); }

  function isScrollableY(n){const cs=getComputedStyle(n); return /(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+20;}
  function closestScrollable(n){for(let p=n;p;p=p.parentElement) if(isScrollableY(p)) return p; return null;}
  let sc=null;

  function normalizeFB(href){ try{
    const u=new URL(href,'https://www.facebook.com');
    if(/^l\.facebook\.com$|^lm\.facebook\.com$/i.test(u.hostname)){ const redir=u.searchParams.get('u'); if(redir) return normalizeFB(decodeURIComponent(redir)); }
    u.protocol='https:'; u.hostname='www.facebook.com'; u.hash='';
    if(u.pathname==='/profile.php'){ const id=u.searchParams.get('id'); if(!id) return null; u.search='?id='+encodeURIComponent(id); } else { u.search=''; }
    u.pathname=u.pathname.replace(/\/+/g,'/').replace(/\/$/,''); return u.toString();
  }catch(e){ return null; } }
  function looksLikeProfile(url){ try{
    const p=new URL(url).pathname.toLowerCase();
    if(p==='/profile.php') return true;
    if(/^\/people\/[^/]+\/\d+$/.test(p)) return true;
    if(/^\/[a-z0-9.\-_]+$/.test(p)){
      const bad=new Set(['events','groups','pages','marketplace','watch','gaming','reel','reels','photo','photos','videos','privacy','help','settings','notifications','bookmarks','messages','friends','stories','story.php','permalink.php','ufi','reactions','posts','share']);
      return !bad.has(p.slice(1));
    }
    return false;
  }catch(e){ return false; } }
  const isVisible=el=>{ const r=el.getBoundingClientRect(), cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.visibility==='visible'&&cs.display!=='none'; };
  const inMessageBody=a=>!!(a.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"]'));
  const isCommentArticleNode=n=>{ const art=n.closest&&n.closest('[role="article"]'); if(!art) return false; const al=(art.getAttribute('aria-label')||'').toLowerCase(); return al.startsWith('comment by')||al.startsWith('reply by'); };
  function cleanName(s){ if(!s) return ''; s=s.replace(/\b(profile|cover)\s+(picture|photo)\s+(of|for)\s*/ig,''); s=s.replace(/\s*[·•]\s*\d+\s*[smhdw]\b.*$/i,''); s=s.replace(/\s*\b(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b.*$/i,''); return s.trim(); }
  function getNameFromAnchor(a){
    const t=(a.textContent||'').trim(); if(t) return cleanName(t);
    const al=a.getAttribute('aria-label'); if(al) return cleanName(al);
    const imgLabel=a.querySelector('[aria-label]')?.getAttribute('aria-label'); if(imgLabel) return cleanName(imgLabel);
    const imgAlt=a.querySelector('img[alt]')?.getAttribute('alt'); if(imgAlt) return cleanName(imgAlt);
    return '';
  }

  function likeItems(){ return Array.from(sc.querySelectorAll('[role="listitem"],[data-visualcompletion="ignore-dynamic"]')).filter(isVisible); }
  function pickLikeAnchor(item){
    const header=item.querySelector('[data-ad-rendering-role="profile_name"] a[href]'); if(header) return header;
    const anchors=Array.from(item.querySelectorAll('a[href]')).filter(isVisible);
    const withText=anchors.find(a=>(a.textContent||'').trim()&&looksLikeProfile(normalizeFB(a.getAttribute('href'))));
    return withText||anchors[0]||null;
  }
  function commentArticles(){ return Array.from(sc.querySelectorAll('[role="article"][aria-label^="Comment by "]')).filter(isVisible); }
  function pickCommentAnchor(article){
    const candidates=Array.from(article.querySelectorAll('a[href]')).filter(isVisible);
    for(const a of candidates){
      if(inMessageBody(a)) continue;
      const url=normalizeFB(a.getAttribute('href')); if(!looksLikeProfile(url)) continue;
      const txt=(a.textContent||'').trim(); if(!txt) continue;
      if(/\bago\b/i.test(txt) || /^[0-9]+\s*[smhdw]$/i.test(txt)) continue;
      return a;
    } return null;
  }
  function sharerAnchors(root){
    const R = root || sc;
    const sel='[data-ad-rendering-role="profile_name"] a[href], h3 a[href]';
    return Array.from(R.querySelectorAll(sel)).filter(a=>{
      if(!isVisible(a)) return false;
      if(inMessageBody(a)) return false;
      if(isCommentArticleNode(a)) return false;
      const url=normalizeFB(a.getAttribute('href')); if(!looksLikeProfile(url)) return false;
      const txt=(a.textContent||'').trim(); if(!txt) return false;
      if(/\bago\b/i.test(txt) || /^[0-9]+\s*[smhdw]$/i.test(txt)) return false;
      const ok=a.closest('[data-ad-rendering-role="profile_name"]')||a.closest('h1,h2,h3');
      return !!ok;
    });
  }

  function getDialog(container){ return container.closest && container.closest('[role="dialog"]'); }
  const norm = s => String(s||'').replace(/\u00A0/g,' ').toLowerCase();
  function dialogText(dlg){
    if(!dlg) return '';
    const aria = norm(dlg.getAttribute('aria-label')||'');
    const head = norm(Array.from(dlg.querySelectorAll('h1,h2,h3,[role="heading"]')).slice(0,2).map(e=>e.textContent||'').join(' '));
    return (aria + ' ' + head);
  }
  function resolvePostURL(dlg){
    const cand = new Set();
    const add = (h) => { const u = normalizeFB(h); if(u) cand.add(u); };
    const scope = dlg || document;
    scope.querySelectorAll('a[href]').forEach(a=>{
      const h=a.getAttribute('href')||'';
      if(/permalink\.php/i.test(h)) add(h);
      if(/[\?/](story_fbid|fbid)=/i.test(h)) add(h);
      if(/\/posts\//i.test(h)) add(h);
      if(/\/videos\//i.test(h)) add(h);
      if(/\/photos\//i.test(h)) add(h);
    });
    const score = u => ( (/\/posts\//.test(u)?8:0) + (/(permalink\.php|story_fbid|fbid=)/.test(u)?8:0) + (/\/photos\//.test(u)?4:0) + (/\/videos\//.test(u)?4:0) - ((/[?&]v=/.test(u)&&/\/watch/.test(u))?2:0) );
    let best=null, bestScore=-1; cand.forEach(u=>{ const s=score(u); if(s>bestScore){ best=u; bestScore=s; }});
    return best || location.href;
  }
  function isSharesPanel(container){
    const dlg = getDialog(container);
    const text = dialogText(dlg);
    if (/\b(people\s+who\s+)?shared?\s+this\b/i.test(text)) return true;
    if (/\bpeople\s+who\s+shared\b/i.test(text)) return true;
    if (/\bshares?\b/i.test(text) && !/\bcomment/i.test(text)) return true;
    return false;
  }
  function detectPanelType(container){
    if (isSharesPanel(container)) return 'shares';
    const dlg = container.closest && container.closest('[role="dialog"]');
    const label = norm(dlg?.getAttribute('aria-label')||'');
    if (container.querySelector('[role="article"][aria-label^="Comment by "]')) return 'comments';
    if (/\bcomment/.test(label)) return 'comments';
    if (dlg) {
      const tablist = dlg.querySelector('[role="tablist"]');
      if (tablist) {
        const hasAllTab = Array.from(tablist.querySelectorAll('[role="tab"]')).some(t => /all/i.test(t.textContent||''));
        if (hasAllTab) return 'likes';
      }
    }
    const manyListItems = container.querySelectorAll('[role="listitem"]').length >= 3;
    if (manyListItems && !container.querySelector('[role="article"][aria-label^="Comment by "]')) return 'likes';
    return 'unknown';
  }

  function upsertRow(name,url,mode){
    if(!name||!url) return; if(!looksLikeProfile(url)) return;
    const key=url;
    const existing = store.get(key) || { Person_Name:name, Person:url, Like:'No', Share:'No', Comment:'No', Publication_URL: POST_URL };
    if(name && (!existing.Person_Name || existing.Person_Name.length < name.length)) existing.Person_Name = name;
    if(mode==='likes') existing.Like='Yes';
    if(mode==='comments') existing.Comment='Yes';
    if(mode==='shares') existing.Share='Yes';
    existing.Publication_URL = POST_URL;
    store.set(key, existing);
  }

  let lastRender=0; function maybeRender(force=false){ const t=Date.now(); if(force || t-lastRender>900){ renderPreview(); lastRender=t; } else { updateStats(); } }

  // ===== PREVIEW
  function renderPreview(){
    const rows = Array.from(store.values());
    if(rows.length === 0){ prevBox.style.height='80px'; prevBox.style.overflowY='hidden'; }
    else { prevBox.style.height='clamp(120px,18vh,230px)'; prevBox.style.overflowY='auto'; }

    let head =
      '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px">' +
        '<colgroup><col style="width:44%"><col style="width:36%"><col style="width:6%"><col style="width:6%"><col style="width:8%"></colgroup>' +
        '<thead><tr style="position:sticky;top:0;background:#242526">' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap">Person_Name</th>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap">Person</th>' +
          '<th title="Like" style="text-align:center;padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap">👍</th>' +
          '<th title="Share" style="text-align:center;padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap">↗</th>' +
          '<th title="Comment" style="text-align:center;padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap">💬</th>' +
        '</tr></thead><tbody>';

    let body='';
    const n=Math.min(rows.length,50);
    for(let i=0;i<n;i++){
      const r=rows[i];
      body+='<tr>' +
        '<td style="padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">'+escapeHTML(r.Person_Name)+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3a3b3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0"><a href="'+r.Person+'" target="_blank" style="color:#2374e1" title="'+r.Person+'">'+shorten(r.Person,40)+'</a></td>' +
        '<td style="padding:6px;border-bottom:1px solid #3a3b3c;text-align:center">'+r.Like+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3a3b3c;text-align:center">'+r.Share+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3a3b3c;text-align:center">'+r.Comment+'</td>' +
      '</tr>';
    }
    prevBox.innerHTML = head + body + '</tbody></table>';
    updateStats();
  }
  function escapeHTML(s){ return (s||'').replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
  function shorten(s,n){ s=String(s||''); return s.length>n ? (s.slice(0,n-1)+'…') : s; }

  function downloadMerged(){
    const rows = Array.from(store.values());
    const header = 'Person_Name,Person,Like,Share,Comment,Publication_URL\n';
    const q = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const body = rows.map(r => [q(r.Person_Name), q(r.Person), q(r.Like), q(r.Share), q(r.Comment), q(r.Publication_URL)].join(',')).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'facebook_engagements_export_from_fb.csv' });
    document.body.appendChild(link); link.click(); link.remove();
  }

  // ===== Live run indicator
  let heartbeat=null, actionsThisRun=0, currentRunStarted=0;
  function setRunningState(state){
    const setLED=(el,color,anim)=>{ if(!el) return; el.style.background=color; el.style.animation=anim?'fbp-pulse 1.6s infinite':'none'; };
    if(state==='running'){ setLED(led,'#24d05a',true); runtext.textContent='Running'; }
    if(state==='paused'){ setLED(led,'#ffcc00',true); runtext.textContent='Paused'; }
    if(state==='backoff'){ setLED(led,'#ff6a00',true); runtext.textContent='Backoff'; }
    if(state==='idle'){ setLED(led,'#666',false); runtext.textContent='Idle'; prog.style.width='0%'; opsEl.textContent='0/min'; }
    refreshControls();
  }
  function startHeartbeat(started){
    stopHeartbeat(); currentRunStarted = started; actionsThisRun = 0; setRunningState('running');
    heartbeat = setInterval(()=>{
      const elapsed = now() - currentRunStarted;
      const cur = (activeMode === 'likes' ? counts.likes : activeMode === 'comments' ? counts.comments : counts.shares);
      const pct = Math.min(100, Math.round((cur / LIMITS.SOFT_ROW_CAP) * 100));
      prog.style.width = pct + '%';
      const mins = Math.max(0.016, elapsed/60000);
      const apm = Math.round(actionsThisRun / mins);
      opsEl.textContent = apm + '/min';
      if(pausedByUser || pausedByHidden) setRunningState('paused');
      else if(throttleSignal){ setRunningState('backoff'); throttleSignal=false; }
      else setRunningState('running');
    }, 500);
    refreshControls();
  }
  function stopHeartbeat(){ if(heartbeat){ clearInterval(heartbeat); heartbeat=null; } setRunningState('idle'); }
  function refreshControls(){
    const running = !!heartbeat;
    btnPause.disabled = !running;
    btnStop.disabled  = !running;
    btnPause.textContent = (running && pausedByUser) ? '▶' : '⏸';
    btnPause.title = (running && pausedByUser) ? 'Resume' : 'Pause';
  }
  function setPaused(p){
    pausedByUser = !!p;
    const running = !!heartbeat;
    if(running){ setRunningState(pausedByUser ? 'paused' : 'running'); }
    else { setRunningState('idle'); }
    refreshControls();
  }
  btnPause.addEventListener('click',()=>setPaused(!pausedByUser));
  btnStop.addEventListener('click', ()=>{ runToken++; stopHeartbeat(); setPaused(false); setUIBusy(false, 'Stopped'); });
  btnDL.addEventListener('click', downloadMerged);
  btnReset.addEventListener('click', ()=>{ resetForThisPost(); toast('Cleared for this post.'); });

  // ===== Run control
  let runToken=0;
  function setUIBusy(busy, label){
    const btn = ui.querySelector('#fbp-go');
    btn.disabled = !!busy;
    Object.values(modeButtons).forEach(b=>b.disabled = !!busy);
    btn.style.opacity = busy ? 0.7 : 1;
    if (label) statusEl.textContent = label;
    refreshControls();
  }

  ui.querySelector('#fbp-go').addEventListener('click', async function(){
    setPaused(false);
    toast('Click inside the open panel…', 1800);
    const ev = await new Promise(function(res){
      const h = function(e){ document.removeEventListener('click', h, true); res(e); };
      document.addEventListener('click', h, true);
    });
    const seed = ev.target;
    let c = closestScrollable(seed);
    if(!c){
      const dlg = seed.closest && (seed.closest('[role="dialog"],[aria-modal="true"]') || document.querySelector('[role="dialog"][aria-modal="true"]'));
      if(dlg){ c = Array.from(dlg.querySelectorAll('*')).find(isScrollableY) || dlg; }
    }
    sc = c || document.scrollingElement || document.body;

    const detected = detectPanelType(sc);
    if (detected !== 'unknown' && detected !== activeMode) { setActiveMode(detected); toast('Detected ' + detected + ' panel — switching mode.', 1400); }
    if (detected === 'unknown') {
      if (activeMode === 'likes') toast('Panel looks like Reactions — proceeding as Likes.', 1400);
      else { toast('Could not recognize this panel for ' + activeMode + '. Open the correct dialog and try again.', 2000); return; }
    }

    const dlg = getDialog(sc);
    POST_URL = resolvePostURL(dlg);
    setPostKeyLabel();

    const myToken = ++runToken;
    setUIBusy(true, 'Collecting…'); startHeartbeat(now());

    if (activeMode === 'likes')        await runLikes(myToken);
    else if (activeMode === 'comments') await runComments(myToken);
    else                                 await runShares(myToken);

    if (myToken !== runToken){ setUIBusy(false); stopHeartbeat(); return; }
    setUIBusy(false); stopHeartbeat();

    const hasAll = counts.likes>0 && counts.comments>0 && counts.shares>0;
    if(hasAll){ toast('All three collected — downloading merged CSV…', 1400); downloadMerged(); }
    else { toast('Done for this mode ✓'); }
  });

  // ===== Runners (unchanged logic)
  async function runLikes(token){
    const kind = detectPanelType(sc);
    if (kind !== 'likes' && kind !== 'unknown') { toast('This panel doesn’t look like the Reactions list; aborting likes run.', 1800); return; }
    const started = now(); let prevH=-1, stable=0, seenRun=new Set(), emptyPass=0;
    for(let i=0;i<280 && stable<STABLE_LIMIT;i++){
      if(token !== runToken) return;
      if((now() - started) > LIMITS.MAX_RUN_MS){ toast('Run time cap reached.', 1600); break; }
      if(store.size >= LIMITS.SOFT_ROW_CAP){ toast('Row cap reached. Stopping.', 1600); break; }
      let grew=false, found=0;
      likeItems().forEach(it=>{
        const a = pickLikeAnchor(it); if(!a) return;
        const url=normalizeFB(a.getAttribute('href')); if(!url) return;
        if(seenRun.has(url)) return; seenRun.add(url);
        const name=getNameFromAnchor(a);
        const before = store.size; upsertRow(name,url,'likes');
        if(store.size>before){ grew=true; found++; }
      });
      counts.likes = Array.from(store.values()).filter(r=>r.Like==='Yes').length;
      if(found===0){ Throttle.backoff(false); if(++emptyPass>=EMPTY_PASSES) break; } else { emptyPass=0; Throttle.ease(); }
      maybeRender(grew);
      if(Throttle.spend()){ sc.scrollBy(0, Math.round(sc.clientHeight * 0.75)); actionsThisRun++; }
      await Throttle.politeWait(PAUSE.likes);
      const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
      const bodyTxt = document.body.innerText.toLowerCase();
      if(bodyTxt.includes("you're temporarily blocked") || bodyTxt.includes('you’re temporarily blocked')){ toast('Temporary block text detected. Cooling down.', 2000); Throttle.backoff(true); break; }
    }
    maybeRender(true);
  }
  async function runComments(token){
    const dlg=getDialog(sc); const text=dialogText(dlg);
    if(/\bshare\b/.test(text) || /\bshared?\s+this\b/.test(text)){ toast('You clicked the Shares dialog; aborting comments run.', 1800); return; }
    if(detectPanelType(sc) !== 'comments'){ toast('This panel doesn’t look like the main Comments list; aborting.', 1800); return; }
    const started = now(); let prevH=-1, stable=0, seenRun=new Set(), emptyPass=0, anyFound=false;
    for(let i=0;i<320 && stable<STABLE_LIMIT;i++){
      if(token !== runToken) return;
      if((now() - started) > LIMITS.MAX_RUN_MS){ toast('Run time cap reached.', 1600); break; }
      if(store.size >= LIMITS.SOFT_ROW_CAP){ toast('Row cap reached. Stopping.', 1600); break; }
      let grew=false, found=0;
      commentArticles().forEach(art=>{
        const a = pickCommentAnchor(art); if(!a) return;
        const url=normalizeFB(a.getAttribute('href')); if(!url) return;
        if(seenRun.has(url)) return; seenRun.add(url);
        const name=getNameFromAnchor(a);
        const before = store.size; upsertRow(name,url,'comments');
        if(store.size>before){ grew=true; found++; anyFound=true; }
      });
      let clicked=0;
      sc.querySelectorAll('div[role="button"],button').forEach(b=>{
        if(clicked>=2) return;
        const t=(b.innerText||'').toLowerCase();
        if(t.includes('view more comment')||t.includes('more comments')||t.includes('replies')){ b.click(); clicked++; actionsThisRun++; }
      });
      counts.comments = Array.from(store.values()).filter(r=>r.Comment==='Yes').length;
      if(found===0){ Throttle.backoff(false); if(++emptyPass>=EMPTY_PASSES) break; } else { emptyPass=0; Throttle.ease(); }
      maybeRender(grew);
      if(Throttle.spend()){ sc.scrollBy(0, Math.round(sc.clientHeight * 0.75)); actionsThisRun++; }
      await Throttle.politeWait(PAUSE.comments);
      const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
      const bodyTxt = document.body.innerText.toLowerCase();
      if(bodyTxt.includes("you're temporarily blocked") || bodyTxt.includes('you’re temporarily blocked')){ toast('Temporary block text detected. Cooling down.', 2000); Throttle.backoff(true); break; }
    }
    if(!anyFound) toast('No comments found in this panel.', 1400);
    maybeRender(true);
  }
  async function runShares(token){
    if(!isSharesPanel(sc)){ toast('This panel doesn’t look like the Shares list; aborting shares run.', 1800); return; }
    const started = now(); let prevH=-1, stable=0, seenRun=new Set(), emptyPass=0, anyFound=false;
    for(let i=0;i<280 && stable<STABLE_LIMIT;i++){
      if(token !== runToken) return;
      if((now() - started) > LIMITS.MAX_RUN_MS){ toast('Run time cap reached.', 1600); break; }
      if(store.size >= LIMITS.SOFT_ROW_CAP){ toast('Row cap reached. Stopping.', 1600); break; }
      let grew=false, found=0;
      const as = sharerAnchors(sc);
      as.forEach(a=>{
        const url=normalizeFB(a.getAttribute('href')); if(!url) return;
        if(seenRun.has(url)) return; seenRun.add(url);
        const name=getNameFromAnchor(a);
        const before = store.size; upsertRow(name,url,'shares');
        if(store.size>before){ grew=true; found++; anyFound=true; }
      });
      counts.shares = Array.from(store.values()).filter(r=>r.Share==='Yes').length;
      if(found===0){ Throttle.backoff(false); if(++emptyPass>=EMPTY_PASSES) break; } else { emptyPass=0; Throttle.ease(); }
      maybeRender(grew);
      if(Throttle.spend()){ sc.scrollBy(0, Math.round(sc.clientHeight * 0.75)); actionsThisRun++; }
      await Throttle.politeWait(PAUSE.shares);
      const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
      const bodyTxt = document.body.innerText.toLowerCase();
      if(bodyTxt.includes("you're temporarily blocked") || bodyTxt.includes('you’re temporarily blocked')){ toast('Temporary block text detected. Cooling down.', 2000); Throttle.backoff(true); break; }
    }
    if(!anyFound) toast('No shares found in this panel.', 1400);
    maybeRender(true);
  }

  // initial render
  renderPreview();

})();
