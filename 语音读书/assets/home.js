/* ===== 首页逻辑 ===== */
(function(){
  var THEMES = {
    PP:{color:"linear-gradient(135deg,#2e7d6f,#1d5a50)", emoji:"🌿", sub:"从创造到出埃及"},
    PK:{color:"linear-gradient(135deg,#5a4a9e,#3b2f73)", emoji:"👑", sub:"从所罗门到回归"},
    DA:{color:"linear-gradient(135deg,#c9a24b,#8a5a2b)", emoji:"🕊️", sub:"耶稣生平与教训"},
    AA:{color:"linear-gradient(135deg,#c2685a,#8f3b2e)", emoji:"⚓", sub:"使徒的脚踪"},
    GC:{color:"linear-gradient(135deg,#a0392f,#6d1f18)", emoji:"⚔️", sub:"善恶大斗争"}
  };
  function init(){
    var s = DS.load();
    // 今日金句
    renderQuote();
    // 继续阅读
    renderContinue(s);
    // 统计
    renderStats(s);
    // 书架
    renderShelf(s);
    // 连续打卡
    renderStreak(s);
    // 徽章
    renderBadges(s);
    // 应用主题
    applyTheme(s);
  }
  function applyTheme(s){
    document.body.classList.remove("theme-paper","theme-sepia","theme-night");
    document.body.classList.add("theme-"+s.settings.theme);
    document.body.classList.remove("size-sm","size-md","size-lg","size-xl");
    document.body.classList.add("size-"+s.settings.size);
  }
  function renderQuote(){
    // 从已加载的书里随机挑一句金句（10~28字）
    var quotes=[];
    try{
      var bids=Object.keys(window.BOOK_DATA||{});
      if(bids.length){
        var bid=bids[Math.floor(Math.random()*bids.length)];
        var book=window.BOOK_DATA[bid];
        var ch=book.chapters[Math.floor(Math.random()*book.chapters.length)];
        for(var i=0;i<ch.paras.length;i++){
          var p=ch.paras[i];
          var parts=p.split(/[。！？]/);
          for(var j=0;j<parts.length;j++){
            var t=parts[j].trim();
            if(t.length>=8 && t.length<=30 && /[“”]/.test(t)){ quotes.push(t); }
          }
        }
      }
    }catch(e){}
    var q=quotes.length?quotes[Math.floor(Math.random()*quotes.length)]:"“上帝与我们同在。”——以马内利";
    var el=document.getElementById("quote");
    if(el){ el.textContent=q; }
  }
  function renderContinue(s){
    var box=document.getElementById("continueBox");
    if(!box) return;
    if(!s.last){ box.classList.add("hidden"); return; }
    var bid=s.last.book, ch=s.last.ch;
    var book=window.BOOK_DATA[bid];
    if(!book){ box.classList.add("hidden"); return; }
    var chap=book.chapters.find(function(c){return c.n===ch;});
    if(!chap){ box.classList.add("hidden"); return; }
    var th=THEMES[bid]||THEMES.DA;
    var total=0, got=0;
    book.chapters.forEach(function(c){ total++; if((s.books[bid]||{})[c.n]&&s.books[bid][c.n].completed) got++; });
    var pct=Math.round(got/total*100);
    var title=bid+" · "+chap.title;
    document.getElementById("contTitle").textContent=title;
    document.getElementById("contPct").textContent=pct+"%";
    document.getElementById("contBar").style.width=pct+"%";
    document.getElementById("contBtn").href="reader.html?book="+encodeURIComponent(bid)+"&ch="+encodeURIComponent(ch);
    box.classList.remove("hidden");
  }
  function renderStats(s){
    var time=DS.statTime(s), chars=DS.statChars(s), chs=DS.statChapters(s);
    var t1=document.getElementById("statTime"); if(t1) t1.textContent=DS.fmtTime(time);
    var t2=document.getElementById("statChars"); if(t2) t2.textContent=DS.fmtNum(chars);
    var t3=document.getElementById("statCh"); if(t3) t3.textContent=chs;
    var t4=document.getElementById("statStreak"); if(t4) t4.textContent=DS.streak(s);
  }
  function renderShelf(s){
    var grid=document.getElementById("bookGrid");
    if(!grid) return;
    grid.innerHTML="";
    window.BOOKS.forEach(function(b){
      var th=THEMES[b.id]||THEMES.DA;
      var book=window.BOOK_DATA[b.id];
      var total=book?book.chapters.length:0;
      var got=0;
      (s.books[b.id]||{}).forEach && Object.keys(s.books[b.id]||{}).forEach(function(c){ if(s.books[b.id][c].completed) got++; });
      var pct=total?Math.round(got/total*100):0;
      var lastDone=false;
      if(s.last && s.last.book===b.id) lastDone=(s.books[b.id]||{})[s.last.ch]&&s.books[b.id][s.last.ch].completed;
      var card=document.createElement("a");
      card.className="book";
      card.href="reader.html?book="+encodeURIComponent(b.id)+"&ch="+encodeURIComponent(book.chapters[0].n);
      card.innerHTML=
        (pct===100?'<span class="done-badge">✔ 已读完</span>':"")+
        '<div class="cover" style="background:'+th.color+'">'+
          '<span class="emoji">'+th.emoji+'</span>'+
          '<div><h3>'+b.title+'</h3><div class="en">'+b.subtitle+'</div></div>'+
        '</div>'+
        '<div class="body">'+
          '<div class="row"><span><b>'+total+'</b> 章</span><span>已读 <b>'+got+'</b></span></div>'+
          '<div class="pbar"><i style="width:'+pct+'%"></i></div>'+
          '<div class="row"><span>'+th.sub+'</span><span>'+pct+'%</span></div>'+
          '<div class="btns">'+
            '<span class="btn primary small">📖 '+(got?'继续阅读':'开始阅读')+'</span>'+
          '</div>'+
        '</div>';
      grid.appendChild(card);
    });
  }
  function renderStreak(s){
    var el=document.getElementById("streakBar");
    if(!el) return;
    var html="";
    for(var i=13;i>=0;i--){
      var d=DS.day(i);
      var dd=s.days[d]||{};
      var on=((dd.time||0)>2000||(dd.chars||0)>20);
      var today=(i===0);
      html+='<div class="day'+(on?' on':'')+(today?' today':'')+'"><div class="dot">'+(on?"✓":"·")+'</div><span>'+(i===0?"今天":(i===1?"昨天":String(d).slice(5).replace("-","/"))) +'</span></div>';
    }
    el.innerHTML=html;
  }
  function renderBadges(s){
    var el=document.getElementById("badgeBox");
    if(!el) return;
    var list=DS.badgeList();
    el.innerHTML="";
    list.forEach(function(b){
      var got=b.check(s);
      var div=document.createElement("div");
      div.className="badge"+(got?" got":"");
      div.innerHTML='<div class="ic">'+b.ic+'</div><div><b>'+b.name+'</b><span>'+(got?"已达成":"未达成 · "+b.desc)+'</span></div>';
      el.appendChild(div);
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
