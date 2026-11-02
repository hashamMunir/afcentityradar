(function(){
"use strict";
var CONFIG=window.AFC_CONFIG||{};
/* ================= basics ================= */
var css=getComputedStyle(document.documentElement), C=function(n){return css.getPropertyValue(n).trim();};
var el=function(id){return document.getElementById(id);};
var mk=function(tag,cls,text){var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e;};
var fmtInt=d3.format(',');
var DN; try{ DN=new Intl.DisplayNames(['en'],{type:'region'}); }catch(e){ DN=null; }
var cn=function(a2){ if(!a2) return ''; a2=String(a2).toUpperCase(); if(a2.length!==2) return a2; try{ return DN?DN.of(a2):a2; }catch(e){ return a2; } };
var A2N={}, N2A={}; ISO.forEach(function(r){ A2N[r[0]]=r[2]; N2A[r[2]]=r[0]; });
var to=function(p,ms){ return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'));},ms);})]); };
var getJSON=function(u,o,ms){ return to(fetch(u,o),ms||15000).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); };
var esc=function(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');};
function csvCell(v){ if(v==null) return ''; var s=Array.isArray(v)?v.join('; '):String(v); if(/^[=+\-@\t\r]/.test(s)) s="'"+s; return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function download(name,text,type){ var b=new Blob([text],{type:type||'text/csv;charset=utf-8'}); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},600); }
function toCSV(rows,cols){ return '﻿'+[cols.join(',')].concat(rows.map(function(r){return cols.map(function(c){return csvCell(r[c]);}).join(',');})).join('\r\n'); }
var today=function(){return new Date().toISOString().slice(0,10);};
var SRC={}; function setSrc(n,s){ SRC[n]=s; renderSrc(); }
function renderSrc(){ var b=el('src-status'); if(!b) return; b.replaceChildren(); Object.keys(SRC).forEach(function(k){ b.appendChild(mk('span',SRC[k]===true?'ok':SRC[k]==='load'?'load':SRC[k]===false?'err':'',k)); }); }

/* ================= country risk (embedded, dated) ================= */
var FATF_BLACK=['IR','MM','KP'];
var FATF_GREY=['AO','BO','BA','VG','BG','CM','CI','CD','HT','IQ','KE','KW','LA','LB','MC','NP','PG','SS','SY','VE','VN','YE'];
var EU_HR=['AF','DZ','AO','BO','VG','CM','CI','CD','HT','KE','LA','LB','MC','MM','NA','NP','SS','SY','TT','VU','VE','VN','YE','KP','IR','RU'];
var BASEL={MM:8.18,HT:8.12,CD:7.63,TD:7.56,GQ:7.55,VE:7.55,LA:7.50,GA:7.46,CF:7.44,GW:7.30,CG:7.27,CN:7.26,DJ:6.93,NE:6.84,DZ:6.82,MG:6.77,TM:6.73,KH:6.72,VN:6.69,KM:6.67,NZ:3.76,NO:3.73,SI:3.49,AD:3.48,SE:3.48,EE:3.25,DK:3.18,SM:3.08,IS:3.04,FI:3.03};
function countryRisk(a2){ a2=(a2||'').toUpperCase(); var r={a2:a2,name:cn(a2),fatf:FATF_BLACK.indexOf(a2)>=0?'Call for action (black list)':FATF_GREY.indexOf(a2)>=0?'Increased monitoring (grey list)':'',eu:EU_HR.indexOf(a2)>=0,basel:BASEL[a2]||null};
 r.tier=(r.fatf||r.eu)?'High':(r.basel&&r.basel>=6.5)?'Medium':'Low'; if(FATF_BLACK.indexOf(a2)>=0) r.tier='High'; return r; }
var TIER_COL=function(t){return t==='High'?C('--bad'):t==='Medium'?C('--warn'):C('--ok');};

/* ================= name matching ================= */
var TITLES={mr:1,mrs:1,ms:1,miss:1,dr:1,prof:1,sir:1,hon:1,honourable:1,haji:1,hajji:1,alhaj:1,the:1,ltd:1,llc:1,inc:1,plc:1,gmbh:1,ag:1,sa:1,co:1,company:1,limited:1,corporation:1,corp:1,jsc:1,ojsc:1,pjsc:1,oao:1,ooo:1,zao:1};
function norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(t){return t&&!TITLES[t];}); }
function key(t){ t=t.replace(/ph/g,'f').replace(/q/g,'k').replace(/ck/g,'k'); var k=t[0]+t.slice(1).replace(/[aeiouhwy]/g,''); return k.replace(/(.)\1+/g,'$1'); }
function jw(a,b){ if(a===b) return 1; var la=a.length, lb=b.length; if(!la||!lb) return 0; var md=Math.max(0,Math.floor(Math.max(la,lb)/2)-1), am=new Array(la), bm=new Array(lb), m=0;
 for(var i=0;i<la;i++){ for(var j=Math.max(0,i-md);j<Math.min(lb,i+md+1);j++){ if(!bm[j]&&a[i]===b[j]){ am[i]=bm[j]=true; m++; break; } } }
 if(!m) return 0; var t=0,k=0; for(i=0;i<la;i++){ if(am[i]){ while(!bm[k]) k++; if(a[i]!==b[k]) t++; k++; } }
 var s=(m/la+m/lb+(m-t/2)/m)/3, p=0; while(p<4&&a[p]===b[p]) p++; return s+p*0.1*(1-s); }
var LOW={muhammad:1,mohammad:1,mohammed:1,muhammed:1,mohamed:1,mohd:1,md:1,ahmad:1,ahmed:1,ali:1,al:1,el:1,bin:1,ibn:1,binti:1,abu:1,abd:1,abdul:1,abdel:1,syed:1,sayed:1,said:1,mian:1,sheikh:1,shaikh:1,khan:1,malik:1,chaudhry:1,chaudhary:1,rana:1,de:1,da:1,van:1,von:1,der:1,del:1,la:1,le:1,bank:1,group:1,international:1,trading:1,holding:1,holdings:1};
var tw=function(t){return LOW[t]?0.3:t.length;};
function bestOf(t,arr){ var b=0; arr.forEach(function(n){ var s=Math.max(jw(t,n), key(t)===key(n)&&t.length>2?0.95:0); if(s>b) b=s; }); return b; }
function nameScore(qt,nt){ if(!qt.length||!nt.length) return 0; var sq=0,wq=0,sn=0,wn=0;
 qt.forEach(function(q){ sq+=tw(q)*bestOf(q,nt); wq+=tw(q); }); nt.forEach(function(n){ sn+=tw(n)*bestOf(n,qt); wn+=tw(n); });
 var aq=sq/wq; return Math.min(1,0.65*aq+0.35*(sn/wn)+(aq>=0.97?0.03:0)); }
function infoTokens(qt){ return qt.filter(function(t){return !LOW[t]&&t.length>=3;}).length; }

/* ================= screening lists (OpenSanctions, live) ================= */
var LISTS=[
 ['un_sc_sanctions','UN Security Council sanctions','sanction'],['us_ofac_sdn','US OFAC SDN list','sanction'],['us_ofac_cons','US OFAC consolidated (non-SDN)','sanction'],
 ['eu_fsf','EU financial sanctions','sanction'],['gb_fcdo_sanctions','UK sanctions list','sanction'],['gb_proscribed_orgs','UK proscribed terrorist organisations','terror'],['gb_nca_most_wanted','UK NCA most wanted','wanted'],['ch_seco_sanctions','Switzerland SECO sanctions','sanction'],
 ['ca_dfatd_sema_sanctions','Canada autonomous sanctions','sanction'],['au_dfat_sanctions','Australia DFAT sanctions','sanction'],
 ['pk_proscribed_persons','Pakistan NACTA proscribed persons','terror'],['ae_local_terrorists','UAE local terrorist list','terror'],['in_mha_banned','India MHA banned organisations','terror'],
 ['interpol_red_notices','Interpol red notices','wanted'],['us_fbi_most_wanted','FBI most wanted','wanted'],['worldbank_debarred','World Bank debarred firms & individuals','debarment'],
 ['pk_na_members','Pakistan National Assembly members','pep'],['pk_senate_members','Pakistan Senate members','pep']
];
var LOADED={}, STATS=null;
function api(path,body){ return Promise.resolve(window.AFC_AUTH?window.AFC_AUTH.token():null).then(function(tok){
  var h={'Content-Type':'application/json'}; if(tok) h.Authorization='Bearer '+tok;
  return to(fetch(path,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined,credentials:'same-origin'}),25000).then(function(r){ return r.json().catch(function(){return {};}).then(function(j){ if(!r.ok){ var e=new Error(j.error||('HTTP '+r.status)); e.status=r.status; e.data=j; throw e; } return j; }); }); }); }
function loadStats(){ setSrc('OpenSanctions lists','load');
 return api('/api/stats').then(function(s){ STATS=s; LOADED={}; (s.lists||[]).forEach(function(l){ LOADED[l.id]=true; });
  setSrc('OpenSanctions lists',true); el('prog').style.width='100%'; el('lists-status').textContent=fmtInt(s.total||0)+' listed entries from '+(s.lists||[]).length+' official lists · updated '+(s.updated?new Date(s.updated).toLocaleString():'—'); onListsDone(); })
 .catch(function(){ setSrc('OpenSanctions lists',false); el('lists-status').textContent='Screening lists are refreshing — try again in a few minutes'; setTimeout(loadStats,3*60e3); }); }
function setQuota(q){ if(window.AFC_AUTH&&window.AFC_AUTH.setQuota) window.AFC_AUTH.setQuota(q); }
/* ================= external lookups ================= */
var WD='https://query.wikidata.org/sparql?format=json&query=';
var REL={P22:'father',P25:'mother',P26:'spouse',P40:'child',P3373:'sibling',P1038:'relative',P127:'owned by',P749:'parent organisation',P355:'subsidiary',P112:'founded by',P169:'chief executive',P488:'chairperson',P1830:'owner of',P108:'employer',P102:'political party'};
var RELKEYS=Object.keys(REL).filter(function(k){return k!=='P102';});
function sparql(q){ return getJSON(WD+encodeURIComponent(q),{headers:{Accept:'application/sparql-results+json'}},25000).then(function(j){ setSrc('Wikidata',true); return j.results.bindings; }).catch(function(e){ setSrc('Wikidata',false); throw e; }); }
var qid=function(u){return u?u.replace('http://www.wikidata.org/entity/',''):'';};
function wdSearch(q){ return getJSON('https://www.wikidata.org/w/api.php?action=wbsearchentities&search='+encodeURIComponent(q)+'&language=en&limit=7&format=json&origin=*').then(function(j){ return (j.search||[]).map(function(s){return {id:s.id,label:s.label,description:s.description||''};}); }).catch(function(){return [];}); }
function wpSearch(q){ return getJSON('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(q)+'&srlimit=5&srinfo=suggestion&format=json&origin=*').then(function(j){ setSrc('Wikipedia',true);
  var titles=(j.query.search||[]).map(function(s){return s.title;}); if(!titles.length) return [];
  return getJSON('https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles='+encodeURIComponent(titles.join('|'))+'&format=json&origin=*').then(function(p){ var pages=Object.values(p.query.pages||{}); return titles.map(function(t){ var pg=pages.filter(function(x){return x.title===t;})[0]; return pg&&pg.pageprops?{id:pg.pageprops.wikibase_item,label:t,description:'Wikipedia: '+t}:null; }).filter(Boolean); }); }).catch(function(){ setSrc('Wikipedia',false); return []; }); }
