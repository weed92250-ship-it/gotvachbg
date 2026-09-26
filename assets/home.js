const fallbackImage='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000&auto=format&fit=crop&q=85';
const recipesUrl='/recipes.json';
const grid=document.querySelector('#recipeGrid');
const searchPanel=document.querySelector('#searchPanel');
const searchGrid=document.querySelector('#searchGrid');
const searchStatus=document.querySelector('#searchStatus');
const input=document.querySelector('#siteSearch');
const form=document.querySelector('#searchForm');
let recipes=[];

function safeImage(src){return src && src.startsWith('http') && !src.includes('pollinations.ai') && !src.includes('[https://') ? src : fallbackImage}
function card(recipe){return '<article class="card"><img loading="lazy" src="'+safeImage(recipe.img)+'" alt="'+recipe.title.replace(/"/g,'&quot;')+'"><div class="card-body"><span class="tag">Рецепта</span><h3><a href="'+recipe.url+'">'+recipe.title+'</a></h3><p>Домашна рецепта с ясни стъпки и продукти.</p><div class="meta"><span>⏱ '+recipe.time+'</span><span>🍽 Готвене у дома</span></div></div></article>'}
function render(list,target){target.innerHTML=list.length?list.map(card).join(''):'<div class="empty">Няма рецепти за това търсене.</div>'}
function search(q){const term=q.trim().toLocaleLowerCase('bg');const list=!term?recipes:recipes.filter(r=>r.title.toLocaleLowerCase('bg').includes(term));searchPanel.hidden=false;searchStatus.textContent=term?'Намерени рецепти: '+list.length:'Всички налични рецепти: '+list.length;render(list,searchGrid);searchPanel.scrollIntoView({behavior:'smooth',block:'start'})}
form.addEventListener('submit',e=>{e.preventDefault();search(input.value)})
document.querySelectorAll('[data-search]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.search;search(b.dataset.search)}))
fetch(recipesUrl).then(r=>r.ok?r.json():[]).then(data=>{recipes=Array.isArray(data)?data:[];render(recipes.slice(0,3),grid)}).catch(()=>{grid.innerHTML='<div class="empty">Рецептите временно не се зареждат.</div>'});
