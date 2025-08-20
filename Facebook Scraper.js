(async function FB_Export_Persons_UNIFIED_v14a(){
const sleep = ms => new Promise(r => setTimeout(r, ms));
// ===== UI =====
const ui = document.createElement('div');
Object.assign(ui.style, {
  position:'fixed', inset:'16px 16px auto auto', width:'360px',
  background:'#0f1115', color:'#e6e6e6', font:'12px system-ui, -apple-system, Segoe UI, Roboto',
  border:'1px solid #2a2f3a', borderRadius:'12px', boxShadow:'0 10px 30px rgba(0,0,0,.45)',
  zIndex:2147483647, padding:'12px'
});
ui.innerHTML =
  '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
    '<div style="font-weight:700">FB People Scraper</div>' +
    '<div style="margin-left:auto;opacity:.7" id="fbp-postkey"></div>' +
  '</div>' +
  '<div style="display:grid;gap:8px">' +
    '<div>' +
      '<div style="font-size:11px;opacity:.8;margin-bottom:6px">1) Choose what to collect</div>' +
      '<div id="fbp-modes" style="display:flex;gap:6px;flex-wrap:wrap"></div>' +
    '</div>' +
    '<div>' +
      '<div style="font-size:11px;opacity:.8;margin-bottom:6px">2) Select panel & start</div>' +
      '<button id="fbp-go" style="width:100%;padding:10px;border:1px solid #3b7cff;background:#2353ff;color:white;border-radius:8px;cursor:pointer;font-weight:600">Select Panel & Start</button>' +
      '<div style="font-size:11px;opacity:.6;margin-top:4px">Tip: open the Likes/Comments/Shares dialog first, then click this and click inside it.</div>' +
    '</div>' +
    '<div id="fbp-stats" style="display:flex;gap:6px;justify-content:space-between">' +
      '<div style="flex:1;background:#141823;border:1px solid #293042;border-radius:8px;padding:8px;text-align:center">' +
        '<div style="opacity:.65;font-size:11px">Likes</div><div id="fbp-likec" style="font-weight:700">0</div>' +
      '</div>' +
      '<div style="flex:1;background:#141823;border:1px solid #293042;border-radius:8px;padding:8px;text-align:center">' +
        '<div style="opacity:.65;font-size:11px">Comments</div><div id="fbp-commentc" style="font-weight:700">0</div>' +
      '</div>' +
      '<div style="flex:1;background:#141823;border:1px solid #293042;border-radius:8px;padding:8px;text-align:center">' +
        '<div style="opacity:.65;font-size:11px">Shares</div><div id="fbp-sharec" style="font-weight:700">0</div>' +
      '</div>' +
    '</div>' +
    '<div>' +
      '<div style="font-size:11px;opacity:.8;margin:8px 0 6px">Preview (first 50)</div>' +
      '<div id="fbp-prev" style="max-height:240px;overflow:auto;border:1px solid #293042;border-radius:8px"></div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button id="fbp-dl" style="flex:1;padding:8px;border:1px solid #2c8a3f;background:#1d7a31;color:#fff;border-radius:8px;cursor:pointer;font-weight:600">Download Merged CSV</button>' +
      '<button id="fbp-reset" style="padding:8px;border:1px solid #444;background:#181b22;color:#e6e6e6;border-radius:8px;cursor:pointer">Reset (this post)</button>' +
      '<button id="fbp-exit" style="padding:8px;border:1px solid #444;background:#181b22;color:#e6e6e6;border-radius:8px;cursor:pointer">Exit</button>' +
    '</div>' +
  '</div>';
document.body.appendChild(ui);
const modes = [
  {key:'likes', label:'Likes'},
  {key:'comments', label:'Comments'},
  {key:'shares', label:'Shares'}
];
const modeWrap = ui.querySelector('#fbp-modes');
let activeMode = 'likes';
const modeButtons = {};
function setActiveMode(k){
  activeMode = k;
  Object.values(modeButtons).forEach(el=>el.style.outline='');
  if(modeButtons[k]) modeButtons[k].style.outline='2px solid #3b7cff';
}
modes.forEach(m=>{
  const b=document.createElement('button');
  Object.assign(b.style,{padding:'6px 10px',borderRadius:'8px',border:'1px solid #384155',background:'#171a20',color:'#e6e6e6',cursor:'pointer'});
  b.textContent = m.label;
  b.dataset.mode = m.key;
  b.addEventListener('click',()=>setActiveMode(m.key));
  modeWrap.appendChild(b);
  modeButtons[m.key]=b;
});
setActiveMode('likes');
const prevBox   = ui.querySelector('#fbp-prev');
const likeC     = ui.querySelector('#fbp-likec');
const commentC  = ui.querySelector('#fbp-commentc');
const shareC    = ui.querySelector('#fbp-sharec');
const postKeyEl = ui.querySelector('#fbp-postkey');
function toast(msg, ms){
  if(ms==null) ms=1600;
  const t=document.createElement('div');
  Object.assign(t.style,{position:'fixed',top:'14px',left:'50%',transform:'translateX(-50%)',background:'#111',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:2147483647,boxShadow:'0 8px 20px rgba(0,0,0,.4)'});
  t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),ms);
}
// ===== Storage (per-post) =====
let POST_URL = location.href;
function postKeyFromURL(u){ try{ const x=new URL(u); x.hash=''; return x.toString(); } catch(e){ return u; } }
let POST_KEY = postKeyFromURL(POST_URL);
postKeyEl.textContent = 'post key: ' + (POST_KEY.length>42? (POST_KEY.slice(0,42)+'…'): POST_KEY);
const store = new Map();
const counts = {likes:0, comments:0, shares:0};
function resetForThisPost(){
  store.clear();
  counts.likes = counts.comments = counts.shares = 0;
  updateStats(); renderPreview();
}
// ===== Helpers / selectors =====
function isScrollableY(n){const cs=getComputedStyle(n); return /(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+20;}
function closestScrollable(n){for(let p=n;p;p=p.parentElement) if(isScrollableY(p)) return p; return null;}
let sc = null;
function normalizeFB(href){
  try{
    const u=new URL(href,'https://www.facebook.com');
    if(/^l\.facebook\.com$|^lm\.facebook\.com$/i.test(u.hostname)){
      const redir=u.searchParams.get('u'); if(redir) return normalizeFB(decodeURIComponent(redir));
    }
    u.protocol='https:'; u.hostname='www.facebook.com'; u.hash='';
    if(u.pathname==='/profile.php'){
      const id=u.searchParams.get('id'); if(!id) return null;
      u.search='?id='+encodeURIComponent(id);
    } else {
      u.search='';
    }
    u.pathname=u.pathname.replace(/\/+/g,'/').replace(/\/$/,'');
    return u.toString();
  }catch(e){ return null; }
}
function looksLikeProfile(url){
  try{
    const p=new URL(url).pathname.toLowerCase();
    if(p==='/profile.php') return true;
    if(/^\/people\/[^/]+\/\d+$/.test(p)) return true;
    if(/^\/[a-z0-9.\-_]+$/.test(p)){
      const bad=new Set(['events','groups','pages','marketplace','watch','gaming','reel','reels','photo','photos','videos','privacy','help','settings','notifications','bookmarks','messages','friends','stories','story.php','permalink.php','ufi','reactions','posts','share']);
      return !bad.has(p.slice(1));
    }
    return false;
  }catch(e){ return false; }
}
const isVisible = el => { const r=el.getBoundingClientRect(), cs=getComputedStyle(el); return r.width>0 && r.height>0 && cs.visibility==='visible' && cs.display!=='none'; };
const inMessageBody = a => !!(a.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"]'));
const isCommentArticleNode = n => {
  const art=n.closest && n.closest('[role="article"]'); if(!art) return false;
  const al=(art.getAttribute('aria-label')||'').toLowerCase();
  return al.startsWith('comment by') || al.startsWith('reply by');
};
function cleanName(s){
  if(!s) return '';
  s = s.replace(/\b(profile|cover)\s+(picture|photo)\s+(of|for)\s*/ig,'');
  s = s.replace(/\s*[·•]\s*\d+\s*[smhdw]\b.*$/i,'');
  s = s.replace(/\s*\b(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b.*$/i,'');
  return s.trim();
}
function getNameFromAnchor(a){
  const t=(a.textContent||'').trim(); if(t) return cleanName(t);
  const al=a.getAttribute('aria-label'); if(al) return cleanName(al);
  const imgLabel=a.querySelector('[aria-label]')?.getAttribute('aria-label'); if(imgLabel) return cleanName(imgLabel);
  const imgAlt=a.querySelector('img[alt]')?.getAttribute('alt'); if(imgAlt) return cleanName(imgAlt);
  return '';
}
function likeItems(){ return Array.from(sc.querySelectorAll('[role="listitem"],[data-visualcompletion="ignore-dynamic"]')).filter(isVisible); }
function pickLikeAnchor(item){
  const header = item.querySelector('[data-ad-rendering-role="profile_name"] a[href]');
  if(header) return header;
  const anchors = Array.from(item.querySelectorAll('a[href]')).filter(isVisible);
  const withText = anchors.find(a => (a.textContent||'').trim() && looksLikeProfile(normalizeFB(a.getAttribute('href'))));
  return withText || anchors[0] || null;
}
function commentArticles(){ return Array.from(sc.querySelectorAll('[role="article"][aria-label^="Comment by "]')).filter(isVisible); }
function pickCommentAnchor(article){
  const candidates = Array.from(article.querySelectorAll('a[href]')).filter(isVisible);
  for(let i=0;i<candidates.length;i++){
    const a=candidates[i];
    if(inMessageBody(a)) continue;
    const url = normalizeFB(a.getAttribute('href')); if(!looksLikeProfile(url)) continue;
    const txt = (a.textContent||'').trim(); if(!txt) continue;
    if(/\bago\b/i.test(txt) || /^[0-9]+\s*[smhdw]$/i.test(txt)) continue;
    return a;
  }
  return null;
}
function sharerAnchors(){
  const candidates = Array.from(sc.querySelectorAll('[data-ad-rendering-role="profile_name"] a[href], h3 a[href]')).filter(isVisible);
  return candidates.filter(a=>{
    if(inMessageBody(a)) return false;
    if(isCommentArticleNode(a)) return false;
    const url = normalizeFB(a.getAttribute('href')); if(!looksLikeProfile(url)) return false;
    const txt=(a.textContent||'').trim(); if(!txt) return false;
    if(/\bago\b/i.test(txt) || /^[0-9]+\s*[smhdw]$/i.test(txt)) return false;
    const ok = a.closest('[data-ad-rendering-role="profile_name"]') || a.closest('h1,h2,h3');
    return !!ok;
  });
}
function updateStats(){
  likeC.textContent = counts.likes;
  commentC.textContent = counts.comments;
  shareC.textContent = counts.shares;
}
function upsertRow(name,url,mode){
  if(!name||!url) return;
  if(!looksLikeProfile(url)) return;
  const key=url;
  const existing = store.get(key) || {
    Person_Name:name,
    Person:url,
    Like:'No', Share:'No', Comment:'No',
    Publication_URL: POST_URL
  };
  if(name && (!existing.Person_Name || existing.Person_Name.length < name.length)) existing.Person_Name = name;
  if(mode==='likes') existing.Like='Yes';
  if(mode==='comments') existing.Comment='Yes';
  if(mode==='shares') existing.Share='Yes';
  existing.Publication_URL = POST_URL;
  store.set(key, existing);
}
let lastRender = 0;
function maybeRender(force){
  if(force==null) force=false;
  const now = Date.now();
  if(force || now - lastRender > 1000){ renderPreview(); lastRender = now; } else { updateStats(); }
}
function renderPreview(){
  const rows = Array.from(store.values());
  var head =
    '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px">' +
      '<thead>' +
        '<tr style="position:sticky;top:0;background:#10131a">' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #2b3344">Person_Name</th>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #2b3344">Person</th>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #2b3344">Like</th>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #2b3344">Share</th>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #2b3344">Comment</th>' +
          '<th style="text-align:left;padding:6px;border-bottom:1px solid #2b3344">Publication_URL</th>' +
        '</tr>' +
      '</thead><tbody>';
  var body = '';
  for(let i=0;i<Math.min(rows.length,50);i++){
    const r=rows[i];
    body += '<tr>' +
      '<td style="padding:6px;border-bottom:1px solid #222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHTML(r.Person_Name)+'</td>' +
      '<td style="padding:6px;border-bottom:1px solid #222;white-space:normal;overflow-wrap:anywhere"><a href="'+r.Person+'" target="_blank" style="color:#8ab4ff">'+shorten(r.Person,40)+'</a></td>' +
      '<td style="padding:6px;border-bottom:1px solid #222">'+r.Like+'</td>' +
      '<td style="padding:6px;border-bottom:1px solid #222">'+r.Share+'</td>' +
      '<td style="padding:6px;border-bottom:1px solid #222">'+r.Comment+'</td>' +
      '<td style="padding:6px;border-bottom:1px solid #222;white-space:normal;overflow-wrap:anywhere"><a href="'+r.Publication_URL+'" target="_blank" style="color:#8ab4ff">'+shorten(r.Publication_URL,42)+'</a></td>' +
    '</tr>';
  }
  prevBox.innerHTML = head + body + '</tbody></table>';
  updateStats();
}
function escapeHTML(s){ return (s||'').replace(/[&<>"]/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]); }); }
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
function detectPanelType(container){
  const dlg = container.closest && container.closest('[role="dialog"]');
  const label = (dlg?.getAttribute('aria-label')||'').toLowerCase();
  if(label.includes('comment')) return 'comments';
  if(label.includes('share'))   return 'shares';
  if(label.includes('reaction') || label.includes('reacted') || label.includes('like')) return 'likes';
  if(container.querySelector && container.querySelector('[role="article"][aria-label^="Comment by "]')) return 'comments';
  const hasSharerHdr = container.querySelector && container.querySelector('[data-ad-rendering-role="profile_name"] a[href], h3 a[href]');
  if(hasSharerHdr) return 'shares';
  return 'unknown';
}
let runToken = 0;
function setUIBusy(busy){
  ui.querySelector('#fbp-go').disabled = busy;
  Object.values(modeButtons).forEach(b=>b.disabled=busy);
  ui.querySelector('#fbp-go').style.opacity = busy ? .7 : 1;
}
ui.querySelector('#fbp-go').addEventListener('click', async function(){
  toast('Click inside the open panel…', 1800);
  const ev = await new Promise(function(res){
    const h=function(e){document.removeEventListener('click',h,true);res(e)}; document.addEventListener('click',h,true);
  });
  const seed = ev.target;
  let c = closestScrollable(seed);
  if(!c){
    const dlg = seed.closest && (seed.closest('[role="dialog"],[aria-modal="true"]') || document.querySelector('[role="dialog"][aria-modal="true"]'));
    if(dlg){ c = Array.from(dlg.querySelectorAll('*')).find(isScrollableY) || dlg; }
  }
  sc = c || document.scrollingElement || document.body;
  const detected = detectPanelType(sc);
  if(detected !== 'unknown' && detected !== activeMode){
    setActiveMode(detected);
    toast('Detected ' + detected + ' panel — switching mode.', 1400);
  }
  const myToken = ++runToken;
  setUIBusy(true);
  toast('Panel selected ✓ Collecting…', 1000);
  // lock post URL/key for this run
  POST_URL = location.href;
  POST_KEY = postKeyFromURL(POST_URL);
  postKeyEl.textContent = 'post key: ' + (POST_KEY.length>42? (POST_KEY.slice(0,42)+'…'): POST_KEY);
  if(activeMode==='likes')        await runLikes(myToken);
  else if(activeMode==='comments') await runComments(myToken);
  else                             await runShares(myToken);
  if(myToken !== runToken){ setUIBusy(false); return; }
  setUIBusy(false);
  const hasAll = counts.likes>0 && counts.comments>0 && counts.shares>0;
  if(hasAll){ toast('All three collected — downloading merged CSV…', 1400); downloadMerged(); }
  else { toast('Done for this mode ✓'); }
});
ui.querySelector('#fbp-dl').addEventListener('click', downloadMerged);
ui.querySelector('#fbp-reset').addEventListener('click', function(){ resetForThisPost(); toast('Cleared for this post.'); });
ui.querySelector('#fbp-exit').addEventListener('click', function(){ ui.remove(); });
async function runLikes(token){
  let prevH=-1, stable=0, seenRun=new Set();
  for(let i=0;i<420 && stable<8;i++){
    if(token !== runToken) return;
    let grew=false;
    likeItems().forEach(it=>{
      const a = pickLikeAnchor(it); if(!a) return;
      const url=normalizeFB(a.getAttribute('href')); if(!url) return;
      if(seenRun.has(url)) return; seenRun.add(url);
      const name=getNameFromAnchor(a);
      const before = store.size;
      upsertRow(name,url,'likes');
      if(store.size>before) grew=true;
    });
    counts.likes = Array.from(store.values()).filter(r=>r.Like==='Yes').length;
    maybeRender(grew);
    sc.scrollTo(0, sc.scrollHeight);
    await sleep(700);
    const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
  }
  maybeRender(true);
}
async function runComments(token){
  let prevH=-1, stable=0, seenRun=new Set();
  if(detectPanelType(sc) !== 'comments'){
    toast('This panel doesn’t look like the main Comments list; aborting comments run.', 2000);
    return;
  }
  for(let i=0;i<420 && stable<8;i++){
    if(token !== runToken) return;
    let grew=false;
    commentArticles().forEach(art=>{
      const a = pickCommentAnchor(art); if(!a) return;
      const url=normalizeFB(a.getAttribute('href')); if(!url) return;
      if(seenRun.has(url)) return; seenRun.add(url);
      const name=getNameFromAnchor(a);
      const before = store.size;
      upsertRow(name,url,'comments');
      if(store.size>before) grew=true;
    });
    sc.querySelectorAll('div[role="button"],button').forEach(b=>{
      const t=(b.innerText||'').toLowerCase();
      if(t.includes('view more comment')||t.includes('more comments')||t.includes('replies')) b.click();
    });
    counts.comments = Array.from(store.values()).filter(r=>r.Comment==='Yes').length;
    maybeRender(grew);
    sc.scrollTo(0, sc.scrollHeight);
    await sleep(1000);
    const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
  }
  maybeRender(true);
}
async function runShares(token){
  let prevH=-1, stable=0, seenRun=new Set();
  for(let i=0;i<420 && stable<8;i++){
    if(token !== runToken) return;
    let grew=false;
    sharerAnchors().forEach(a=>{
      const url=normalizeFB(a.getAttribute('href')); if(!url) return;
      if(seenRun.has(url)) return; seenRun.add(url);
      const name=getNameFromAnchor(a);
      const before = store.size;
      upsertRow(name,url,'shares');
      if(store.size>before) grew=true;
    });
    counts.shares = Array.from(store.values()).filter(r=>r.Share==='Yes').length;
    maybeRender(grew);
    sc.scrollTo(0, sc.scrollHeight);
    await sleep(700);
    const h=sc.scrollHeight; stable=(h===prevH)?(stable+1):0; prevH=h;
  }
  maybeRender(true);
}
renderPreview();
})();