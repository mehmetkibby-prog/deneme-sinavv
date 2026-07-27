const $ = s => document.querySelector(s);
const app = $("#app");
const state = { data:null, route:"home", section:null, exam:[], index:0, correct:0, wrong:0, answered:false, examTitle:"", rtc:null, voiceStream:null, voiceAudio:null, voiceChannel:null, chat:[], studyChat:[] };
const store = {
  get(k,f){ try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
};
const esc = (t="") => String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle = xs => { const a=[...xs]; for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; };
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1900)}
function allQuestions(){return state.data.sections.flatMap(s=>s.questions)}
function ids(key){return new Set(store.get(key,[]))}
function setTitle(t,s="V24 Android",back=false){$("#page-title").textContent=t;$("#subtitle").textContent=s;$("#back").classList.toggle("hidden",!back)}
function nav(r){state.route=r;document.querySelectorAll("#bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.route===r));({home:renderHome,wrong:renderWrong,stats:renderStats,voice:renderVoice,more:renderMore,settings:renderSettings}[r]||renderHome)()}

function renderHome(){
  const p=store.get("profile",{name:"Çağlar",examDate:""});
  setTitle("Müzik Sınavı",p.name?`Hoş geldin, ${p.name}`:"V24 Android");
  app.innerHTML=`<section class="hero"><h2>Sınava hazırlan</h2><p>${allQuestions().length} soruluk bankadan çalış, yanlışlarını tekrar çöz ve gelişimini izle.</p>
  <div class="actions"><button class="primary" id="mixed">Karışık Deneme</button><button class="secondary" id="ai-exam">AI Eğitim Bilimleri</button><button class="secondary ai-center-button" id="ai-center">AI Destekli Çalışma Merkezi</button></div></section>
  <div class="feature-grid">
    <button class="card feature" data-go="teacher"><b>🤖 AI Öğretmen</b><span>Sor, öğren, mini sınav yap</span></button>
    <button class="card feature" data-go="cards"><b>🗂 Ezber Kartları</b><span>Kart çevirerek tekrar et</span></button>
    <button class="card feature memory-feature" data-go="memory"><b>🧠 Yoğun Ezber Soruları</b><span>Eser–besteci, dönem ve ağır bilgi soruları</span></button>
    <button class="card feature" data-go="study"><b>📚 Konu Çalışma Köşesi</b><span>Plan ve notlarını tut</span></button>
    <button class="card feature" data-go="profile"><b>👤 Kişisel Bilgi Köşesi</b><span>Hedeflerini düzenle</span></button>
  </div>
  <h3 class="section-title">Soru Bankası</h3><div class="grid">${state.data.sections.map(s=>`<button class="card section" data-id="${s.id}"><b>${esc(s.title)}</b><span class="pill">${s.questions.length} soru</span></button>`).join("")}</div>`;
  $(".feature-grid").onclick=e=>{const b=e.target.closest("[data-go]");if(b)({teacher:renderTeacher,cards:renderFlashcards,memory:renderMemoryCenter,study:renderStudy,profile:renderProfile}[b.dataset.go])()};
  document.querySelectorAll(".section").forEach(b=>b.onclick=()=>renderSection(b.dataset.id));
  $("#mixed").onclick=()=>startExam(shuffle(allQuestions()).slice(0,Math.min(50,allQuestions().length)),"Karışık Deneme");
  $("#ai-exam").onclick=renderAiExam;
  $("#ai-center").onclick=renderAiStudyCenter;
}
function renderSection(id){
  const s=state.data.sections.find(x=>x.id===id);state.section=s;setTitle(s.title,`${s.questions.length} soru`,true);
  const counts=[5,10,15,20,30,50,s.questions.length].filter((v,i,a)=>v<=s.questions.length&&a.indexOf(v)===i);
  app.innerHTML=`<section class="hero"><h2>${esc(s.title)}</h2><p>Soru sayısını seçerek denemeyi başlat.</p>
  <label>Soru sayısı</label><select id="count">${counts.map(v=>`<option value="${v}">${v===s.questions.length?"Tümü":v}</option>`).join("")}</select>
  <div class="actions"><button class="primary" id="begin">Sınavı Başlat</button><button class="secondary" id="inspect">Soruları İncele</button></div></section>`;
  $("#begin").onclick=()=>startExam(shuffle(s.questions).slice(0,+$("#count").value),s.title);
  $("#inspect").onclick=()=>renderQuestionList(s.questions,s.title);
}
function renderQuestionList(qs,title){setTitle(title,"Cevaplı çalışma listesi",true);app.innerHTML=`<div class="list">${qs.map((q,i)=>`<article class="list-item"><h3>${i+1}. ${esc(q.question)}</h3><div class="muted">Doğru cevap: <b>${q.answer}) ${esc(q.choices[q.answer])}</b></div>${q.explanation?`<p>${esc(q.explanation)}</p>`:""}</article>`).join("")}</div>`}
function startExam(qs,title){
  if(!qs.length)return toast("Bu listede soru yok.");
  Object.assign(state,{exam:qs,index:0,correct:0,wrong:0,answered:false,examTitle:title});renderQuestion();
}
function renderQuestion(){
  const q=state.exam[state.index],hard=ids("hardQuestions").has(q.id),pct=Math.round(state.index/state.exam.length*100);
  setTitle(state.examTitle,`Soru ${state.index+1} / ${state.exam.length}`,true);
  app.innerHTML=`<div class="exam-head"><span class="pill">Doğru ${state.correct} · Yanlış ${state.wrong}</span><label class="hard-toggle"><input id="hard-check" type="checkbox" ${hard?"checked":""}> ★ Zor</label></div>
  <div class="progress"><i style="width:${pct}%"></i></div><div class="question">${esc(q.question)}</div>
  <div>${Object.entries(q.choices).map(([k,v])=>`<button class="choice" data-key="${k}"><strong>${k}</strong><span>${esc(v)}</span></button>`).join("")}</div>
  <div id="feedback"></div><div class="actions"><button class="primary hidden" id="next">${state.index===state.exam.length-1?"Sınavı Bitir":"Sonraki Soru"}</button></div>`;
  $("#hard-check").onchange=e=>toggleId("hardQuestions",q.id,e.target.checked,"Zor Sorular");
  document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>answer(b.dataset.key));
  $("#next").onclick=()=>{if(++state.index>=state.exam.length)finishExam();else{state.answered=false;renderQuestion()}};
}
function toggleId(key,id,on,label){const s=ids(key);on?s.add(id):s.delete(id);store.set(key,[...s]);toast(on?`${label} bölümüne eklendi`:`${label} bölümünden çıkarıldı`)}
function answer(key){
  if(state.answered)return;state.answered=true;const q=state.exam[state.index],ok=key===q.answer;
  if(ok){state.correct++;const w=ids("wrongQuestions");w.delete(q.id);store.set("wrongQuestions",[...w])}
  else{state.wrong++;const w=ids("wrongQuestions");w.add(q.id);store.set("wrongQuestions",[...w])}
  document.querySelectorAll(".choice").forEach(b=>{b.disabled=true;if(b.dataset.key===q.answer)b.classList.add("correct");else if(b.dataset.key===key)b.classList.add("wrong")});
  $("#feedback").innerHTML=`<div class="result"><b>${ok?"Doğru!":"Yanlış."}</b><br>${!ok?`Doğru cevap: ${q.answer}) ${esc(q.choices[q.answer])}<br>`:""}${esc(q.explanation||"")}</div>`;
  $("#next").classList.remove("hidden");
}
function finishExam(){
  const score=Math.round(state.correct/state.exam.length*100),h=store.get("history",[]);
  h.unshift({date:new Date().toISOString(),title:state.examTitle,total:state.exam.length,correct:state.correct,wrong:state.wrong,score});store.set("history",h.slice(0,100));
  setTitle("Sınav Sonucu",state.examTitle,true);app.innerHTML=`<section class="hero center"><h2>%${score}</h2><p>${state.correct} doğru · ${state.wrong} yanlış</p><div class="actions center"><button class="primary" id="again">Tekrar Çöz</button><button class="secondary" id="home">Ana Sayfa</button></div></section>`;
  $("#again").onclick=()=>startExam(shuffle(state.exam),state.examTitle);$("#home").onclick=()=>nav("home");
}
function renderWrong(){renderSavedQuestions("Yanlış Sorular","wrongQuestions","Yanlış Soruları Çöz","Yanlış cevapladığın sorular otomatik olarak burada birikir. Doğru çözdüğünde listeden çıkar.")}
function renderHard(){renderSavedQuestions("Zor Sorular","hardQuestions","Zor Soruları Çöz","Yıldızla işaretlediğin sorular burada birikir.")}
function renderSavedQuestions(title,key,button,empty){
  setTitle(title,"Tekrar çalışma",false);const s=ids(key),qs=allQuestions().filter(q=>s.has(q.id));
  app.innerHTML=qs.length?`<section class="hero"><h2>${qs.length} soru</h2><p>Hazır olduğunda yeniden çöz.</p><div class="actions"><button class="primary" id="solve">${button}</button><button class="danger" id="clear">Listeyi Temizle</button></div></section><div class="list">${qs.map(q=>`<article class="list-item"><h3>${esc(q.question)}</h3><div class="muted">${esc(q.choices[q.answer])}</div></article>`).join("")}</div>`:`<section class="hero"><h2>Liste boş</h2><p>${empty}</p></section>`;
  if(qs.length){$("#solve").onclick=()=>startExam(shuffle(qs),title);$("#clear").onclick=()=>{if(confirm("Bu liste temizlensin mi?")){store.set(key,[]);renderSavedQuestions(title,key,button,empty)}}}
}
function renderStats(){
  setTitle("Başarı Analizi","Son denemelerin");const h=store.get("history",[]);
  app.innerHTML=h.length?`<div class="list">${h.map(x=>`<article class="list-item"><h3>${esc(x.title)} · %${x.score}</h3><p class="muted">${new Date(x.date).toLocaleString("tr-TR")} · ${x.correct} doğru / ${x.wrong} yanlış</p><div class="bar"><span style="width:${x.score}%"></span></div></article>`).join("")}</div>`:`<section class="hero"><h2>Henüz sonuç yok</h2><p>Bir deneme tamamladığında sonuçların burada görünecek.</p></section>`;
}
function renderMore(){
  setTitle("Çalışma Alanları","Tüm araçlar");app.innerHTML=`<div class="grid">
  <button class="card" data-go="hard"><b>★ Zor Sorular</b></button><button class="card" data-go="cards"><b>🗂 Ezber Kartları</b></button>
  <button class="card memory-feature" data-go="memory"><b>🧠 Yoğun Ezber Soruları</b></button>
  <button class="card" data-go="ai-center"><b>✨ AI Çalışma Merkezi</b></button><button class="card" data-go="study"><b>📚 Konu Çalışma</b></button>
  <button class="card" data-go="profile"><b>👤 Kişisel Bilgiler</b></button><button class="card" data-go="settings"><b>⚙ Ayarlar</b></button></div>`;
  app.onclick=e=>{const b=e.target.closest("[data-go]");if(b)({hard:renderHard,cards:renderFlashcards,memory:renderMemoryCenter,"ai-center":renderAiStudyCenter,study:renderStudy,profile:renderProfile,settings:renderSettings}[b.dataset.go])()};
}
function renderFlashcards(){
  setTitle("Ezber Kartları","Dokun ve cevabı gör",true);const sections=state.data.sections;
  app.innerHTML=`<section class="hero"><label>Konu</label><select id="card-section"><option value="all">Tüm konular</option>${sections.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join("")}</select><div class="actions"><button class="primary" id="start-cards">Kartları Başlat</button></div></section>`;
  $("#start-cards").onclick=()=>{const v=$("#card-section").value,qs=v==="all"?allQuestions():sections.find(s=>s.id===v).questions;showCard(shuffle(qs),0,false)};
}
function showCard(qs,i,reveal){
  const q=qs[i];setTitle("Ezber Kartları",`Kart ${i+1} / ${qs.length}`,true);
  app.innerHTML=`<div class="flashcard ${reveal?"flipped":""}" id="flash"><div><small>${reveal?"CEVAP":"SORU"}</small><h2>${reveal?`${q.answer}) ${esc(q.choices[q.answer])}`:esc(q.question)}</h2>${reveal&&q.explanation?`<p>${esc(q.explanation)}</p>`:""}<span>Çevirmek için dokun</span></div></div><div class="actions center"><button class="secondary" id="prev" ${i===0?"disabled":""}>Önceki</button><button class="primary" id="next-card">${i===qs.length-1?"Başa Dön":"Sonraki"}</button></div>`;
  $("#flash").onclick=()=>showCard(qs,i,!reveal);$("#prev").onclick=()=>showCard(qs,i-1,false);$("#next-card").onclick=()=>showCard(qs,i===qs.length-1?0:i+1,false);
}
const MEMORY_LABELS={
  composer:"Eser – Besteci",
  period:"Dönem – Akım",
  person:"Kişi – Katkı",
  term:"Terim – Tanım",
  instrument:"Çalgı – Teknik",
  other:"Diğer Yoğun Ezber"
};
function localMemoryCategory(q){
  const text=`${q.question||""} ${q.choices?.[q.answer]||""}`.toLocaleLowerCase("tr-TR");
  if(/besteci|besteledi|operası|senfoni|konçerto|oratoryo|eseri kime|kime aittir/.test(text))return "composer";
  if(/dönem|yüzyıl|akım|rönesans|barok|klasik|romantik|çağ|tarihinde|yılında/.test(text))return "period";
  if(/kimdir|tarafından|geliştiren|kurucusu|öncüsü|müzikolog|sanatçı/.test(text))return "person";
  if(/terim|ne ad verilir|anlamı|tanımı|ifade eder|hangi dil|usul|makam|form/.test(text))return "term";
  if(/çalgı|enstrüman|tel|akort|yay|nefesli|vurmalı|çalma tekniği/.test(text))return "instrument";
  return null;
}
function memoryMap(){
  const saved=store.get("aiMemoryMap",null);
  if(saved&&saved.version===1&&saved.items)return saved.items;
  const items={};allQuestions().forEach(q=>{const category=localMemoryCategory(q);if(category)items[q.id]=category});
  return items;
}
function memoryQuestions(category="all"){
  const map=memoryMap();
  return allQuestions().filter(q=>map[q.id]&&(category==="all"||map[q.id]===category));
}
function renderMemoryCenter(){
  const map=memoryMap(),qs=memoryQuestions(),counts={};
  Object.values(map).forEach(x=>counts[x]=(counts[x]||0)+1);
  setTitle("Yoğun Ezber Soruları",`${qs.length} soru`,true);
  app.innerHTML=`<section class="hero memory-hero"><h2>Ağır ezberleri ayrı çalış</h2><p>Eser–besteci, dönem, kişi, terim ve çalgı bilgileri soru bankasından ayrılır. “AI ile Tara” bütün bankayı daha ayrıntılı sınıflandırır.</p>
  <div class="memory-counts">${Object.entries(MEMORY_LABELS).filter(([k])=>counts[k]).map(([k,v])=>`<span>${v}: ${counts[k]}</span>`).join("")}</div></section>
  <label>Kategori</label><select id="memory-category"><option value="all">Tüm yoğun ezberler (${qs.length})</option>${Object.entries(MEMORY_LABELS).map(([k,v])=>`<option value="${k}">${v} (${counts[k]||0})</option>`).join("")}</select>
  <div class="actions"><button class="primary" id="solve-memory">Soruları Çöz</button><button class="secondary" id="cards-memory">Ezber Kartları</button><button class="secondary" id="scan-memory">AI ile Tara</button></div>
  <div id="memory-status" class="result">${store.get("aiMemoryMap",null)?"Son AI taraması cihazda kayıtlı.":"Hızlı yerel tarama hazır; istersen AI ile ayrıntılı tarayabilirsin."}</div>`;
  const selected=()=>memoryQuestions($("#memory-category").value);
  $("#solve-memory").onclick=()=>startExam(shuffle(selected()),"Yoğun Ezber Soruları");
  $("#cards-memory").onclick=()=>{const list=shuffle(selected());if(list.length)showCard(list,0,false);else toast("Bu kategoride soru yok.")};
  $("#scan-memory").onclick=scanMemoryWithAI;
}
async function scanMemoryWithAI(){
  if(!store.get("apiKey",""))return toast("Önce Ayarlar bölümüne API anahtarını gir.");
  const button=$("#scan-memory"),status=$("#memory-status"),questions=allQuestions(),items={};
  button.disabled=true;
  try{
    for(let start=0;start<questions.length;start+=50){
      const batch=questions.slice(start,start+50);
      status.textContent=`AI tarıyor: ${Math.min(start+batch.length,questions.length)} / ${questions.length}`;
      const compact=batch.map(q=>({id:q.id,soru:q.question,cevap:q.choices?.[q.answer]||""}));
      const prompt=`Aşağıdaki sınav sorularını sınıflandır. Yalnızca doğrudan ezber gerektiren olgusal soruları seç: eser-besteci, dönem-akım-tarih, kişi-katkı, terim-tanım, çalgı-teknik veya diğer yoğun ezber. Kavramsal yorum ve hesap sorularını seçme. Yalnızca JSON döndür: {"items":[{"id":"...","category":"composer|period|person|term|instrument|other"}]}\n${JSON.stringify(compact)}`;
      const raw=await openAIText(prompt,"Sen titiz bir müzik öğretmenliği sınavı soru sınıflandırıcısısın. Yalnızca geçerli JSON ver.");
      const parsed=JSON.parse(raw.replace(/^```json\s*|```$/g,"").trim());
      (parsed.items||[]).forEach(x=>{if(MEMORY_LABELS[x.category])items[x.id]=x.category});
    }
    store.set("aiMemoryMap",{version:1,scannedAt:new Date().toISOString(),items});
    toast(`${Object.keys(items).length} yoğun ezber sorusu ayrıldı`);
    renderMemoryCenter();
  }catch(e){
    status.textContent=`Tarama durdu: ${e.message}`;
    button.disabled=false;
  }
}
function renderProfile(){
  const p=store.get("profile",{name:"Çağlar",examDate:"",goal:"KKTC Müzik Öğretmenliği sınavını kazanmak",daily:"30"});
  setTitle("Kişisel Bilgi Köşesi","Hedeflerin",true);
  app.innerHTML=`<label>Adın</label><input id="p-name" type="text" value="${esc(p.name)}"><label>Sınav tarihi</label><input id="p-date" type="date" value="${esc(p.examDate)}"><label>Ana hedefin</label><textarea id="p-goal">${esc(p.goal)}</textarea><label>Günlük soru hedefi</label><input id="p-daily" type="number" value="${esc(p.daily)}"><div id="countdown"></div><div class="actions"><button class="primary" id="save-profile">Kaydet</button></div>`;
  if(p.examDate){const d=Math.ceil((new Date(p.examDate+"T23:59:59")-new Date())/86400000);$("#countdown").innerHTML=`<div class="result">${d>=0?`Sınava ${d} gün kaldı.`:"Sınav tarihi geçti."}</div>`}
  $("#save-profile").onclick=()=>{store.set("profile",{name:$("#p-name").value.trim(),examDate:$("#p-date").value,goal:$("#p-goal").value.trim(),daily:$("#p-daily").value});toast("Kişisel bilgiler kaydedildi");renderProfile()};
}
function renderStudy(){
  const notes=store.get("studyNotes",[]);setTitle("Konu Çalışma Köşesi","Plan ve notlar",true);
  app.innerHTML=`<section class="hero"><h2>Yeni çalışma notu</h2><label>Konu</label><input id="note-title" type="text" placeholder="Örn. Öğrenme psikolojisi"><label>Not / yapılacak</label><textarea id="note-text" placeholder="Çalışacağın başlıkları veya kısa notlarını yaz"></textarea><div class="actions"><button class="primary" id="add-note">Ekle</button></div></section><div class="list note-list">${notes.map((n,i)=>`<article class="list-item"><label class="check-row"><input type="checkbox" data-check="${i}" ${n.done?"checked":""}><span><b>${esc(n.title)}</b><br><span class="muted">${esc(n.text)}</span></span></label><button class="text-danger" data-del="${i}">Sil</button></article>`).join("")}</div>`;
  $("#add-note").onclick=()=>{const title=$("#note-title").value.trim(),text=$("#note-text").value.trim();if(!title)return toast("Konu başlığı yaz.");notes.unshift({title,text,done:false});store.set("studyNotes",notes);renderStudy()};
  document.querySelectorAll("[data-check]").forEach(x=>x.onchange=()=>{notes[+x.dataset.check].done=x.checked;store.set("studyNotes",notes)});
  document.querySelectorAll("[data-del]").forEach(x=>x.onclick=()=>{notes.splice(+x.dataset.del,1);store.set("studyNotes",notes);renderStudy()});
}
const AI_MODELS=["gpt-5-mini","gpt-5","gpt-4.1-mini","gpt-4.1"];
const AI_MODES={
  "AI Öğretmen":"Konuyu öğret: önce anlaşılır biçimde anlat, ardından ezberlenecek maddeleri, karıştırılan kavramları, bir hafıza tekniğini ve kısa kontrol sorularını ver.",
  "Serbest Soru":"Kullanıcının sorusunu doğrudan, açık ve öğretici biçimde yanıtla. Gerektiğinde kısa örnek ver.",
  "Soru Üretici":"İstenen konuda dört seçenekli özgün test soruları üret. Her sorunun doğru cevabını ve kısa açıklamasını ver. Çıktıyı numaralı düzenle.",
  "Çalışma Planı":"Kullanıcının isteğine göre uygulanabilir, günlere bölünmüş çalışma planı hazırla. Tekrar, test ve yanlış analizi sürelerini belirt.",
  "Yanlış Analizi":"Verilen yanlışları analiz et. Doğru cevabı, çeldiricilerin neden yanlış olduğunu, hafıza tekniğini ve üç benzer soru ver."
};
function modelOptions(selected){return AI_MODELS.map(m=>`<option value="${m}" ${m===selected?"selected":""}>${m}</option>`).join("")}
function renderSettings(){
  const selected=store.get("aiModel","gpt-5-mini");
  setTitle("Ayarlar","AI ve uygulama",true);app.innerHTML=`<section class="hero"><h2>OpenAI ayarları</h2><p>API anahtarı yalnızca bu cihazda saklanır. Paylaşma veya ekran görüntüsünde gösterme.</p></section><label>OpenAI API anahtarı</label><input id="api-key" type="password" value="${esc(store.get("apiKey",""))}" placeholder="sk-..."><label>AI modeli</label><select id="ai-model">${modelOptions(selected)}</select><label>Realtime oturum sunucusu (önerilen)</label><input id="realtime-endpoint" type="text" value="${esc(store.get("realtimeEndpoint",""))}" placeholder="https://sunucun.com/session"><p class="muted">Boş bırakırsan Realtime bağlantısı cihazdaki API anahtarını kullanır. En güvenlisi kısa ömürlü oturum anahtarı veren kendi sunucunu kullanmaktır.</p><label>AI çalışma talimatı</label><textarea id="instructions">${esc(store.get("instructions","Türkçe konuş. Müzik ve eğitim bilimleri sınavına hazırlanan bir öğretmene kısa, doğru ve öğretici cevaplar ver. İstenirse birer birer soru sor ve cevabı açıklayarak değerlendir."))}</textarea><div class="actions"><button class="primary" id="save-settings">Kaydet</button></div>`;
  $("#save-settings").onclick=()=>{store.set("apiKey",$("#api-key").value.trim());store.set("aiModel",$("#ai-model").value);store.set("realtimeEndpoint",$("#realtime-endpoint").value.trim());store.set("instructions",$("#instructions").value.trim());toast("Ayarlar kaydedildi")};
}
async function openAIText(input,instructions=""){
  const key=store.get("apiKey","");if(!key)throw new Error("Önce Ayarlar bölümüne API anahtarını gir.");
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:store.get("aiModel","gpt-5-mini"),instructions:instructions||store.get("instructions","Türkçe konuş ve öğretici ol."),input})});
  if(!r.ok)throw new Error((await r.json()).error?.message||`HTTP ${r.status}`);const d=await r.json();return d.output_text||d.output?.flatMap(o=>o.content||[]).find(c=>c.type==="output_text")?.text||"Yanıt alınamadı.";
}
function wrongContext(){
  const wrong=ids("wrongQuestions"),qs=allQuestions().filter(q=>wrong.has(q.id)).slice(0,15);
  return qs.length?qs.map((q,i)=>`${i+1}. ${q.question} | Doğru: ${q.answer}) ${q.choices[q.answer]}`).join("\n"):"Kayıtlı yanlış soru yok.";
}
function renderAiStudyCenter(){
  const mode=store.get("aiMode","AI Öğretmen"),model=store.get("aiModel","gpt-5-mini");
  setTitle("AI Destekli Çalışma Merkezi",`${mode} · ${model}`,true);
  app.innerHTML=`<section class="hero ai-center-hero"><h2>AI Destekli Çalışma Merkezi</h2><p>Çalışma biçimini ve kullanmak istediğin AI modelini seç.</p></section>
  <div class="ai-control-grid"><div><label>Çalışma modu</label><select id="study-mode">${Object.keys(AI_MODES).map(x=>`<option ${x===mode?"selected":""}>${x}</option>`).join("")}<option ${mode==="AI Deneme Sınavı"?"selected":""}>AI Deneme Sınavı</option><option ${mode==="AI Sesli Öğretmen"?"selected":""}>AI Sesli Öğretmen</option></select></div><div><label>AI modeli</label><select id="study-model">${modelOptions(model)}</select></div></div>
  <div class="quick-prompts"><button data-prompt="Bu konuyu sınav odaklı öğret: ">Konu Anlat</button><button data-prompt="Bana birer birer soru sor ve cevaplarımı değerlendir. Konu: ">Soru-Cevap</button><button data-prompt="Bu konuda kısa özet ve ezber tekniği hazırla: ">Özet + Ezber</button></div>
  <div id="study-chat">${state.studyChat.map(m=>`<div class="message ${m.role}"><b>${m.role==="me"?"Sen":"AI"}:</b> ${esc(m.text)}</div>`).join("")}</div>
  <div class="chat-box study-compose"><textarea id="study-input" placeholder="Örn. Olumsuz pekiştirmeyi örneklerle öğret"></textarea><button class="primary" id="study-send">Gönder</button></div>
  <div class="actions"><button class="secondary" id="voice-teacher">AI Sesli Öğretmen</button><button class="secondary" id="clear-study-chat">Sohbeti Temizle</button></div>`;
  $("#study-mode").onchange=e=>{store.set("aiMode",e.target.value);if(e.target.value==="AI Sesli Öğretmen")renderVoice()};
  $("#study-model").onchange=e=>{store.set("aiModel",e.target.value);setTitle("AI Destekli Çalışma Merkezi",`${$("#study-mode").value} · ${e.target.value}`,true)};
  document.querySelectorAll("[data-prompt]").forEach(b=>b.onclick=()=>{$("#study-input").value=b.dataset.prompt;$("#study-input").focus()});
  $("#voice-teacher").onclick=renderVoice;
  $("#clear-study-chat").onclick=()=>{state.studyChat=[];renderAiStudyCenter()};
  $("#study-send").onclick=sendStudyRequest;
}
async function sendStudyRequest(){
  const input=$("#study-input").value.trim(),mode=$("#study-mode").value;if(!input)return toast("Çalışmak istediğin konuyu veya soruyu yaz.");
  store.set("aiMode",mode);store.set("aiModel",$("#study-model").value);
  if(mode==="AI Sesli Öğretmen")return renderVoice();
  state.studyChat.push({role:"me",text:input});renderAiStudyCenter();
  const chat=$("#study-chat");chat.insertAdjacentHTML("beforeend",'<div class="message ai">Yanıt hazırlanıyor…</div>');
  const base="Sen KKTC/Türkiye müzik öğretmenliği ve Eğitim Bilimleri sınavına hazırlanan kullanıcıya destek veren uzman bir öğretmensin. Türkçe konuş, bilmediğin bilgiyi uydurma.";
  const local=mode==="Yanlış Analizi"?`\n\nKullanıcının kayıtlı yanlışları:\n${wrongContext()}`:"";
  try{
    const answer=await openAIText(input,`${base}\n\nGörev: ${AI_MODES[mode]||AI_MODES["Serbest Soru"]}${local}`);
    state.studyChat.push({role:"ai",text:answer});renderAiStudyCenter();
  }catch(e){state.studyChat.push({role:"ai",text:`Hata: ${e.message}`});renderAiStudyCenter()}
}
function renderTeacher(){
  setTitle("AI Öğretmen","Yazılı çalışma",true);app.innerHTML=`<section class="hero"><h2>AI Öğretmen</h2><p>Konu sorabilir, açıklama isteyebilir veya “bana bir soru sor” diyebilirsin.</p></section><div id="chat">${state.chat.map(m=>`<div class="message ${m.role}"><b>${m.role==="me"?"Sen":"Öğretmen"}:</b> ${esc(m.text)}</div>`).join("")}</div><div class="chat-box"><textarea id="teacher-input" placeholder="Örn. Olumsuz pekiştirmeyi kısa örnekle anlat"></textarea><button class="primary" id="send-teacher">Gönder</button></div>`;
  $("#send-teacher").onclick=async()=>{const t=$("#teacher-input").value.trim();if(!t)return;state.chat.push({role:"me",text:t});renderTeacher();const box=$("#chat");box.insertAdjacentHTML("beforeend",'<div class="message ai">Yanıt hazırlanıyor…</div>');try{const answer=await openAIText(t);state.chat.push({role:"ai",text:answer});renderTeacher()}catch(e){toast(e.message)}};
}
async function renderAiExam(){
  setTitle("AI Eğitim Bilimleri","AI denemesi oluştur",true);app.innerHTML=`<section class="hero"><h2>Eğitim Bilimleri Denemesi</h2><p>Felsefe ve sosyoloji hariç, dört seçenekli ve açıklamalı sorular oluşturur.</p></section><label>Alan</label><select id="ai-area"><option>Tüm alanlar</option><option>Gelişim Psikolojisi</option><option>Öğrenme Psikolojisi</option><option>Program Geliştirme</option><option>Öğretim İlke ve Yöntemleri</option><option>Ölçme ve Değerlendirme</option><option>Rehberlik</option><option>Sınıf Yönetimi</option></select><label>Soru sayısı</label><select id="ai-count"><option>5</option><option>10</option><option>15</option><option>21</option></select><div class="actions"><button class="primary" id="generate">Deneme Oluştur</button></div><div id="ai-status"></div>`;
  $("#generate").onclick=generateAiExam;
}
async function generateAiExam(){
  const area=$("#ai-area").value,count=+$("#ai-count").value,status=$("#ai-status");status.innerHTML='<div class="result">Sorular hazırlanıyor…</div>';$("#generate").disabled=true;
  const prompt=`${area} alanında ${count} Eğitim Bilimleri çoktan seçmeli soru üret. Eğitim Felsefesi ve Sosyolojisi olmasın. Yalnızca geçerli JSON döndür: {"questions":[{"question":"...","choices":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A","explanation":"..."}]}`;
  try{const text=await openAIText(prompt),parsed=JSON.parse(text.replace(/^```json\s*|```$/g,"").trim()),qs=parsed.questions.map((q,i)=>({id:`ai_${Date.now()}_${i}`,...q}));startExam(qs,"AI Eğitim Bilimleri")}catch(e){status.innerHTML=`<div class="result">Hata: ${esc(e.message)}</div>`;$("#generate").disabled=false}
}
function renderVoice(){
  const live=!!state.rtc;setTitle("Realtime AI Voice","Canlı konuşma",false);
  app.innerHTML=`<section class="hero"><h2>AI ile kesintisiz konuş</h2><p>Mikrofon açık kalır, AI anında sesli yanıt verir. AI konuşurken araya girip sözünü kesebilirsin.</p></section>
  <div class="voice-orb ${live?"live":""}">◉</div><div class="actions center"><button class="${live?"danger":"primary"}" id="voice-toggle">${live?"Canlı Görüşmeyi Bitir":"Canlı Görüşmeyi Başlat"}</button></div>
  <div id="voice-status" class="result">${live?"Bağlı · Konuşabilirsin.":"Hazır · Başlat düğmesine dokun."}</div><div id="transcript"></div>`;
  $("#voice-toggle").onclick=live?stopRealtimeVoice:startRealtimeVoice;
}
async function startRealtimeVoice(){
  const key=store.get("apiKey",""),endpoint=store.get("realtimeEndpoint","");
  if(!key&&!endpoint)return toast("Önce Ayarlar bölümüne API anahtarı veya Realtime sunucu adresi gir.");
  const status=$("#voice-status");status.textContent="Mikrofon ve canlı bağlantı hazırlanıyor…";
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Bu cihaz WebRTC mikrofon erişimini desteklemiyor.");
    const pc=new RTCPeerConnection();state.rtc=pc;
    const audio=document.createElement("audio");audio.autoplay=true;audio.setAttribute("playsinline","");state.voiceAudio=audio;
    pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{})};
    pc.onconnectionstatechange=()=>{
      const el=$("#voice-status");if(!el)return;
      if(pc.connectionState==="connected")el.textContent="Bağlı · Konuşabilirsin.";
      if(["failed","disconnected"].includes(pc.connectionState))el.textContent="Canlı bağlantı kesildi.";
    };
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    state.voiceStream=stream;stream.getAudioTracks().forEach(track=>pc.addTrack(track,stream));
    const dc=pc.createDataChannel("oai-events");state.voiceChannel=dc;
    dc.onopen=()=>dc.send(JSON.stringify({type:"session.update",session:{
      type:"realtime",model:"gpt-realtime-2.1",output_modalities:["audio"],
      instructions:store.get("instructions","Türkçe konuş. Kısa, doğru ve öğretici bir sınav hocası ol. Kullanıcı isterse birer birer sözlü soru sor."),
      audio:{input:{transcription:{model:"gpt-4o-mini-transcribe",language:"tr"},turn_detection:{type:"server_vad",create_response:true,interrupt_response:true}},output:{voice:"marin"}}
    }}));
    dc.onmessage=e=>{try{handleRealtimeEvent(JSON.parse(e.data))}catch{}};
    dc.onerror=()=>{const el=$("#voice-status");if(el)el.textContent="Realtime veri bağlantısında hata oluştu."};
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    const target=endpoint||"https://api.openai.com/v1/realtime/calls";
    const headers={"Content-Type":"application/sdp"};if(!endpoint)headers.Authorization=`Bearer ${key}`;
    const res=await fetch(target,{method:"POST",headers,body:offer.sdp});
    if(!res.ok)throw new Error((await res.text())||`HTTP ${res.status}`);
    await pc.setRemoteDescription({type:"answer",sdp:await res.text()});renderVoice();
  }catch(e){
    stopRealtimeVoice(false);
    const denied=e?.name==="NotAllowedError"||/permission|izin|denied/i.test(e?.message||"");
    renderVoice();const el=$("#voice-status");
    if(el)el.textContent=denied?"Mikrofon izni reddedildi. Android uygulama izinlerinden Mikrofonu aç.":`Bağlantı kurulamadı: ${e?.message||"Bilinmeyen hata"}`;
  }
}
function handleRealtimeEvent(e){
  const tr=$("#transcript");if(!tr)return;
  let who="",text="";
  if(e.type==="conversation.item.input_audio_transcription.completed"){who="me";text=e.transcript}
  if(e.type==="response.output_audio_transcript.done"||e.type==="response.audio_transcript.done"){who="ai";text=e.transcript}
  if(e.type==="error"){const s=$("#voice-status");if(s)s.textContent=`Realtime hatası: ${e.error?.message||"Bilinmeyen hata"}`}
  if(text){tr.insertAdjacentHTML("beforeend",`<div class="message ${who}"><b>${who==="me"?"Sen":"AI"}:</b> ${esc(text)}</div>`);tr.scrollTop=tr.scrollHeight}
}
function stopRealtimeVoice(redraw=true){
  state.voiceStream?.getTracks().forEach(t=>t.stop());state.voiceChannel?.close();state.rtc?.close();
  if(state.voiceAudio){state.voiceAudio.pause();state.voiceAudio.srcObject=null}
  state.rtc=null;state.voiceStream=null;state.voiceAudio=null;state.voiceChannel=null;if(redraw)renderVoice();
}

$("#back").onclick=()=>nav("home");$("#settings").onclick=()=>renderSettings();
document.querySelectorAll("#bottom-nav button").forEach(b=>b.onclick=()=>nav(b.dataset.route));
fetch("questions.json").then(r=>r.json()).then(d=>{state.data=d;nav("home")}).catch(e=>app.innerHTML=`<div class="result">Soru bankası yüklenemedi: ${esc(e.message)}</div>`);