function resolveCandidates(q){ return Promise.all([wdSearch(q),wpSearch(q)]).then(function(r){ var seen={}, out=[]; r[0].concat(r[1]).forEach(function(c){ if(!c||seen[c.id]) return; seen[c.id]=1; out.push(c); }); return out; }); }
function egoQuery(id){
 var props='wdt:P31 wdt:P39 wdt:P102 wdt:P27 wdt:P17 wdt:P106 wdt:P1399 wdt:P1595 wdt:P19 wdt:P551 wdt:P159 wdt:P569 wdt:P463 wdt:P166 '+RELKEYS.map(function(k){return 'wdt:'+k;}).join(' ');
 return sparql('SELECT ?p ?o ?oLabel ?coord ?iso ?oDesc WHERE { VALUES ?p {'+props+'} wd:'+id+' ?p ?o . OPTIONAL{?o wdt:P625 ?coord} OPTIONAL{?o wdt:P297 ?iso} OPTIONAL{?o schema:description ?oDesc FILTER(lang(?oDesc)="en")} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400')
  .then(function(b){ var e={id:id,props:{},rel:[]}; b.forEach(function(x){ var p=x.p.value.split('/').pop(), v={id:qid(x.o.value),label:x.oLabel?x.oLabel.value:x.o.value,coord:x.coord?x.coord.value:null,iso:x.iso?x.iso.value:null,desc:x.oDesc?x.oDesc.value:''};
   (e.props[p]=e.props[p]||[]).push(v); if(REL[p]&&p!=='P102'&&/^Q\d+$/.test(v.id)) e.rel.push({p:p,to:v}); }); return e; }); }
function egoMeta(id){ return sparql('SELECT ?label ?desc (GROUP_CONCAT(DISTINCT ?alias;separator="|") AS ?aliases) ?article WHERE { wd:'+id+' rdfs:label ?label FILTER(lang(?label)="en") OPTIONAL{wd:'+id+' schema:description ?desc FILTER(lang(?desc)="en")} OPTIONAL{wd:'+id+' skos:altLabel ?alias FILTER(lang(?alias)="en")} OPTIONAL{?article schema:about wd:'+id+'; schema:isPartOf <https://en.wikipedia.org/>} } GROUP BY ?label ?desc ?article')
 .then(function(b){ var x=b[0]||{}; return {label:x.label?x.label.value:id,desc:x.desc?x.desc.value:'',aliases:x.aliases&&x.aliases.value?x.aliases.value.split('|'):[],article:x.article?x.article.value:null}; }); }
function neighbourQuery(ids){ if(!ids.length) return Promise.resolve([]);
 return sparql('SELECT ?s ?p ?o ?oLabel WHERE { VALUES ?s {'+ids.map(function(i){return 'wd:'+i;}).join(' ')+'} VALUES ?p {'+RELKEYS.map(function(k){return 'wdt:'+k;}).join(' ')+'} ?s ?p ?o . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 600')
  .then(function(b){ return b.map(function(x){return {s:qid(x.s.value),p:x.p.value.split('/').pop(),o:qid(x.o.value),oLabel:x.oLabel?x.oLabel.value:''};}).filter(function(x){return /^Q\d+$/.test(x.o);}); }); }
function nodeFacts(ids){ if(!ids.length) return Promise.resolve({});
 return sparql('SELECT ?s ?sLabel (COUNT(DISTINCT ?pos) AS ?pep) (GROUP_CONCAT(DISTINCT ?posL;separator="|") AS ?positions) (GROUP_CONCAT(DISTINCT ?crimeL;separator="|") AS ?crimes) (GROUP_CONCAT(DISTINCT ?chargeL;separator="|") AS ?charges) (SAMPLE(?t) AS ?type) (SAMPLE(?iso) AS ?ciso) WHERE { VALUES ?s {'+ids.map(function(i){return 'wd:'+i;}).join(' ')+'} OPTIONAL{?s wdt:P39 ?pos. ?pos rdfs:label ?posL FILTER(lang(?posL)="en")} OPTIONAL{?s wdt:P1399 ?crime. ?crime rdfs:label ?crimeL FILTER(lang(?crimeL)="en")} OPTIONAL{?s wdt:P1595 ?charge. ?charge rdfs:label ?chargeL FILTER(lang(?chargeL)="en")} OPTIONAL{?s wdt:P31 ?t} OPTIONAL{?s wdt:P27 ?c. ?c wdt:P297 ?iso} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". ?s rdfs:label ?sLabel. } } GROUP BY ?s ?sLabel')
  .then(function(b){ var m={}; b.forEach(function(x){ var id=qid(x.s.value); m[id]={label:x.sLabel?x.sLabel.value:id,pep:+x.pep.value>0,positions:x.positions.value?x.positions.value.split('|'):[],crimes:x.crimes.value?x.crimes.value.split('|'):[],charges:x.charges.value?x.charges.value.split('|'):[],human:x.type&&qid(x.type.value)==='Q5',iso:x.ciso?x.ciso.value:''}; }); return m; }); }
function icij(names){ var qs={}; names.forEach(function(n,i){ qs['q'+i]={query:n}; });
 return getJSON('https://offshoreleaks.icij.org/api/v1/reconcile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:qs})},20000).then(function(j){ setSrc('ICIJ Offshore Leaks',true);
  return names.map(function(n,i){ var qt=norm(n); return ((j['q'+i]||{}).result||[]).filter(function(r){ return !/^Address/i.test(r.description)&&nameScore(qt,norm(r.name))>=0.9; }).map(function(r){ var leak=(r.description.match(/from the (.+?) data/i)||[])[1]||r.description; return {id:r.id,name:r.name,type:(r.types&&r.types[0]&&r.types[0].name)||'',leak:leak.replace(/^the /i,''),score:Math.round(r.score),url:'https://offshoreleaks.icij.org/nodes/'+r.id}; }); }); })
 .catch(function(){ setSrc('ICIJ Offshore Leaks',false); return names.map(function(){return [];}); }); }
function interpol(name){ var t=String(name).trim().split(/\s+/); if(t.length<2) return Promise.resolve([]);
 return getJSON('https://ws-public.interpol.int/notices/v1/red?name='+encodeURIComponent(t[t.length-1])+'&forename='+encodeURIComponent(t.slice(0,-1).join(' '))+'&resultPerPage=20',{},15000).then(function(j){ setSrc('Interpol red notices (live)',true);
  var qt=norm(name); return ((j._embedded||{}).notices||[]).map(function(n){ var nm=(n.forename||'')+' '+(n.name||''); return {name:nm.trim(),dob:n.date_of_birth,nat:(n.nationalities||[]).join(', '),score:nameScore(qt,norm(nm)),url:'https://www.interpol.int/en/How-we-work/Notices/Red-Notices/View-Red-Notices#'+String(n.entity_id).replace('/','-')}; }).filter(function(n){return n.score>=0.86;}); })
 .catch(function(){ setSrc('Interpol red notices (live)',false); return []; }); }
var NEG_RE=/(corrupt|money[- ]launder|launder|convict|sentenc|arrest|indict|charged|charges|fraud|brib|embezzl|panama papers|pandora papers|paradise papers|accountability bureau|\bnab\b|reference|disqualif|sanction|kickback|tax evasion|smuggl|terror|misappropriat|scandal|investigat|probe|graft|kleptocra|seiz|freez|extradit|absconder|fugitive)/i;
function wikiExtract(title){ return getJSON('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles='+encodeURIComponent(title)+'&format=json&origin=*',{},20000).then(function(j){ var p=Object.values(j.query.pages||{})[0]||{}; return p.extract||''; }).catch(function(){return '';}); }
function adverseSentences(text){ if(!text) return {sents:[],cases:[]}; var sents=text.replace(/\n+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z])/).filter(function(s){return s.length>40&&s.length<600&&NEG_RE.test(s);});
 var cases={}; var re=/((?:[A-Z][A-Za-z'\-]+\s){0,3}(?:[A-Z][A-Za-z'\-]+))\s(reference|references|case|cases|scandal|Papers|inquiry|investigation|trial)\b/g, m;
 while((m=re.exec(text))){ var c=(m[1]+' '+m[2]).replace(/^(The|A|In|On|His|Her|Their|After|During)\s/,''); if(c.split(' ').length>=2) cases[c]=(cases[c]||0)+1; }
 return {sents:sents.slice(0,40),cases:Object.keys(cases).map(function(k){return {name:k,n:cases[k]};}).sort(function(a,b){return b.n-a.n;}).slice(0,25)}; }
var RSS='https://api.rss2json.com/v1/api.json?rss_url=';
function newsFor(name){ var q='"'+name+'" (corruption OR fraud OR "money laundering" OR bribery OR arrested OR convicted OR sanctions OR investigation OR case)';
 return getJSON(RSS+encodeURIComponent('https://www.bing.com/news/search?q='+encodeURIComponent(q)+'&format=rss'),{},15000).then(function(j){ if(j.status!=='ok') throw 0; setSrc('Adverse media (Bing News)',true);
  return (j.items||[]).map(function(it){ var t=textOf(it.title); return {title:t,link:it.link,date:it.pubDate,neg:NEG_RE.test(t+' '+textOf(it.description))}; }); })
 .catch(function(){ setSrc('Adverse media (Bing News)',false); return null; }); }
function textOf(h){ try{return (new DOMParser().parseFromString(h||'','text/html').body.textContent||'').replace(/\s+/g,' ').trim();}catch(e){return '';} }

/* ================= risk model ================= */
var MODEL=[
 ['Sanctions list match (strong / possible)','60 / 30'],['Terrorist or proscribed list match','60 / 30'],['Wanted: Interpol red notice or FBI','50 / 25'],['Debarred (World Bank)','25 / 12'],
 ['Convicted of a crime (Wikidata)','35'],['Charged with a crime (Wikidata)','20'],['Politically exposed person (positions held, parliament lists)','25 · tier floor High'],['Relative or close associate of a PEP','15 · tier floor Medium'],
 ['Offshore leaks (Panama, Paradise, Pandora…)','20 + 5 per extra record, max 30'],['Network: connected person or company sanctioned / convicted','15'],['Network: connected person in offshore leaks','10'],
 ['Adverse media: Wikipedia sentences (≥3 / ≥8)','10 / 15'],['Adverse media: negative news headlines ≥3','10'],['Country risk of citizenship (High / Medium)','15 / 8']
];
function tierOf(s){ return s>=75?'Critical':s>=50?'High':s>=25?'Medium':'Low'; }
var TCOL=function(t){return t==='Critical'?C('--crit'):t==='High'?C('--bad'):t==='Medium'?C('--warn'):C('--ok');};
function score(P){ var F=[], add=function(pts,label,ev){ if(pts>0) F.push({pts:pts,label:label,ev:ev}); };
 ['sanction','terror','wanted','debarment'].forEach(function(cat){ var hits=P.lists.filter(function(h){return h.row.cat===cat;}); if(!hits.length) return; var top=hits[0];
  var base={sanction:[60,30],terror:[60,30],wanted:[50,25],debarment:[25,12]}[cat]; var strong=top.score>=0.92;
  add(strong?base[0]:base[1],{sanction:'Sanctions list',terror:'Terrorist / proscribed list',wanted:'Wanted list',debarment:'Debarment list'}[cat]+(strong?' — strong match':' — possible match'),top.row.list+': '+top.row.name+' ('+Math.round(top.score*100)+'% match)'); });
 if(P.interpol.length&&!P.lists.some(function(h){return h.row.cat==='wanted';})) add(P.interpol[0].score>=0.92?50:25,'Interpol red notice (live)',P.interpol[0].name);
 if(P.ego.crimes.length) add(35,'Convicted of a crime',P.ego.crimes.join(', '));
 if(P.ego.charges.length) add(20,'Charged with a crime',P.ego.charges.join(', '));
 var pepList=P.lists.filter(function(h){return h.row.cat==='pep'&&h.score>=0.9;});
 var isPEP=P.ego.positions.length>0||pepList.length>0; if(isPEP) add(25,'Politically exposed person',(P.ego.positions.slice(0,4).join('; ')||pepList[0].row.list));
 var rca=P.graph.nodes.filter(function(n){return n.depth===1&&n.pep&&n.human;}); if(!isPEP&&rca.length) add(15,'Relative or close associate of a PEP',rca.slice(0,4).map(function(n){return n.label+' ('+n.rel+')';}).join('; '));
 if(P.leaks.length) add(Math.min(30,20+5*(P.leaks.length-1)),'Named in offshore leaks',P.leaks.slice(0,3).map(function(l){return l.leak;}).filter(function(v,i,a){return a.indexOf(v)===i;}).join(', '));
 var netBad=P.graph.nodes.filter(function(n){return n.depth>0&&(n.sanction||n.crimes&&n.crimes.length);}); if(netBad.length) add(15,'Connected to sanctioned or convicted parties',netBad.slice(0,4).map(function(n){return n.label;}).join('; '));
 var netLeak=P.graph.nodes.filter(function(n){return n.depth>0&&n.leaks;}); if(netLeak.length) add(10,'Connected to people in offshore leaks',netLeak.slice(0,5).map(function(n){return n.label;}).join('; '));
 var ns=P.adverse.sents.length; if(ns>=3) add(ns>=8?15:10,'Adverse mentions in Wikipedia article',ns+' sentences on corruption, fraud, cases or sanctions');
 var nn=P.news?P.news.filter(function(n){return n.neg;}).length:0; if(nn>=3) add(10,'Negative news coverage',nn+' recent headlines');
 var cr=P.countries.map(countryRisk).sort(function(a,b){ var o={High:2,Medium:1,Low:0}; return o[b.tier]-o[a.tier]; })[0]; if(cr&&cr.tier!=='Low') add(cr.tier==='High'?15:8,'Country risk: '+cr.name,cr.tier+(cr.fatf?' · FATF '+cr.fatf:'')+(cr.eu?' · EU high-risk':'')+(cr.basel?' · Basel '+cr.basel:''));
 var total=Math.min(100,d3.sum(F,function(f){return f.pts;})), tier=tierOf(total), floor='';
 if(isPEP&&(tier==='Low'||tier==='Medium')){ tier='High'; floor='Tier raised to High: PEPs require enhanced due diligence and senior-management approval (FATF R.12).'; }
 else if(rca.length&&tier==='Low'){ tier='Medium'; floor='Tier raised to Medium: relatives and close associates of PEPs require enhanced checks (FATF R.12).'; }
 return {total:total,tier:tier,factors:F.sort(function(a,b){return b.pts-a.pts;}),floor:floor,isPEP:isPEP,rca:rca}; }
