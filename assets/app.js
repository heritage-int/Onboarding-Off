/* Heritage Int — plateforme : clients, professionnels, administration 360 */
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,12);
const clone=o=>JSON.parse(JSON.stringify(o));
const money=(n,cur="EUR")=>{try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:cur,maximumFractionDigits:0}).format(n||0)}catch{return Math.round(n||0)+" "+cur}};
const fdate=d=>d?new Date(d.replace(" ","T")+(d.length<=10?"":"Z")).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}):"";
const STATUTS=["Nouveau","Contacté","Rendez-vous fixé","Devis envoyé","Signé","Sans suite"];
const CATS={full:{t:"Intégration complète",s:"Client à accompagner"},devis:{t:"Devis",s:"Projet à chiffrer"},info:{t:"Information",s:"Prise de contact"}};
const NEXT={full:"Rendez-vous visio d'1 h, proposition d'accompagnement et acompte.",devis:"Appel découverte de 30 min, puis devis définitif sous 5 jours.",info:"Envoyer l'estimation et le portfolio sous 48 h."};
const ACTIVITIES={planner:"Wedding planner",traiteur:"Traiteur / chef",lieu:"Lieu de réception",agence:"Agence événementielle",autre:"Autre activité"};
const CURS=["EUR","CNY","QAR","USD","AED","GBP","CHF"];
let S={csrf:"",user:null,pro:null,plans:{},trial_days:14};

function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3000)}
async function api(a,body,get){
  const opt=body&&!get?{method:"POST",headers:{"Content-Type":"application/json","X-CSRF":S.csrf},body:JSON.stringify(body),credentials:"same-origin"}:{credentials:"same-origin"};
  const r=await fetch("api.php?a="+a+(get&&body?"&"+new URLSearchParams(body):""),opt);let j={};try{j=await r.json()}catch{}
  if(!r.ok){const e=new Error(j.error||"Erreur "+r.status);e.code=r.status;throw e}return j}
async function refreshMe(){const j=await api("me");Object.assign(S,{csrf:j.csrf,user:j.user,pro:j.pro||null,plans:j.plans||{},trial_days:j.trial_days})}
function go(h){if(location.hash===h)route();else location.hash=h}
const main=()=>$("#main");

/* ---------- Navigation ---------- */
function renderNav(){
  const u=S.user,h=location.hash||"#/",l=[];
  if(!u)l.push(["#/","Accueil"],["#/connexion","Connexion"],["#/inscription-client","Créer un compte client"],["#/inscription-pro","Espace professionnel"]);
  else if(u.role==="client")l.push(["#/client","Mes demandes"],["#/compte","Mon compte"]);
  else if(u.role==="pro")l.push(["#/pro","Mon espace pro"],["#/p/"+S.pro.slug,"Ma page client"],["#/compte","Mon compte"]);
  else l.push(["#/admin","Administration 360"],["#/compte","Mon compte"]);
  $("#nav").innerHTML=l.map(([k,t])=>`<a href="${k}" class="${h.startsWith(k)&&k!=="#/"||h===k?"on":""}">${t}</a>`).join("")+(u?`<button id="logout" type="button">Se déconnecter</button>`:"");
  const lo=$("#logout");if(lo)lo.onclick=async()=>{await api("logout",{});await refreshMe();go("#/")}}
function home(u){return u?.role==="client"?"#/client":u?.role==="pro"?"#/pro":u?.role==="admin"?"#/admin":"#/"}

async function route(){
  const h=location.hash||"#/";renderNav();window.scrollTo(0,0);
  try{
    if(h.startsWith("#/p/"))return viewEstimator(decodeURIComponent(h.slice(4)));
    if(h==="#/connexion")return viewLogin();
    if(h==="#/inscription-client")return viewRegister("client");
    if(h==="#/inscription-pro")return viewRegister("pro");
    if(h==="#/compte")return S.user?viewAccount():go("#/connexion");
    if(h==="#/client")return S.user?.role==="client"?viewClient():go("#/connexion");
    if(h.startsWith("#/pro"))return S.user?.role==="pro"?viewPro(h.split("/")[2]||"demandes"):go("#/connexion");
    if(h.startsWith("#/admin"))return S.user?.role==="admin"?viewAdmin(h.split("/")[2]||"vue"):go("#/connexion");
    return viewHome();
  }catch(e){main().innerHTML=`<div class="note bad">${esc(e.message)}</div>`}}

/* ---------- Accueil ---------- */
function plansHtml(sel,name){return `<div class="plans">${Object.entries(S.plans).map(([k,p])=>`<label class="plan ${sel===k?"sel":""} ${k==="pro"?"best":""}">${name?`<input type="radio" name="${name}" value="${k}" ${sel===k?"checked":""}>`:""}<span class="eyebrow">${esc(p.nom)}</span><span class="pr">${money(p.prix)} <small>HT / mois</small></span><span class="muted">${esc(p.desc)}</span></label>`).join("")}</div>`}
function plateArt(){
  const c=200,petals=[...Array(24)].map((_,i)=>`<g transform="rotate(${i*15} ${c} ${c})"><path d="M${c} 24 C ${c+13} 42, ${c+11} 60, ${c} 72 C ${c-11} 60, ${c-13} 42, ${c} 24 Z" fill="${i%2?"#1d1914":"none"}" stroke="#1d1914" stroke-width="1.3"/><circle cx="${c}" cy="82" r="2.2" fill="#b8955a"/></g>`).join("");
  const center=[...Array(8)].map((_,i)=>`<path transform="rotate(${i*45} ${c} ${c})" d="M${c} ${c} C ${c+16} ${c-20}, ${c+10} ${c-46}, ${c} ${c-54} C ${c-10} ${c-46}, ${c-16} ${c-20}, ${c} ${c} Z" fill="none" stroke="#9a7a3f" stroke-width="1.3"/>`).join("");
  return `<svg viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="196" fill="#fffdf9" stroke="#e3d9c6"/><circle cx="200" cy="200" r="188" fill="none" stroke="#9a7a3f" stroke-width="1.5"/>
  <g class="spin">${petals}</g><circle cx="200" cy="200" r="112" fill="#fffdf9" stroke="#b8955a" stroke-width="1.5"/><circle cx="200" cy="200" r="105" fill="none" stroke="#1d1914" stroke-width=".7" opacity=".5"/>${center}<circle cx="200" cy="200" r="9" fill="#b8955a"/>
  <text x="200" y="285" text-anchor="middle" font-family="Didot,Georgia,serif" font-style="italic" font-size="15" fill="#72695c">Heritage Int</text></svg>`}
