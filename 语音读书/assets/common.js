/* ===== 有声读书吧 · 公共逻辑：存储 / 统计 / 工具 ===== */
(function(){
  var KEY = "dushuba_v1";
  function defaults(){
    return {
      v:1,
      settings:{ rate:1, voice:"", theme:"paper", size:"md", ambient:false },
      last:null,                    // {book, ch, para, sent, ts}
      books:{},                     // bookId -> { ch -> {maxSent, time, chars, completed, quiz:{best,total,tries,lastScore} } }
      stats:{ time:0, chars:0, started:0 },
      days:{},                      // "YYYY-MM-DD" -> {time, chars}
      badges:{}
    };
  }
  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return defaults();
      var s = JSON.parse(raw);
      var d = defaults();
      for(var k in d) if(s[k]===undefined) s[k]=d[k];
      if(!s.books) s.books={};
      if(!s.days) s.days={};
      if(!s.badges) s.badges={};
      if(!s.settings) s.settings=d.settings;
      return s;
    }catch(e){ return defaults(); }
  }
  function save(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }
  function todayKey(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function day(offset){ var d=new Date(); d.setDate(d.getDate()-offset); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function fmtTime(ms){
    if(ms < 60000) return Math.round(ms/1000)+" 秒";
    if(ms < 3600000) return Math.round(ms/60000)+" 分钟";
    return (ms/3600000).toFixed(1)+" 小时";
  }
  function fmtNum(n){
    if(n>=10000) return (n/10000).toFixed(1)+" 万";
    if(n>=1000) return (n/1000).toFixed(1)+" 千";
    return String(n);
  }
  function badgeList(){
    return [
      {id:"first",  ic:"🎯", name:"初次相遇",     desc:"打开第一本书",  check:function(s){ return !!s.last; }},
      {id:"quiz1",  ic:"📝", name:"初试啼声",     desc:"完成第一次测验", check:function(s){ return s.stats.quizDone>0; }},
      {id:"ch3",    ic:"📗", name:"小试牛刀",     desc:"读完 3 章",     check:function(s){ return statChapters(s)>=3; }},
      {id:"ch10",   ic:"📘", name:"渐入佳境",     desc:"读完 10 章",    check:function(s){ return statChapters(s)>=10; }},
      {id:"ch25",   ic:"📙", name:"博学多才",     desc:"读完 25 章",    check:function(s){ return statChapters(s)>=25; }},
      {id:"ch50",   ic:"📚", name:"满腹经纶",     desc:"读完 50 章",    check:function(s){ return statChapters(s)>=50; }},
      {id:"ch100",  ic:"🏛️", name:"学富五车",     desc:"读完 100 章",   check:function(s){ return statChapters(s)>=100; }},
      {id:"streak3",ic:"🔥", name:"三连坚持",     desc:"连续打卡 3 天", check:function(s){ return streak(s)>=3; }},
      {id:"streak7",ic:"⭐", name:"七日恒心",     desc:"连续打卡 7 天", check:function(s){ return streak(s)>=7; }},
      {id:"book5",  ic:"🗺️", name:"博览群书",     desc:"打开全部 5 本书", check:function(s){ return Object.keys(s.books||{}).length>=5; }},
      {id:"perfect",ic:"🌟", name:"满堂彩",       desc:"一次测验全对",   check:function(s){ return !!s.stats.perfect; }},
      {id:"late",   ic:"🌙", name:"夜读时光",     desc:"深夜读书一次",   check:function(s){ return !!s.stats.nightRead; }},
      {id:"char5k", ic:"⚡", name:"一目十行",     desc:"单日读满 5000 字", check:function(s){ var d=s.days[todayKey()]||{}; return (d.chars||0)>=5000; }},
      {id:"voice",  ic:"🎧", name:"声临其境",     desc:"用朗读听完一章", check:function(s){ return !!s.stats.voiceFull; }}
    ];
  }
  function statChapters(s){
    var n=0;
    for(var b in s.books) for(var c in s.books[b]) if(s.books[b][c].completed) n++;
    return n;
  }
  function statChars(s){ var n=0; for(var b in s.books) for(var c in s.books[b]) n+=s.books[b][c].chars||0; return n; }
  function statTime(s){ var n=0; for(var b in s.books) for(var c in s.books[b]) n+=s.books[b][c].time||0; return n; }
  function streak(s){
    var n=0;
    for(var i=0;i<365;i++){
      var d=day(i);
      var dd=s.days[d];
      if(dd && ((dd.time||0)>2000 || (dd.chars||0)>20)) n++;
      else if(i===0 && !(dd && ((dd.time||0)>2000||(dd.chars||0)>20))) { /* today not counted yet */ }
      else break;
    }
    return n;
  }
  function chProgress(s, bid, ch){
    var b=s.books[bid]; if(!b) return 0;
    var c=b[ch]; if(!c) return 0;
    return c.maxSent||0;
  }
  window.DS = {
    load:load, save:save, todayKey:todayKey, day:day, fmtTime:fmtTime, fmtNum:fmtNum,
    badgeList:badgeList, statChapters:statChapters, statChars:statChars, statTime:statTime,
    streak:streak, chProgress:chProgress
  };
})();