var REC={Critical:'Do not onboard or transact without MLRO / Financial Crime Compliance approval. Escalate, document the match review and consider a suspicious activity report if the relationship already exists.',
 High:'Enhanced due diligence required: verify identity against the matched records, establish source of wealth and source of funds, obtain senior-management approval and apply ongoing enhanced monitoring.',
 Medium:'Review the potential matches and adverse information; apply enhanced checks proportionate to the findings before onboarding.',
 Low:'No material risk indicators found in the sources checked. Apply standard customer due diligence.'};

/* ================= screening flow ================= */
var CUR=null, RUN=0;
function screen(q,opts){ opts=opts||{}; clearTimeout(window.__taT); var tl=el('ta-list'); if(tl) tl.hidden=true; var run=++RUN; var res=el('result'); res.replaceChildren(); var c=mk('div','card'); c.appendChild(mk('div','empty')).innerHTML='<span class="spin"></span>Screening across sanctions lists, Wikidata, Wikipedia, offshore leaks, Interpol and news…'; res.appendChild(c);
 var year=parseInt(el('qdob').value,10)||null, country=el('qcountry').value||null, type=el('qtype').value;
 var listHits=[];
 var candP=opts.qid?Promise.resolve([{id:opts.qid,label:q,description:''}]):resolveCandidates(q);
 candP.then(function(cands){ if(run!==RUN) return;
  // choose best candidate whose label matches
  var qt=norm(q); cands.forEach(function(c){ c.m=nameScore(qt,norm(c.label)); });
  var pick=opts.qid?cands[0]:cands.slice().sort(function(a,b){return b.m-a.m;})[0];
  if(pick&&!opts.qid&&pick.m<0.8) pick=null;
  var alts=cands.filter(function(c){return !pick||c.id!==pick.id;}).slice(0,6);
  var name=pick?pick.label:q;
  var egoP=pick?Promise.all([egoMeta(pick.id),egoQuery(pick.id)]):Promise.resolve([null,null]);
  return egoP.then(function(r){ if(run!==RUN) return; var meta=r[0], ego=r[1];
   var P={q:q,name:meta?meta.label:q,qid:pick?pick.id:null,desc:meta?meta.desc:'',aliases:meta?meta.aliases:[],article:meta?meta.article:null,alts:alts,year:year,country:country,
    ego:{positions:[],crimes:[],charges:[],props:ego?ego.props:{}},lists:listHits,interpol:[],leaks:[],news:null,adverse:{sents:[],cases:[]},graph:{nodes:[],links:[]},countries:[]};
   if(ego){ var pp=ego.props; P.ego.positions=(pp.P39||[]).map(function(x){return x.label;}); P.ego.crimes=(pp.P1399||[]).map(function(x){return x.label;}); P.ego.charges=(pp.P1595||[]).map(function(x){return x.label;});
    P.countries=(pp.P27||[]).concat(pp.P17||[]).map(function(x){return x.iso;}).filter(Boolean);
    P.human=(pp.P31||[]).some(function(x){return x.id==='Q5';}); P.dob=(pp.P569||[]).map(function(x){return x.label.slice(0,10);})[0]||''; }
   var aliasList=[P.name].concat(P.aliases).filter(function(al){return al!==q&&infoTokens(norm(al))>=2;}).slice(0,8);
   return api('/api/screen',{q:q,aliases:aliasList,year:year||(P.dob?parseInt(P.dob,10):null),country:country||(P.countries[0]||null),type:type}).then(function(sr){ if(run!==RUN) return;
   P.lists=dedupeHits(sr.hits||[]); P.ticket=sr.ticket; setQuota(sr.quota);
   if(!P.countries.length){ var lc={}; P.lists.filter(function(h){return h.score>=0.92;}).forEach(function(h){ (h.row.countries||[]).forEach(function(c){lc[c.toUpperCase()]=1;}); }); P.countries=Object.keys(lc); }
   // graph
   var nonPep=P.lists.filter(function(h){return h.row.cat!=='pep';}).length;
   P.st={lists:{s:Object.keys(LOADED).length?(nonPep?'hit':'ok'):'load',n:P.lists.length},wikidata:{s:pick?'ok':'err',n:P.ego.positions.length?'PEP':null},network:{s:ego?'load':'err'},leaks:{s:'load'},interpol:{s:'load'},wiki:{s:P.article?'load':'err'},news:{s:'load'}};
   var gP=(ego?buildGraph(P,ego):Promise.resolve()).then(function(){ var bad=P.graph.nodes.some(function(n){return n.depth>0&&(n.sanction||(n.crimes&&n.crimes.length));}); P.st.network={s:ego?(bad?'hit':'ok'):'err',n:Math.max(0,P.graph.nodes.length-1)}; },function(){ P.st.network={s:'err'}; });
   var leakNames=[P.name].concat(P.aliases.filter(function(a){return infoTokens(norm(a))>=2;}).slice(0,5));
   var leakP=icij(leakNames).then(function(rs){ var all=[], seen={}; rs.forEach(function(arr){ arr.forEach(function(x){ if(!seen[x.id]){seen[x.id]=1; all.push(x);} }); }); P.leaks=all; P.st.leaks={s:all.length?'hit':(SRC['ICIJ Offshore Leaks']===false?'err':'ok'),n:all.length}; });
   var ipP=(P.human!==false&&type!=='org')?interpol(P.name).then(function(x){P.interpol=x; P.st.interpol={s:x.length?'hit':(SRC['Interpol red notices (live)']===false?'err':'ok'),n:x.length};}):Promise.resolve().then(function(){P.st.interpol={s:'ok',n:'n/a'};});
   var wkP=(P.article?wikiExtract(decodeURIComponent(P.article.split('/wiki/')[1]).replace(/_/g,' ')):Promise.resolve('')).then(function(t){ P.adverse=adverseSentences(t); P.wikiLen=t.length; P.st.wiki={s:!P.article?'err':P.adverse.sents.length>=3?'hit':'ok',n:P.adverse.sents.length}; });
   var nwP=newsFor(P.name).then(function(n){P.news=n; var neg=n?n.filter(function(x){return x.neg;}).length:0; P.st.news={s:n===null?'err':neg>=3?'hit':'ok',n:n===null?'limited':neg+' negative'};});
   CUR=P; renderProfile(P,true);
   [gP,leakP,ipP,wkP,nwP].forEach(function(p){ p.then(function(){ if(run===RUN) renderProfile(P,true); }).catch(function(){}); });
   return Promise.all([gP,leakP,ipP,wkP,nwP].map(function(p){return p.catch(function(){});})).then(function(){ if(run!==RUN) return; P.done=true; renderProfile(P,false); });
   });
  });
 }).catch(function(e){ res.replaceChildren(); if(e&&(e.status===402||e.status===429)&&e.data&&e.data.error==='quota'){ setQuota(e.data.quota); if(window.AFC_AUTH) window.AFC_AUTH.limitReached(e.data); res.appendChild(quotaCard(e.data)); return; } var c=mk('div','card'); c.appendChild(mk('div','empty','Screening failed: '+(e.status===429?'too many requests, please wait a minute':e.message)+'.')); res.appendChild(c); });
}
function quotaCard(d){ var c=mk('div','card hero'); c.appendChild(mk('h2',null,d.anonymous?'You have used your free checks':'Monthly limit reached'));
 c.appendChild(mk('p','note',d.anonymous?'Anonymous visitors can screen '+d.quota.limit+' entities per day. Create a free account for more checks each month, or upgrade for unlimited professional screening.':'Your plan includes '+d.quota.limit+' checks per period. Upgrade for more.'));
 var ch=mk('div','chips'); if(d.anonymous){ var b1=mk('button','btn primary','Create free account'); b1.onclick=function(){ window.AFC_AUTH&&window.AFC_AUTH.open('signup'); }; ch.appendChild(b1); } var b2=mk('a','btn','See plans'); b2.href='/pricing/'; ch.appendChild(b2); c.appendChild(ch); return c; }
function dedupeHits(h){ var seen={}, out=[]; h.sort(function(a,b){return b.score-a.score;}).forEach(function(x){ if(seen[x.row.id+x.row.listId]) return; seen[x.row.id+x.row.listId]=1; out.push(x); }); return out; }
function buildGraph(P,ego){
 var nodes=[{id:P.qid,label:P.name,depth:0,human:P.human,pep:P.ego.positions.length>0,crimes:P.ego.crimes,charges:P.ego.charges,positions:P.ego.positions,iso:(P.countries[0]||'')}], links=[], byId={}; byId[P.qid]=nodes[0];
 ego.rel.slice(0,30).forEach(function(r){ if(!byId[r.to.id]){ byId[r.to.id]={id:r.to.id,label:r.to.label,depth:1,rel:REL[r.p]}; nodes.push(byId[r.to.id]); } links.push({source:P.qid,target:r.to.id,rel:REL[r.p]}); });
 var l1=nodes.filter(function(n){return n.depth===1;}).map(function(n){return n.id;});
 return neighbourQuery(l1).then(function(ex){ var extra=0;
  ex.forEach(function(x){ if(x.o===P.qid) { if(!links.some(function(l){return (l.source===x.s&&l.target===x.o)||(l.source===x.o&&l.target===x.s);})) links.push({source:x.s,target:x.o,rel:REL[x.p]}); return; }
   if(!byId[x.o]){ if(extra>=60) return; extra++; byId[x.o]={id:x.o,label:x.oLabel,depth:2,rel:REL[x.p]}; nodes.push(byId[x.o]); }
   if(!links.some(function(l){return (l.source===x.s&&l.target===x.o)||(l.source===x.o&&l.target===x.s);})) links.push({source:x.s,target:x.o,rel:REL[x.p]}); });
  return nodeFacts(nodes.map(function(n){return n.id;}));
 }).then(function(f){ nodes.forEach(function(n){ var x=f[n.id]; if(!x) return; n.label=x.label||n.label; if(n.depth>0){ n.pep=x.pep; n.positions=x.positions; n.crimes=x.crimes; n.charges=x.charges; } n.human=x.human; n.iso=x.iso||n.iso; });
  var netNames=nodes.filter(function(n){return n.depth>0;}).slice(0,60).map(function(n){return n.label;});
  return (P.ticket&&netNames.length?api('/api/network',{ticket:P.ticket,names:netNames}).catch(function(){return {hits:{}};}):Promise.resolve({hits:{}})).then(function(nr){
  nodes.forEach(function(n){ if(n.depth===0) return; var h=(nr.hits||{})[n.label]; if(h&&h.length){ n.sanction=h[0].list; } });
  P.graph={nodes:nodes,links:links};
  var names=nodes.filter(function(n){return n.depth>0;}).slice(0,40).map(function(n){return n.label;});
  return icij(names).then(function(rs){ rs.forEach(function(arr,i){ if(arr.length){ var n=nodes.filter(function(n){return n.depth>0;})[i]; n.leaks=arr.map(function(a){return a.leak;}).filter(function(v,j,a){return a.indexOf(v)===j;}).join(', '); n.leakUrl=arr[0].url; } }); });
  });
 }); }