function viewHome(){
  if(S.user)return go(home(S.user));
  main().innerHTML=`<section class="hero"><div><span class="eyebrow">Plateforme d'estimation pour l'événementiel</span>
    <h1>Vos clients obtiennent leur prix <em>en trois minutes.</em> Vous recevez des demandes déjà triées.</h1>
    <p class="lead">Wedding planners, traiteurs, lieux de réception, agences : créez votre page, fixez vos formules et vos prix par pays. Vos clients estiment leur projet dans leur devise et suivent leur demande jusqu'au jour J.</p>
    <div class="ctas"><a class="btn gold" href="#/inscription-pro">Créer mon espace professionnel</a><a class="btn" href="#/connexion">Se connecter</a></div>
    <div class="proof"><span><b>${S.trial_days} jours</b> d'essai gratuit</span><span><b>€ · ¥ · QAR · $</b></span><span><b>Sans engagement</b></span></div></div>
    <div class="art">${plateArt()}<div class="tag t1"><span class="muted">Estimation envoyée</span><b>9 240 ¥</b></div><div class="tag t2"><span class="muted">Nouvelle demande</span><b>Score 82/100</b></div></div></section>
  <section class="duo"><div class="card"><span class="eyebrow">Pour les professionnels</span><h2>Votre page d'estimation, <em>à votre image</em></h2>
      <ol class="steps3" style="grid-template-columns:1fr;padding:0;margin:0"><li><b>Créez votre espace</b><span>Choisissez votre activité : un catalogue de départ est prêt, que vous modifiez entièrement.</span></li><li><b>Partagez votre lien</b><span>Sur votre site, Instagram, WeChat ou par e-mail.</span></li><li><b>Traitez les demandes triées</b><span>Score d'intérêt, statut, message au client, export.</span></li></ol>
      <a class="btn p" href="#/inscription-pro">Commencer l'essai gratuit</a></div>
    <div class="card soft"><span class="eyebrow">Pour les clients</span><h2>Un prix clair, <em>tout de suite</em></h2>
      <ol class="steps3" style="grid-template-columns:1fr;padding:0;margin:0"><li><b>Décrivez votre projet</b><span>Date, pays, nombre d'invités, contraintes.</span></li><li><b>Choisissez les prestations</b><span>Chaque formule détaille ce qu'elle comprend.</span></li><li><b>Suivez votre demande</b><span>Lue, en cours, devis envoyé : tout est visible dans votre espace.</span></li></ol>
      <a class="btn" href="#/inscription-client">Créer mon compte client</a></div></section>
  <section class="section-title"><span class="eyebrow">Ce que la plateforme fait pour vous</span><h2>Moins de messages, <em>plus de projets signés</em></h2></section>
  <section class="feats">${[["€","Prix par pays et par devise","Euro, yuan, riyal, dollar : chaque client voit son estimation dans sa monnaie."],["%","Faisabilité calculée","Délai court, grand nombre d'invités, contraintes : le coefficient s'applique tout seul."],["★","Tri automatique","Information, devis ou accompagnement complet, avec un score d'intérêt sur 100."],["✉","Alertes et suivi","Un e-mail à chaque demande, une frise de suivi pour le client, vos messages en direct."]].map(([i,t,d])=>`<div class="feat"><i>${i}</i><b>${t}</b><span>${d}</span></div>`).join("")}</section>
  <section class="card"><div class="row between"><div class="section-title"><span class="eyebrow">Abonnements</span><h2>Une formule <em>pour chaque activité</em></h2></div><span class="pill gold">${S.trial_days} jours offerts</span></div>${plansHtml()}<p class="muted" style="font-size:13px">Prix HT par mois, sans engagement. Paiement mensuel par carte.</p></section>
  <section class="cta-band"><div><span class="eyebrow">Heritage Int</span><h2 style="margin-top:10px">Prêt à recevoir vos premières demandes ?</h2><p class="muted" style="margin-top:10px">Votre page est en ligne dès l'inscription.</p></div><a class="btn gold" href="#/inscription-pro">Créer mon espace</a></section>`}

/* ---------- Connexion / inscription ---------- */
function viewLogin(next){
  main().innerHTML=`<section class="auth"><div class="side"><div><span class="eyebrow">Heritage Int</span><h2 style="margin-top:14px">Bon retour <em>parmi nous</em></h2></div><ul><li>Clients : vos demandes et leur suivi</li><li>Professionnels : vos demandes triées, vos prix, votre page</li><li>Administration : la vue 360</li></ul></div><div class="form"><h2>Connexion</h2>
    <form id="lf" class="field" style="gap:12px"><div class="field"><label for="lg">E-mail ou identifiant</label><input id="lg" type="text" autocomplete="username" required></div>
    <div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <p class="err" id="le" role="alert"></p><button class="btn p" type="submit">Se connecter</button></form>
    <p class="muted" style="font-size:14px">Pas encore de compte ? <a href="#/inscription-client">Compte client</a> · <a href="#/inscription-pro">Espace professionnel</a></p></div></section>`;
  $("#lf").onsubmit=async e=>{e.preventDefault();$("#le").textContent="";try{await api("login",{login:$("#lg").value,password:$("#pw").value});await refreshMe();next?next():go(home(S.user))}catch(err){$("#le").textContent=err.message}}}
function regForm(role,id="rf"){
  return `<form id="${id}" class="field" style="gap:12px">
    <div class="grid"><div class="field"><label for="${id}-n">${role==="pro"?"Votre nom":"Nom ou nom du couple"}</label><input id="${id}-n" type="text" autocomplete="name" required></div>
    <div class="field"><label for="${id}-e">E-mail</label><input id="${id}-e" type="email" autocomplete="email" required></div></div>
    ${role==="pro"?`<div class="grid"><div class="field"><label for="${id}-c">Entreprise</label><input id="${id}-c" type="text" required></div>
      <div class="field"><label for="${id}-a">Activité principale</label><select id="${id}-a">${Object.entries(ACTIVITIES).map(([k,t])=>`<option value="${k}">${t}</option>`).join("")}</select></div></div>
      <div class="field"><span class="lab">Formule (${S.trial_days} jours d'essai gratuit, sans engagement)</span>${plansHtml("pro","plan")}</div>`:""}
    <div class="field"><label for="${id}-p">Mot de passe (10 caractères minimum)</label><input id="${id}-p" type="password" autocomplete="new-password" minlength="10" required></div>
    <p class="err" id="${id}-err" role="alert"></p><button class="btn p" type="submit">${role==="pro"?"Créer mon espace professionnel":"Créer mon compte"}</button></form>`}
function bindReg(role,id,after){
  $("#"+id).onsubmit=async e=>{e.preventDefault();const err=$("#"+id+"-err");err.textContent="";
    const b={role,name:$("#"+id+"-n").value,email:$("#"+id+"-e").value,password:$("#"+id+"-p").value};
    if(role==="pro")Object.assign(b,{company:$("#"+id+"-c").value,activity:$("#"+id+"-a").value,plan:document.querySelector(`#${id} input[name=plan]:checked`)?.value});
    try{await api("register",b);await refreshMe();toast("Compte créé");after?after():go(home(S.user))}catch(x){err.textContent=x.message}}}
function viewRegister(role){
  main().innerHTML=`<section class="auth" ${role==="pro"?'style="max-width:1180px"':""}><div class="side"><div><span class="eyebrow">${role==="pro"?"Espace professionnel":"Compte client"}</span><h2 style="margin-top:14px">${role==="pro"?"Votre page d'estimation <em>en ligne aujourd'hui</em>":"Suivez vos demandes <em>en un coup d'œil</em>"}</h2></div>
    <ul>${role==="pro"?"<li>"+S.trial_days+" jours d'essai gratuit, sans engagement</li><li>Catalogue de départ selon votre activité</li><li>Prix par pays, dans la devise de vos clients</li><li>Demandes triées et alertes par e-mail</li>":"<li>Toutes vos estimations au même endroit</li><li>Le statut de chaque demande en direct</li><li>Les messages de vos professionnels</li>"}</ul></div><div class="form">
    <h2>${role==="pro"?"Créez votre espace":"Créez votre compte"}</h2>
    ${role==="pro"?`<p class="muted">Votre page client est prête tout de suite avec un catalogue de départ selon votre activité. Vous modifiez ensuite tout : prestations, formules, prix, pays.</p>`:""}
    ${regForm(role)}<p class="muted" style="font-size:14px">Déjà inscrit ? <a href="#/connexion">Connectez-vous</a></p></div></section>`;
  bindReg(role,"rf")}
function viewAccount(){
  main().innerHTML=`<div class="pagehead"><div><span class="eyebrow">Mon compte</span><h1>${esc(S.user.name)}</h1></div></div><section class="card" style="max-width:560px"><h2>Mot de passe</h2><p class="muted">${esc(S.user.name)} · ${esc(S.user.email||S.user.login)}</p>
    <form id="cp" class="field" style="gap:12px"><div class="field"><label for="op">Mot de passe actuel</label><input id="op" type="password" autocomplete="current-password" required></div>
    <div class="field"><label for="np">Nouveau mot de passe (10 caractères minimum)</label><input id="np" type="password" autocomplete="new-password" minlength="10" required></div>
    <p class="err" id="ce" role="alert"></p><button class="btn p" type="submit">Changer mon mot de passe</button></form></section>`;
  $("#cp").onsubmit=async e=>{e.preventDefault();$("#ce").textContent="";try{await api("change_password",{old:$("#op").value,new:$("#np").value});e.target.reset();toast("Mot de passe changé")}catch(x){$("#ce").textContent=x.message}}}

