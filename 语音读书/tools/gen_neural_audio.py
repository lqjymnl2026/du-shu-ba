#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 edge-tts（微软 Edge 神经语音：晓晓 / 云希）为语音读书站生成句子级 MP3。

用法：
  python3 gen_neural_audio.py --books DA,GC --chapters 1 --voices xiaoxiao,yunxi
  python3 gen_neural_audio.py                        # 缺省：5 本书第 1 章，双音色

输出：
  语音读书/audio/<BOOK>/<CH>/<voice>/<句序号>.mp3
  语音读书/audio/manifest.js   （window.NEURAL 清单）
说明：
  - 已存在的 MP3 跳过（可断点续跑）
  - 句子切分逻辑与阅读器 assets/reader.js 保持一致
"""
import argparse, asyncio, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
AUDIO = os.path.join(ROOT, "audio")
BOOKS = ["PP", "PK", "DA", "AA", "GC"]
VOICES = {"xiaoxiao": "zh-CN-XiaoxiaoNeural", "yunxi": "zh-CN-YunxiNeural"}
SENT_END = "。！？；…"
QUOTE = "”』」\"’"

def split_sentences(text):
    out = []
    i, n = 0, len(text)
    cur = ""
    while i < n:
        ch = text[i]
        cur += ch
        if ch in SENT_END:
            while i + 1 < n and text[i + 1] in QUOTE:
                i += 1
                cur += text[i]
            if cur.strip():
                out.append(cur)
            cur = ""
        i += 1
    if cur.strip():
        out.append(cur)
    return out

def load_book(bid):
    raw = open(os.path.join(DATA, bid + ".js"), encoding="utf-8").read()
    m = re.search(r"window\.BOOK_DATA\['" + bid + r"'\] = (.*);", raw, re.S)
    return json.loads(m.group(1))

def parse_chapters(spec):
    out = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out

async def synth_one(voice, text, path):
    import edge_tts
    c = edge_tts.Communicate(text, voice=voice)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        async for chunk in c.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
    os.replace(tmp, path)

async def gen(book_ids, chapters, voice_keys):
    manifest = {}
    mpath = os.path.join(AUDIO, "manifest.js")
    if os.path.exists(mpath):
        m = re.search(r"window\.NEURAL = (.*);", open(mpath, encoding="utf-8").read(), re.S)
        if m:
            manifest = json.loads(m.group(1))
    for bid in book_ids:
        book = load_book(bid)
        for ch in book["chapters"]:
            if ch["n"] not in chapters:
                continue
            sents = []
            for p in ch.get("paras", []):
                sents.extend(split_sentences(p))
            if not sents:
                continue
            chm = manifest.setdefault(bid, {}).setdefault(str(ch["n"]), {})
            for vk in voice_keys:
                voice = VOICES[vk]
                folder = os.path.join(AUDIO, bid, str(ch["n"]), vk)
                done = 0
                for i, s in enumerate(sents):
                    path = os.path.join(folder, f"{i}.mp3")
                    if os.path.exists(path):
                        done += 1
                        continue
                    for attempt in range(3):
                        try:
                            await synth_one(voice, s, path)
                            done += 1
                            break
                        except Exception as e:
                            print(f"  retry {bid} ch{ch['n']} {vk} #{i}: {e}", flush=True)
                            await asyncio.sleep(1)
                chm[vk] = {"voice": voice, "count": len(sents)}
                print(f"{bid} ch{ch['n']} {ch['title']} [{vk}] {done}/{len(sents)} 完成", flush=True)
    os.makedirs(AUDIO, exist_ok=True)
    with open(mpath, "w", encoding="utf-8") as f:
        f.write("window.NEURAL = ")
        f.write(json.dumps(manifest, ensure_ascii=False))
        f.write(";\n")
    print("manifest ->", mpath)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--books", default=",".join(BOOKS))
    ap.add_argument("--chapters", default="1")
    ap.add_argument("--voices", default="xiaoxiao,yunxi")
    args = ap.parse_args()
    bids = [b.strip() for b in args.books.split(",") if b.strip()]
    chs = parse_chapters(args.chapters)
    vks = [v.strip() for v in args.voices.split(",") if v.strip() in VOICES]
    asyncio.run(gen(bids, chs, vks))

if __name__ == "__main__":
    main()