/* ================= profile rendering ================= */

var SUB='overview';
function countUp(node,to,ms){ var from=+node.dataset.v||0; node.dataset.v=to; d3.select(node).transition().duration(ms||900).ease(d3.easeCubicOut).tween('text',function(){ var i=d3.interpolateNumber(from,to); return function(t){ node.textContent=Math.round(i(t)); }; }); }
function ckChip(label,st,n){ var c=mk('span','ck '+(st==='hit'?'hit':st==='ok'?'ok':st==='err'?'err':'')); if(st==='load'||!st) c.appendChild(mk('span','spin')); else c.appendChild(document.createTextNode(st==='hit'?'⚑':st==='err'?'✕':'✓')); c.appendChild(document.createTextNode(label+(n!=null&&st!=='load'?' · '+n:''))); return c; }
function renderProfile(P,partial){
 var res=el('result'); var R=score(P); P.risk=R; var prev=P._shown||0; P._shown=R.total; res.replaceChildren();
 var head=mk('div','card hero'); head.style.setProperty('--glow',TCOL(R.tier)); var v=mk('div','verdict');
 var g=mk('div','gauge'); var svg=d3.select(g).append('svg').attr('viewBox','0 0 180 180').attr('width',180).attr('height',180);
 var defs=svg.append('defs'); var gid='gg'+Math.random().toString(36).slice(2,7); var lg=defs.append('linearGradient').attr('id',gid).attr('x1','0').attr('x2','1');
 lg.append('stop').attr('offset','0').attr('stop-color',C('--ok')); lg.append('stop').attr('offset','.45').attr('stop-color',C('--warn')); lg.append('stop').attr('offset','.75').attr('stop-color',C('--bad')); lg.append('stop').attr('offset','1').attr('stop-color',C('--crit'));
 var fid='gf'+Math.random().toString(36).slice(2,7); var f=defs.append('filter').attr('id',fid).attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%'); f.append('feGaussianBlur').attr('stdDeviation',4).attr('result','b'); var fm=f.append('feMerge'); fm.append('feMergeNode').attr('in','b'); fm.append('feMergeNode').attr('in','SourceGraphic');
 var arc=d3.arc().innerRadius(66).outerRadius(80).cornerRadius(7).startAngle(-Math.PI*0.75);
 var gg=svg.append('g').attr('transform','translate(90,90)');
 gg.append('path').attr('d',arc({endAngle:Math.PI*0.75})).style('fill','rgba(148,178,230,.08)');
 for(var t=0;t<=10;t++){ var a=-Math.PI*0.75+Math.PI*1.5*t/10; gg.append('line').attr('x1',Math.sin(a)*58).attr('y1',-Math.cos(a)*58).attr('x2',Math.sin(a)*62).attr('y2',-Math.cos(a)*62).style('stroke','rgba(148,178,230,.35)').style('stroke-width',1.5); }
 var fg=gg.append('path').style('fill','url(#'+gid+')').attr('filter','url(#'+fid+')');
 fg.transition().duration(1000).ease(d3.easeCubicOut).attrTween('d',function(){ var i=d3.interpolateNumber(prev,R.total); return function(t){ return arc({endAngle:-Math.PI*0.75+Math.PI*1.5*i(t)/100}); }; });
 var gv=mk('div','v'); var b=mk('b',null,String(prev)); b.dataset.v=prev; gv.appendChild(b); var sp=mk('span',null,R.tier+' risk'); sp.style.color=TCOL(R.tier); sp.style.textShadow='0 0 14px '+TCOL(R.tier); gv.appendChild(sp); g.appendChild(gv); v.appendChild(g); countUp(b,R.total,1000);
 var info=mk('div'); info.appendChild(mk('p','ename',P.name)); info.appendChild(mk('div','note',[P.desc,P.dob?'born '+P.dob:'',P.countries.map(cn).join(', ')].filter(Boolean).join(' · ')||'No Wikidata profile found — screened on name only'));
 var fl=mk('div','flags'); var addF=function(t,c){fl.appendChild(mk('span','flag '+c,t));};
 var cats={}; P.lists.forEach(function(h){ if(h.score>=0.84) cats[h.row.cat]=Math.max(cats[h.row.cat]||0,h.score); });
 if(cats.sanction) addF(cats.sanction>=0.92?'⛔ Sanctions match':'Possible sanctions match','r'); if(cats.terror) addF('Terror / proscribed list','r'); if(cats.wanted||P.interpol.length) addF('Wanted / red notice','r'); if(cats.debarment) addF('Debarred','a');
 if(R.isPEP) addF('★ PEP','a'); else if(R.rca.length) addF('PEP relative / associate (RCA)','a');
 if(P.ego.crimes.length) addF('Convicted','r'); if(P.ego.charges.length) addF('Charged','r'); if(P.leaks.length) addF('Offshore leaks ('+P.leaks.length+')','v');
 if(P.graph.nodes.some(function(n){return n.depth>0&&(n.sanction||(n.crimes&&n.crimes.length));})) addF('Linked to convicted / sanctioned party','r');
 if(P.adverse.sents.length>=3) addF('Adverse media','a'); if(!fl.childNodes.length) addF(partial?'Checking…':'✓ No hits','g');
 info.appendChild(fl);
 var rec=mk('div','rec'); rec.style.borderLeftColor=TCOL(R.tier); rec.appendChild(mk('b',null,'Recommendation: ')); rec.appendChild(document.createTextNode(REC[R.tier])); if(R.floor){ rec.appendChild(mk('div','note',R.floor)); } info.appendChild(rec);
 var st=P.st||{}; var ck=mk('div','checks');
 [['Watchlists','lists'],['Wikidata','wikidata'],['Network','network'],['Offshore leaks','leaks'],['Interpol','interpol'],['Wikipedia','wiki'],['News','news']].forEach(function(x){ var s=st[x[1]]||{}; ck.appendChild(ckChip(x[0],s.s||'load',s.n)); });
 info.appendChild(ck);
 if(P.alts&&P.alts.length){ var al=mk('div','chips'); al.style.marginTop='10px'; al.appendChild(mk('span','note','Not the right one? ')); P.alts.forEach(function(a){ var c=mk('button','chip',a.label+(a.description?' — '+a.description.slice(0,40):'')); c.onclick=function(){ el('q').value=a.label; screen(a.label,{qid:a.id}); }; al.appendChild(c); }); info.appendChild(al); }
 v.appendChild(info); head.appendChild(v); if(partial) head.classList.add('scan'); res.appendChild(head);
 var body=mk('div','card'); var stb=mk('div','subtabs');
 var nNeg=P.news?P.news.filter(function(n){return n.neg;}).length:0;
 var tabs=[['overview','Risk breakdown',R.factors.length,R.factors.length>0],['lists','Sanctions & watchlists',P.lists.length+P.interpol.length,P.lists.some(function(h){return h.row.cat!=='pep';})||P.interpol.length],['network','Relationship network',Math.max(0,P.graph.nodes.length-1),P.graph.nodes.some(function(n){return n.depth>0&&(n.sanction||(n.crimes&&n.crimes.length));})],['leaks','Offshore leaks',P.leaks.length,P.leaks.length],['media','Adverse media',P.adverse.sents.length+nNeg,P.adverse.sents.length>=3||nNeg>=3],['crimes','Crimes & cases',P.ego.crimes.length+P.ego.charges.length+P.adverse.cases.length,P.ego.crimes.length||P.ego.charges.length],['locations','Locations',null],['sources','Sources & export',null]];
 tabs.forEach(function(t){ var bb=mk('button','subtab',t[1]); bb.setAttribute('aria-selected',String(SUB===t[0])); if(t[2]!=null){ var n=mk('span','n'+(t[3]?' hot':''),String(t[2])); bb.appendChild(n); } bb.onclick=function(){ SUB=t[0]; renderProfile(P,!P.done); }; stb.appendChild(bb); });
 body.appendChild(stb); var pane=mk('div','panel'); body.appendChild(pane); res.appendChild(body);
 ({overview:paneOverview,lists:paneLists,network:paneNetwork,leaks:paneLeaks,media:paneMedia,crimes:paneCrimes,locations:paneLocations,sources:paneSources})[SUB](pane,P,R);
}
function table(cols,rows){ var t=mk('table'), th=mk('thead'), tr=mk('tr'); cols.forEach(function(c){ tr.appendChild(mk('th',c.hide?'hn':null,c.l)); }); th.appendChild(tr); t.appendChild(th); var tb=mk('tbody');
 rows.forEach(function(r){ var row=mk('tr'); cols.forEach(function(c){ var td=mk('td',(c.cls||'')+(c.hide?' hn':'')); var v=c.f?c.f(r):r[c.k]; if(v instanceof Node) td.appendChild(v); else td.textContent=v==null||v===''?'—':v; row.appendChild(td); }); tb.appendChild(row); }); t.appendChild(tb); var bx=mk('div','tbox'); bx.appendChild(t); return bx; }
var link=function(u,t){ if(!u) return '—'; var a=mk('a',null,t||'open'); a.href=u; a.target='_blank'; a.rel='noopener noreferrer'; return a; };
var pill=function(s){ var p=mk('span','score',Math.round(s*100)+'%'); p.style.background=s>=0.92?C('--bad'):s>=0.88?C('--warn'):C('--axis'); return p; };

function paneOverview(p,P,R){ var k=mk('div','kpis'); [['Risk score',R.total],['Watchlist hits',P.lists.filter(function(h){return h.row.cat!=='pep';}).length+P.interpol.length],['Offshore leak records',P.leaks.length],['Network size',Math.max(0,P.graph.nodes.length-1)],['Adverse mentions',P.adverse.sents.length]].forEach(function(x){ var d=mk('div','kpi'); d.appendChild(mk('div','l',x[0])); var vv=mk('div','v','0'); d.appendChild(vv); k.appendChild(d); countUp(vv,x[1],800); }); p.appendChild(k);
 var h=mk('h3',null,'Score composition'); h.style.margin='16px 0 2px'; p.appendChild(h);
 var stack=mk('div','stack'); var palette=[C('--bad'),C('--c1'),C('--warn'),C('--c3'),C('--c2'),C('--c0'),C('--c6'),C('--c5')];
 var tip=mk('div','tip'); tip.hidden=true; p.style.position='relative'; p.appendChild(tip);
 R.factors.forEach(function(f,i){ var s=mk('i'); s.style.background=palette[i%palette.length]; s.style.flexGrow='0'; s.style.flexBasis='0'; s.title=f.label+' +'+f.pts; stack.appendChild(s); requestAnimationFrame(function(){ setTimeout(function(){ s.style.flexBasis=f.pts+'%'; s.style.transition='flex-basis .9s cubic-bezier(.2,.8,.2,1)'; },30); }); });
 p.appendChild(stack); p.appendChild(mk('div','note',R.total+' of 100 points'+(R.floor?' · '+R.floor:'')));
 var h2=mk('h3',null,'Why this score'); h2.style.margin='12px 0 2px'; p.appendChild(h2);
 if(!R.factors.length) p.appendChild(mk('div','empty','No risk factors found in the sources checked.'));
 R.factors.forEach(function(f,i){ var d=mk('div','factor'); d.style.animationDelay=(i*60)+'ms'; d.appendChild(mk('div',null,f.label)); var pt=mk('div','pts','+'+f.pts); var col=palette[i%palette.length]; pt.style.color=col; d.appendChild(pt); var bar=mk('div','bar'); var bi=mk('i'); bi.style.background=col; bi.style.boxShadow='0 0 10px '+col; bar.appendChild(bi); d.appendChild(bar); d.appendChild(mk('div','ev',f.ev)); p.appendChild(d); setTimeout(function(){ bi.style.width=Math.min(100,f.pts/60*100)+'%'; },60+i*60); });
 var fp=mk('div','disc'); fp.style.marginTop='14px'; fp.textContent='False-positive control: list matches below 92% count as "possible" (half points). Add the birth year and country above to confirm or rule out matches — mismatching records are down-weighted automatically.'; p.appendChild(fp); }
