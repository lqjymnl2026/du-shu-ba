/* ===== 阅读器逻辑：朗读 / 测验 / 记录 ===== */
(function(){
  var Q = {};            // book -> ch -> quiz
  var BID, BOOK, CH, STATE, SENTENCES = [], CUR = 0, PLAYING = false, PAUSED = false;
  var timer = null, lastTick = 0, ambient = null;
  var THEMES = {
    PP:{color:"linear-gradient(135deg,#2e7d6f,#1d5a50)", emoji:"🌿"},
    PK:{color:"linear-gradient(135deg,#5a4a9e,#3b2f73)", emoji:"👑"},
    DA:{color:"linear-gradient(135deg,#c9a24b,#8a5a2b)", emoji:"🕊️"},
    AA:{color:"linear-gradient(135deg,#c2685a,#8f3b2e)", emoji:"⚓"},
    GC:{color:"linear-gradient(135deg,#a0392f,#6d1f18)", emoji:"⚔️"}
  };

  /* ---------- 工具 ---------- */
  function $(id){ return document.getElementById(id); }
  function params(){
    var o={};
    location.search.replace(/^\?/,"").split("&").forEach(function(kv){
      var p=kv.split("="); if(p[0]) o[decodeURIComponent(p[0])]=decodeURIComponent(p[1]||"");
    });
    return o;
  }
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function splitSentences(text){
    var out=[], cur="";
    for(var i=0;i<text.length;i++){
      var ch=text[i]; cur+=ch;
      if("。！？；…".indexOf(ch)>=0){
        while(i+1<text.length && "”』」\"’".indexOf(text[i+1])>=0){ cur+=text[++i]; }
        if(cur.trim()) out.push(cur);
        cur="";
      }
    }
    if(cur.trim()) out.push(cur);
    return out;
  }
  function toast(msg){
    var t=$("toast"); t.textContent=msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove("show"); }, 2400);
  }
  function saveState(){ DS.save(STATE); }
  function chKey(bid,ch){ return STATE.books[bid] && STATE.books[bid][ch]; }
  function ensureCh(){
    if(!STATE.books[BID]) STATE.books[BID]={};
    if(!STATE.books[BID][CH.n]) STATE.books[BID][CH.n]={maxSent:-1,time:0,chars:0,completed:false,quiz:{best:0,total:0,tries:0}};
    return STATE.books[BID][CH.n];
  }

  /* ---------- 记录：计时 / 字数 ---------- */
  function tick(){
    var now=Date.now();
    if(lastTick){
      var dt=Math.min(now-lastTick, 30000);
      if(document.visibilityState==="visible"){
        var c=ensureCh();
        c.time+=dt;
        STATE.stats.time+=dt;
        var d=STATE.days[DS.todayKey()] || (STATE.days[DS.todayKey()]={time:0,chars:0});
        d.time+=dt;
        var hr=new Date().getHours();
        if(hr>=21||hr<5) STATE.stats.nightRead=true;
        saveState();
      }
    }
    lastTick=now;
  }
  function markRead(idx){
    var c=ensureCh();
    if(idx<=c.maxSent) return;
    var add=0;
    for(var i=c.maxSent+1;i<=idx && i<SENTENCES.length;i++) add+=SENTENCES[i].text.length;
    c.maxSent=idx; c.chars=(c.chars||0)+add;
    STATE.stats.chars+=add;
    var d=STATE.days[DS.todayKey()] || (STATE.days[DS.todayKey()]={time:0,chars:0});
    d.chars+=add;
    if(idx>=SENTENCES.length-1) completeChapter();
    saveState();
    updateProgressUI();
  }
  function completeChapter(){
    var c=ensureCh();
    if(c.completed) return;
    c.completed=true;
    saveState();
    checkBadges();
    toast("🎉 本章读完，太棒了！去下方做个小测验吧");
  }

  /* ---------- 徽章 ---------- */
  var lastBadges={};
  function checkBadges(){
    var list=DS.badgeList();
    var newly=[];
    list.forEach(function(b){
      var got=b.check(STATE);
      if(got && !STATE.badges[b.id]){ STATE.badges[b.id]=Date.now(); newly.push(b); }
    });
    if(newly.length){ saveState(); newly.forEach(function(b){ toast("🏅 解锁徽章：「"+b.name+"」"); }); renderBadges(); }
  }
  function renderBadges(){ /* 阅读器顶部不展示徽章详情，跳过 */ }

  /* ---------- 朗读 ---------- */
  var audioEl=null, ENGINE="browser", cloudWarned=false;
  function engineVoice(){ return ENGINE==="yunxi" ? "yunxi" : "xiaoxiao"; }
  function neuralInfo(){
    try{ return (window.NEURAL||{})[BID] && (window.NEURAL||{})[BID][String(CH.n)]; }catch(e){ return null; }
  }
  function cloudAvailable(){
    if(ENGINE==="browser") return false;
    var vk=engineVoice();
    var info=neuralInfo();
    return !!(info && info[vk] && info[vk].count===SENTENCES.length);
  }
  var advancing=false;
  function onUtteranceEnd(){
    if(advancing) return;
    advancing=true;
    try{
      markRead(CUR);
      highlight(CUR);
      if(CUR<SENTENCES.length-1){ CUR++; speak(CUR); }
      else {
        PLAYING=false; PAUSED=false; highlight(-1); $("playBtn").textContent="▶";
        if(CUR>=SENTENCES.length-1) STATE.stats.voiceFull=true;
        saveState(); checkBadges();
      }
    } finally { advancing=false; }
  }
  function setPlayBtn(playing){ $("playBtn").textContent=playing?"⏸":"▶"; }
  function nowTxt(i){ $("nowTxt").textContent=SENTENCES[i].text.slice(0,26)+(SENTENCES[i].text.length>26?"…":""); }
  function cloudSpeak(i){
    var vk=engineVoice();
    audioEl=new Audio("audio/"+BID+"/"+CH.n+"/"+vk+"/"+i+".mp3");
    audioEl.onended=onUtteranceEnd;
    audioEl.onerror=function(){ /* 单个音频缺失/失败：跳到下一句，避免卡住 */ onUtteranceEnd(); };
    audioEl.play().catch(function(){ onUtteranceEnd(); });
    highlight(CUR); setPlayBtn(true); nowTxt(i);
  }
  function speak(i){
    if(i<0||i>=SENTENCES.length) return;
    stop();
    CUR=i; PLAYING=true; PAUSED=false;
    if(ENGINE!=="browser"){
      if(cloudAvailable()){ cloudSpeak(i); return; }
      if(!cloudWarned){ cloudWarned=true; toast("本章"+(engineVoice()==="xiaoxiao"?"晓晓":"云希")+"云端语音未生成，先用浏览器语音"); renderCloudTag(); }
    }
    var u=new SpeechSynthesisUtterance(SENTENCES[i].text);
    u.lang="zh-CN";
    u.rate=parseFloat(STATE.settings.rate)||1;
    var v=STATE.settings.voice;
    if(v){ var vs=speechSynthesis.getVoices().filter(function(x){return x.voiceURI===v;}); if(vs.length) u.voice=vs[0]; }
    u.onend=onUtteranceEnd;
    u.onerror=function(){ PLAYING=false; PAUSED=false; setPlayBtn(false); };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    highlight(CUR); setPlayBtn(true); nowTxt(i);
  }
  function togglePlay(){
    if(PLAYING){
      if(PAUSED){
        if(ENGINE!=="browser" && audioEl){ audioEl.play().catch(function(){}); }
        else speechSynthesis.resume();
        PAUSED=false; setPlayBtn(true);
      } else {
        if(ENGINE!=="browser" && audioEl) audioEl.pause();
        else speechSynthesis.pause();
        PAUSED=true; setPlayBtn(false);
      }
      return;
    }
    if(CUR>=SENTENCES.length-1 && STATE.books[BID][CH.n] && STATE.books[BID][CH.n].maxSent>=SENTENCES.length-1) CUR=0;
    if(CUR<0) CUR=0;
    speak(CUR);
  }
  function stop(){
    speechSynthesis.cancel();
    if(audioEl){
      try{ audioEl.onended=null; audioEl.onerror=null; audioEl.pause(); audioEl.removeAttribute("src"); audioEl.load(); }catch(e){}
      audioEl=null;
    }
    PLAYING=false; PAUSED=false; setPlayBtn(false);
  }
  function step(d){
    var ni=CUR+d;
    if(ni<0||ni>=SENTENCES.length) return;
    stop(); speak(ni);
  }
  function highlight(i){
    SENTENCES.forEach(function(s,j){
      if(s.el) s.el.classList.toggle("playing", j===i);
    });
    if(i>=0 && SENTENCES[i].el){
      SENTENCES[i].el.scrollIntoView({block:"center", behavior:"smooth"});
    }
  }
  function loadVoices(){
    var sel=$("voiceSel");
    if(!sel) return;
    var voices=speechSynthesis.getVoices().filter(function(v){return /^zh/i.test(v.lang)||/Chinese/i.test(v.name);});
    sel.innerHTML="<option value=''>系统默认中文</option>"+voices.map(function(v){
      return "<option value='"+esc(v.voiceURI)+"' "+(STATE.settings.voice===v.voiceURI?"selected":"")+">"+esc(v.name)+"</option>";
    }).join("");
    sel.onchange=function(){ STATE.settings.voice=sel.value; saveState(); };
  }
  function renderCloudTag(){
    var el=$("cloudTag"); if(!el) return;
    var info=neuralInfo();
    if(ENGINE==="browser"){
      var av=[];
      if(info){ if(info.xiaoxiao) av.push("晓晓"); if(info.yunxi) av.push("云希"); }
      el.innerHTML=av.length?("🌥️ 云端神经语音可用："+av.join(" / ")+" · 到「设置」切换"):"";
    } else {
      var vk=engineVoice();
      el.innerHTML=cloudAvailable()?("🎧 正在用 "+(vk==="xiaoxiao"?"晓晓":"云希")+" 神经语音朗读"):("⚠️ 本章"+(vk==="xiaoxiao"?"晓晓":"云希")+"语音未生成，已回退浏览器语音");
    }
  }
  /* ---------- 渲染 ---------- */
  function render(){
    var th=THEMES[BID]||THEMES.DA;
    document.documentElement.style.setProperty("--bookaccent", th.color);
    document.title=BID+" · "+CH.title+" — 有声读书吧";
    $("topBook").textContent=window.BOOKS.find(function(b){return b.id===BID;}).title+" "+th.emoji;
    $("topCh").textContent=(CH.n?"第"+cnNum(CH.n)+"章　":"")+CH.title;
    var idx=BOOK.chapters.indexOf(CH);
    $("topIdx").textContent="第 "+(idx+1)+" / "+BOOK.chapters.length+" 章";
    var total=BOOK.chapters.length, got=0;
    BOOK.chapters.forEach(function(c){ if(STATE.books[BID]&&STATE.books[BID][c.n]&&STATE.books[BID][c.n].completed) got++; });
    var pct=Math.round(got/total*100);
    $("topBar").style.width=pct+"%";
    renderSidebar(idx);
    renderChapter();
    renderQuiz();
    updateProgressUI();
  }
  function cnNum(n){
    var d=["零","一","二","三","四","五","六","七","八","九"];
    if(n<=10) return n===10?"十":d[n];
    var t=Math.floor(n/10), o=n%10;
    return (t>1?d[t]:"")+"十"+(o?d[o]:"");
  }
  function renderSidebar(activeIdx){
    var list=$("chList"); list.innerHTML="";
    BOOK.chapters.forEach(function(c,i){
      var done=STATE.books[BID]&&STATE.books[BID][c.n]&&STATE.books[BID][c.n].completed;
      var li=document.createElement("li");
      var a=document.createElement("a");
      a.href="reader.html?book="+encodeURIComponent(BID)+"&ch="+encodeURIComponent(c.n);
      a.className=(i===activeIdx?"active":"")+(c.n===0?" preface":"");
      a.innerHTML="<span class='num'>"+(c.n===0?"序":cnNum(c.n))+"</span><span class='t'>"+esc(c.title)+"</span>"+(done?"<span class='ok'>✔</span>":"");
      li.appendChild(a); list.appendChild(li);
    });
    $("sideTitle").textContent=window.BOOKS.find(function(b){return b.id===BID;}).title;
    $("sideSub").textContent=BOOK.chapters.length+" 章 · "+(window.BOOKS.find(function(b){return b.id===BID;}).subtitle||"");
  }
  function renderChapter(){
    SENTENCES=[];
    var box=$("chapterBox"); box.innerHTML="";
    var head=document.createElement("div"); head.className="chhead";
    head.innerHTML="<div class='chapno'>"+(CH.n?"第"+cnNum(CH.n)+"章":"序")+"</div><h1>"+esc(CH.title)+"</h1>"+(CH.note?"<div class='note'>📌 "+esc(CH.note)+"</div>":"")+"<div class='cloudtag' id='cloudTag'></div>";
    box.appendChild(head);
    cloudWarned=false;
    renderCloudTag();
    // 本章金句
    var gq=goldQuote(CH);
    if(gq){ var g=document.createElement("div"); g.className="gold-sent"; g.innerHTML="<span class='star'>✨</span><div>"+esc(gq)+"</div>"; box.appendChild(g); }
    CH.paras.forEach(function(p,pi){
      var div=document.createElement("div"); div.className="para";
      var sents=splitSentences(p);
      sents.forEach(function(s,si){
        var span=document.createElement("span"); span.className="sent"; span.textContent=s;
        var flat=SENTENCES.length;
        span.addEventListener("click",function(){ markRead(flat); speak(flat); });
        div.appendChild(span);
        SENTENCES.push({para:pi,sent:si,text:s,el:span});
      });
      box.appendChild(div);
    });
    // 恢复上次位置
    var c=STATE.books[BID]&&STATE.books[BID][CH.n];
    if(c && c.maxSent>=0 && c.maxSent<SENTENCES.length){
      var target=SENTENCES[c.maxSent].el;
      setTimeout(function(){ target.scrollIntoView({block:"center"}); }, 80);
      var prev=document.createElement("div");
      prev.className="gold-sent"; prev.style.marginBottom="26px";
      prev.innerHTML="<span class='star'>🔖</span><div>上次读到这里</div>";
      target.parentNode.insertBefore(prev, target);
    }
  }
  function goldQuote(ch){
    var cands=[];
    for(var i=0;i<Math.min(ch.paras.length,12);i++){
      var parts=ch.paras[i].split(/[。！？]/);
      for(var j=0;j<parts.length;j++){
        var t=parts[j].trim();
        if(t.length>=8&&t.length<=34&&/[“”]/.test(t)) cands.push(t);
      }
    }
    return cands.length?cands[Math.floor(Math.random()*cands.length)]:null;
  }

  /* ---------- 测验 ---------- */
  function renderQuiz(){
    var box=$("quizBox");
    var quiz=(Q[BID]||{})[String(CH.n)] || (Q[BID]||{})[CH.n];
    var c=ensureCh();
    if(!quiz || !quiz.length){
      box.innerHTML="<div class='qsub' style='margin-top:6px'>📖 本章测验筹备中——先好好读书吧！</div>";
      return;
    }
    var html="<div class='qhead'><h2>📝 本章测验</h2><span class='tag'>"+quiz.length+" 题</span></div>";
    html+="<div class='qsub'>读完全章来试试 · 答对点亮星星 · 成绩自动保存</div>";
    quiz.forEach(function(item,i){
      html+="<div class='qcard' data-q='"+i+"'>"+
        "<div class='q'>"+(i+1)+". "+esc(item.q)+"</div>"+
        "<div class='opts'>"+item.options.map(function(op,j){
          return "<div class='opt' data-o='"+j+"'><span class='key'>"+String.fromCharCode(65+j)+"</span><span>"+esc(op)+"</span></div>";
        }).join("")+"</div>"+
        "<div class='qexp hidden'></div></div>";
    });
    html+="<div class='qresult hidden'></div>";
    box.innerHTML=html;
    box.querySelectorAll(".qcard").forEach(function(card){
      var i=+card.getAttribute("data-q");
      card.querySelectorAll(".opt").forEach(function(opt){
        opt.addEventListener("click",function(){ answer(card,i,+opt.getAttribute("data-o")); });
      });
    });
  }
  function answer(card,i,sel){
    var quiz=(Q[BID]||{})[String(CH.n)]||(Q[BID]||{})[CH.n];
    var item=quiz[i];
    if(card.getAttribute("data-done")) return;
    card.setAttribute("data-done","1");
    var opts=card.querySelectorAll(".opt");
    opts.forEach(function(o,j){
      o.classList.add("disabled");
      if(j===item.answer) o.classList.add("right");
      else if(j===sel) o.classList.add("wrong");
    });
    var exp=card.querySelector(".qexp");
    exp.classList.remove("hidden");
    exp.textContent=(sel===item.answer?"✅ 答对了！":"❌ 再想想～正确答案是 "+String.fromCharCode(65+item.answer)+"。")+(item.explain?(" "+item.explain):"");
    // 判分
    var cards=document.querySelectorAll(".qcard");
    var done=document.querySelectorAll(".qcard[data-done]").length;
    if(done===cards.length){
      var score=0;
      cards.forEach(function(cd){
        var qi=+cd.getAttribute("data-q");
        var right=cd.querySelector(".opt.right")!==null;
        if(right) score++;
      });
      showResult(score,quiz.length);
    }
  }
  function showResult(score,total){
    var c=ensureCh();
    var best=c.quiz.best||0;
    c.quiz.tries=(c.quiz.tries||0)+1;
    if(score>best){ c.quiz.best=score; c.quiz.total=total; }
    c.quiz.lastScore=score;
    if(score===total) STATE.stats.perfect=true;
    saveState();
    checkBadges();
    var pct=Math.round(score/total*100);
    var stars=score>=total?"★★★":(score>=total-1?"★★☆":(score>=Math.ceil(total/2)?"★☆☆":"☆☆☆"));
    var box=document.querySelector(".qresult");
    box.classList.remove("hidden");
    box.innerHTML="<div class='score'>"+score+" / "+total+"</div>"+
      "<div class='stars'>"+stars+"</div>"+
      "<p>"+(score===total?"全对！你就是本章大师！":(score>=Math.ceil(total/2)?"不错，继续加油！":"再多读两遍，你一定可以！"))+" 历史最佳 "+best+" / "+total+"</p>"+
      "<button class='btn primary small' onclick='location.reload()'>🔄 再测一次</button>";
    if(pct>=75) confetti();
    box.scrollIntoView({block:"nearest",behavior:"smooth"});
  }
  function confetti(){
    var colors=["#c9a24b","#2e8b57","#c2685a","#5a4a9e","#e0a13c"];
    for(var i=0;i<60;i++){
      var d=document.createElement("div");
      d.className="confetti";
      d.style.left=Math.random()*100+"vw";
      d.style.background=colors[i%colors.length];
      d.style.animationDelay=(Math.random()*0.6)+"s";
      document.body.appendChild(d);
      setTimeout(function(n){ n.remove(); }, 3000);
    }
  }

  /* ---------- 进度 ---------- */
  function updateProgressUI(){
    var c=STATE.books[BID]&&STATE.books[BID][CH.n];
    var total=SENTENCES.length;
    var cur=(c&&c.maxSent>=0)?c.maxSent+1:0;
    if(total) $("readPct").textContent="已读 "+Math.min(cur,total)+" / "+total+" 句 · "+(c?DS.fmtTime(c.time||0):"0")+"";
  }

  /* ---------- 设置 ---------- */
  function setEngine(e){
    stop();
    ENGINE=(e==="xiaoxiao"||e==="yunxi")?e:"browser";
    STATE.settings.engine=ENGINE;
    saveState(); syncSettings(); renderCloudTag();
    toast(ENGINE==="browser"?"已切换为浏览器语音":("已切换为云端 "+(ENGINE==="xiaoxiao"?"晓晓":"云希")+" 神经语音"));
  }
  function openSheet(){ $("sheet").classList.add("open"); syncSettings(); }
  function closeSheet(){ $("sheet").classList.remove("open"); }
  function syncSettings(){
    var th=STATE.settings.theme, sz=STATE.settings.size;
    document.body.className=document.body.className.replace(/theme-\w+/g,"").replace(/size-\w+/g,"").trim();
    document.body.classList.add("theme-"+th,"size-"+sz);
    document.querySelectorAll(".seg[data-set=theme] button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-v")===th); });
    document.querySelectorAll(".seg[data-set=size] button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-v")===sz); });
    document.querySelectorAll(".seg[data-set=engine] button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-v")===ENGINE); });
    $("rateRange").value=STATE.settings.rate;
    $("ambientChk").checked=!!STATE.settings.ambient;
    var cloud=ENGINE!=="browser";
    $("rateRange").disabled=cloud;
    $("voiceSel").disabled=cloud;
    renderCloudTag();
  }

  /* ---------- 环境音 ---------- */
  function toggleAmbient(on){
    STATE.settings.ambient=!!on; saveState();
    if(!on){ if(ambient){ try{ambient.close();}catch(e){} ambient=null; } return; }
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      var ctx=new AC();
      var master=ctx.createGain(); master.gain.value=0.05; master.connect(ctx.destination);
      // 低音垫
      [55,82.4,110].forEach(function(f){
        var o=ctx.createOscillator(); o.type="sine"; o.frequency.value=f;
        var g=ctx.createGain(); g.gain.value=0.6; o.connect(g); g.connect(master); o.start();
      });
      // 柔和的棕色噪音（雨声）
      var len=ctx.sampleRate*4;
      var buf=ctx.createBuffer(1,len,ctx.sampleRate);
      var data=buf.getChannelData(0); var last=0;
      for(var i=0;i<len;i++){ var white=Math.random()*2-1; last=(last+0.02*white)/1.02; data[i]=last*3.5; }
      var src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
      var lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=400;
      var ng=ctx.createGain(); ng.gain.value=0.5;
      src.connect(lp); lp.connect(ng); ng.connect(master); src.start();
      ambient=ctx;
    }catch(e){}
  }

  /* ---------- 导航 ---------- */
  function goChapter(d){
    var idx=BOOK.chapters.indexOf(CH);
    var ni=idx+d;
    if(ni<0||ni>=BOOK.chapters.length){ toast(d>0?"已经是最后一章啦":"已经是第一章啦"); return; }
    stop();
    location.href="reader.html?book="+encodeURIComponent(BID)+"&ch="+encodeURIComponent(BOOK.chapters[ni].n);
  }

  /* ---------- 初始化 ---------- */
  function init(){
    STATE=DS.load();
    Q=window.QUIZZES||{};
    ENGINE=(STATE.settings.engine==="xiaoxiao"||STATE.settings.engine==="yunxi")?STATE.settings.engine:"browser";
    var p=params();
    var bid=p.book||"DA";
    if(!window.BOOK_DATA[bid]) bid=window.BOOKS[0].id;
    BID=bid;
    BOOK=window.BOOK_DATA[BID];
    var ch=(+p.ch)||BOOK.chapters[0].n;
    CH=BOOK.chapters.find(function(c){return c.n===ch;}) || BOOK.chapters[0];
    if(!STATE.last) STATE.last={};
    STATE.last={book:BID,ch:CH.n,ts:Date.now()};
    saveState(); checkBadges();
    // 计时器
    timer=setInterval(tick,5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("scroll", function(){
      if(SENTENCES.length && (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 140){
        markRead(SENTENCES.length-1);
      }
    }, {passive:true});
    window.addEventListener("beforeunload", function(){ tick(); stop(); });
    // 事件
    $("playBtn").addEventListener("click",togglePlay);
    $("prevBtn").addEventListener("click",function(){ step(-1); });
    $("nextBtn").addEventListener("click",function(){ step(1); });
    $("stopBtn").addEventListener("click",stop);
    $("rateRange").addEventListener("input",function(){ STATE.settings.rate=this.value; saveState(); $("rateVal").textContent=this.value+"x"; });
    $("menuBtn").addEventListener("click",function(){ $("sidebar").classList.toggle("open"); });
    $("closeSide").addEventListener("click",function(){ $("sidebar").classList.remove("open"); });
    $("setBtn").addEventListener("click",openSheet);
    $("sheet").addEventListener("click",function(e){ if(e.target===$("sheet")) closeSheet(); });
    $("closeSheetBtn").addEventListener("click",closeSheet);
    $("prevCh").addEventListener("click",function(){ goChapter(-1); });
    $("nextCh").addEventListener("click",function(){ goChapter(1); });
    $("immersiveBtn").addEventListener("click",function(){
      document.body.classList.toggle("immersive");
      $("sidebar").classList.remove("open");
      toast(document.body.classList.contains("immersive")?"🧘 已进入沉浸阅读":"退出沉浸模式");
    });
    $("homeBtn").addEventListener("click",function(){ stop(); });
    document.querySelectorAll(".seg[data-set=theme] button").forEach(function(b){
      b.addEventListener("click",function(){ STATE.settings.theme=b.getAttribute("data-v"); saveState(); syncSettings(); });
    });
    document.querySelectorAll(".seg[data-set=size] button").forEach(function(b){
      b.addEventListener("click",function(){ STATE.settings.size=b.getAttribute("data-v"); saveState(); syncSettings(); });
    });
    document.querySelectorAll(".seg[data-set=engine] button").forEach(function(b){
      b.addEventListener("click",function(){ setEngine(b.getAttribute("data-v")); });
    });
    $("ambientChk").addEventListener("change",function(){ toggleAmbient(this.checked); });
    // 键盘
    document.addEventListener("keydown",function(e){
      if($("sheet").classList.contains("open")) return;
      if(e.code==="Space"){ e.preventDefault(); togglePlay(); }
      else if(e.key==="ArrowRight") step(1);
      else if(e.key==="ArrowLeft") step(-1);
    });
    speechSynthesis.onvoiceschanged=loadVoices;
    loadVoices();
    render();
    syncSettings();
    if(STATE.settings.ambient) toggleAmbient(true);
    checkBadges();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
