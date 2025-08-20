(async function FB_Export_Persons_UNIFIED_v16(){
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ===== UI (Facebook-ish + draggable) =====
  const ui = document.createElement('div');
  Object.assign(ui.style, {
    position:'fixed', top:'16px', right:'16px', width:'360px',
    background:'#242526', color:'#E4E6EB',
    font:'12px system-ui, -apple-system, Segoe UI, Roboto',
    border:'1px solid #3A3B3C', borderRadius:'8px',
    boxShadow:'0 12px 32px rgba(0,0,0,.45)', zIndex:2147483647, padding:'10px'
  });
  ui.innerHTML =
    '<div id="fbp-drag" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:grab;padding:6px 4px;border-bottom:1px solid #3A3B3C">' +
      '<div style="display:inline-flex;flex-direction:column;gap:2px;margin-right:6px;opacity:.7">' +
        '<span>⋮⋮</span><span>⋮⋮</span>' +
      '</div>' +
      '<div style="font-weight:700">FB People Scraper</div>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:6px">' +
        '<span id="fbp-postkey" style="max-width:190px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.85"></span>' +
        '<button id="fbp-copy" title="Copy post URL" style="border:1px solid #3A3B3C;background:#3A3B3C;color:#E4E6EB;border-radius:6px;padding:2px 6px;cursor:pointer">Copy</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:grid;gap:10px">' +
      '<div>' +
        '<div style="font-size:11px;opacity:.8;margin-bottom:6px">1) Choose what to collect</div>' +
        '<div id="fbp-modes" style="display:flex;gap:6px;flex-wrap:wrap"></div>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;opacity:.8;margin-bottom:6px">2) Select panel & start</div>' +
        '<button id="fbp-go" style="width:100%;padding:10px;border:0;background:#2374E1;color:#fff;border-radius:6px;cursor:pointer;font-weight:600">Select Panel & Start</button>' +
        '<div style="font-size:11px;opacity:.65;margin-top:6px">Open the Likes/Comments/Shares dialog first, then click this and click inside it.</div>' +
      '</div>' +
      '<div id="fbp-stats" style="display:flex;gap:6px;justify-content:space-between">' +
        '<div style="flex:1;background:#3A3B3C;border-radius:6px;padding:8px;text-align:center">' +
          '<div style="opacity:.75;font-size:11px">Likes</div><div id="fbp-likec" style="font-weight:700">0</div>' +
        '</div>' +
        '<div style="flex:1;background:#3A3B3C;border-radius:6px;padding:8px;text-align:center">' +
          '<div style="opacity:.75;font-size:11px">Comments</div><div id="fbp-commentc" style="font-weight:700">0</div>' +
        '</div>' +
        '<div style="flex:1;background:#3A3B3C;border-radius:6px;padding:8px;text-align:center">' +
          '<div style="opacity:.75;font-size:11px">Shares</div><div id="fbp-sharec" style="font-weight:700">0</div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;opacity:.8;margin:8px 0 6px">Preview (first 50)</div>' +
        '<div id="fbp-prev" style="max-height:240px;overflow:auto;border:1px solid #3A3B3C;border-radius:6px;background:#18191a"></div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button id="fbp-dl" style="flex:1;padding:8px;border:0;background:#2DCE89;color:#0B1017;border-radius:6px;cursor:pointer;font-weight:700">Download Merged CSV</button>' +
        '<button id="fbp-reset" style="padding:8px;border:0;background:#3A3B3C;color:#E4E6EB;border-radius:6px;cursor:pointer">Reset (this post)</button>' +
        '<button id="fbp-exit" style="padding:8px;border:0;background:#3A3B3C;color:#E4E6EB;border-radius:6px;cursor:pointer">Exit</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ui);

  // Drag (grab the top bar)
  (function drag(panel, handle){
    let dragging=false, sx=0, sy=0, baseL=0, baseT=0;
    handle.addEventListener('mousedown', e=>{
      dragging=true; handle.style.cursor='grabbing';
      const r=panel.getBoundingClientRect(); baseL=r.left; baseT=r.top; sx=e.clientX; sy=e.clientY;
      panel.style.left=r.left+'px'; panel.style.top=r.top+'px'; panel.style.right='auto';
      e.preventDefault();
    }, true);
    document.addEventListener('mousemove', e=>{
      if(!dragging) return;
      let nx=baseL+(e.clientX-sx), ny=baseT+(e.clientY-sy);
      nx=Math.max(8,Math.min(window.innerWidth-panel.offsetWidth-8,nx));
      ny=Math.max(8,Math.min(window.innerHeight-panel.offsetHeight-8,ny));
      panel.style.left=nx+'px'; panel.style.top=ny+'px';
    }, true);
    document.addEventListener('mouseup', ()=>{ dragging=false; handle.style.cursor='grab'; }, true);
  })(ui, ui.querySelector('#fbp-drag'));

  const modes=[{key:'likes',label:'Likes'},{key:'comments',label:'Comments'},{key:'shares',label:'Shares'}];
  const modeWrap=ui.querySelector('#fbp-modes');
  let activeMode='likes'; const modeButtons={};
  function setActiveMode(k){ activeMode=k; Object.values(modeButtons).forEach(el=>el.style.outline=''); if(modeButtons[k]) modeButtons[k].style.outline='2px solid #2374E1'; }
  modes.forEach(m=>{
    const b=document.createElement('button');
    Object.assign(b.style,{padding:'6px 10px',borderRadius:'999px',border:'1px solid #3A3B3C',background:'#3A3B3C',color:'#E4E6EB',cursor:'pointer'});
    b.textContent=m.label; b.dataset.mode=m.key; b.addEventListener('click',()=>setActiveMode(m.key));
    modeWrap.appendChild(b); modeButtons[m.key]=b;
  });
  setActiveMode('likes');

  const prevBox=ui.querySelector('#fbp-prev');
  const likeC=ui.querySelector('#fbp-likec');
  const commentC=ui.querySelector('#fbp-commentc');
  const shareC=ui.querySelector('#fbp-sharec');
  const postKeyEl=ui.querySelector('#fbp-postkey');
  const copyBtn=ui.querySelector('#fbp-copy');

  function toast(msg,ms=1400){
    const t=document.createElement('div');
    Object.assign(t.style,{position:'fixed',top:'14px',left:'50%',transform:'translateX(-50%)',background:'#18191a',color:'#E4E6EB',padding:'8px 12px',borderRadius:'6px',zIndex:2147483647,border:'1px solid #3A3B3C'});
    t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),ms);
  }

  // ===== Storage =====
  let POST_URL=location.href;
  function postKeyFromURL(u){ try{const x=new URL(u); x.hash=''; return x.toString();}catch{ return u; } }
  let POST_KEY=postKeyFromURL(POST_URL);
  function setPostKeyLabel(){
    postKeyEl.title=POST_KEY;
    const s=POST_KEY, n=48; postKeyEl.textContent = s.length>n? (s.slice(0,30)+'…'+s.slice(-15)) : s;
  }
  setPostKeyLabel();
  copyBtn.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(POST_URL); toast('Post URL copied'); }catch{ toast('Copy failed'); } });

  const store=new Map(); const counts={likes:0,comments:0,shares:0};
  function resetForThisPost(){ store.clear(); counts.likes=counts.comments=counts.shares=0; updateStats(); renderPreview(); }

  // ===== Helpers =====
  function isScrollableY(n){const cs=getComputedStyle(n); return /(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+20;}
  function closestScrollable(n){for(let p=n;p;p=p.parentElement) if(isScrollableY(p)) return p; return null;}
  let sc=null;

  function normalizeFB(href){
    try{
      const u=new URL(href,'https://www.facebook.com');
      if(/^l\.facebook\.com$|^lm\.facebook\.com$/i.test(u.hostname)){ const redir=u.searchParams.get('u'); if(redir) return normalizeFB(decodeURIComponent(redir)); }
      u.protocol='https:'; u.hostname='www.facebook.com'; u.hash='';
      if(u.pathname==='/profile.php'){ const id=u.searchParams.get('id'); if(!id) return null; u.search='?id='+encodeURIComponent(id); } else { u.search=''; }
      u.pathname=u.pathname.replace(/\/+/g,'/').replace(/\/$/,''); return u.toString();
    }catch{ return null; }
  }
  function looksLikeProfile(url){
    try{
      const p=new URL(url).pathname.toLowerCase();
      if(p==='/profile.php') return true;
      if(/^\/people\/[^/]+\/\d+$/.test(p)) return true;
      if(/^\/[a-z0-9.\-_]+$/.test(p)){ const bad=new Set(['events','groups','pages','marketplace','watch','gaming','reel','reels','photo','photos','videos','privacy','help','settings','notifications','bookmarks','messages','friends','stories','story.php','permalink.php','ufi','reactions','posts','share']); return !bad.has(p.slice(1)); }
      return false;
    }catch{ return false; }
  }
  const isVisible=el=>{ const r=el.getBoundingClientRect(), cs=getComputedStyle(el); return r.width>0 && r.height>0 && cs.visibility==='visible' && cs.display!=='none'; };
  const inMessageBody=a=>!!(a.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"]'));
  const isCommentArticleNode=n=>{ const art=n.closest && n.closest('[role="article"]'); if(!art) return false; const al=(art.getAttribute('aria-label')||'').toLowerCase(); return al.startsWith('comment by')||al.startsWith('reply by'); };
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
    const withText=anchors.find(a=> (a.textContent||'').trim() && looksLikeProfile(normalizeFB(a.getAttribute('href'))));
    return withText || anchors[0] || null;
  }
  function commentArticles(){ return Array.from(sc.querySelectorAll('[role="article"][aria-label^="Comment by "]')).filter(isVisible); }
  function pickCommentAnchor(article){
    const candidates=Array.from(article.querySelectorAll('a[href]')).filter(isVisible);
    for(const a of candidates){
      if(inMessageBody(a)) continue;
      const url=normalizeFB(a.getAttribute('href')); if(!looksLikeProfile(url)) continue;
      const txt=(a.textContent||'').trim(); if(!txt) continue;
      if(/\bago\b/i.test(txt) || /^[0-9]+\s*[smhdw]$/i.test(txt)) continue;
      if(!isCommentArticleNode(a)) continue;
      return a;
    }
    return null;
  }
  function sharerAnchors(){
    const candidates=Array.from(sc.querySelectorAll('[data-ad-rendering-role="profile_name"] a[href], h3 a[href]')).filter(isVisible);
    return candidates.filter(a=>{
      if(inMessageBody(a)) return false;
      if(isCommentArticleNode(a)) return false;
      const url=normalizeFB(a.getAttribute('href')); if(!looksLikeProfile(url)) return false;
      const txt=(a.textContent||'').trim(); if(!txt) return false;
      if(/\bago\b/i.test(txt) || /^[0-9]+\s*[smhdw]$/i.test(txt)) return false;
      const ok=a.closest('[data-ad-rendering-role="profile_name"]') || a.closest('h1,h2,h3');
      return !!ok;
    });
  }

  function updateStats(){ likeC.textContent=counts.likes; commentC.textContent=counts.comments; shareC.textContent=counts.shares; }
  function upsertRow(name,url,mode){
    if(!name||!url) return; if(!looksLikeProfile(url)) return;
    const key=url;
    const existing=store.get(key)||{Person_Name:name,Person:url,Like:'No',Share:'No',Comment:'No',Publication_URL:POST_URL};
    if(name && (!existing.Person_Name || existing.Person_Name.length<name.length)) existing.Person_Name=name;
    if(mode==='likes') existing.Like='Yes';
    if(mode==='comments') existing.Comment='Yes';
    if(mode==='shares') existing.Share='Yes';
    existing.Publication_URL=POST_URL;
    store.set(key,existing);
  }

  let lastRender=0;
  function maybeRender(force=false){ const now=Date.now(); if(force || now-lastRender>600){ renderPreview(); lastRender=now; } else { updateStats(); } }
  function renderPreview(){
    const rows=Array.from(store.values());
    let head =
      '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;color:#E4E6EB">' +
        '<thead>' +
          '<tr style="position:sticky;top:0;background:#242526">' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid #3A3B3C">Person_Name</th>' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid #3A3B3C">Person</th>' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid #3A3B3C">Like</th>' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid #3A3B3C">Share</th>' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid #3A3B3C">Comment</th>' +
            '<th style="text-align:left;padding:6px;border-bottom:1px solid #3A3B3C">Publication_URL</th>' +
          '</tr>' +
        '</thead><tbody>';
    let body='';
    for(let i=0;i<Math.min(rows.length,50);i++){
      const r=rows[i];
      body += '<tr>' +
        '<td style="padding:6px;border-bottom:1px solid #3A3B3C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHTML(r.Person_Name)+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3A3B3C;white-space:normal;overflow-wrap:anywhere"><a href="'+r.Person+'" target="_blank" style="color:#8ab4ff">'+shorten(r.Person,40)+'</a></td>' +
        '<td style="padding:6px;border-bottom:1px solid #3A3B3C">'+r.Like+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3A3B3C">'+r.Share+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3A3B3C">'+r.Comment+'</td>' +
        '<td style="padding:6px;border-bottom:1px solid #3A3B3C;white-space:normal;overflow-wrap:anywhere"><a href="'+r.Publication_URL+'" target="_blank" style="color:#8ab4ff">'+shorten(r.Publication_URL,42)+'</a></td>' +
      '</tr>';
    }
    prevBox.innerHTML=head+body+'</tbody></table>'; updateStats();
  }
  function escapeHTML(s){ return (s||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
  function shorten(s,n){ s=String(s||''); return s.length>n ? (s.slice(0,n-1)+'…') : s; }

  function downloadMerged(){
    const rows=Array.from(store.values());
    const header='Person_Name,Person,Like,Share,Comment,Publication_URL\n';
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const body=rows.map(r=>[q(r.Person_Name),q(r.Person),q(r.Like),q(r.Share),q(r.Comment),q(r.Publication_URL)].join(',')).join('\n');
    const blob=new Blob([header+body],{type:'text/csv'});
    const link=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'facebook_engagements_export_from_fb.csv'});
    document.body.appendChild(link); link.click(); link.remove();
  }

  // ===== Panel detection / guards =====
  function detectPanelType(container){
    const dlg=container.closest && container.closest('[role="dialog"]');
    const label=(dlg?.getAttribute('aria-label')||'').toLowerCase();
    if(label.includes('comment')) return 'comments';
    if(label.includes('share'))   return 'shares';
    if(label.includes('reaction')||label.includes('reacted')||label.includes('like')) return 'likes';
    if(container.querySelector && container.querySelector('[role="article"][aria-label^="Comment by "]')) return 'comments';
    const hasSharerHdr=container.querySelector && container.querySelector('[data-ad-rendering-role="profile_name"] a[href], h3 a[href]');
    if(hasSharerHdr) return 'shares';
    return 'unknown';
  }
  function ensureExpected(expected){ return detectPanelType(sc)===expected; }

  let runToken=0;
  function setUIBusy(b){ ui.querySelector('#fbp-go').disabled=b; Object.values(modeButtons).forEach(x=>x.disabled=b); ui.querySelector('#fbp-go').style.opacity=b?.7:1; }

  ui.querySelector('#fbp-go').addEventListener('click', async ()=>{
    toast('Click inside the open panel…', 1200);
    const ev = await new Promise(res=>{ const h=e=>{document.removeEventListener('click',h,true);res(e)}; document.addEventListener('click',h,true); });
    const seed=ev.target;
    let c=closestScrollable(seed);
    if(!c){
      const dlg=seed.closest && (seed.closest('[role="dialog"],[aria-modal="true"]')||document.querySelector('[role="dialog"][aria-modal="true"]'));
      if(dlg){ c=Array.from(dlg.querySelectorAll('*')).find(isScrollableY)||dlg; }
    }
    sc=c||document.scrollingElement||document.body;

    const detected=detectPanelType(sc);
    if(detected==='unknown'){ toast('Not a Likes/Comments/Shares panel.', 1800); return; }
    if(detected!==activeMode){ setActiveMode(detected); toast('Detected '+detected+' — switched mode.', 1200); }

    const myToken=++runToken; setUIBusy(true); toast('Collecting…', 900);

    POST_URL=location.href; POST_KEY=postKeyFromURL(POST_URL); setPostKeyLabel();

    if(activeMode==='likes')        await runLikes(myToken);
    else if(activeMode==='comments') await runComments(myToken);
    else                             await runShares(myToken);

    if(myToken!==runToken){ setUIBusy(false); return; }
    setUIBusy(false);
    const hasAll=counts.likes>0 && counts.comments>0 && counts.shares>0;
    if(hasAll){ toast('All three collected — downloading…', 1200); downloadMerged(); } else { toast('Done ✓'); }
  });

  ui.querySelector('#fbp-dl').addEventListener('click', downloadMerged);
  ui.querySelector('#fbp-reset').addEventListener('click', ()=>{ resetForThisPost(); toast('Cleared for this post.'); });
  ui.querySelector('#fbp-exit').addEventListener('click', ()=>ui.remove());

  // ===== Faster end conditions =====
  function atBottom(el){ return (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 2); }

  async function runLikes(token){
    let prevH=-1, stable=0, seenRun=new Set(), noNew=0;
    for(let i=0;i<360 && stable<3;i++){
      if(token!==runToken) return;
      if(!ensureExpected('likes')){ toast('Panel switched — stopped Likes.', 1200); return; }

      let grew=false;
      likeItems().forEach(it=>{
        const a=pickLikeAnchor(it); if(!a) return;
        const url=normalizeFB(a.getAttribute('href')); if(!url) return;
        if(seenRun.has(url)) return; seenRun.add(url);
        const name=getNameFromAnchor(a);
        const before=store.size; upsertRow(name,url,'likes'); if(store.size>before) grew=true;
      });

      if(grew) noNew=0; else noNew++;
      if((noNew>=2 && atBottom(sc)) || (noNew>=4 && i>10)){ break; }

      counts.likes=Array.from(store.values()).filter(r=>r.Like==='Yes').length;
      maybeRender(grew);
      sc.scrollTo(0, sc.scrollHeight);
      await sleep(550);
      const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
      if(!document.body.contains(sc)) { toast('Panel closed — stopped.', 1200); return; }
    }
    maybeRender(true);
  }

  async function runComments(token){
    if(!ensureExpected('comments')){ toast('This panel doesn’t look like the main Comments list.', 1600); return; }
    let prevH=-1, stable=0, seenRun=new Set(), noNew=0;
    for(let i=0;i<360 && stable<3;i++){
      if(token!==runToken) return;
      if(!ensureExpected('comments')){ toast('Panel switched — stopped Comments.', 1200); return; }

      let grew=false;
      commentArticles().forEach(art=>{
        const a=pickCommentAnchor(art); if(!a) return;
        const url=normalizeFB(a.getAttribute('href')); if(!url) return;
        if(seenRun.has(url)) return; seenRun.add(url);
        const name=getNameFromAnchor(a);
        const before=store.size; upsertRow(name,url,'comments'); if(store.size>before) grew=true;
      });

      if(grew) noNew=0; else noNew++;
      if((noNew>=2 && atBottom(sc)) || (noNew>=4 && i>12)){ break; }

      sc.querySelectorAll('div[role="button"],button').forEach(b=>{
        const t=(b.innerText||'').toLowerCase();
        if(t.includes('view more comment')||t.includes('more comments')||t.includes('replies')) b.click();
      });

      counts.comments=Array.from(store.values()).filter(r=>r.Comment==='Yes').length;
      maybeRender(grew);
      sc.scrollTo(0, sc.scrollHeight);
      await sleep(700);
      const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
      if(!document.body.contains(sc)) { toast('Panel closed — stopped.', 1200); return; }
    }
    maybeRender(true);
  }

  async function runShares(token){
    let prevH=-1, stable=0, seenRun=new Set(), noNew=0;
    for(let i=0;i<360 && stable<3;i++){
      if(token!==runToken) return;
      if(!ensureExpected('shares')){ toast('Panel switched — stopped Shares.', 1200); return; }

      let grew=false;
      const anchors=sharerAnchors();
      anchors.forEach(a=>{
        const url=normalizeFB(a.getAttribute('href')); if(!url) return;
        if(seenRun.has(url)) return; seenRun.add(url);
        const name=getNameFromAnchor(a);
        const before=store.size; upsertRow(name,url,'shares'); if(store.size>before) grew=true;
      });

      if(grew) noNew=0; else noNew++;
      if((noNew>=2 && atBottom(sc)) || (noNew>=4 && i>12)){ break; }

      counts.shares=Array.from(store.values()).filter(r=>r.Share==='Yes').length;
      maybeRender(grew);
      sc.scrollTo(0, sc.scrollHeight);
      await sleep(550);
      const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
      if(!document.body.contains(sc)) { toast('Panel closed — stopped.', 1200); return; }
    }
    maybeRender(true);
  }

  // initial preview
  renderPreview();
})();