function paneLists(p,P){ var rows=P.lists.map(function(h){return {h:h};});
 p.appendChild(mk('p','note','Matches against '+Object.keys(LOADED).length+' official lists from OpenSanctions ('+fmtInt(STATS?STATS.total:0)+' entries), refreshed every 6 hours.'));
 if(!rows.length&&!P.interpol.length){ p.appendChild(mk('div','empty','No sanctions, terrorist, wanted, debarment or parliament-list matches.')); return; }
 p.appendChild(table([{l:'Match',f:function(r){return pill(r.h.score);}},{l:'Listed name',f:function(r){return r.h.row.name+(r.h.via!==r.h.row.name?' (alias: '+r.h.via+')':'');}},{l:'List',f:function(r){return r.h.row.list;}},{l:'Type',f:function(r){return {sanction:'Sanctions',terror:'Terror / proscribed',wanted:'Wanted',debarment:'Debarment',pep:'PEP list'}[r.h.row.cat];}},
  {l:'Birth date',f:function(r){return r.h.row.dob;},cls:'nw',hide:true},{l:'Countries',f:function(r){return r.h.row.countries.map(cn).join(', ');},hide:true},{l:'Programme / reason',f:function(r){return r.h.row.sanctions||r.h.row.program;},hide:true},{l:'Listed since',f:function(r){return (r.h.row.first_seen||'').slice(0,10);},cls:'nw',hide:true},{l:'Match notes',f:function(r){return r.h.notes.join('; ');},hide:true},{l:'Record',f:function(r){return link('https://www.opensanctions.org/entities/'+r.h.row.id+'/','OpenSanctions');}}],rows));
 if(P.interpol.length){ p.appendChild(mk('h3',null,'Interpol red notices (live search)')); p.appendChild(table([{l:'Match',f:function(r){return pill(r.score);}},{l:'Name',k:'name'},{l:'Birth date',k:'dob'},{l:'Nationality',k:'nat'},{l:'Notice',f:function(r){return link(r.url,'Interpol');}}],P.interpol)); } }
function paneLeaks(p,P){ p.appendChild(mk('p','note','ICIJ Offshore Leaks database: Panama Papers, Paradise Papers, Pandora Papers, Bahamas Leaks and Offshore Leaks. Searched for the name and its known aliases. Appearing in the database does not by itself indicate wrongdoing.'));
 if(!P.leaks.length){ p.appendChild(mk('div','empty','No offshore-leaks records matched.')); return; }
 p.appendChild(table([{l:'Name in leak',k:'name'},{l:'Role',k:'type'},{l:'Leak / dataset',k:'leak'},{l:'Relevance',f:function(r){return r.score+'%';},cls:'num'},{l:'Record',f:function(r){return link(r.url,'ICIJ');}}],P.leaks));
 var net=P.graph.nodes.filter(function(n){return n.depth>0&&n.leaks;}); if(net.length){ p.appendChild(mk('h3',null,'Connected people in offshore leaks')); p.appendChild(table([{l:'Name',k:'label'},{l:'Relationship',k:'rel'},{l:'Leaks',k:'leaks'},{l:'Record',f:function(r){return link(r.leakUrl,'ICIJ');}}],net)); } }
function paneMedia(p,P){ var h=mk('h3',null,'Adverse mentions in the Wikipedia article'); p.appendChild(h);
 if(!P.adverse.sents.length) p.appendChild(mk('div','empty',P.article?'No sentences about corruption, fraud, cases or sanctions found.':'No Wikipedia article found.'));
 var re=new RegExp(NEG_RE.source,'gi');
 P.adverse.sents.forEach(function(s){ var d=mk('div','snip'); var last=0, m; re.lastIndex=0; while((m=re.exec(s))){ d.appendChild(document.createTextNode(s.slice(last,m.index))); d.appendChild(mk('mark',null,m[0])); last=m.index+m[0].length; } d.appendChild(document.createTextNode(s.slice(last))); p.appendChild(d); });
 if(P.article){ var a=link(P.article,'Read the full article on Wikipedia'); var dd=mk('div','note'); dd.appendChild(a); p.appendChild(dd); }
 var h2=mk('h3',null,'Recent news'); h2.style.marginTop='14px'; p.appendChild(h2);
 if(P.news===null){ var d=mk('div','note','Live news search is rate-limited right now. Search directly: '); d.appendChild(link('https://news.google.com/search?q='+encodeURIComponent('"'+P.name+'" corruption OR fraud OR laundering'),'Google News')); d.appendChild(document.createTextNode(' · ')); d.appendChild(link('https://www.bing.com/news/search?q='+encodeURIComponent('"'+P.name+'" corruption OR fraud OR laundering'),'Bing News')); p.appendChild(d); }
 else if(!P.news.length) p.appendChild(mk('div','empty','No recent news found.'));
 else P.news.forEach(function(n){ var it=mk('div','item'); it.appendChild(mk('div','t',n.date?String(n.date).slice(0,10):'')); var b=mk('div'); var a=link(n.link,n.title); b.appendChild(a); b.appendChild(mk('div','meta',n.neg?'Negative keywords present':'Neutral')); it.appendChild(b); p.appendChild(it); }); }
function paneCrimes(p,P){ var any=false;
 if(P.ego.crimes.length||P.ego.charges.length){ any=true; p.appendChild(mk('h3',null,'Convictions and charges (Wikidata)')); p.appendChild(table([{l:'Type',k:'t'},{l:'Offence',k:'o'}],P.ego.crimes.map(function(c){return {t:'Convicted of',o:c};}).concat(P.ego.charges.map(function(c){return {t:'Charged with',o:c};})))); }
 if(P.adverse.cases.length){ any=true; var h=mk('h3',null,'Papers, cases and references named in public sources'); h.style.marginTop='12px'; p.appendChild(h); p.appendChild(mk('p','note','Extracted from the Wikipedia article; open the article to read the context.')); var ch=mk('div','chips'); P.adverse.cases.forEach(function(c){ ch.appendChild(mk('span','chip',c.name+(c.n>1?' ×'+c.n:''))); }); p.appendChild(ch); }
 var leaks=Array.from(new Set(P.leaks.map(function(l){return l.leak;}))); if(leaks.length){ any=true; var h2=mk('h3',null,'Leak datasets'); h2.style.marginTop='12px'; p.appendChild(h2); var c2=mk('div','chips'); leaks.forEach(function(l){c2.appendChild(mk('span','chip',l));}); p.appendChild(c2); }
 var net=P.graph.nodes.filter(function(n){return n.depth>0&&((n.crimes&&n.crimes.length)||(n.charges&&n.charges.length)||n.sanction);});
 if(net.length){ any=true; var h3=mk('h3',null,'Crimes and listings in the network'); h3.style.marginTop='12px'; p.appendChild(h3); p.appendChild(table([{l:'Name',k:'label'},{l:'Relationship',k:'rel'},{l:'Convicted / charged',f:function(r){return (r.crimes||[]).concat(r.charges||[]).join(', ');}},{l:'Listed on',f:function(r){return r.sanction||'';}}],net)); }
 if(!any) p.appendChild(mk('div','empty','No crimes, charges or named cases found in the sources checked.')); }
function paneSources(p,P,R){
 var rows=[{s:'OpenSanctions lists',what:Object.keys(LOADED).length+' lists, '+fmtInt(STATS?STATS.total:0)+' entries',u:'https://www.opensanctions.org/'},{s:'Wikidata',what:P.qid?('Entity '+P.qid):'No entity',u:P.qid?'https://www.wikidata.org/wiki/'+P.qid:null},{s:'Wikipedia',what:P.article?'Article text analysed':'No article',u:P.article},{s:'ICIJ Offshore Leaks',what:P.leaks.length+' records',u:'https://offshoreleaks.icij.org/search?q='+encodeURIComponent(P.name)},{s:'Interpol red notices',what:P.interpol.length+' matches',u:'https://www.interpol.int/How-we-work/Notices/Red-Notices/View-Red-Notices'},{s:'Bing News',what:P.news===null?'Rate-limited':(P.news.length+' headlines'),u:'https://www.bing.com/news/search?q='+encodeURIComponent(P.name)},{s:'Country risk',what:'FATF Jun 2026 · EU list 2026 · Basel AML Index 2025',u:'https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html'}];
 p.appendChild(table([{l:'Source',k:'s'},{l:'What was used',k:'what'},{l:'Link',f:function(r){return link(r.u,'open');}}],rows));
 var bx=mk('div','chips'); bx.style.marginTop='12px';
 var b1=mk('button','btn','Download screening report (CSV)'); b1.onclick=function(){ var out=[{section:'Summary',name:P.name,detail:'Score '+R.total+' — '+R.tier+' risk',source:P.qid?'https://www.wikidata.org/wiki/'+P.qid:''}];
  R.factors.forEach(function(f){out.push({section:'Risk factor (+'+f.pts+')',name:f.label,detail:f.ev,source:''});});
  P.lists.forEach(function(h){out.push({section:'List match '+Math.round(h.score*100)+'%',name:h.row.name,detail:h.row.list+' · '+(h.row.sanctions||''),source:'https://www.opensanctions.org/entities/'+h.row.id+'/'});});
  P.interpol.forEach(function(h){out.push({section:'Interpol',name:h.name,detail:h.dob+' '+h.nat,source:h.url});});
  P.leaks.forEach(function(l){out.push({section:'Offshore leaks',name:l.name,detail:l.leak+' · '+l.type,source:l.url});});
  P.graph.nodes.filter(function(n){return n.depth>0;}).forEach(function(n){out.push({section:'Relationship (depth '+n.depth+')',name:n.label,detail:[n.rel,n.pep?'PEP':'',n.leaks?'Leaks: '+n.leaks:'',n.sanction?'Listed: '+n.sanction:''].filter(Boolean).join(' · '),source:'https://www.wikidata.org/wiki/'+n.id});});
  P.adverse.sents.forEach(function(s){out.push({section:'Adverse mention (Wikipedia)',name:'',detail:s,source:P.article||''});});
  (P.news||[]).forEach(function(n){out.push({section:'News',name:n.title,detail:n.neg?'negative':'neutral',source:n.link});});
  download('screening-'+P.name.replace(/\W+/g,'_')+'-'+today()+'.csv',toCSV(out,['section','name','detail','source'])); };
 var b2=mk('button','btn','Download full record (JSON)'); b2.onclick=function(){ var o={screened_at:new Date().toISOString(),query:P.q,name:P.name,wikidata:P.qid,risk:R,lists:P.lists.map(function(h){return {score:h.score,list:h.row.list,name:h.row.name,id:h.row.id,notes:h.notes};}),interpol:P.interpol,offshore_leaks:P.leaks,network:P.graph,adverse:P.adverse,news:P.news}; download('screening-'+P.name.replace(/\W+/g,'_')+'-'+today()+'.json',JSON.stringify(o,null,2),'application/json'); };
 var b3=mk('button','btn','Print report'); b3.onclick=function(){ window.print(); };
 bx.append(b1,b2,b3); p.appendChild(bx);
 p.appendChild(mk('div','note','Screened '+new Date().toLocaleString()+'. Keep the downloaded report as audit evidence of the check.')); }


