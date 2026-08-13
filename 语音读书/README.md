# 有声读书吧 · 《历代斗争丛书》

把怀爱伦《历代斗争丛书》五卷 PDF 变成**能听、能测、能记录**的语音读书网站。

## 功能

| 板块 | 说明 |
|---|---|
| 🎧 中文朗读 | 浏览器中文语音逐句朗读，语速可调、可换声音；点击任意句子即可从那里跟读 |
| 🌥️ Edge 神经语音 | 微软晓晓 / 云希神经语音（MP3）：每本书第 1 章已生成，设置里一键切换「云端晓晓 / 云端云希」，任何浏览器都能听；未生成的章节自动回退浏览器语音 |
| 📖 逐句高亮 | 朗读到哪句，哪句高亮并自动滚动，像卡拉 OK 一样跟读 |
| 📝 每章测验 | 324 章都有选择题测验（精选章节目工出题 + 其余自动生成），答完即时反馈与解析 |
| 📊 阅读记录 | 自动记录阅读时长、字数、读到的位置、读完的章节 |
| 🔥 连续打卡 | 近 14 天阅读日历 + 连续天数统计 |
| 🏅 成就徽章 | 14 枚徽章：读完 3/10/50/100 章、连续打卡、测验全对等 |
| ✨ 创意细节 | 本章金句、沉浸阅读、夜间/羊皮纸主题、字号调节、环境雨声、彩带庆祝 |
| 📱 完全离线 | 所有内容都在本地文件里，双击 `index.html` 即可使用 |

## 内容

- **先祖与先知（PP）** 74 章 · **先知与君王（PK）** 61 章 · **历代愿望（DA）** 87 章 · **使徒行述（AA）** 59 章 · **善恶之争（GC·2023版）** 43 章，共 324 章
- 已按要求删除「安息日会」四个字（保留「安息日」及其他全部内容）
- 旧版《善恶之争 GC.pdf》文字编码损坏无法提取，故采用 2023 版

## 目录结构

```
index.html          书架首页（统计 / 继续阅读 / 打卡 / 徽章）
reader.html         阅读器（朗读 / 测验 / 记录）
assets/
  style.css         全部样式（纸页 / 羊皮纸 / 夜间主题）
  common.js         本地存储与统计逻辑
  home.js           首页逻辑
  reader.js         阅读器逻辑（TTS / 云端神经语音 / 测验 / 进度）
data/
  books.js          书目元数据
  PP.js PK.js DA.js AA.js GC.js   各书正文（章节 + 段落）
  quizzes.js        324 章测验题
audio/
  manifest.js       云端神经语音清单（window.NEURAL）
  <BOOK>/<CH>/<voice>/<n>.mp3   晓晓/云希 句子级 MP3
tools/
  extract_books.py  PDF → data/*.js（目录页页码精确切分 + 去噪 + 删「安息日会」）
  gen_quizzes.py    测验生成（精选人工出题 + 自动生成）
  gen_neural_audio.py  用 edge-tts 生成晓晓/云希 MP3
```

## 重建数据

```bash
python3 tools/extract_books.py    # 从 Desktop PDF 重新提取正文
python3 tools/gen_quizzes.py      # 重新生成测验题
python3 tools/gen_neural_audio.py --books DA,GC --chapters 1-5 --voices xiaoxiao,yunxi   # 生成更多晓晓/云希 MP3
```

（提取脚本中的 PDF 路径为 `/Users/macbook/Desktop/怀氏著作/历代斗争丛书/`）
