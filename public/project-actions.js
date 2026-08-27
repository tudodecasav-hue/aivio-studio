(()=>{
const KEY='aivio_projects_v1',CLEAN='aivio_cleanup_v2';
const A=()=>JSON.parse(localStorage.getItem(KEY)||'[]'),S=x=>localStorage.setItem(KEY,JSON.stringify(x));
const enc=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const link=(p,days)=>{const exp=Date.now()+days*86400000;return `${location.origin}/preview.html?data=${encodeURIComponent(enc(p))}&expires=${exp}`};
const findByCard=c=>{const h=c.querySelector('h3');return h?A().find(p=>p.businessName===h.textContent):null};
function refresh(){if(window.render)window.render();setTimeout(inject,30)}
function inject(){document.querySelectorAll('.card').forEach(card=>{if(card.dataset.actionsReady)return;const p=findByCard(card);if(!p)return;card.dataset.actionsReady='1';const row=card.querySelector('.card-actions');if(!row)return;
 const pre=document.createElement('button');pre.textContent='👁 Prévia · 7 dias';pre.title='Gera um link de prévia válido por 7 dias';pre.onclick=()=>preview(p);
 const act=document.createElement('button');act.className='primary';act.textContent=p.active?'✓ Ativo':'⚡ Ativar';act.title='Ativa uma versão pública do site';act.onclick=()=>activate(p);
 const del=document.createElement('button');del.textContent='🗑 Excluir';del.onclick=()=>{if(confirm(`Excluir o projeto “${p.businessName}”?`)){S(A().filter(x=>x.id!==p.id));refresh()}};
 row.append(pre,act,del);
 if(p.previewExpires){const d=new Date(p.previewExpires);const n=document.createElement('div');n.className='quick-note';n.textContent=`Prévia: ${d>new Date()?'válida até '+d.toLocaleDateString('pt-BR'):'expirada'}`;card.appendChild(n)}
 if(p.active&&p.activeUrl){const n=document.createElement('div');n.className='quick-note';n.innerHTML=`Site ativo · <a href="${p.activeUrl}" target="_blank" rel="noopener">abrir site</a>`;card.appendChild(n)}
 })}
function preview(p){const url=link(p,7),xs=A(),i=xs.findIndex(x=>x.id===p.id);p.previewExpires=Date.now()+7*86400000;p.previewUrl=url;xs[i]=p;S(xs);navigator.clipboard?.writeText(url).catch(()=>{});window.open(url,'_blank','noopener');refresh()}
function activate(p){const url=link(p,3650),xs=A(),i=xs.findIndex(x=>x.id===p.id);p.active=true;p.activatedAt=Date.now();p.activeUrl=url;xs[i]=p;S(xs);navigator.clipboard?.writeText(url).catch(()=>{});window.open(url,'_blank','noopener');refresh()}
function cleanup(){if(!localStorage.getItem(CLEAN)){localStorage.removeItem(KEY);localStorage.setItem(CLEAN,'1');if(window.render)window.render()}}
const st=document.createElement('style');st.textContent=`.card-actions{display:flex;flex-wrap:wrap;gap:8px}.card-actions button{min-height:38px}.quick-note a{font-weight:800;text-decoration:underline}.status-dot{font-size:11px}.card[data-actions-ready]{}`;document.head.appendChild(st);
cleanup();new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});setTimeout(inject,100);
window.aivioActions={preview,activate,refresh};
})();