function nodeKind(n){ if(n.depth===0) return 'ego'; if(n.sanction||(n.crimes&&n.crimes.length)) return 'bad'; if(n.leaks) return 'leak'; if(n.pep) return 'pep'; return n.human===false?'org':'person'; }
var KIND={ego:['Screened entity','--cyan'],bad:['Sanctioned / convicted','--bad'],leak:['In offshore leaks','--c3'],pep:['PEP','--warn'],org:['Company / organisation','--c5'],person:['Person','--c7']};
var NET={hide:{},deg2:true};
function paneNetwork(p,P){
 p.appendChild(mk('p','note','Family, business and ownership links from Wikidata, two steps out (A → B → C). Every person and company is checked against the sanctions lists and offshore leaks. Hover to trace connections, drag to rearrange, scroll to zoom, click a node to screen it.'));
 if(P.graph.nodes.length<=1){ p.appendChild(mk('div','empty',P.qid?(P.done?'No family or business relationships recorded.':'Building the network…'):'No Wikidata profile to build a network from.')); return; }
 var box=mk('div','graph'); p.appendChild(box);
 var lg=mk('div','lg'); Object.keys(KIND).forEach(function(k){ var cnt=P.graph.nodes.filter(function(n){return nodeKind(n)===k;}).length; if(!cnt) return; var b=mk('button',NET.hide[k]?'off':''); var i=mk('i'); i.style.background=C(KIND[k][1]); i.style.color=C(KIND[k][1]); b.appendChild(i); b.appendChild(document.createTextNode(KIND[k][0]+' ('+cnt+')')); if(k!=='ego') b.onclick=function(){ NET.hide[k]=!NET.hide[k]; renderProfile(P,!P.done); }; lg.appendChild(b); });
 var d2=mk('button',NET.deg2?'':'off'); d2.appendChild(mk('i')).style.background='transparent'; d2.appendChild(document.createTextNode('Show 2nd degree')); d2.onclick=function(){ NET.deg2=!NET.deg2; renderProfile(P,!P.done); }; lg.appendChild(d2); box.appendChild(lg);
 var ctl=mk('div','ctl'); var zi=mk('button',null,'+'), zo=mk('button',null,'−'), zf=mk('button',null,'⤢'); zi.title='Zoom in'; zo.title='Zoom out'; zf.title='Fit'; ctl.append(zi,zo,zf); box.appendChild(ctl);
 var tip=mk('div','tip'); tip.hidden=true; box.appendChild(tip);
 var W=box.clientWidth||900, H=600;
 var keep=P.graph.nodes.filter(function(n){ return (NET.deg2||n.depth<2)&&!NET.hide[nodeKind(n)]; }); var ids={}; keep.forEach(function(n){ids[n.id]=1;});
 var nodes=keep.map(function(n){return Object.assign({},n,{kind:nodeKind(n)});});
 var links=P.graph.links.map(function(l){return {source:typeof l.source==='object'?l.source.id:l.source,target:typeof l.target==='object'?l.target.id:l.target,rel:l.rel};}).filter(function(l){return ids[l.source]&&ids[l.target];});
 var svg=d3.select(box).append('svg').attr('viewBox','0 0 '+W+' '+H);
 var defs=svg.append('defs'); var f=defs.append('filter').attr('id','nglow').attr('x','-80%').attr('y','-80%').attr('width','260%').attr('height','260%'); f.append('feGaussianBlur').attr('stdDeviation',5).attr('result','b'); var fm=f.append('feMerge'); fm.append('feMergeNode').attr('in','b'); fm.append('feMergeNode').attr('in','SourceGraphic');
 var g=svg.append('g'); var zoom=d3.zoom().scaleExtent([0.25,5]).on('zoom',function(e){g.attr('transform',e.transform);}); svg.call(zoom);
 zi.onclick=function(){ svg.transition().duration(300).call(zoom.scaleBy,1.4); }; zo.onclick=function(){ svg.transition().duration(300).call(zoom.scaleBy,0.7); }; zf.onclick=function(){ svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity); };
 var R=function(d){ return d.depth===0?20:d.depth===1?(d.kind==='person'||d.kind==='org'?11:14):(d.kind==='person'||d.kind==='org'?6:9); };
 var sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(function(d){return d.id;}).distance(function(l){return l.target.depth===2||l.source.depth===2?80:130;}).strength(.7)).force('charge',d3.forceManyBody().strength(-340)).force('center',d3.forceCenter(W/2,H/2)).force('collide',d3.forceCollide(function(d){return R(d)+16;})).force('r',d3.forceRadial(function(d){return d.depth*150;},W/2,H/2).strength(.08));
 var col=function(d){return C(KIND[d.kind][1]);};
 var lk=g.append('g').selectAll('line').data(links).join('line').attr('class','flow').style('stroke',function(l){ var t=nodes.find(function(n){return n.id===(l.target.id||l.target);}); return t&&(t.kind==='bad')?C('--bad'):'rgba(125,160,220,.45)'; }).style('stroke-width',1.4);
 var ll=g.append('g').selectAll('text').data(links).join('text').attr('font-size',9.5).style('fill',C('--muted')).attr('text-anchor','middle').style('pointer-events','none').text(function(l){return l.rel||'';});
 var nd=g.append('g').selectAll('g').data(nodes).join('g').style('cursor','pointer')
  .call(d3.drag().on('start',function(e,d){ if(!e.active) sim.alphaTarget(.3).restart(); d.fx=d.x; d.fy=d.y; }).on('drag',function(e,d){ d.fx=e.x; d.fy=e.y; }).on('end',function(e,d){ if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }));
 nd.filter(function(d){return d.depth===0||d.kind==='bad';}).append('circle').attr('class','egoring').attr('r',R).style('fill','none').style('stroke',col).style('stroke-width',2);
 nd.append('circle').attr('r',R).style('fill',col).style('fill-opacity',function(d){return d.depth===0?1:.9;}).attr('filter','url(#nglow)').style('stroke','rgba(6,10,19,.9)').style('stroke-width',2);
 nd.filter(function(d){return d.pep&&d.kind!=='pep';}).append('circle').attr('r',function(d){return R(d)+4;}).style('fill','none').style('stroke',C('--warn')).style('stroke-width',2).style('stroke-dasharray','3 3');
 nd.append('text').attr('dy',function(d){return R(d)+14;}).attr('text-anchor','middle').attr('font-size',function(d){return d.depth===0?14:d.depth===1?11.5:9.5;}).style('fill',C('--fg')).style('font-weight',function(d){return d.depth===0?800:d.depth===1?600:400;}).style('paint-order','stroke').style('stroke','rgba(3,6,12,.9)').style('stroke-width',3).style('pointer-events','none').text(function(d){return d.label.length>28?d.label.slice(0,26)+'…':d.label;});
 var adj={}; links.forEach(function(l){ var s=l.source.id||l.source, t=l.target.id||l.target; adj[s+'|'+t]=adj[t+'|'+s]=1; });
 nd.on('mouseenter',function(ev,d){ nd.style('opacity',function(o){return o.id===d.id||adj[d.id+'|'+o.id]?1:.15;}); lk.style('opacity',function(l){return l.source.id===d.id||l.target.id===d.id?1:.06;}).style('stroke-width',function(l){return l.source.id===d.id||l.target.id===d.id?2.6:1.4;}); ll.style('opacity',function(l){return l.source.id===d.id||l.target.id===d.id?1:0;}); })
  .on('mousemove',function(ev,d){ tip.replaceChildren(mk('div','h',d.label)); var badge=mk('div','m',KIND[d.kind][0]+(d.rel?' · '+d.rel+(d.depth===2?' (2nd degree)':''):'')); tip.appendChild(badge); if(d.pep) tip.appendChild(mk('div',null,'★ PEP: '+(d.positions||[]).slice(0,3).join('; '))); if(d.sanction) tip.appendChild(mk('div',null,'⛔ Listed: '+d.sanction)); if(d.crimes&&d.crimes.length) tip.appendChild(mk('div',null,'Convicted: '+d.crimes.join(', '))); if(d.charges&&d.charges.length) tip.appendChild(mk('div',null,'Charged: '+d.charges.join(', '))); if(d.leaks) tip.appendChild(mk('div',null,'Offshore leaks: '+d.leaks)); if(d.iso) tip.appendChild(mk('div','m',cn(d.iso))); if(d.depth>0) tip.appendChild(mk('div','m','Click to screen this '+(d.human===false?'organisation':'person')));
   tip.hidden=false; var b=box.getBoundingClientRect(); var x=ev.clientX-b.left, y=ev.clientY-b.top; tip.style.left=Math.max(4,Math.min(b.width-tip.offsetWidth-4,x+16))+'px'; tip.style.top=Math.max(4,Math.min(b.height-tip.offsetHeight-4,y-10))+'px'; })
  .on('mouseleave',function(){ tip.hidden=true; nd.style('opacity',1); lk.style('opacity',1).style('stroke-width',1.4); ll.style('opacity',.85); })
  .on('click',function(ev,d){ if(d.depth===0) return; el('q').value=d.label; SUB='overview'; screen(d.label,{qid:d.id}); window.scrollTo({top:0,behavior:'smooth'}); });
 ll.style('opacity',.85);
 sim.on('tick',function(){ lk.attr('x1',function(d){return d.source.x;}).attr('y1',function(d){return d.source.y;}).attr('x2',function(d){return d.target.x;}).attr('y2',function(d){return d.target.y;});
  ll.attr('x',function(d){return (d.source.x+d.target.x)/2;}).attr('y',function(d){return (d.source.y+d.target.y)/2-4;}); nd.attr('transform',function(d){return 'translate('+d.x+','+d.y+')';}); });
 var t=mk('h3',null,'Relationship list'); t.style.marginTop='16px'; p.appendChild(t);
 p.appendChild(table([{l:'Name',k:'label'},{l:'Relationship',f:function(r){return r.rel+(r.depth===2?' (2nd degree)':'');}},{l:'Flag',f:function(r){ var s=mk('span','score',KIND[nodeKind(r)][0]); s.style.background=C(KIND[nodeKind(r)][1]); return s; }},{l:'PEP positions',f:function(r){return (r.positions||[]).slice(0,2).join('; ');},hide:true},{l:'Listed',f:function(r){return r.sanction||'';},hide:true},{l:'Offshore leaks',f:function(r){return r.leaks||'';},hide:true},{l:'Wikidata',f:function(r){return link('https://www.wikidata.org/wiki/'+r.id,r.id);}}],P.graph.nodes.filter(function(n){return n.depth>0;}).sort(function(a,b){return a.depth-b.depth;}))); }