/* ---------- Estimation (page publique d'un professionnel) ---------- */
let E=null;
function estimate(pro,rates,d){
  const st=pro.settings,ct=st.countries.find(c=>c.code===d.pays)||st.countries[0],inv=Math.max(0,+d.invites||0),lines=[];
  pro.catalogue.forEach(s=>{const sel=d.choix?.[s.id],ids=Array.isArray(sel)?sel:sel?[sel]:[];
    s.formules.forEach(f=>{if(!ids.includes(f.id))return;const pu=+f.prix?.[ct.code]||0,q=f.calc==="parPers"?inv:1;lines.push({t:s.nom+" — "+f.nom,m:pu*q,q,pu,calc:f.calc,taches:f.taches||[]})})});
  let pts=0;const why=[];
  if(d.date){const m=(new Date(d.date)-Date.now())/2.6298e9;if(m<3){pts+=2;why.push("délai de moins de 3 mois")}else if(m<6){pts+=1;why.push("délai de 3 à 6 mois")}}
  if(inv>(+st.seuil||250)){pts++;why.push("grand nombre d'invités")}
  const nc=(d.contraintes||[]).length;if(nc>=3){pts+=2;why.push(nc+" contraintes")}else if(nc){pts++;why.push(nc>1?nc+" contraintes":"1 contrainte")}
  const k=pts>=2?"etu":pts===1?"ren":"std",mult=k==="etu"?+st.coefEtude||1.4:k==="ren"?+st.coefRenf||1.2:1;
  const base=lines.reduce((s,l)=>s+l.m,0),total=base*mult,cur=ct.devise||"EUR",rate=+rates[cur]||1;
  return{lines,base,mult,k,why,total,cur,rate,pays:ct.nom,totalCur:cur==="EUR"?total:Math.round(total*rate/10)*10}}
