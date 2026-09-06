const API="https://iptv-org.github.io/api";
const $=s=>document.querySelector(s);
const el={grid:$("#grid"),search:$("#search"),country:$("#country"),category:$("#category"),sort:$("#sort"),count:$("#resultCount"),video:$("#video"),overlay:$("#overlay"),error:$("#error"),now:$("#nowName"),meta:$("#nowMeta")};

let channels=[], streams=new Map(), logos=new Map(), countries=new Map(), cats=new Map();
let favorites=new Set(JSON.parse(localStorage.getItem("worldtv:fav")||"[]")), selected=null, mode="all", hls=null;

// Infinite scroll & pagination variables
let filteredChannels = [];
let currentPage = 0;
const itemsPerPage = 20;

async function get(u){const r=await fetch(u);if(!r.ok)throw Error(r.status);return r.json()}
function save(){localStorage.setItem("worldtv:fav",JSON.stringify([...favorites]))}
function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function logo(id){let a=logos.get(id)||[];return (a.find(x=>x.in_use)||a[0])?.url||""}

// Helper function to create individual channel DOM element
function createChannelCard(c) {
  const d = document.createElement("article");
  d.className = "channel" + (selected === c.id ? " selected" : "");
  let l = logo(c.id), cn = countries.get(c.country)?.name || c.country || "Unknown", cat = (c.categories || [])[0] || "General";
  d.innerHTML = `<button class="star">${favorites.has(c.id) ? "★" : "☆"}</button>${l ? `<img class="logo" src="${esc(l)}" onerror="this.outerHTML='<div class=\\'logo-fallback\\'>${esc(c.name[0] || "T")}</div>'">` : `<div class="logo-fallback">${esc(c.name[0] || "T")}</div>`}<div class="card-info"><div class="channel-name">${esc(c.name)}</div><div class="meta">${esc(cn)} · ${esc(cat)}</div></div>`;
  d.onclick = () => play(c.id);
  d.querySelector(".star").onclick = e => {
    e.stopPropagation();
    favorites.has(c.id) ? favorites.delete(c.id) : favorites.add(c.id);
    save();
    render();
  };
  return d;
}

// Appends the next page of 20 channels
function appendNextPage() {
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredChannels.slice(start, end);

  if (pageItems.length === 0) return;

  const f = document.createDocumentFragment();
  pageItems.forEach(c => {
    f.appendChild(createChannelCard(c));
  });
  el.grid.appendChild(f);
  currentPage++;
}

// Main filter & initial render
function render() {
  let q = el.search.value.toLowerCase().trim(), co = el.country.value, ca = el.category.value;
  
  filteredChannels = channels.filter(c => 
    (mode !== "favorites" || favorites.has(c.id)) &&
    (!co || c.country === co) &&
    (!ca || (c.categories || []).includes(ca)) &&
    (!q || [c.name, ...(c.alt_names || [])].join(" ").toLowerCase().includes(q))
  );

  filteredChannels.sort((x, y) => 
    el.sort.value === "country"
      ? `${x.country}${x.name}`.localeCompare(`${y.country}${y.name}`)
      : el.sort.value === "category"
      ? `${(x.categories || [])[0]}${x.name}`.localeCompare(`${(y.categories || [])[0]}${y.name}`)
      : x.name.localeCompare(y.name)
  );

  el.count.textContent = filteredChannels.length.toLocaleString();
  el.grid.innerHTML = "";
  currentPage = 0;

  if (!filteredChannels.length) {
    el.grid.innerHTML = '<div class="loading">No channels found.</div>';
    return;
  }

  // Load first batch of 20 channels
  appendNextPage();
}

// Window scroll event listener for infinite scrolling
window.addEventListener("scroll", () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
    appendNextPage();
  }
});

function stop(){if(hls){hls.destroy();hls=null}el.video.pause();el.video.removeAttribute("src");el.video.load()}

async function play(id){
 selected=id;render();el.error.classList.add("hidden");el.overlay.style.display="none";stop();
 const c=channels.find(x=>x.id===id),ss=streams.get(id)||[];
 el.now.textContent=c?.name||"Channel";el.meta.textContent=ss.length?`${ss.length} stream${ss.length>1?"s":""} available`:"No stream available";
 if(!ss.length){fail("No playable stream is currently listed for this channel.");return}
 const s=ss.find(x=>!x.label)||ss[0];
 try{if(Hls.isSupported()&&/\.m3u8($|\?)/i.test(s.url)){hls=new Hls({enableWorker:true});hls.loadSource(s.url);hls.attachMedia(el.video);hls.on(Hls.Events.MANIFEST_PARSED,()=>el.video.play().catch(()=>{}));hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail("This stream could not be played. It may be offline, geo-blocked, or restricted by the broadcaster.")})}else{el.video.src=s.url;await el.video.play().catch(()=>{})}}catch(e){fail("This stream could not be played in the browser.")}
}

function fail(msg){el.error.textContent=msg;el.error.classList.remove("hidden");el.overlay.style.display="grid"}

function populate(){
 el.country.innerHTML='<option value="">Country</option>'+[...countries].sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([k,v])=>`<option value="${k}">${v.flag||""} ${esc(v.name)}</option>`).join("");
 el.category.innerHTML='<option value="">Category</option>'+[...cats].sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join("");
}

async function init(){
 try{
  const [c,s,l,co,ca]=await Promise.all([get(API+"/channels.json"),get(API+"/streams.json"),get(API+"/logos.json"),get(API+"/countries.json"),get(API+"/categories.json")]);
  channels=c.filter(x=>!x.closed);s.forEach(x=>{if(x.channel&&x.url){if(!streams.has(x.channel))streams.set(x.channel,[]);streams.get(x.channel).push(x)}});
  l.forEach(x=>{if(x.channel){if(!logos.has(x.channel))logos.set(x.channel,[]);logos.get(x.channel).push(x)}});
  co.forEach(x=>countries.set(x.code,x));ca.forEach(x=>cats.set(x.id,x));populate();render();
 }catch(e){el.grid.innerHTML='<div class="loading">Unable to load IPTV data. Check your connection and refresh.</div>'}
}

[el.search,el.country,el.category,el.sort].forEach(x=>x.addEventListener("input",render));
$("#favChip").onclick=()=>{mode=mode==="favorites"?"all":"favorites";$("#favChip").classList.toggle("active",mode==="favorites");render()};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{mode=b.dataset.filter;document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x===b));render()});
$("#fullscreen").onclick=()=>document.querySelector(".player").requestFullscreen?.();
$("#heroPlay").onclick=()=>document.querySelector(".player-section").scrollIntoView({behavior:"smooth"});
$("#heroFav").onclick=()=>{if(selected){favorites.add(selected);save();render()}};
init();