/* ---------- maps ---------- */
var countries=topojson.feature(WORLD,WORLD.objects.countries).features.filter(function(f){return f.properties.name!=='Antarctica';});
countries.forEach(function(f){ f.a2=N2A[f.id]||''; });
function drawMap(box,fill,tipFn,points,opts){ opts=opts||{}; if(box._timer){ box._timer.stop(); box._timer=null; } box.replaceChildren();
 var mode=box.dataset.mode||opts.mode||'globe'; var W=Math.max(300,box.clientWidth), H=mode==='globe'?Math.min(620,Math.max(360,Math.round(W*0.56))):Math.round(W*0.48);
 var proj, path, svg=d3.select(box).append('svg').attr('width','100%').attr('viewBox','0 0 '+W+' '+H);
 var defs=svg.append('defs'); var rg=defs.append('radialGradient').attr('id','ocean'+box.id).attr('cx','40%').attr('cy','35%'); rg.append('stop').attr('offset','0').attr('stop-color','#12305a'); rg.append('stop').attr('offset','1').attr('stop-color','#050b18');
 var gl=defs.append('filter').attr('id','mglow'+box.id).attr('x','-20%').attr('y','-20%').attr('width','140%').attr('height','140%'); gl.append('feGaussianBlur').attr('stdDeviation',8);
 var tip=mk('div','tip'); tip.hidden=true; box.appendChild(tip);
 var ctl=mk('div','chips'); ctl.style.cssText='position:absolute;right:8px;top:8px;z-index:3';
 [['globe','🌐 Globe'],['flat','▭ Flat']].forEach(function(m){ var b=mk('button','chip'+(mode===m[0]?' on':''),m[1]); b.onclick=function(){ box.dataset.mode=m[0]; drawMap(box,fill,tipFn,points,opts); }; ctl.appendChild(b); }); box.appendChild(ctl);
 var mv=function(ev,lines){ tip.replaceChildren(); lines.forEach(function(x,i){ if(x) tip.appendChild(mk('div',i===0?'h':null,x)); }); tip.hidden=false; var b=box.getBoundingClientRect(), x=ev.clientX-b.left; tip.style.left=Math.max(0,Math.min(b.width-tip.offsetWidth,x+16>b.width-tip.offsetWidth?x-tip.offsetWidth-16:x+16))+'px'; tip.style.top=Math.max(0,Math.min(b.height-tip.offsetHeight,ev.clientY-b.top-10))+'px'; };
 if(mode==='globe'){ var r0=Math.min(W,H)/2-14; proj=d3.geoOrthographic().scale(r0).translate([W/2,H/2]).clipAngle(90).rotate(opts.rotate||[-20,-20]);
  svg.append('circle').attr('cx',W/2).attr('cy',H/2).attr('r',r0+6).style('fill',C('--cyan')).style('opacity',.18).attr('filter','url(#mglow'+box.id+')').attr('class','halo'); }
 else proj=d3.geoNaturalEarth1().fitSize([W,H],{type:'Sphere'});
 path=d3.geoPath(proj);
 var sph=svg.append('path').datum({type:'Sphere'}).style('fill',mode==='globe'?'url(#ocean'+box.id+')':'rgba(8,16,32,.6)').style('stroke','rgba(34,211,238,.35)');
 var grat=svg.append('path').datum(d3.geoGraticule10()).style('fill','none').style('stroke','rgba(125,160,220,.12)').style('stroke-width',.6);
 var cs=svg.append('g').selectAll('path').data(countries).join('path').attr('class','c').style('fill',function(f){return fill(f.a2)||C('--map-empty');})
  .on('mousemove',function(ev,f){ mv(ev,tipFn(f.a2,f.properties.name)); }).on('mouseleave',function(){tip.hidden=true;}).on('click',function(ev,f){ if(opts.onClick) opts.onClick(f.a2); });
 var pg=svg.append('g'); var pts=(points||[]).map(function(p){return Object.assign({},p);});
 var rings=pg.selectAll('circle.dotring').data(pts.filter(function(p){return p.pulse!==false;})).join('circle').attr('class','dotring').style('stroke',function(p){return p.color||C('--bad');});
 var dots=pg.selectAll('circle.dot').data(pts).join('circle').attr('class','dot').style('fill',function(p){return p.color||C('--bad');}).style('stroke','rgba(255,255,255,.85)').style('stroke-width',1.2).style('cursor','pointer')
  .on('mousemove',function(ev,p){ mv(ev,p.tip); }).on('mouseleave',function(){tip.hidden=true;}).on('click',function(ev,p){ if(p.onClick) p.onClick(); });
 function vis(p){ if(mode!=='globe') return true; var r=proj.rotate(); return d3.geoDistance(p.ll,[-r[0],-r[1]])<Math.PI/2-0.02; }
 function upd(){ sph.attr('d',path); grat.attr('d',path); cs.attr('d',path);
  dots.attr('cx',function(p){return proj(p.ll)[0];}).attr('cy',function(p){return proj(p.ll)[1];}).attr('r',function(p){return p.r||6;}).style('display',function(p){return vis(p)?null:'none';});
  rings.attr('cx',function(p){return proj(p.ll)[0];}).attr('cy',function(p){return proj(p.ll)[1];}).attr('r',function(p){return p.r||6;}).style('display',function(p){return vis(p)?null:'none';}); }
 upd();
 if(mode==='globe'){ var spinning=opts.spin!==false; var last=Date.now();
  box._timer=d3.timer(function(){ if(!box.isConnected){ box._timer.stop(); return; } if(!spinning) return; var now=Date.now(), dt=now-last; last=now; var r=proj.rotate(); proj.rotate([r[0]+dt*0.006,r[1]]); upd(); });
  svg.call(d3.drag().on('start',function(){ spinning=false; }).on('drag',function(e){ var r=proj.rotate(), k=75/proj.scale(); proj.rotate([r[0]+e.dx*k,Math.max(-80,Math.min(80,r[1]-e.dy*k))]); upd(); }));
  svg.on('wheel',function(e){ e.preventDefault(); var s=proj.scale()*(e.deltaY<0?1.1:0.9); s=Math.max(r0*0.7,Math.min(r0*4,s)); proj.scale(s); svg.select('.halo').attr('r',s+6); upd(); },{passive:false});
  svg.on('dblclick',function(){ spinning=!spinning; last=Date.now(); }); }
}
var CENT={}; countries.forEach(function(f){ if(f.a2) CENT[f.a2]=d3.geoCentroid(f); });
function paneLocations(p,P){
 p.appendChild(mk('p','note','Places linked to the entity: birthplace, residence and headquarters (Wikidata), plus countries of citizenship and of any matched list records.'));
 var pts=[], pr=P.ego.props||{}; [['P19','Birthplace'],['P551','Residence'],['P159','Headquarters']].forEach(function(x){ (pr[x[0]]||[]).forEach(function(v){ if(!v.coord) return; var m=v.coord.match(/Point\(([-\d.]+) ([-\d.]+)\)/); if(m) pts.push({ll:[+m[1],+m[2]],tip:[v.label,x[1]],color:C('--c0'),r:7}); }); });
 var cs={}; P.countries.forEach(function(c){cs[c.toUpperCase()]='Citizenship / country';}); P.lists.filter(function(h){return h.score>=0.88;}).forEach(function(h){ h.row.countries.forEach(function(c){ c=c.toUpperCase(); if(!cs[c]) cs[c]='Listed record: '+h.row.list; }); });
 P.graph.nodes.forEach(function(n){ if(n.depth>0&&n.iso&&!cs[n.iso]) cs[n.iso]='Connected person: '+n.label; });
 var box=mk('div','map'); box.id='loc-map'; p.appendChild(box); var c0=pts[0]?pts[0].ll:(CENT[(P.countries[0]||'').toUpperCase()]||[0,20]);
 setTimeout(function(){ drawMap(box,function(a2){ return cs[a2]?(cs[a2].indexOf('Citizenship')===0?C('--c1'):cs[a2].indexOf('Listed')===0?C('--bad'):C('--c4')):null; },function(a2,n){ var r=countryRisk(a2); return [cn(a2)||n].concat(cs[a2]?[cs[a2]]:[]).concat(['Country risk: '+r.tier+(r.fatf?' · FATF '+r.fatf:'')+(r.eu?' · EU high-risk':'')]); },pts,{rotate:[-c0[0],-c0[1]+10],spin:false}); },0);
 var lg=mk('div','ramp'); [['Citizenship',C('--c1')],['Country of a list match',C('--bad')],['Country of connected person',C('--c4')],['Place (birth, residence, HQ)',C('--c0')]].forEach(function(x){ var s=mk('span'); var i=mk('i'); i.style.background=x[1]; s.appendChild(i); s.appendChild(document.createTextNode(x[0])); lg.appendChild(s); }); p.appendChild(lg);
 var rows=Object.keys(cs).map(function(a2){ var r=countryRisk(a2); return {c:cn(a2),why:cs[a2],tier:r.tier,fatf:r.fatf,eu:r.eu?'Yes':'',basel:r.basel||''}; });
 if(rows.length) p.appendChild(table([{l:'Country',k:'c'},{l:'Link to entity',k:'why'},{l:'Risk',k:'tier'},{l:'FATF',k:'fatf'},{l:'EU high-risk',k:'eu'},{l:'Basel',k:'basel',cls:'num'}],rows)); }

/* ================= daily top 50 ================= */
var TOP=[];
function computeTop(){ var kind=el('top-kind').value; TOP=STATS&&STATS.top?(STATS.top[kind]||[]):[]; el('n-top').textContent=TOP.length; renderTop(); }
function renderTop(){ var tb=el('top-table'); tb.replaceChildren(); if(!TOP.length){ tb.appendChild(mk('tr')).appendChild(mk('td','empty','Loading lists…')); return; }
 var th=mk('thead'), tr=mk('tr'); ['#','Listed','Name','Type','List','Countries','Reason / programme',''].forEach(function(h,i){ tr.appendChild(mk('th',i===6?'hn':null,h)); }); th.appendChild(tr); tb.appendChild(th);
 var body=mk('tbody'); TOP.forEach(function(r,i){ var row=mk('tr'); [String(i+1),(r.first_seen||'').slice(0,10),r.name,r.schema,r.list,r.countries.map(cn).join(', '),r.sanctions||r.program].forEach(function(v,j){ row.appendChild(mk('td',(j<2?'nw':'')+(j===6?' hn':''),v||'—')); });
  var td=mk('td'); var b=mk('button','chip','Screen'); b.onclick=function(){ el('q').value=r.name; showTab('screen'); screen(r.name); }; td.appendChild(b); row.appendChild(td); body.appendChild(row); }); tb.appendChild(body);
 var cc={}; TOP.forEach(function(r){ r.countries.forEach(function(c){ c=c.toUpperCase(); (cc[c]=cc[c]||[]).push(r.name); }); });
 var pts=Object.keys(cc).filter(function(c){return CENT[c];}).map(function(c){ return {ll:CENT[c],r:4+Math.sqrt(cc[c].length)*4,tip:[cn(c),cc[c].length+' newly listed',cc[c].slice(0,4).join('; ')],color:C('--bad'),onClick:function(){ el('q').value=cc[c][0]; showTab('screen'); screen(cc[c][0]); }}; });
 drawMap(el('top-map'),function(a2){ return cc[a2]?'rgba(251,59,100,.35)':null; },function(a2,n){ return [cn(a2)||n,(cc[a2]?cc[a2].length:0)+' of the top 50']; },pts); }
el('top-kind').onchange=computeTop;
el('top-csv').onclick=function(){ download('top50-newly-listed-'+today()+'.csv',toCSV(TOP.map(function(r){return {first_seen:r.first_seen,name:r.name,schema:r.schema,list:r.list,countries:r.countries.join('; '),reason:r.sanctions||r.program,opensanctions:'https://www.opensanctions.org/entities/'+r.id+'/'};}),['first_seen','name','schema','list','countries','reason','opensanctions'])); };

/* ================= country risk ================= */
var riskLayer='risk', LISTCOUNT={};
function computeListCount(){ LISTCOUNT=STATS&&STATS.countries?STATS.countries:{}; }
document.querySelectorAll('#risk-layer [data-layer]').forEach(function(b){ b.onclick=function(){ riskLayer=b.dataset.layer; document.querySelectorAll('#risk-layer [data-layer]').forEach(function(x){x.style.fontWeight=x===b?'700':'400';}); renderRisk(); }; });
function renderRisk(){ var lg=el('risk-legend'); lg.replaceChildren(); var nc=newsCountries();
 var fill, note;
 if(riskLayer==='risk'){ fill=function(a2){ if(!a2) return null; var t=countryRisk(a2).tier; return t==='Low'?(BASEL[a2]?C('--ok'):null):TIER_COL(t); }; note='Country risk for financial institutions (FATF June 2026, EU 2026 list, Basel AML Index 2025).';
  [['High',C('--bad')],['Medium',C('--warn')],['Low (Basel lowest risk)',C('--ok')],['Not on any list',C('--map-empty')]].forEach(function(x){ var s=mk('span'); var i=mk('i'); i.style.background=x[1]; s.appendChild(i); s.appendChild(document.createTextNode(x[0])); lg.appendChild(s); }); }
 else if(riskLayer==='listed'){ var mx=d3.max(Object.values(LISTCOUNT))||1, ramp=d3.interpolateRgb(C('--c4'),C('--bad')); fill=function(a2){ var v=LISTCOUNT[a2]; return v?ramp(Math.sqrt(v/mx)):null; }; note='Entities on the loaded sanctions, terrorist, wanted and debarment lists, by country.'; lg.appendChild(mk('span',null,'Darker = more listed entities')); }
 else { var mx2=d3.max(Object.values(nc))||1, ramp2=d3.interpolateRgb(C('--c4'),C('--bad')); fill=function(a2){ var v=nc[a2]; return v?ramp2(Math.sqrt(v/mx2)):null; }; note='Countries named in financial-crime news over the last 7 days (live).'; lg.appendChild(mk('span',null,'Darker = more news')); }
 el('risk-note').textContent=note+' Hover a country for details.';
 drawMap(el('risk-map'),fill,function(a2,n){ var r=countryRisk(a2); return [cn(a2)||n,'Risk: '+r.tier,(r.fatf?'FATF: '+r.fatf:'Not on FATF lists'),(r.eu?'EU high-risk third country':'Not on EU list'),(r.basel?'Basel AML Index 2025: '+r.basel:''),'Listed entities: '+fmtInt(LISTCOUNT[a2]||0),'News mentions (7 days): '+(nc[a2]||0)].filter(Boolean); });
 renderRiskTable(); }
