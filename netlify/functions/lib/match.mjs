// Name matching and list index — shared by the screening functions.
// Same algorithm as the browser: token similarity (Jaro-Winkler), phonetic keys for spelling variants,
// low weight for common name parts, and birth-year / country adjustments to cut false positives.
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


var LISTS=[
 ['un_sc_sanctions','UN Security Council sanctions','sanction'],['us_ofac_sdn','US OFAC SDN list','sanction'],['us_ofac_cons','US OFAC consolidated (non-SDN)','sanction'],
 ['eu_fsf','EU financial sanctions','sanction'],['gb_fcdo_sanctions','UK sanctions list','sanction'],['gb_proscribed_orgs','UK proscribed terrorist organisations','terror'],['gb_nca_most_wanted','UK NCA most wanted','wanted'],['ch_seco_sanctions','Switzerland SECO sanctions','sanction'],
 ['ca_dfatd_sema_sanctions','Canada autonomous sanctions','sanction'],['au_dfat_sanctions','Australia DFAT sanctions','sanction'],
 ['pk_proscribed_persons','Pakistan NACTA proscribed persons','terror'],['ae_local_terrorists','UAE local terrorist list','terror'],['in_mha_banned','India MHA banned organisations','terror'],
 ['interpol_red_notices','Interpol red notices','wanted'],['us_fbi_most_wanted','FBI most wanted','wanted'],['worldbank_debarred','World Bank debarred firms & individuals','debarment'],
 ['pk_na_members','Pakistan National Assembly members','pep'],['pk_senate_members','Pakistan Senate members','pep']
];
function parseCSV(text,cb){ var i=0,n=text.length,row=[],f='',q=false,first=true,head=null;
 for(;i<n;i++){ var c=text[i];
  if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
  else if(c==='"') q=true; else if(c===','){ row.push(f); f=''; } else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(f); f=''; if(first){head=row;first=false;} else if(row.length>1) cb(row,head); row=[]; } else f+=c; }
 if(f||row.length){ row.push(f); if(head&&row.length>1) cb(row,head); } }

function searchLists(name,opts){ var qt=norm(name); if(!qt.length) return []; var cand=new Map();
 qt.forEach(function(t){ if(t.length<3) return; (IDX.get(key(t))||[]).forEach(function(ix){ cand.set(ix,(cand.get(ix)||0)+1); }); });
 var need=Math.min(2,qt.filter(function(t){return t.length>=3;}).length)||1, out=[];
 cand.forEach(function(c,ix){ if(c<need) return; var r=ROWS[ix]; var best=0, via=r.name;
  [r.name].concat(r.aliases).forEach(function(nm){ var s=nameScore(qt,norm(nm)); if(s>best){best=s;via=nm;} });
  if(best<0.84) return; if(infoTokens(qt)<2){ var nn=norm(via); if(!qt.some(function(t){return nn.indexOf(t)>=0;})||infoTokens(nn)>3) return; } var notes=[]; var s=best;
  if(opts&&opts.year&&r.dob){ var y=parseInt(r.dob.slice(0,4),10); if(y&&Math.abs(y-opts.year)>1){ s*=0.6; notes.push('birth year '+y+' ≠ '+opts.year); } else if(y){ s=Math.min(1,s+0.05); notes.push('birth year matches'); } }
  if(opts&&opts.country&&r.countries.length){ if(r.countries.indexOf(opts.country.toLowerCase())<0){ s*=0.85; notes.push('country differs'); } else { s=Math.min(1,s+0.03); notes.push('country matches'); } }
  if(opts&&opts.type==='person'&&r.schema!=='Person'&&r.schema!=='LegalEntity') s*=0.7;
  if(opts&&opts.type==='org'&&r.schema==='Person') s*=0.7;
  out.push({row:r,score:s,via:via,notes:notes}); });
 return out.sort(function(a,b){return b.score-a.score;}).slice(0,40); }


let ROWS = [], IDX = new Map();
export function buildIndex(rows) {
  ROWS = rows; IDX = new Map();
  rows.forEach(function (o, ix) { var seen = {};
    [o.name].concat((o.aliases || []).slice(0, 8)).forEach(function (nm) { norm(nm).forEach(function (t) { if (t.length < 3) return; var k = key(t); if (seen[k]) return; seen[k] = 1; var a = IDX.get(k); if (!a) { a = []; IDX.set(k, a); } a.push(ix); }); }); });
}
export function rowFromCsv(r, list) {
  return { id: r[0], schema: r[1], name: r[2], aliases: r[3] ? r[3].split(';').slice(0, 12) : [], dob: r[4] || '', countries: r[5] ? r[5].split(';') : [], sanctions: (r[8] || '').slice(0, 300), program: r[11] || '', first_seen: r[13] || '', list: list[1], listId: list[0], cat: list[2] };
}
export const indexSize = () => ROWS.length;
export { LISTS, parseCSV, norm, nameScore, infoTokens, searchLists };
