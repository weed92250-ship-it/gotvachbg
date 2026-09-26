const SITE_URL='https://gotvachbg.pages.dev';
const pages=['/','/categories.html','/about.html','/contacts.html','/privacy.html'];
const recipes=[
'/recipes/kralski-svinski-dzholan-na-baven-ogan-s-tamna-bira-rozmarin-i-karamelizirani-korenoplodni.html',
'/recipes/klasicheski-hrupkavi-triagalni-banichki-sas-sirene-i-krave-maslo.html',
'/recipes/klasicheski-hrupkavi-triagalni-banichki-sas-sirene.html',
'/recipes/krem-supa-ot-tikva.html','/recipes/domashni-mekici.html','/recipes/pecheni-kartofi-s-podpravki.html',
'/recipes/pileshko-s-oriz-na-furna.html','/recipes/shokoladov-keks.html','/recipes/shopska-salata.html',
'/recipes/bob-chorba.html','/recipes/kyufteta-na-furna.html'];
export async function onRequestGet(){const urls=[...pages,...recipes].map(path=>`<url><loc>${SITE_URL}${path}</loc></url>`).join('');
return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{'content-type':'application/xml; charset=UTF-8'}});}