var RISKROWS=[];
function renderRiskTable(){ var nc=newsCountries(); var q=(el('risk-search').value||'').toLowerCase();
 RISKROWS=ISO.map(function(r){ var x=countryRisk(r[0]); return {country:x.name,iso:r[0],tier:x.tier,fatf:x.fatf,eu:x.eu?'Yes':'',basel:x.basel||'',listed:LISTCOUNT[r[0]]||0,news:nc[r[0]]||0}; }).filter(function(r){return r.country&&r.country.toLowerCase().indexOf(q)>=0;})
  .sort(function(a,b){ var o={High:0,Medium:1,Low:2}; return o[a.tier]-o[b.tier]||(b.basel||0)-(a.basel||0)||b.listed-a.listed; });
 var t=el('risk-table'); t.replaceChildren(); var th=mk('thead'), tr=mk('tr'); ['Country','Risk','FATF','EU high-risk','Basel 2025','Listed entities','News (7 days)'].forEach(function(h){tr.appendChild(mk('th',null,h));}); th.appendChild(tr); t.appendChild(th);
 var tb=mk('tbody'); RISKROWS.forEach(function(r){ var row=mk('tr'); var tdc=mk('td',null,r.country); row.appendChild(tdc); var tt=mk('td'); var pl=mk('span','score',r.tier); pl.style.background=TIER_COL(r.tier); tt.appendChild(pl); row.appendChild(tt);
  [r.fatf,r.eu,r.basel,fmtInt(r.listed),r.news].forEach(function(v,i){ row.appendChild(mk('td',i>=2?'num':null,v===''||v==null?'—':String(v))); }); tb.appendChild(row); }); t.appendChild(tb); }
el('risk-search').addEventListener('input',renderRiskTable);
el('risk-csv').onclick=function(){ download('country-risk-'+today()+'.csv',toCSV(RISKROWS,['country','iso','tier','fatf','eu','basel','listed','news'])); };

/* ================= news ================= */
var NEWS_FEEDS=[['Money laundering','money laundering'],['Sanctions evasion','sanctions evasion'],['Fraud','financial fraud charged'],['Bribery & corruption','bribery corruption charged'],['Terrorist financing','terrorist financing'],['Asset seizure','assets seized laundering']];
var NEWS=[], newsFilter='All';
var CNAMES=ISO.map(function(r){ return [r[0],cn(r[0])]; }).filter(function(x){return x[1]&&x[1].length>3;});
var CRE=CNAMES.map(function(x){ return [x[0],new RegExp('\\b'+esc(x[1])+'\\b','i')]; });
var DEM={US:/\b(U\.S\.|American|FBI|DOJ|FinCEN|Treasury)\b/,GB:/\b(UK|British|London|FCA)\b/,RU:/\bRussian\b/,CN:/\bChinese\b/,IN:/\bIndian\b/,PK:/\bPakistani\b/,DE:/\b(German|Berlin|BaFin)\b/,AE:/\b(UAE|Dubai|Emirati)\b/,FR:/\bFrench\b/,NG:/\bNigerian\b/,AU:/\b(Australian|AUSTRAC)\b/};
function tagC(t){ var out={}; CRE.forEach(function(x){ if(x[1].test(t)) out[x[0]]=1; }); Object.keys(DEM).forEach(function(k){ if(DEM[k].test(t)) out[k]=1; }); return Object.keys(out); }
function newsCountries(){ var cut=Date.now()-7*864e5, c={}; NEWS.forEach(function(n){ if(n.ts<cut) return; n.c.forEach(function(x){c[x]=(c[x]||0)+1;}); }); return c; }
function loadNews(){ var out=[], i=0; setSrc('Financial-crime news','load');
 function step(){ if(i>=NEWS_FEEDS.length) return Promise.resolve(); var f=NEWS_FEEDS[i++];
  return getJSON(RSS+encodeURIComponent('https://www.bing.com/news/search?q='+encodeURIComponent(f[1])+'&format=rss'),{},15000).then(function(j){ if(j.status!=='ok') throw 0; (j.items||[]).forEach(function(it){ var t=textOf(it.title), d=textOf(it.description); out.push({title:t,desc:d,link:it.link,ts:Date.parse(String(it.pubDate).replace(' ','T')+'Z')||Date.parse(it.pubDate),type:f[0],c:tagC(t+' '+d)}); }); }).catch(function(){}).then(function(){ return new Promise(function(r){setTimeout(r,900);}); }).then(step); }
 return step().then(function(){ var seen={}; var merged=out.concat(NEWS).filter(function(n){ var k=n.title.toLowerCase().slice(0,80); if(seen[k]) return false; seen[k]=1; return !isNaN(n.ts); }).sort(function(a,b){return b.ts-a.ts;}).slice(0,400);
  if(merged.length){ NEWS=merged; try{ localStorage.setItem('afc_news',JSON.stringify(NEWS)); }catch(e){} } setSrc('Financial-crime news',out.length>0); el('n-news').textContent=NEWS.length; renderNews(); if(riskLayer==='news') renderRisk(); }); }
try{ NEWS=JSON.parse(localStorage.getItem('afc_news')||'[]').filter(function(n){return Date.now()-n.ts<14*864e5;}); }catch(e){ NEWS=[]; }
function ago(ms){ var s=(Date.now()-ms)/1000; if(s<3600) return Math.max(1,Math.floor(s/60))+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
var NAME_RE=/\b([A-Z][a-z]+(?:\s(?:bin|al|de|van|von|ul|ur)?\s?[A-Z][a-z]+){1,3})\b/g;
function renderNews(){ var ch=el('news-chips'); ch.replaceChildren(); ['All'].concat(NEWS_FEEDS.map(function(f){return f[0];})).forEach(function(t){ var n=t==='All'?NEWS.length:NEWS.filter(function(x){return x.type===t;}).length; var b=mk('button','chip',t+' '+n); if(newsFilter===t){ b.style.background=C('--fg'); b.style.color=C('--bg'); } b.onclick=function(){ newsFilter=t; renderNews(); }; ch.appendChild(b); });
 var box=el('news-list'); box.replaceChildren(); var rows=NEWS.filter(function(n){return newsFilter==='All'||n.type===newsFilter;});
 if(!rows.length){ box.appendChild(mk('div','empty','No news loaded yet — the free news service may be rate-limited; retrying every 10 minutes.')); return; }
 rows.slice(0,200).forEach(function(n){ var it=mk('div','item'); it.appendChild(mk('div','t',ago(n.ts))); var b=mk('div'); var a=mk('a',null,n.title); a.href=n.link; a.target='_blank'; a.rel='noopener noreferrer'; b.appendChild(a);
  var m=mk('div','meta',n.type+(n.c.length?' · '+n.c.map(cn).join(', '):'')); b.appendChild(m);
  var names=[], mm; NAME_RE.lastIndex=0; while((mm=NAME_RE.exec(n.title))&&names.length<3){ var nm=mm[1]; if(!/^(The|A|An|In|On|US|UK|EU|How|Why|What|New|Former|Court|Police|Bank|Ex)\b/.test(nm)&&!CNAMES.some(function(c){return c[1]===nm;})) names.push(nm); }
  if(names.length){ var cs=mk('div','chips'); cs.style.marginTop='4px'; names.forEach(function(nm){ var c=mk('button','chip','Screen “'+nm+'”'); c.onclick=function(){ el('q').value=nm; showTab('screen'); screen(nm); }; cs.appendChild(c); }); b.appendChild(cs); }
  it.appendChild(b); box.appendChild(it); }); }
el('news-csv').onclick=function(){ download('financial-crime-news-'+today()+'.csv',toCSV(NEWS.map(function(n){return {published:new Date(n.ts).toISOString(),title:n.title,type:n.type,countries:n.c.map(cn).join('; '),link:n.link};}),['published','title','type','countries','link'])); };

/* ================= tabs, wiring, live updates ================= */
function showTab(t){ if(t==='plans'){ location.href='/pricing/'; return; } document.querySelectorAll('.tab').forEach(function(b){ b.setAttribute('aria-selected',String(b.dataset.tab===t)); }); document.querySelectorAll('[data-panel]').forEach(function(p){ p.hidden=p.dataset.panel!==t; });
 if(t==='top') renderTop(); if(t==='risk') renderRisk(); if(t==='news') renderNews(); try{ history.replaceState(null,'','#'+t); }catch(e){} }
document.querySelectorAll('.tab').forEach(function(b){ b.onclick=function(){ showTab(b.dataset.tab); }; });
ISO.map(function(r){return [r[0],cn(r[0])];}).filter(function(x){return x[1];}).sort(function(a,b){return a[1].localeCompare(b[1]);}).forEach(function(x){ el('qcountry').appendChild(new Option(x[1],x[0])); });
el('sform').onsubmit=function(e){ e.preventDefault(); closeTA(); var q=el('q').value.trim(); if(q.length<2) return; SUB='overview'; screen(q); };
var taT=null, taItems=[], taIdx=-1;
function closeTA(){ el('ta-list').hidden=true; taIdx=-1; }
function drawTA(){ var L=el('ta-list'); L.replaceChildren(); if(!taItems.length){ closeTA(); return; } taItems.forEach(function(it,i){ var d=mk('div','ta-item'+(i===taIdx?' on':'')); d.appendChild(mk('b',null,it.label)); d.appendChild(mk('span',null,it.description||'Wikidata '+it.id)); d.onmousedown=function(e){ e.preventDefault(); el('q').value=it.label; closeTA(); SUB='overview'; screen(it.label,{qid:it.id}); }; L.appendChild(d); }); L.hidden=false; }
el('q').addEventListener('input',function(){ clearTimeout(taT); var q=el('q').value.trim(); if(q.length<3){ closeTA(); return; } taT=window.__taT=setTimeout(function(){ wdSearch(q).then(function(r){ if(el('q').value.trim()!==q) return; taItems=r.slice(0,6); taIdx=-1; drawTA(); }); },260); });
el('q').addEventListener('keydown',function(e){ if(el('ta-list').hidden) return; if(e.key==='ArrowDown'){ e.preventDefault(); taIdx=Math.min(taItems.length-1,taIdx+1); drawTA(); } else if(e.key==='ArrowUp'){ e.preventDefault(); taIdx=Math.max(-1,taIdx-1); drawTA(); } else if(e.key==='Enter'&&taIdx>=0){ e.preventDefault(); var it=taItems[taIdx]; el('q').value=it.label; closeTA(); SUB='overview'; screen(it.label,{qid:it.id}); } else if(e.key==='Escape') closeTA(); });
el('q').addEventListener('blur',function(){ setTimeout(closeTA,150); });
document.addEventListener('keydown',function(e){ if(e.key==='/'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='SELECT'){ e.preventDefault(); showTab('screen'); el('q').focus(); el('q').select(); } });
document.querySelectorAll('[data-try]').forEach(function(b){ b.onclick=function(){ el('q').value=b.dataset.try; SUB='overview'; screen(b.dataset.try); }; });
(function(){ var t=el('model-table'); var th=mk('thead'), tr=mk('tr'); tr.appendChild(mk('th',null,'Factor')); tr.appendChild(mk('th',null,'Points')); th.appendChild(tr); t.appendChild(th); var tb=mk('tbody'); MODEL.forEach(function(m){ var r=mk('tr'); r.appendChild(mk('td',null,m[0])); r.appendChild(mk('td','num',m[1])); tb.appendChild(r); });
 [['Tiers','0–24 Low · 25–49 Medium · 50–74 High · 75+ Critical']].forEach(function(m){ var r=mk('tr'); r.appendChild(mk('td',null,m[0])); r.appendChild(mk('td',null,m[1])); tb.appendChild(r); }); t.appendChild(tb); })();
function onListsDone(){ computeTop(); computeListCount(); if(!el('risk-map').closest('[hidden]')) renderRisk();  }
setInterval(function(){ el('clock').textContent=new Date().toLocaleString(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'}); },1000);
setInterval(loadStats,30*60e3); setInterval(loadNews,10*60e3);
var rt; window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(function(){ if(!el('risk-map').closest('[hidden]')) renderRisk(); if(!el('top-map').closest('[hidden]')) renderTop(); },200); });
setSrc('OpenSanctions lists','load'); setSrc('Wikidata',null); setSrc('Wikipedia',null); setSrc('ICIJ Offshore Leaks',null); setSrc('Interpol red notices (live)',null); setSrc('Adverse media (Bing News)',null); setSrc('Financial-crime news',null);
var h=(location.hash||'').slice(1); if(['top','risk','news','method'].indexOf(h)>=0) showTab(h);
var qp=new URLSearchParams(location.search).get('q'); if(qp&&qp.length>=2&&qp.length<=120){ el('q').value=qp; setTimeout(function(){ screen(qp); },600); }
window.AFC_SCREEN=function(q){ el('q').value=q; showTab('screen'); screen(q); };
renderNews(); loadStats(); setTimeout(loadNews,1500);
})();
