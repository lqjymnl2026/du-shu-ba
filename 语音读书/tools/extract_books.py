#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从《历代斗争丛书》PDF 提取正文 → 语音读书网站 data/*.js

切分策略：
- AA / PK / DA：目录（标题+印张页码）→ 印张页码 → PDF 页 精确切分
- PP：正文「第X章」标题 + {XX n.m} 标记分段
- GC2023：layout 模式正文「第X章」标题 + 空行分段

通用：删除「安息日会」四个字（保留「安息日」及其他内容）、清理页眉页脚
"""
import json, os, re

BASE_PDF = "/Users/macbook/Desktop/怀氏著作/历代斗争丛书"
OUT_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
TMP      = "/tmp/booktext"

BOOKS = [
    ("PP", "先祖與先知 PP.pdf", "先祖与先知", "Patriarchs and Prophets", "PP"),
    ("PK", "先知與君王 PK.pdf", "先知与君王", "Prophets and Kings", "PK"),
    ("DA", "历代愿望 DA.pdf",   "历代愿望",   "The Desire of Ages",     "DA"),
    ("AA", "使徒行述 AA.pdf",   "使徒行述",   "The Acts of the Apostles","AA"),
    ("GC", "善恶之争2023版 GC.pdf", "善恶之争", "The Great Controversy", "GC"),
]
TOC_BOOKS = {"AA": (5, 6, 7), "PK": (8, 9, 10, 11), "DA": (4, 5, 6, 7), "PP": (11, 12, 13), "GC": (12, 13, 14)}
LAYOUT_BOOKS = {"GC"}
PRE_LABEL = {"AA": "序言", "PK": "导论", "DA": None, "PP": "前言", "GC": "导言"}

HEAD_RE  = re.compile(r"第\s*([0-9一二三四五六七八九十百零两]+)\s*章")
REF_RE   = re.compile(r"\{[A-Za-z]{1,4}[\s-]*\d+\.\d+\}")
TOC_RE   = re.compile(r"(?<!回)目\s*录")
PRE_PAT  = re.compile(r"(序\s*言|前\s*言|导\s*论|导\s*言|引\s*言)")
JING_RE  = re.compile(r"^第\s*[0-9一二三四五六七八九十百零两]+\s*[卷编篇部]")
LATIN_RE = re.compile(r"^[\sA-Za-z0-9（）()·.&'\"\-—:：]+$")
DOTS_RE  = re.compile(r"^[\s\-—.…·]+$")
HEADLINE_RE = re.compile(r"^第\s*([0-9一二三四五六七八九十百零两]+)\s*章$")
NUMLINE_RE  = re.compile(r"^[0-9一二三四五六七八九十百零两]+\s*章\s*$")
NOTE_RE  = re.compile(r"^(（(?:本章依据|参|根据)[^）]*）)\s*")

CN = "零一二三四五六七八九十"
def num_to_int(s):
    s = s.strip()
    if s.isdigit():
        return int(s)
    if "百" in s:
        a, b = s.split("百", 1)
        return (num_to_int(a) if a else 1) * 100 + (num_to_int(b) if b else 0)
    if "十" in s:
        a, b = s.split("十", 1)
        return (num_to_int(a) if a else 1) * 10 + (num_to_int(b) if b else 0)
    tot = 0
    for ch in s:
        if ch in CN:
            tot = tot * 10 + CN.index(ch)
    return tot

def is_toc_page(t):
    return bool(TOC_RE.search(t))

def is_body_page(t):
    if is_toc_page(t):
        return False
    if PRE_PAT.search(t):
        return True
    if HEAD_RE.search(t):
        return True
    return False

def clean_title(raw):
    t = re.sub(r"\s+", "", raw)
    t = t.strip(" \t\n　")
    t = t.rstrip("。；，、")
    m = re.search(r"（(?:本章依据|参|根据)", t)
    if m:
        t = t[:m.start()]
    return t.strip('"“”')

def extract_title(tail):
    first_nl = tail.find("\n")
    same = (tail if first_nl == -1 else tail[:first_nl]).strip(" \t　")
    if same and clean_title(same):
        return clean_title(same)
    rest = tail[first_nl:] if first_nl != -1 else ""
    for ln in rest.split("\n"):
        s = ln.strip(" \t　")
        if s and not HEAD_RE.search(s) and not is_toc_page(s) and clean_title(s):
            return clean_title(s)
    return ""

def is_line_start(p, pos):
    return pos == 0 or p[pos - 1] in "\n\r \t|"

def is_heading_match(p, m):
    if not is_line_start(p, m.start()):
        return False
    ctx = p[max(0, m.start() - 200): m.end() + 200]
    rel = m.start() - max(0, m.start() - 200)
    for mm in HEAD_RE.finditer(ctx):
        if mm.start() != rel and is_line_start(ctx, mm.start()):
            return False
    return True

def bad_line(s, title, book_titles):
    if not s:
        return False
    s_strip = s.strip()
    if not s_strip:
        return True
    if DOTS_RE.fullmatch(s_strip):
        return True
    if s_strip in ("回目录", "目 录", "目录"):
        return True
    if re.fullmatch(r"[0-9IVXLCDMivxlcdm\s]+回目录", s_strip):
        return True
    if re.fullmatch(r"[0-9IVXLCDMivxlcdm\s]+", s_strip):
        return True
    if s_strip == "第" or NUMLINE_RE.fullmatch(s_strip):
        return True
    if HEAD_RE.search(s_strip) or JING_RE.search(s_strip):
        return True
    if LATIN_RE.fullmatch(s_strip):
        return True
    compact = re.sub(r"\s+", "", s_strip)
    if compact in book_titles:
        return True
    t2 = re.sub(r"^[0-9IVXLCDMivxlcdm\s]+", "", s_strip)
    if re.sub(r"\s+", "", t2) == title and len(title) >= 2:
        return True
    if compact.strip('"“”') == title and len(title) >= 2:
        return True
    return False

def clean_para_lines(lines, title, book_titles):
    kept = [ln for ln in lines if not bad_line(ln.strip(), title, book_titles)]
    txt = "".join(kept)
    txt = re.sub(r"\s+", "", txt)
    txt = txt.replace("安息日会", "")
    return txt

def load_pages(bid):
    mode = "layout" if bid in LAYOUT_BOOKS else "normal"
    cache = os.path.join(TMP, bid + ("_l.json" if mode == "layout" else "_n.json"))
    if os.path.exists(cache):
        pages = json.load(open(cache, encoding="utf-8"))
    else:
        from pypdf import PdfReader
        fn = [b[1] for b in BOOKS if b[0] == bid][0]
        r = PdfReader(os.path.join(BASE_PDF, fn))
        kw = {"extraction_mode": "layout"} if mode == "layout" else {}
        pages = []
        for p in r.pages:
            try:
                pages.append(p.extract_text(**kw) or "")
            except Exception:
                pages.append("")
        json.dump(pages, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
    return pages

def print_page_of(p, bid=None):
    m = re.match(r"\s*(\d+)", p)
    if m:
        return int(m.group(1))
    if bid in LAYOUT_BOOKS:
        best = None
        for mm in re.finditer(r"(\d+)\s*回目录|回目录\s*(\d+)", p):
            best = int(mm.group(1) or mm.group(2))
        return best
    return None

def parse_toc(pages, toc_idxs, bid):
    entries = []  # (title, print_page)
    for i in toc_idxs:
        for ln in pages[i].split("\n"):
            s = ln.strip()
            if not s:
                continue
            if s in ("目 录", "目录") or re.fullmatch(r"\d+", s):
                continue
            if HEADLINE_RE.fullmatch(s):
                continue
            if JING_RE.fullmatch(s):
                continue
            btitle = re.sub(r"\s+", "", s)
            if btitle in ("先祖与先知", "先知与君王", "历代愿望", "使徒行述", "善恶之争"):
                continue
            m = re.match(r"^(.*?)[\s\-—.…·]+(\d+)\s*$", s)
            if m:
                title = clean_title(m.group(1))
                page = int(m.group(2))
                if page <= 0:
                    continue
                if title in ("-", "—", ""):
                    title = PRE_LABEL.get(bid)
                if not title:
                    continue
                if "附录" in title:
                    continue
                mh = HEAD_RE.match(title)
                if mh:
                    title = title[mh.end():].strip('"“” ')
                if not title:
                    continue
                entries.append((title, page))
    # 去重（保留首次）
    seen = set()
    out = []
    for title, page in entries:
        key = (title, page)
        if key not in seen:
            seen.add(key)
            out.append((title, page))
    return out

def split_by_toc(pages, bid):
    toc_idxs = TOC_BOOKS[bid]
    entries = parse_toc(pages, toc_idxs, bid)
    filt = [(i, p) for i, p in enumerate(pages) if not is_toc_page(p)]
    lead = [print_page_of(p, bid) for _, p in filt]
    body0 = None
    for idx, l in enumerate(lead):
        if l is not None:
            body0 = idx
            break
    starts = []  # (title, print_page, filt_idx)
    for title, pg in entries:
        idx = None
        for k in range(body0, len(filt)):
            if lead[k] == pg:
                idx = k
                break
        if idx is None:
            for k in range(body0, len(filt)):
                if lead[k] is not None and lead[k] > pg:
                    idx = k
                    break
        starts.append((title, pg, idx))
    has_pre = bool(PRE_LABEL.get(bid)) and starts and starts[0][0] == PRE_LABEL[bid]
    chapters = []
    for k, (title, pg, idx) in enumerate(starts):
        if idx is None:
            continue
        end = starts[k + 1][2] if k + 1 < len(starts) else len(filt)
        if end is None:
            end = len(filt)
        raw = "\n".join(p for _, p in filt[idx:end])
        n = k if has_pre else k + 1
        chapters.append({"n": n, "title": title, "raw": raw})
    return chapters

def split_by_heading(pages, bid):
    book_titles = set()
    for b in BOOKS:
        if b[0] == bid:
            book_titles.add(re.sub(r"\s+", "", b[2]))
            break
    filt = [(i, p) for i, p in enumerate(pages) if not is_toc_page(p)]
    body_start = None
    for idx, (_, p) in enumerate(filt):
        if bid in LAYOUT_BOOKS:
            if "导言" in re.sub(r"\s+", "", p):
                body_start = idx
                break
        elif is_body_page(p):
            body_start = idx
            break
    if body_start is None:
        return []
    alltext = "\n".join(p for _, p in filt)
    offsets = []
    pos = 0
    for _, p in filt:
        offsets.append(pos)
        pos += len(p) + 1
    headings = []
    cur = 0
    for idx in range(body_start, len(filt)):
        p = filt[idx][1]
        for m in HEAD_RE.finditer(p):
            if not is_heading_match(p, m):
                continue
            num = num_to_int(m.group(1))
            if num <= cur:
                continue
            title = extract_title(p[m.end():])
            if not title or len(title) < 2:
                continue
            headings.append((num, title, offsets[idx] + m.start()))
            cur = num
    if not headings:
        return []
    chapters = []
    pre_raw = alltext[offsets[body_start]:headings[0][2]]
    pre_label = None
    for kw in ["导言", "导论", "前言", "序言", "引言"]:
        if re.search(kw[0] + r"\s*" + kw[1:], pre_raw):
            pre_label = kw
            break
    if pre_label and len(pre_raw.strip()) > 150:
        chapters.append({"n": 0, "title": pre_label, "raw": pre_raw})
    for i, (num, title, gpos) in enumerate(headings):
        end = headings[i + 1][2] if i + 1 < len(headings) else len(alltext)
        chapters.append({"n": num, "title": title, "raw": alltext[gpos:end]})
    return chapters

def build_paras(raw, title, book_titles, bid):
    paras = []
    if bid in LAYOUT_BOOKS:
        for blk in re.split(r"\n\s*\n+", raw):
            lines = [ln.strip() for ln in blk.split("\n")]
            txt = clean_para_lines(lines, title, book_titles)
            if len(txt) >= 10:
                paras.append(txt)
    else:
        for seg in REF_RE.split(raw):
            lines = [ln.strip() for ln in seg.split("\n")]
            txt = clean_para_lines(lines, title, book_titles)
            if len(txt) >= 10:
                paras.append(txt)
    out = []
    for p in paras:
        if not out or out[-1] != p:
            out.append(p)
    return out

def process_book(bid, fn, zh, en):
    pages = load_pages(bid)
    if bid in TOC_BOOKS:
        chapters = split_by_toc(pages, bid)
    else:
        chapters = split_by_heading(pages, bid)
    book_titles = {re.sub(r"\s+", "", zh)}
    for ch in chapters:
        ch["paras"] = build_paras(ch["raw"], ch["title"], book_titles, bid)
        ch.pop("raw", None)
    # 章末溢出去重
    for i in range(1, len(chapters)):
        while chapters[i]["paras"] and chapters[i - 1]["paras"]:
            first = chapters[i]["paras"][0]
            last_prev = chapters[i - 1]["paras"][-1]
            if first == last_prev or (len(first) >= 8 and first in last_prev):
                chapters[i]["paras"] = chapters[i]["paras"][1:]
            else:
                break
    # 章节开头「（本章依据…）」说明 → note 字段
    for ch in chapters:
        if ch["paras"]:
            m = NOTE_RE.match(ch["paras"][0])
            if m:
                ch["note"] = m.group(1)
                ch["paras"][0] = ch["paras"][0][m.end():].lstrip("，, ")
    n_paras = sum(len(c["paras"]) for c in chapters)
    n_chars = sum(sum(len(p) for p in c["paras"]) for c in chapters)
    print(f"[{bid}] chapters={len(chapters)} paras={n_paras} chars={n_chars}")
    for c in chapters[:4]:
        if c["paras"]:
            note = c.get("note", "")
            print(f"   ch{c['n']} {c['title']!r} note={note!r} first={c['paras'][0][:34]!r}")
        else:
            print(f"   ch{c['n']} {c['title']!r} paras=0")
    last = chapters[-1]
    print(f"   ... last ch{last['n']} {last['title']!r} paras={len(last['paras'])}")
    alltxt = "".join(p for c in chapters for p in c["paras"])
    print(f"   安息日会 remaining: {alltxt.count('安息日会')} | 安息日 count: {alltxt.count('安息日')}")
    payload = {"id": bid, "title": zh, "subtitle": en,
               "chapters": [{"n": c["n"], "title": c["title"], "paras": c["paras"],
                             **({"note": c["note"]} if c.get("note") else {})} for c in chapters]}
    with open(os.path.join(OUT_DIR, bid + ".js"), "w", encoding="utf-8") as f:
        f.write("window.BOOK_DATA = window.BOOK_DATA || {};\n")
        f.write(f"window.BOOK_DATA['{bid}'] = ")
        f.write(json.dumps(payload, ensure_ascii=False))
        f.write(";\n")
    return {"id": bid, "title": zh, "subtitle": en, "chapters": len(chapters)}

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    meta = []
    for bid, fn, zh, en, _ in BOOKS:
        meta.append(process_book(bid, fn, zh, en))
        print()
    with open(os.path.join(OUT_DIR, "books.js"), "w", encoding="utf-8") as f:
        f.write("window.BOOKS = ")
        f.write(json.dumps(meta, ensure_ascii=False))
        f.write(";\n")
    print("done ->", OUT_DIR)

if __name__ == "__main__":
    main()