async function viewEstimator(slug){
  main().innerHTML=`<p class="muted">Chargement…</p>`;
  let j;try{j=await api("pro_page",{slug},true)}catch(e){main().innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  if(!E||E.slug!==slug)E={slug,step:0,d:{pays:j.pro.settings.countries[0]?.code,contraintes:[],choix:{}},sent:null};
  E.pro=j.pro;E.rates=j.rates;renderEstimator()}
function renderEstimator(){
  const P=E.pro,pf=P.profile||{},d=E.d,st=E.step,STEPS=["Votre projet","Prestations","Estimation","Envoi"];
  document.documentElement.style.setProperty("--p-main",pf.couleur||"#1f1b16");document.documentElement.style.setProperty("--p-accent",pf.accent||"#8a6d3b");
  const ini=(P.company||"?").split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  let h=`<div class="pro-head"><span class="lg">${esc(ini)}</span><div><span class="eyebrow">Estimation en ligne</span><h2>${esc(P.company)}</h2></div></div>`;
  if(!P.open){main().innerHTML=h+`<div class="empty">Ce professionnel ne reçoit pas de demandes en ligne pour le moment.</div>`;return}
  const cty=P.settings.countries.find(c=>c.code===d.pays)||P.settings.countries[0],cur=cty.devise,rate=+E.rates[cur]||1;
  const conv=eur=>money(cur==="EUR"?eur:Math.round(eur*rate/10)*10,cur);
  h+=`<section class="card"><div class="prog">${STEPS.map((s,i)=>`<i class="${i<=st?"on":""}">${s}</i>`).join("")}</div>`;
  if(st===0)h+=`<h3>${esc(pf.titre||"Votre projet")}</h3><p class="muted">${esc(pf.intro||"")}</p>
    <div class="field"><span class="lab">Vous souhaitez</span><div class="opts">${[["info","Une information","Tarifs, disponibilités"],["devis","Un devis","Un événement précis à chiffrer"],["full","Un accompagnement complet","Du concept au jour J"]].map(([v,t,s])=>`<label class="opt"><input type="radio" name="intent" value="${v}" ${d.intent===v?"checked":""}><span><b>${t}</b><small>${s}</small></span></label>`).join("")}</div></div>
    <div class="grid"><div class="field"><label for="e-type">Type d'événement</label><select id="e-type">${["Mariage","Événement privé","Événement d'entreprise","Expérience gastronomique","Autre"].map(t=>`<option ${d.type===t?"selected":""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="e-pays">Pays de l'événement</label><select id="e-pays">${P.settings.countries.map(c=>`<option value="${esc(c.code)}" ${d.pays===c.code?"selected":""}>${esc(c.nom)}</option>`).join("")}</select></div>
      <div class="field"><label for="e-ville">Ville</label><input id="e-ville" type="text" value="${esc(d.ville||"")}"></div>
      <div class="field"><label for="e-date">Date</label><input id="e-date" type="date" value="${esc(d.date||"")}"></div>
      <div class="field"><label for="e-inv">Nombre d'invités</label><input id="e-inv" type="number" min="0" value="${esc(d.invites||"")}"></div></div>
    ${P.settings.contraintes?.length?`<div class="field"><span class="lab">Contraintes particulières</span><div class="chips">${P.settings.contraintes.map((c,i)=>`<label><input type="checkbox" data-ct="${i}" ${d.contraintes.includes(c)?"checked":""}>${esc(c)}</label>`).join("")}</div></div>`:""}`;
  if(st===1)h+=`<h3>Prestations</h3><p class="muted">Tarifs ${esc(cty.nom)}, en ${cur}.</p>`+P.catalogue.map(s=>`<div class="svcblock"><h3>${esc(s.nom)}</h3><div class="b">${s.desc?`<p class="muted">${esc(s.desc)}</p>`:""}
      <div class="opts">${s.formules.map(f=>{const chk=s.mode==="options"?(d.choix[s.id]||[]).includes(f.id):d.choix[s.id]===f.id;
        return `<label class="opt"><input type="${s.mode==="options"?"checkbox":"radio"}" name="s-${s.id}" value="${f.id}" data-s="${s.id}" ${chk?"checked":""}><span><b>${esc(f.nom)}</b>${f.desc?`<small>${esc(f.desc)}</small>`:""}${f.taches?.length?`<ul>${f.taches.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`:""}<span class="px">${conv(+f.prix?.[cty.code]||0)}${f.calc==="parPers"?" / invité":""}</span></span></label>`}).join("")}</div>
      ${s.mode!=="options"&&d.choix[s.id]?`<button class="btn sm ghost" type="button" data-clear="${s.id}">Retirer ${esc(s.nom)}</button>`:""}</div></div>`).join("");
  if(st===2){const r=estimate(P,E.rates,d);
    h+=`<h3>Votre estimation</h3>${r.k!=="std"?`<span class="pill warn">${r.k==="etu"?"Sur étude":"Faisabilité renforcée"} · ${esc(r.why.join(", "))}</span>`:""}
    <div class="quote">${r.lines.map(l=>`<div><span>${esc(l.t)}${l.calc==="parPers"?`<small>${l.q} invités × ${conv(l.pu)}</small>`:""}</span><span>${conv(l.m)}</span></div>`).join("")}
    ${r.mult!==1?`<div><span>Coefficient de faisabilité</span><span>×${r.mult}</span></div>`:""}<div class="tot"><span>Total indicatif</span><span>${money(r.totalCur,cur)}</span></div></div>
    ${cur!=="EUR"?`<p class="muted" style="font-size:13px">Soit ${money(r.total)} HT. Taux de change indicatif.</p>`:`<p class="muted" style="font-size:13px">Montant HT, estimation non contractuelle.</p>`}
    <div class="field"><span class="lab">Souhaitez-vous être recontacté·e ?</span><div class="opts">${[["rapide","Oui, rapidement"],["tard","Oui, plus tard"],["non","Non, l'estimation me suffit"]].map(([v,t])=>`<label class="opt"><input type="radio" name="rc" value="${v}" ${d.recontact===v?"checked":""}><span><b>${t}</b></span></label>`).join("")}</div></div>
    <div class="field"><span class="lab">Êtes-vous la personne qui décide ?</span><div class="chips">${[["oui","Oui"],["non","Non"]].map(([v,t])=>`<label><input type="radio" name="dec" value="${v}" ${d.decideur===v?"checked":""}>${t}</label>`).join("")}</div></div>`}
  if(st===3){
    if(E.sent)h+=`<h3>Demande envoyée</h3><p>${esc(pf.merci||"Merci !")}</p><p class="muted">Référence : <b>${esc(E.sent)}</b>. Suivez son traitement dans votre espace.</p><div class="row"><a class="btn p" href="#/client">Voir mes demandes</a></div>`;
    else{h+=`<h3>Envoyer votre demande</h3><div class="field"><label for="e-msg">Message pour ${esc(P.company)} (facultatif)</label><textarea id="e-msg">${esc(d.message||"")}</textarea></div>
      <div class="field"><label for="e-tel">Téléphone ou WeChat (facultatif)</label><input id="e-tel" type="text" value="${esc(d.tel||"")}"></div>`;
      if(S.user?.role==="client")h+=`<p class="muted">Connecté·e : ${esc(S.user.name)} (${esc(S.user.email)})</p>`;
      else if(S.user)h+=`<div class="note">Vous êtes connecté·e avec un compte ${S.user.role==="pro"?"professionnel":"administrateur"}. Pour envoyer une demande, utilisez un compte client.</div>`;
      else h+=`<div class="card soft"><h3>Créez votre compte pour envoyer et suivre votre demande</h3>${regForm("client","er")}<p class="muted" style="font-size:14px">Déjà un compte ? <button class="btn sm" type="button" id="e-login">Se connecter</button></p></div>`}}
  if(!(st===3&&E.sent))h+=`<p class="err" id="e-err" role="alert"></p><div class="row between"><button class="btn" type="button" id="e-back" ${st===0?"disabled":""}>Retour</button>${st<3?`<button class="btn p" type="button" id="e-next">${st===2?"Continuer":"Suivant"}</button>`:S.user?.role==="client"?`<button class="btn p" type="button" id="e-send">Envoyer ma demande</button>`:""}</div>`;
  h+=`</section>`;main().innerHTML=h;bindEstimator()}
function collectE(){const d=E.d,v=id=>$("#"+id);
  const it=document.querySelector("input[name=intent]:checked");if(it)d.intent=it.value;
  [["e-type","type"],["e-pays","pays"],["e-ville","ville"],["e-date","date"],["e-inv","invites"],["e-msg","message"],["e-tel","tel"]].forEach(([i,k])=>{if(v(i))d[k]=v(i).value});
  if(document.querySelector("[data-ct]"))d.contraintes=[...document.querySelectorAll("[data-ct]:checked")].map(x=>E.pro.settings.contraintes[+x.dataset.ct]);
  E.pro.catalogue.forEach(s=>{const els=[...document.querySelectorAll(`input[data-s="${s.id}"]`)];if(!els.length)return;
    if(s.mode==="options")d.choix[s.id]=els.filter(x=>x.checked).map(x=>x.value);else{const c=els.find(x=>x.checked);if(c)d.choix[s.id]=c.value}});
  const rc=document.querySelector("input[name=rc]:checked");if(rc)d.recontact=rc.value;
  const dc=document.querySelector("input[name=dec]:checked");if(dc)d.decideur=dc.value}
function bindEstimator(){
  const err=()=>$("#e-err");
  document.querySelectorAll("#main input,#main select,#main textarea").forEach(el=>el.addEventListener("change",collectE));
  const ep=$("#e-pays");if(ep)ep.onchange=()=>{collectE()};
  document.querySelectorAll("[data-clear]").forEach(b=>b.onclick=()=>{delete E.d.choix[b.dataset.clear];renderEstimator()});
  const bk=$("#e-back");if(bk)bk.onclick=()=>{collectE();E.step--;renderEstimator()};
  const nx=$("#e-next");if(nx)nx.onclick=()=>{collectE();const d=E.d;
    if(E.step===0&&!d.intent)return err().textContent="Indiquez ce que vous souhaitez.";
    if(E.step===1&&!estimate(E.pro,E.rates,d).lines.length)return err().textContent="Choisissez au moins une prestation.";
    if(E.step===2&&!d.recontact)return err().textContent="Indiquez si vous souhaitez être recontacté·e.";
    E.step++;renderEstimator()};
  if($("#er"))bindReg("client","er",()=>{renderNav();renderEstimator()});
  const el=$("#e-login");if(el)el.onclick=()=>{collectE();const back=()=>{renderNav();location.hash="#/p/"+E.slug;renderEstimator()};viewLogin(back)};
  const sd=$("#e-send");if(sd)sd.onclick=async()=>{collectE();sd.disabled=true;
    try{const j=await api("submit",{slug:E.slug,data:{...E.d,nom:S.user.name,email:S.user.email}});E.sent=j.code;renderEstimator()}catch(x){sd.disabled=false;err().textContent=x.message}}}

/* ---------- Espace client ---------- */
function timeline(r){
  const ix=["Contacté","Rendez-vous fixé","Devis envoyé","Signé"].indexOf(r.statut),lu=r.lu||r.statut!=="Nouveau";
  if(r.statut==="Sans suite")return `<div class="msg">Cette demande est clôturée.</div>`;
  const s=[["Demande envoyée",fdate(r.created_at),true],["Demande lue",lu?fdate(r.lu_at):"Bientôt",lu],["En cours de traitement",ix>=0?r.statut:"Prise de contact à venir",ix>=0],["Devis envoyé","",ix>=2],["Projet confirmé","",ix>=3]];
  return `<ol class="timeline">${s.map(x=>`<li class="${x[2]?"done":""}"><span class="pt">${x[2]?"✓":""}</span><div><b>${x[0]}</b>${x[1]?`<small>${esc(x[1])}</small>`:""}</div></li>`).join("")}</ol>`}
async function viewClient(){
  const j=await api("my_requests");
  main().innerHTML=`<div class="pagehead"><div><span class="eyebrow">Espace client</span><h1>Mes demandes</h1></div><a class="btn gold sm" href="#/compte">Mon compte</a></div>
  ${j.requests.length?j.requests.map(r=>{const e=r.data.estimation||{};return `<section class="card"><div class="row between"><div><h3>${esc(r.company)}</h3><p class="muted">${esc(r.data.type||"")}${r.data.ville?" · "+esc(r.data.ville):""}${r.data.date?" · "+fdate(r.data.date):""} · réf. ${esc(r.code)}</p></div><span class="amt">${money(r.total_devise,r.devise)}</span></div>
    <div class="grid" style="align-items:start"><div>${timeline(r)}</div><div class="field" style="gap:10px">${r.message_pro?`<div class="field"><span class="lab">Message de ${esc(r.company)}</span><div class="msg">${esc(r.message_pro)}</div></div>`:""}
    <div class="quote">${(e.lines||[]).map(l=>`<div><span>${esc(l.t)}</span><span>${money(l.m)}</span></div>`).join("")}<div class="tot"><span>Total indicatif</span><span>${money(r.total_devise,r.devise)}</span></div></div>
    <a class="btn sm ghost" href="#/p/${esc(r.slug)}">Faire une autre demande à ${esc(r.company)}</a></div></div></section>`}).join(""):`<div class="empty">Vous n'avez pas encore de demande. Ouvrez le lien de votre professionnel pour estimer votre événement.</div>`}`}

/* ---------- Espace professionnel ---------- */
let PR={reqs:[],draft:null};
async function viewPro(tab){
  await refreshMe();const p=S.pro;renderNav();
  const tabs=[["demandes","Demandes"],["catalogue","Catalogue et prix"],["page","Ma page"],["abonnement","Abonnement"],["avis","Donner mon avis"]];
  const stat=p.free?`<span class="pill ok">Compte offert · accès complet</span>`:p.plan_status==="active"?`<span class="pill ok">Abonnement ${esc(p.plan_info?.nom||p.plan)} actif</span>`:p.plan_status==="trial"?`<span class="pill ${p.open?"gold":"bad"}">${p.open?"Essai jusqu'au "+fdate(p.trial_end):"Essai terminé"}</span>`:`<span class="pill bad">Abonnement ${p.plan_status==="cancelled"?"résilié":"suspendu"}</span>`;
  main().innerHTML=`<div class="pagehead"><div><span class="eyebrow">Espace professionnel</span><h1>${esc(p.company)}</h1></div><div class="row">${stat}<a class="btn gold sm" href="#/p/${esc(p.slug)}">Voir ma page client</a></div></div>
  ${!p.open?`<div class="note bad">Votre page client est désactivée. Choisissez une formule dans l'onglet Abonnement pour la réactiver.</div>`:""}
  <div class="tabs" role="tablist">${tabs.map(([k,t])=>`<button role="tab" aria-selected="${k===tab}" data-tab="${k}">${t}${k==="demandes"?`<span class="n" id="nreq"></span>`:""}</button>`).join("")}</div><div id="pro-body"></div>`;
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>go("#/pro/"+b.dataset.tab));
  PR.draft=PR.draft&&PR.draft.slug0===p.slug?PR.draft:{slug0:p.slug,company:p.company,slug:p.slug,profile:clone(p.profile||{}),catalogue:clone(p.catalogue||[]),settings:clone(p.settings)};
  ({demandes:proRequests,catalogue:proCatalogue,page:proPage,abonnement:proPlan,avis:proReview}[tab]||proRequests)()}
async function proRequests(){
  const j=await api("pro_requests");PR.reqs=j.requests;const R=PR.reqs,unread=R.filter(r=>!r.lu).length;$("#nreq").textContent=R.length||"";
  const open=R.filter(r=>!["Signé","Sans suite"].includes(r.statut)),sum=open.reduce((s,r)=>s+r.total_eur,0);
  $("#pro-body").innerHTML=`<div class="kpis"><div class="kpi ${unread?"hi":""}"><span>Non lues</span><b>${unread}</b></div><div class="kpi"><span>En cours</span><b>${open.length}</b></div><div class="kpi"><span>Montant estimé en cours</span><b>${money(sum)}</b></div><div class="kpi"><span>Signées</span><b>${R.filter(r=>r.statut==="Signé").length}</b></div></div>
  <div class="board">${["full","devis","info"].map(c=>{const it=R.filter(r=>r.cat===c).sort((a,b)=>b.score-a.score);
    return `<div class="col"><div class="colhead c-${c}"><div><h3>${CATS[c].t}</h3><small class="muted">${CATS[c].s}</small></div><b>${it.length}</b></div>${it.map(reqCard).join("")||`<div class="empty">Aucune demande</div>`}</div>`}).join("")}</div>`;
  document.querySelectorAll("[data-st]").forEach(s=>s.onchange=()=>upd(+s.dataset.st,{statut:s.value}));
  document.querySelectorAll("[data-read]").forEach(b=>b.onclick=()=>upd(+b.dataset.read,{lu:1}));
  document.querySelectorAll("[data-msg]").forEach(b=>b.onclick=()=>upd(+b.dataset.msg,{message_pro:$("#m-"+b.dataset.msg).value},"Message enregistré : visible par le client"));
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmer";return}await api("pro_delete_request",{id:+b.dataset.del});proRequests()})}
function reqCard(r){const d=r.data,e=d.estimation||{};
  return `<article class="req"><div class="top2"><span class="nm">${esc(r.client.name)}</span><span class="pill ${r.cat==="full"?"ok":r.cat==="devis"?"gold":""}">${r.score}/100</span></div>
  ${r.lu?"":`<div class="row"><span class="pill bad">Non lue</span><button class="btn sm ghost" data-read="${r.id}">Marquer comme lue</button></div>`}
  <div class="meta"><span class="amt">${money(r.total_devise,r.devise)}</span>${r.devise!=="EUR"?`<span>${money(r.total_eur)}</span>`:""}<span>Rappel : ${{rapide:"rapidement",tard:"plus tard",non:"non"}[d.recontact]||"—"}</span></div>
  <div class="meta"><span>${esc(d.type||"")}</span>${d.date?`<span>${fdate(d.date)}</span>`:""}<span>${esc([d.ville,e.pays].filter(Boolean).join(", "))}</span>${d.invites?`<span>${esc(d.invites)} invités</span>`:""}</div>
  <div class="meta"><span>${esc(r.client.email)}</span>${d.tel?`<span>${esc(d.tel)}</span>`:""}<span>${fdate(r.created_at)}</span></div>
  ${r.statut==="Nouveau"?`<p class="muted" style="font-size:13px">${NEXT[r.cat]}</p>`:""}
  <details class="more"><summary>Détail et message au client</summary><div class="body">${(e.lines||[]).map(l=>`<div>${esc(l.t)} — ${money(l.m)}</div>`).join("")}${e.mult&&e.mult!==1?`<div>Coefficient ×${e.mult} (${esc((e.why||[]).join(", "))})</div>`:""}
    ${(d.contraintes||[]).length?`<div>Contraintes : ${esc(d.contraintes.join(", "))}</div>`:""}${d.message?`<div class="msg">${esc(d.message)}</div>`:""}
    <label class="lab" for="m-${r.id}" style="font-size:12px;color:var(--muted)">Message visible par le client</label><textarea id="m-${r.id}">${esc(r.message_pro)}</textarea><button class="btn sm" data-msg="${r.id}">Enregistrer le message</button></div></details>
  <div class="row"><select data-st="${r.id}" aria-label="Statut" style="width:auto">${STATUTS.map(s=>`<option ${r.statut===s?"selected":""}>${s}</option>`).join("")}</select><button class="btn sm bad" data-del="${r.id}">Supprimer</button></div></article>`}
async function upd(id,patch,msg){try{await api("pro_update_request",{id,...patch});if(msg)toast(msg);proRequests()}catch(e){toast(e.message)}}
async function saveDraft(msg){const D=PR.draft;try{const j=await api("pro_save",{company:D.company,slug:D.slug,profile:D.profile,catalogue:D.catalogue,settings:D.settings});await refreshMe();PR.draft=null;toast(msg||"Enregistré");return j}catch(e){toast(e.message);throw e}}
function bindDraft(root){root.querySelectorAll("[data-k]").forEach(el=>el.addEventListener(el.tagName==="SELECT"?"change":"input",()=>{
  const ks=el.dataset.k.split(".");let o=PR.draft;ks.slice(0,-1).forEach(k=>o=o[k]);let v=el.value;
  if(el.dataset.num)v=parseFloat(v)||0;if(el.dataset.lines)v=v.split("\n").map(x=>x.trim()).filter(Boolean);o[ks.at(-1)]=v;if(el.dataset.re)rerenderTab()}))}
function rerenderTab(){const t=(location.hash.split("/")[2])||"demandes";({catalogue:proCatalogue,page:proPage})[t]?.()}
function proCatalogue(){
  const D=PR.draft,C=D.settings.countries;
  $("#pro-body").innerHTML=`<p class="muted">Prix HT en euros pour chaque pays. Le client les voit convertis dans la devise du pays de son événement.</p>
  ${D.catalogue.map((s,i)=>`<section class="card"><div class="row between"><h3>${esc(s.nom||"Prestation")}</h3><button class="btn sm bad" data-dels="${i}">Supprimer la prestation</button></div>
    <div class="grid"><div class="field"><label>Nom</label><input type="text" data-k="catalogue.${i}.nom" value="${esc(s.nom)}"></div><div class="field"><label>Description</label><input type="text" data-k="catalogue.${i}.desc" value="${esc(s.desc)}"></div>
    <div class="field"><label>Le client choisit</label><select data-k="catalogue.${i}.mode"><option value="formules" ${s.mode!=="options"?"selected":""}>Une formule</option><option value="options" ${s.mode==="options"?"selected":""}>Plusieurs options</option></select></div></div>
    <div class="tw"><table class="t"><thead><tr><th>Formule</th><th>Description</th><th>Calcul</th>${C.map(c=>`<th class="n">${esc(c.nom)} (€)</th>`).join("")}<th>Tâches incluses (une par ligne)</th><th></th></tr></thead><tbody>
    ${s.formules.map((f,k)=>`<tr><td><input type="text" data-k="catalogue.${i}.formules.${k}.nom" value="${esc(f.nom)}"></td><td><input type="text" data-k="catalogue.${i}.formules.${k}.desc" value="${esc(f.desc)}"></td>
      <td><select data-k="catalogue.${i}.formules.${k}.calc"><option value="forfait" ${f.calc!=="parPers"?"selected":""}>Forfait</option><option value="parPers" ${f.calc==="parPers"?"selected":""}>Par invité</option></select></td>
      ${C.map(c=>`<td class="n"><input type="number" min="0" step="any" style="width:100px" data-num="1" data-k="catalogue.${i}.formules.${k}.prix.${esc(c.code)}" value="${+f.prix?.[c.code]||0}"></td>`).join("")}
      <td><textarea rows="2" data-lines="1" data-k="catalogue.${i}.formules.${k}.taches">${esc((f.taches||[]).join("\n"))}</textarea></td><td><button class="btn sm bad" data-delf="${i}.${k}">Retirer</button></td></tr>`).join("")}</tbody></table></div>
    <div class="row"><button class="btn sm" data-addf="${i}">+ Ajouter une formule</button></div></section>`).join("")}
  <div class="row between"><button class="btn" id="adds">+ Ajouter une prestation</button><button class="btn p" id="savec">Enregistrer le catalogue</button></div>`;
  const body=$("#pro-body");bindDraft(body);
  const zero=()=>Object.fromEntries(C.map(c=>[c.code,0]));
  body.querySelectorAll("[data-addf]").forEach(b=>b.onclick=()=>{D.catalogue[+b.dataset.addf].formules.push({id:uid(),nom:"Nouvelle formule",desc:"",calc:"forfait",taches:[],prix:zero()});proCatalogue()});
  body.querySelectorAll("[data-delf]").forEach(b=>b.onclick=()=>{const[i,k]=b.dataset.delf.split(".").map(Number);D.catalogue[i].formules.splice(k,1);proCatalogue()});
  body.querySelectorAll("[data-dels]").forEach(b=>b.onclick=()=>{if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmer la suppression";return}D.catalogue.splice(+b.dataset.dels,1);proCatalogue()});
  $("#adds").onclick=()=>{D.catalogue.push({id:uid(),nom:"Nouvelle prestation",desc:"",mode:"formules",formules:[{id:uid(),nom:"Formule 1",desc:"",calc:"forfait",taches:[],prix:zero()}]});proCatalogue()};
  $("#savec").onclick=()=>saveDraft("Catalogue enregistré : votre page client est à jour")}
function proPage(){
  const D=PR.draft,st=D.settings,pf=D.profile,slug=encodeURIComponent(S.pro.slug);
  const link=location.origin+location.pathname+"#/p/"+slug;
  const embedLink=location.origin+location.pathname+"?embed=1#/p/"+slug;
  const embedCode=`<iframe src="${embedLink}" style="width:100%;height:1200px;border:0" title="Estimation - ${esc(D.company)}"></iframe>`;
  $("#pro-body").innerHTML=`<section class="card"><h3>Lien de votre page client</h3><div class="code" id="plink">${esc(link)}</div>
    <div class="row"><button class="btn sm" id="cpy">Copier le lien</button><a class="btn sm ghost" href="#/p/${esc(S.pro.slug)}">Voir ma page</a></div>
    <p class="muted" style="font-size:13px">Code d'intégration à ajouter sur votre site :</p><div class="code" id="iframe-code">${esc(embedCode)}</div>
    <button class="btn sm" id="cpy-iframe" type="button">Copier le code d'intégration</button></section>
  <section class="card"><h3>Identité</h3><div class="grid"><div class="field"><label>Nom affiché à vos clients</label><input type="text" data-k="company" value="${esc(D.company)}"></div>
    <div class="field"><label>Adresse de la page (lettres, chiffres, tirets)</label><input type="text" data-k="slug" value="${esc(D.slug)}"></div>
    <div class="field"><label>Couleur principale</label><input type="color" data-k="profile.couleur" value="${esc(pf.couleur||"#1f1b16")}"></div><div class="field"><label>Couleur des bordures et accents</label><input type="color" data-k="profile.accent" value="${esc(pf.accent||"#8a6d3b")}"></div></div>
    <div class="grid"><div class="field"><label>Titre d'accueil</label><input type="text" data-k="profile.titre" value="${esc(pf.titre||"")}"></div><div class="field"><label>Message après envoi</label><input type="text" data-k="profile.merci" value="${esc(pf.merci||"")}"></div></div>
    <div class="field"><label>Texte d'accueil</label><textarea data-k="profile.intro">${esc(pf.intro||"")}</textarea></div></section>
  <section class="card"><h3>Pays et devises</h3>${st.countries.map((c,i)=>`<div class="row" style="align-items:flex-end"><div class="field" style="flex:1"><label>Pays</label><input type="text" data-k="settings.countries.${i}.nom" value="${esc(c.nom)}"></div>
    <div class="field"><label>Devise</label><select data-k="settings.countries.${i}.devise">${CURS.map(x=>`<option ${c.devise===x?"selected":""}>${x}</option>`).join("")}</select></div>${st.countries.length>1?`<button class="btn sm bad" data-delc="${i}">Retirer</button>`:""}</div>`).join("")}
    <div class="row"><button class="btn sm" id="addc">+ Ajouter un pays</button></div></section>
  <section class="card"><h3>Faisabilité</h3><div class="grid"><div class="field"><label>Coefficient « renforcée »</label><input type="number" step="0.05" min="1" data-num="1" data-k="settings.coefRenf" value="${st.coefRenf}"></div>
    <div class="field"><label>Coefficient « sur étude »</label><input type="number" step="0.05" min="1" data-num="1" data-k="settings.coefEtude" value="${st.coefEtude}"></div>
    <div class="field"><label>Seuil de grands événements (invités)</label><input type="number" min="1" data-num="1" data-k="settings.seuil" value="${st.seuil}"></div></div>
    <div class="field"><label>Contraintes proposées (une par ligne)</label><textarea data-lines="1" data-k="settings.contraintes">${esc((st.contraintes||[]).join("\n"))}</textarea></div></section>
  <div class="row" style="justify-content:flex-end"><button class="btn p" id="savep">Enregistrer ma page</button></div>`;
  const body=$("#pro-body");bindDraft(body);
  $("#cpy").onclick=async()=>{try{await navigator.clipboard.writeText(link);toast("Lien copié")}catch{const r=document.createRange();r.selectNodeContents($("#plink"));getSelection().removeAllRanges();getSelection().addRange(r);toast("Lien sélectionné : copiez-le")}};
  $("#cpy-iframe").onclick=async()=>{try{await navigator.clipboard.writeText(embedCode);toast("Code d'intégration copié")}catch{const r=document.createRange();r.selectNodeContents($("#iframe-code"));getSelection().removeAllRanges();getSelection().addRange(r);toast("Code sélectionné : copiez-le")}};
  $("#addc").onclick=()=>{const code="c"+uid().slice(0,5);st.countries.push({code,nom:"Nouveau pays",devise:"USD"});D.catalogue.forEach(s=>s.formules.forEach(f=>{f.prix[code]=0}));proPage()};
  body.querySelectorAll("[data-delc]").forEach(b=>b.onclick=()=>{st.countries.splice(+b.dataset.delc,1);proPage()});
  $("#savep").onclick=()=>saveDraft("Page enregistrée")}
function proPlan(){
  const p=S.pro;
  $("#pro-body").innerHTML=p.free?`<section class="card"><h3>Compte offert</h3><p class="muted">Votre espace a un accès complet et gratuit. Aucun abonnement à payer.</p></section>`:
  `<section class="card"><h3>Votre formule</h3><p class="muted">${p.plan_status==="trial"?`Essai gratuit jusqu'au ${fdate(p.trial_end)}.`:p.plan_status==="active"?"Abonnement actif.":"Abonnement inactif : votre page client est désactivée."} Le paiement est mensuel, par carte, sans engagement.</p>
    ${plansHtml(p.plan,"plan")}<p class="err" id="pe" role="alert"></p><div class="row"><button class="btn p" id="pay">Payer et activer cette formule</button></div></section>`;
  const pay=$("#pay");if(pay)pay.onclick=async()=>{const plan=document.querySelector("input[name=plan]:checked")?.value;
    try{const j=await api("pro_choose_plan",{plan});await refreshMe();if(j.payment_link){location.href=j.payment_link}else $("#pe").textContent="Formule enregistrée. Le paiement en ligne n'est pas encore ouvert : Heritage Int vous contactera pour l'activer."}catch(e){$("#pe").textContent=e.message}}}
function proReview(){
  let note=0;
  $("#pro-body").innerHTML=`<section class="card" style="max-width:620px"><h3>Votre avis sur la plateforme</h3><p class="muted">Il est lu uniquement par l'équipe Heritage Int et nous aide à améliorer l'outil.</p>
    <div class="stars" role="radiogroup" aria-label="Note">${[1,2,3,4,5].map(n=>`<label data-n="${n}"><input type="radio" name="note" value="${n}">★</label>`).join("")}</div>
    <div class="field"><label for="rv">Commentaire</label><textarea id="rv"></textarea></div><p class="err" id="re" role="alert"></p><div class="row"><button class="btn p" id="send-rv">Envoyer mon avis</button></div></section>`;
  document.querySelectorAll(".stars label").forEach(l=>l.onclick=()=>{note=+l.dataset.n;document.querySelectorAll(".stars label").forEach(x=>x.classList.toggle("on",+x.dataset.n<=note))});
  $("#send-rv").onclick=async()=>{try{await api("pro_review",{rating:note,comment:$("#rv").value});toast("Merci pour votre avis");proReview()}catch(e){$("#re").textContent=e.message}}}

/* ---------- Administration 360 ---------- */
async function viewAdmin(tab){
  const tabs=[["vue","Vue d'ensemble"],["pros","Professionnels"],["paiements","Paiements et CA"],["avis","Avis"],["reglages","Abonnements et charges"]];
  main().innerHTML=`<div class="pagehead"><div><span class="eyebrow">Administration</span><h1>Heritage Int · <em style="color:var(--gold2)">vue 360</em></h1></div><span class="pill gold">${new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span></div>
  <div class="tabs" role="tablist">${tabs.map(([k,t])=>`<button role="tab" aria-selected="${k===tab}" data-tab="${k}">${t}</button>`).join("")}</div><div id="adm"></div>`;
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>go("#/admin/"+b.dataset.tab));
  await ({vue:admOverview,pros:admPros,paiements:admPayments,avis:admReviews,reglages:admSettings}[tab]||admOverview)()}
function chart(series){
  const W=760,H=240,pl=56,pr=12,pt=14,pb=30,max=Math.max(100,...series.map(s=>Math.max(s.ca,s.charges)))*1.1,bw=(W-pl-pr)/series.length;
  const y=v=>pt+(H-pt-pb)*(1-v/max),ticks=[0,.25,.5,.75,1].map(t=>t*max);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiffre d'affaires et charges sur 12 mois"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8955a"/><stop offset="1" stop-color="#9a7a3f"/></linearGradient></defs>
  ${ticks.map(t=>`<line x1="${pl}" x2="${W-pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl-6}" y="${y(t)+4}" text-anchor="end">${Math.round(t)}</text>`).join("")}
  ${series.map((s,i)=>`<rect x="${pl+i*bw+bw*.18}" y="${y(s.ca)}" width="${bw*.64}" height="${Math.max(0,H-pb-y(s.ca))}" fill="url(#gg)" rx="4"><title>${s.mois} : ${money(s.ca)}</title></rect>
    <text x="${pl+i*bw+bw/2}" y="${H-10}" text-anchor="middle">${new Date(s.mois+"-01T12:00").toLocaleDateString("fr-FR",{month:"short"})}</text>`).join("")}
  <polyline fill="none" stroke="var(--bad)" stroke-width="2" points="${series.map((s,i)=>`${pl+i*bw+bw/2},${y(s.charges)}`).join(" ")}"/></svg>
  <div class="legend"><span><i style="background:var(--gold)"></i>Chiffre d'affaires encaissé (€ HT)</span><span><i style="background:var(--bad)"></i>Charges mensuelles</span></div>`}
async function admOverview(){
  const o=await api("admin_overview");
  $("#adm").innerHTML=`<div class="kpis"><div class="kpi hi"><span>CA aujourd'hui</span><b>${money(o.ca_jour)}</b></div><div class="kpi hi"><span>CA ce mois</span><b>${money(o.ca_mois)}</b></div><div class="kpi hi"><span>CA cette année</span><b>${money(o.ca_annee)}</b></div><div class="kpi"><span>CA total</span><b>${money(o.ca_total)}</b></div></div>
  <div class="kpis"><div class="kpi"><span>Revenu mensuel récurrent</span><b>${money(o.mrr)}</b><small>soit ${money(o.arr)} par an</small></div><div class="kpi"><span>Charges du mois</span><b>${money(o.charges_mois)}</b></div>
    <div class="kpi hi"><span>Résultat du mois</span><b class="${o.benefice_mois<0?"neg":"pos"}">${money(o.benefice_mois)}</b><small>CA du mois − charges</small></div>
    <div class="kpi"><span>Note moyenne des pros</span><b>${o.avis.moyenne??"—"}${o.avis.moyenne?" / 5":""}</b><small>${o.avis.nombre} avis</small></div></div>
  <section class="card"><h3>Chiffre d'affaires et charges, 12 derniers mois</h3>${chart(o.series)}</section>
  <div class="grid3"><section class="card"><h3>Professionnels</h3><div class="kpis"><div class="kpi"><span>Abonnés actifs</span><b>${o.pros.actifs}</b></div><div class="kpi"><span>En essai</span><b>${o.pros.essai}</b></div><div class="kpi"><span>Inactifs</span><b>${o.pros.inactifs}</b></div><div class="kpi"><span>Offerts</span><b>${o.pros.gratuits}</b></div></div></section>
    <section class="card"><h3>Abonnés par formule</h3><div class="tw"><table class="t compact"><thead><tr><th>Formule</th><th class="n">Prix</th><th class="n">Actifs</th><th class="n">Revenu / mois</th></tr></thead><tbody>${Object.values(o.par_formule).map(p=>`<tr><td>${esc(p.nom)}</td><td class="n">${money(p.prix)}</td><td class="n">${p.actifs}</td><td class="n">${money(p.prix*p.actifs)}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><h3>Activité</h3><div class="kpis"><div class="kpi"><span>Clients inscrits</span><b>${o.clients}</b></div><div class="kpi"><span>Demandes ce mois</span><b>${o.demandes_mois}</b></div><div class="kpi"><span>Demandes au total</span><b>${o.demandes}</b></div></div></section></div>`}
async function admPros(){
  const j=await api("admin_pros");
  $("#adm").innerHTML=j.pros.length?`<div class="tw"><table class="t"><thead><tr><th>Professionnel</th><th>Formule</th><th>Statut</th><th class="n">Demandes</th><th class="n">Note</th><th class="n">Payé</th><th>Inscrit le</th><th>Actions</th></tr></thead><tbody>
  ${j.pros.map(p=>`<tr><td><b>${esc(p.company)}</b><br><span class="muted">${esc(p.name)} · ${esc(p.email)}</span><br><span class="muted">${esc(ACTIVITIES[p.activity]||p.activity||"")}</span> · <a href="#/p/${esc(p.slug)}">page</a></td>
    <td><select data-plan="${p.id}">${Object.entries(S.plans).map(([k,x])=>`<option value="${k}" ${p.plan===k?"selected":""}>${esc(x.nom)}</option>`).join("")}</select></td>
    <td>${p.free?`<span class="pill ok">Offert</span>`:`<select data-status="${p.id}">${[["trial","Essai"],["active","Actif"],["suspended","Suspendu"],["cancelled","Résilié"]].map(([k,t])=>`<option value="${k}" ${p.plan_status===k?"selected":""}>${t}</option>`).join("")}</select>`}<br>${p.open?`<span class="pill ok">Page ouverte</span>`:`<span class="pill bad">Page fermée</span>`}${p.plan_status==="trial"&&!p.free?`<br><small class="muted">jusqu'au ${fdate(p.trial_end)}</small>`:""}</td>
    <td class="n">${p.demandes}</td><td class="n">${p.note??"—"}</td><td class="n">${money(p.paye)}</td><td>${fdate(p.created_at)}</td>
    <td><button class="btn sm ghost" data-free="${p.id}" data-v="${p.free?0:1}">${p.free?"Retirer la gratuité":"Offrir l'accès"}</button> <button class="btn sm ${p.active?"bad":""}" data-act="${p.id}" data-v="${p.active?0:1}">${p.active?"Bloquer le compte":"Débloquer"}</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Aucun professionnel inscrit pour l'instant.</div>`;
  const up=async b=>{try{await api("admin_update_pro",b);toast("Modifié");admPros()}catch(e){toast(e.message)}};
  document.querySelectorAll("[data-plan]").forEach(s=>s.onchange=()=>up({id:+s.dataset.plan,plan:s.value}));
  document.querySelectorAll("[data-status]").forEach(s=>s.onchange=()=>up({id:+s.dataset.status,plan_status:s.value}));
  document.querySelectorAll("[data-free]").forEach(b=>b.onclick=()=>up({id:+b.dataset.free,free:+b.dataset.v}));
  document.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>up({id:+b.dataset.act,active:+b.dataset.v}))}
async function admPayments(){
  const [j,ps]=await Promise.all([api("admin_payments"),api("admin_pros")]);
  $("#adm").innerHTML=`<section class="card"><h3>Ajouter un encaissement</h3><p class="muted" style="font-size:13px">Les paiements Stripe s'ajoutent automatiquement. Ajoutez ici les virements ou les frais de mise en place.</p>
    <div class="grid"><div class="field"><label for="pa">Montant (€ HT)</label><input id="pa" type="number" step="0.01"></div><div class="field"><label for="pd">Date</label><input id="pd" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="field"><label for="pk">Type</label><select id="pk"><option value="abonnement">Abonnement</option><option value="mise_en_place">Mise en place</option><option value="autre">Autre</option></select></div>
    <div class="field"><label for="pp">Professionnel</label><select id="pp"><option value="">—</option>${ps.pros.map(p=>`<option value="${p.id}">${esc(p.company)}</option>`).join("")}</select></div>
    <div class="field"><label for="pl">Libellé</label><input id="pl" type="text"></div></div><p class="err" id="pe" role="alert"></p><div class="row"><button class="btn p" id="padd">Ajouter</button></div></section>
  ${j.payments.length?`<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Professionnel</th><th>Type</th><th>Libellé</th><th>Source</th><th class="n">Montant</th><th></th></tr></thead><tbody>
  ${j.payments.map(p=>`<tr><td>${fdate(p.paid_at)}</td><td>${esc(p.company||"—")}</td><td>${{abonnement:"Abonnement",mise_en_place:"Mise en place",autre:"Autre"}[p.kind]||esc(p.kind)}</td><td>${esc(p.label||"")}</td><td>${p.source==="stripe"?`<span class="pill ok">Stripe</span>`:`<span class="pill">Manuel</span>`}</td><td class="n">${money(p.amount)}</td><td>${p.source==="manuel"?`<button class="btn sm bad" data-delp="${p.id}">Supprimer</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Aucun encaissement enregistré.</div>`}`;
  $("#padd").onclick=async()=>{try{await api("admin_add_payment",{amount:+$("#pa").value,date:$("#pd").value,kind:$("#pk").value,pro_id:+$("#pp").value||null,label:$("#pl").value});toast("Encaissement ajouté");admPayments()}catch(e){$("#pe").textContent=e.message}};
  document.querySelectorAll("[data-delp]").forEach(b=>b.onclick=async()=>{if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Confirmer";return}await api("admin_delete_payment",{id:+b.dataset.delp});admPayments()})}
async function admReviews(){
  const j=await api("admin_reviews");
  $("#adm").innerHTML=j.reviews.length?j.reviews.map(r=>`<section class="card"><div class="row between"><b>${esc(r.company)}</b><span style="color:var(--gold);font-size:18px">${"★".repeat(r.rating)}<span style="color:var(--line)">${"★".repeat(5-r.rating)}</span></span></div>${r.comment?`<p>${esc(r.comment)}</p>`:""}<small class="muted">${fdate(r.created_at)}</small></section>`).join(""):`<div class="empty">Aucun avis pour l'instant. Les professionnels donnent leur avis depuis leur espace.</div>`}
async function admSettings(){
  const s=await api("admin_settings");
  $("#adm").innerHTML=`<section class="card"><h3>Formules d'abonnement</h3><div class="tw"><table class="t"><thead><tr><th>Formule</th><th class="n">Prix € HT / mois</th><th>Description</th><th>Lien de paiement Stripe</th></tr></thead><tbody>
    ${Object.entries(s.plans).map(([k,p])=>`<tr><td><input type="text" data-pl="${k}.nom" value="${esc(p.nom)}"></td><td class="n"><input type="number" step="1" min="0" style="width:90px" data-pl="${k}.prix" value="${p.prix}"></td><td><input type="text" data-pl="${k}.desc" value="${esc(p.desc)}"></td><td><input type="url" placeholder="https://buy.stripe.com/…" data-pl="${k}.lien" value="${esc(p.lien||"")}"></td></tr>`).join("")}</tbody></table></div>
    <div class="field" style="max-width:260px"><label for="mep">Frais de mise en place accompagnée (€ HT)</label><input id="mep" type="number" value="${s.mise_en_place}"></div></section>
  <section class="card"><h3>Charges mensuelles</h3><div id="chg">${s.charges.map((c,i)=>`<div class="row"><input type="text" data-cn="${i}" value="${esc(c.nom)}" style="flex:1"><input type="number" step="0.01" data-cm="${i}" value="${c.montant}" style="width:120px"><button class="btn sm bad" data-cd="${i}">Retirer</button></div>`).join("")}</div><div class="row"><button class="btn sm" id="ca">+ Ajouter une charge</button></div></section>
  <section class="card"><h3>Taux de change (pour 1 €)</h3><div class="grid">${Object.entries(s.rates).filter(([k])=>k!=="EUR").map(([k,v])=>`<div class="field"><label>${k}</label><input type="number" step="0.0001" data-rt="${k}" value="${v}"></div>`).join("")}</div></section>
  <div class="row" style="justify-content:flex-end"><button class="btn p" id="ss">Enregistrer les réglages</button></div>`;
  const collect=()=>{document.querySelectorAll("[data-pl]").forEach(i=>{const[k,f]=i.dataset.pl.split(".");s.plans[k][f]=f==="prix"?+i.value:i.value});
    document.querySelectorAll("[data-cn]").forEach(i=>s.charges[+i.dataset.cn].nom=i.value);document.querySelectorAll("[data-cm]").forEach(i=>s.charges[+i.dataset.cm].montant=+i.value);
    document.querySelectorAll("[data-rt]").forEach(i=>s.rates[i.dataset.rt]=+i.value);s.mise_en_place=+$("#mep").value};
  $("#ca").onclick=()=>{collect();s.charges.push({nom:"Nouvelle charge",montant:0});admSettingsRender(s)};
  document.querySelectorAll("[data-cd]").forEach(b=>b.onclick=()=>{collect();s.charges.splice(+b.dataset.cd,1);admSettingsRender(s)});
  $("#ss").onclick=async()=>{collect();try{await api("admin_save_settings",s);await refreshMe();toast("Réglages enregistrés")}catch(e){toast(e.message)}};
  function admSettingsRender(x){api("admin_save_settings",x).then(()=>admSettings()).catch(e=>toast(e.message))}}

/* ---------- Démarrage ---------- */
(async()=>{
  if(new URLSearchParams(location.search).get("embed")==="1")document.documentElement.classList.add("embed");
  const q=new URLSearchParams(location.search).get("p");if(q)history.replaceState(null,"",location.pathname+"#/p/"+encodeURIComponent(q));
  try{await refreshMe()}catch(e){main().innerHTML=`<div class="note bad">Le service ne répond pas (${esc(e.message)}). Réessayez dans un instant.</div>`;return}
  addEventListener("hashchange",route);route()})();