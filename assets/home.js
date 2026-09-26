const fallbackImage='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000&auto=format&fit=crop&q=85';
const grid=document.querySelector('#recipeGrid');
const searchPanel=document.querySelector('#searchPanel');
const searchGrid=document.querySelector('#searchGrid');
const searchStatus=document.querySelector('#searchStatus');
const input=document.querySelector('#siteSearch');
const form=document.querySelector('#searchForm');
let recipes=[];

function safeImage(src){return src&&src.startsWith('http')&&!src.includes('pollinations.ai')&&!src.includes('[https://')?src:fallbackImage}
function normalize(r){
  return {
    ...r,
    img:r.img||r.image||fallbackImage,
    url:r.url||('/recipe/'+r.id),
    excerpt:r.excerpt||'Домашна рецепта с ясни стъпки и продукти.',
    category:r.category||'Рецепта',
    area:r.area||'Домашна',
    time:r.time||'Време според рецептата',
    ingredients:Array.isArray(r.ingredients)?r.ingredients:[]
  }
}
function card(recipe){
  const title=String(recipe.title||'Рецепта').replace(/"/g,'&quot;');
  const text=String(recipe.excerpt||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<article class="card"><img loading="lazy" src="'+safeImage(recipe.img)+'" alt="'+title+'"><div class="card-body"><span class="tag">'+recipe.category+'</span><h3><a href="'+recipe.url+'">'+recipe.title+'</a></h3><p>'+text+'</p><div class="meta"><span>⏱ '+recipe.time+'</span><span>🌍 '+recipe.area+'</span></div></div></article>'
}
function render(list,target){target.innerHTML=list.length?list.map(card).join(''):'<div class="empty">Няма рецепти за това търсене.</div>'}
function search(q){
  const term=q.trim().toLocaleLowerCase('bg');
  const list=!term?recipes:recipes.filter(r=>[r.title,r.excerpt,r.category,r.area,r.ingredients.map(x=>x.name||'').join(' ')].join(' ').toLocaleLowerCase('bg').includes(term));
  searchPanel.hidden=false;
  searchStatus.textContent=term?'Намерени рецепти: '+list.length:'Всички налични рецепти: '+list.length;
  render(list,searchGrid);
  searchPanel.scrollIntoView({behavior:'smooth',block:'start'})
}
form.addEventListener('submit',e=>{e.preventDefault();search(input.value)});
document.querySelectorAll('[data-search]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.search;search(b.dataset.search)}));

async function loadRecipes(){
  try{
    const api=await fetch('/api/recipes',{cache:'no-store'});
    if(api.ok){const data=await api.json();if(Array.isArray(data)&&data.length)return data.map(normalize)}
  }catch(e){}
  const local=await fetch('/recipes.json');
  return (await local.json()).map(normalize);
}
loadRecipes().then(data=>{recipes=data;render(recipes.slice(0,6),grid)}).catch(()=>{grid.innerHTML='<div class="empty">Рецептите временно не се зареждат.</div>'});
