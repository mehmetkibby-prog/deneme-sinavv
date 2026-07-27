const $ = (s) => document.querySelector(s);
const app = $("#app");
const state = {
  data: null, route: "home", section: null, exam: [], index: 0,
  selected: null, answered: false, correct: 0, wrong: 0, rtc: null,
};
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

function esc(text = "") {
  return String(text).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
}
function toast(text) {
  const el = $("#toast"); el.textContent = text; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}
function shuffle(items) {
  const a = [...items];
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function allQuestions() { return state.data.sections.flatMap(s => s.questions); }
function hardIds() { return new Set(store.get("hardQuestions", [])); }
function setTitle(title, subtitle="V23.6 Android", back=false) {
  $("#page-title").textContent=title; $("#subtitle").textContent=subtitle;
  $("#back").classList.toggle("hidden", !back);
}
function nav(route) {
  state.route=route;
  document.querySelectorAll("#bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.route===route));
  ({home:renderHome,hard:renderHard,stats:renderStats,voice:renderVoice,settings:renderSettings}[route]||renderHome)();
}
function renderHome() {
  setTitle("Müzik Sınavı","Samsung Galaxy Tab için",false);
  app.innerHTML=`<section class="hero"><h2>Sınava hazırlan</h2><p>${allQuestions().length} soruluk bankadan bölüm seç, zor sorularını ayır ve gelişimini takip et.</p>
  <div class="actions"><button class="primary" id="mixed">Karışık Deneme</button><button class="secondary" id="ai-exam">AI Eğitim Bilimleri</button></div></section>
  <div class="grid">${state.data.sections.map(s=>`<button class="card section" data-id="${s.id}"><b>${esc(s.title)}</b><span class="pill">${s.questions.length} soru</span></button>`).join("")}</div>`;
  document.querySelectorAll(".section").forEach(b=>b.onclick=()=>renderSection(b.dataset.id));
  $("#mixed").onclick=()=>startExam(shuffle(allQuestions()).slice(0,Math.min(50,allQuestions().length)),"Karışık Deneme");
  $("#ai-exam").onclick=renderAiExam;
}
function renderSection(id) {
  const section=state.data.sections.find(s=>s.id===id); state.section=section;
  setTitle(section.title,`${section.questions.length} soru`,true);
  app.innerHTML=`<section class="hero"><h2>${esc(section.title)}</h2><p>Soru sayısını seçerek denemeyi başlat.</p>
  <label>Soru sayısı</label><select id="count">${[5,10,15,20,30,50,section.questions.length].filter((v,i,a)=>v<=section.questions.length&&a.indexOf(v)===i).map(v=>`<option value="${v}">${v===section.questions.length?"Tümü":v}</option>`).join("")}</select>
  <div class="actions"><button class="primary" id="begin">Sınavı Başlat</button><button class="secondary" id="cards">Soruları İncele</button></div></section>`;
  $("#begin").onclick=()=>startExam(shuffle(section.questions).slice(0,+$("#count").value),section.title);
  $("#cards").onclick=()=>renderQuestionList(section.questions,section.title);
}
function renderQuestionList(questions,title) {
  setTitle(title,"Çalışma kartları",true);
  app.innerHTML=`<div class="list">${questions.map((q,i)=>`<article class="list-item"><h3>${i+1}. ${esc(q.question)}</h3><div class="muted">Doğru cevap: <b>${q.answer}) ${esc(q.choices[q.answer])}</b></div></article>`).join("")}</div>`;
}
function startExam(questions,title) {
  if(!questions.length){toast("Bu listede soru yok.");return}
  Object.assign(state,{exam:questions,index:0,selected:null,answered:false,correct:0,wrong:0,examTitle:title});
  renderQuestion();
}
function renderQuestion() {
  const q=state.exam[state.index], hard=hardIds().has(q.id), pct=Math.round(state.index/state.exam.length*100);
  setTitle(state.examTitle,`Soru ${state.index+1} / ${state.exam.length}`,true);
  app.innerHTML=`<div class="exam-head"><span class="pill">Doğru ${state.correct} · Yanlış ${state.wrong}</span>
  <label class="hard-toggle"><input id="hard-check" type="checkbox" ${hard?"checked":""}> ★ Zor Soru</label></div>
  <div class="progress"><i style="width:${pct}%"></i></div><div class="question">${esc(q.question)}</div>
  <div id="choices">${Object.entries(q.choices).map(([k,v])=>`<button class="choice" data-key="${k}"><strong>${k}</strong><span>${esc(v)}</span></button>`).join("")}</div>
  <div id="feedback"></div><div class="actions"><button class="primary hidden" id="next">${state.index===state.exam.length-1?"Sınavı Bitir":"Sonraki Soru"}</button></div>`;
  $("#hard-check").onchange=e=>toggleHard(q.id,e.target.checked);
  document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>answer(b.dataset.key));
  $("#next").onclick=()=>{if(++state.index>=state.exam.length)finishExam();else{state.selected=null;state.answered=false;renderQuestion()}};
}
function toggleHard(id,on) {
  const ids=hardIds(); on?ids.add(id):ids.delete(id); store.set("hardQuestions",[...ids]);
  toast(on?"Zor Sorulara eklendi":"Zor Sorulardan çıkarıldı");
}
function answer(key) {
  if(state.answered)return;
  const q=state.exam[state.index]; state.answered=true; state.selected=key;
  const ok=key===q.answer; ok?state.correct++:state.wrong++;
  document.querySelectorAll(".choice").forEach(b=>{
    b.disabled=true;
    if(b.dataset.key===q.answer)b.classList.add("correct");
    else if(b.dataset.key===key)b.classList.add("wrong");
  });
  $("#feedback").innerHTML=`<div class="result"><b>${ok?"Doğru!":"Yanlış."}</b><br>${!ok?`Doğru cevap: ${q.answer}) ${esc(q.choices[q.answer])}<br>`:""}${q.explanation?esc(q.explanation):""}</div>`;
  $("#next").classList.remove("hidden");
}
function finishExam() {
  const score=Math.round(state.correct/state.exam.length*100);
  const history=store.get("history",[]);
  history.unshift({date:new Date().toISOString(),title:state.examTitle,total:state.exam.length,correct:state.correct,wrong:state.wrong,score});
  store.set("history",history.slice(0,100));
  setTitle("Sınav Sonucu",state.examTitle,true);
  app.innerHTML=`<section class="hero"><h2>%${score}</h2><p>${state.exam.length} soruda ${state.correct} doğru, ${state.wrong} yanlış.</p>
  <div class="actions"><button class="primary" id="again">Tekrar Çöz</button><button class="secondary" id="home">Ana Sayfa</button></div></section>`;
  $("#again").onclick=()=>startExam(shuffle(state.exam),state.examTitle);
  $("#home").onclick=()=>nav("home");
}
function renderHard() {
  setTitle("Zor Sorular","İşaretlediğin sorular",false);
  const ids=hardIds(), qs=allQuestions().filter(q=>ids.has(q.id));
  app.innerHTML=qs.length?`<section class="hero"><h2>${qs.length} zor soru</h2><p>Yalnızca işaretlediğin sorularla çalış.</p><div class="actions"><button class="primary" id="solve-hard">Zor Soruları Çöz</button><button class="danger" id="clear-hard">Tümünü Temizle</button></div></section>
  <div class="list">${qs.map(q=>`<article class="list-item"><h3>${esc(q.question)}</h3><div class="muted">${esc(q.choices[q.answer])}</div></article>`).join("")}</div>`:
  `<section class="hero"><h2>Henüz zor soru yok</h2><p>Sınav sırasında “Zor Soru” kutusunu işaretlediğin sorular burada görünecek.</p></section>`;
  if(qs.length){$("#solve-hard").onclick=()=>startExam(shuffle(qs),"Zor Sorular");$("#clear-hard").onclick=()=>{if(confirm("Tüm zor soru işaretleri silinsin mi?")){store.set("hardQuestions",[]);renderHard()}}}
}
function renderStats() {
  setTitle("Başarı Analizi","Son denemelerin",false);
  const h=store.get("history",[]);
  app.innerHTML=h.length?`<div class="list">${h.map(x=>`<article class="list-item"><h3>${esc(x.title)} · %${x.score}</h3><p class="muted">${new Date(x.date).toLocaleString("tr-TR")} · ${x.correct} doğru / ${x.wrong} yanlış</p><div class="bar"><span style="width:${x.score}%"></span></div></article>`).join("")}</div>`:
  `<section class="hero"><h2>Henüz sonuç yok</h2><p>Bir deneme tamamladığında sonuçların burada görünecek.</p></section>`;
}
function renderSettings() {
  setTitle("Ayarlar","API ve uygulama",true);
  app.innerHTML=`<section class="hero"><h2>OpenAI ayarları</h2><p>API anahtarı yalnızca bu cihazda saklanır.</p></section>
  <label>OpenAI API anahtarı</label><input id="api-key" type="password" value="${esc(store.get("apiKey",""))}" placeholder="sk-...">
  <label>AI çalışma talimatı</label><textarea id="instructions">${esc(store.get("instructions","Türkçe konuş. Müzik ve eğitim bilimleri sınavına hazırlanan bir öğretmene kısa, doğru ve öğretici cevaplar ver. İstenirse birer birer soru sor ve cevabı açıklayarak değerlendir."))}</textarea>
  <div class="actions"><button class="primary" id="save-settings">Kaydet</button></div>`;
  $("#save-settings").onclick=()=>{store.set("apiKey",$("#api-key").value.trim());store.set("instructions",$("#instructions").value.trim());toast("Ayarlar kaydedildi")};
}
async function renderAiExam() {
  setTitle("AI Eğitim Bilimleri","AI denemesi oluştur",true);
  app.innerHTML=`<section class="hero"><h2>Eğitim Bilimleri Denemesi</h2><p>Felsefe ve sosyoloji hariç, açıklamalı ve dört seçenekli sorular oluşturur.</p></section>
  <label>Alan</label><select id="ai-area"><option>Tüm alanlar</option><option>Gelişim Psikolojisi</option><option>Öğrenme Psikolojisi</option><option>Program Geliştirme</option><option>Öğretim İlke ve Yöntemleri</option><option>Ölçme ve Değerlendirme</option><option>Rehberlik</option><option>Sınıf Yönetimi</option></select>
  <label>Soru sayısı</label><select id="ai-count"><option>5</option><option>10</option><option>15</option><option>20</option><option>21</option></select>
  <div class="actions"><button class="primary" id="generate">Deneme Oluştur</button></div><div id="ai-status"></div>`;
  $("#generate").onclick=generateAiExam;
}
async function generateAiExam() {
  const key=store.get("apiKey",""); if(!key){toast("Önce ayarlardan API anahtarını gir.");return}
  const area=$("#ai-area").value,count=+$("#ai-count").value,status=$("#ai-status");
  status.innerHTML='<div class="result">Sorular hazırlanıyor…</div>'; $("#generate").disabled=true;
  const prompt=`${area} alanında ${count} adet Eğitim Bilimleri çoktan seçmeli deneme sorusu üret. Eğitim Felsefesi ve Eğitim Sosyolojisini dahil etme. Her soruda A-D dört seçenek, doğru cevap ve kısa açıklama olsun. Yanlış seçenekler konuya uygun güçlü çeldiriciler olsun. Yalnızca şu JSON biçimini döndür: {"questions":[{"question":"...","choices":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A","explanation":"..."}]}`;
  try{
    const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5-mini",input:prompt,text:{format:{type:"json_object"}}})});
    if(!res.ok)throw new Error((await res.json()).error?.message||`HTTP ${res.status}`);
    const data=await res.json(), text=data.output?.flatMap(o=>o.content||[]).find(c=>c.type==="output_text")?.text;
    const parsed=JSON.parse(text), qs=parsed.questions.map((q,i)=>({id:`ai_${Date.now()}_${i}`,sectionId:"ai",...q}));
    startExam(qs,"AI Eğitim Bilimleri");
  }catch(e){status.innerHTML=`<div class="result">Hata: ${esc(e.message)}</div>`;$("#generate").disabled=false}
}
function renderVoice() {
  setTitle("Realtime AI Voice","Sesli çalışma",false);
  const live=!!state.rtc;
  app.innerHTML=`<section class="hero"><h2>AI ile sesli çalış</h2><p>Mikrofondan konuş; AI sana sesli yanıt versin veya sözlü mini sınav yapsın.</p></section>
  <div class="voice-orb ${live?"live":""}">◉</div><div class="actions" style="justify-content:center"><button class="${live?"danger":"primary"}" id="voice-toggle">${live?"Konuşmayı Bitir":"Konuşmayı Başlat"}</button></div>
  <div id="voice-status" class="result">${live?"Bağlı; konuşabilirsin.":"Başlatmak için API anahtarının ayarlarda kayıtlı olması gerekir."}</div><div id="transcript"></div>`;
  $("#voice-toggle").onclick=live?stopVoice:startVoice;
}
async function startVoice() {
  const key=store.get("apiKey",""); if(!key){toast("Önce ayarlardan API anahtarını gir.");return}
  const status=$("#voice-status");status.textContent="Mikrofon ve AI bağlantısı hazırlanıyor…";
  try{
    const pc=new RTCPeerConnection(); state.rtc=pc;
    const audio=document.createElement("audio");audio.autoplay=true;pc.ontrack=e=>audio.srcObject=e.streams[0];
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>pc.addTrack(t,stream));
    const dc=pc.createDataChannel("oai-events");
    dc.onopen=()=>dc.send(JSON.stringify({type:"session.update",session:{type:"realtime",model:"gpt-realtime-2.1",output_modalities:["audio"],instructions:store.get("instructions","Türkçe konuş ve öğretici ol."),audio:{input:{format:{type:"audio/pcm",rate:24000},turn_detection:{type:"server_vad"}},output:{format:{type:"audio/pcm",rate:24000},voice:"marin"}}}}));
    dc.onmessage=e=>handleRealtimeEvent(JSON.parse(e.data));
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    const res=await fetch("https://api.openai.com/v1/realtime/calls",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/sdp"},body:offer.sdp});
    if(!res.ok)throw new Error(await res.text());
    await pc.setRemoteDescription({type:"answer",sdp:await res.text()});renderVoice();
  }catch(e){stopVoice();toast("Ses bağlantısı kurulamadı");status.textContent=e.message}
}
function handleRealtimeEvent(e) {
  const tr=$("#transcript"); if(!tr)return;
  let who="",text="";
  if(e.type==="conversation.item.input_audio_transcription.completed"){who="me";text=e.transcript}
  if(e.type==="response.output_audio_transcript.done"||e.type==="response.audio_transcript.done"){who="ai";text=e.transcript}
  if(text){tr.insertAdjacentHTML("beforeend",`<div class="message ${who}"><b>${who==="me"?"Sen":"AI"}:</b> ${esc(text)}</div>`);tr.scrollTop=tr.scrollHeight}
}
function stopVoice() {
  if(state.rtc){state.rtc.getSenders().forEach(s=>s.track?.stop());state.rtc.close()}state.rtc=null;renderVoice();
}

$("#back").onclick=()=>nav("home");
$("#settings").onclick=()=>nav("settings");
document.querySelectorAll("#bottom-nav button").forEach(b=>b.onclick=()=>nav(b.dataset.route));
fetch("questions.json").then(r=>r.json()).then(data=>{state.data=data;nav("home")}).catch(e=>app.innerHTML=`<div class="result">Soru bankası yüklenemedi: ${esc(e.message)}</div>`);
