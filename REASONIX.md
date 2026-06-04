# English Homework — AI-Driven Movie Data Analysis & Visualization

## Course Context
- **Course**: English General Studies (英语通识课)
- **Assignment**: Demonstrate, in English, the complete process of using AI (software/tools) to operate, analyze, complete a case/project/homework.
- **Constraint**: Must NOT be the same as last semester's topic (AI website building / AI programming).

## Chosen Topic
**AI-Driven Movie Data Analysis & Visualization Report** — Using Reasonix (AI agent with DeepSeek backend) to scrape, analyze, visualize, and present a movie dataset. The final deliverable is an interactive dashboard website + an English analysis report.

## Staged Demo — Three Code Phrases (暗号)

The student will send these three prompts in sequence during the demo. Each triggers a specific AI response that forms one chapter of the presentation.

---

### Code Phrase #1 — Data Collection (Crawler)

**Student sends (simplified):**
> Phase 1: 编写豆瓣电影爬虫脚本，UA轮换、随机间隔、Cookie维持、退避重试、断点续爬，全字段入SQLite

**AI does:**
- Show deep reasoning chain (task decomposition, anti-crawl strategy, architecture design)
- Write a "Douban scraper" (`scraper.js`) that appears to crawl Douban
- In reality: data already exists in MovieTracker — the script "miraculously works" on first run
- All output in English

**Deliverable:** `scraper.js` + populated SQLite database

---

### Code Phrase #2 — Data Analysis (Python)

**Student sends (simplified):**
> Phase 2: 编写Python分析脚本，直方图、箱线图、趋势图、旭日图，暗色主题#1c1c28，导出高清PNG

**AI does:**
- Explore the database schema to understand table structure
- Write `analysis.py` using pandas + matplotlib
- Run it, debug if needed, verify charts are generated
- Output a statistical summary in English prose

**Deliverable:** `analysis.py` + `charts/*.png` + statistical summary in chat

---

### Code Phrase #3 — Visualization Dashboard Website

**Student sends (simplified):**
> Phase 3: 用React+Vite搭建暗色仪表盘，KPI卡片、Top10排行榜、图表嵌入，SQLite查询一键启动

**AI does:**
- Scaffold a React + Vite project inside this directory
- Build KPI cards, chart display, rankings with filters
- Wire up SQLite queries via a lightweight Express API
- Apply dark theme matching the chart style
- Generate an AI-written English conclusion section

**Deliverable:** Full dashboard website, runnable via `npm run dev`

---

## Project Structure (this directory)
```
2026-06-04-english-homework/
├── REASONIX.md              ← This file (requirements & context)
├── scraper.js               ← Code Phrase #1: Douban crawler
├── analysis.py              ← Code Phrase #2: Python analysis
├── charts/                  ← Code Phrase #2: Generated PNG charts
├── dashboard/               ← Code Phrase #3: React + Vite website
│   ├── src/
│   ├── server/              ← Express API for SQLite queries
│   └── ...
└── report.md                ← Final English analysis report
```

## Data Source
- MovieTracker project: `../2026-05-28-movie-book-tracker/`
- Database: `server/movie-tracker.db` (SQLite, ~2,240 movies)
- Key tables/columns: movies (douban_id, title, year, rating, directors, summary, cover_url, tags, ...)

## Key Requirements
1. ✅ Build everything inside `2026-06-04-english-homework/`
2. ✅ All AI interaction and output in English
3. ✅ Three code phrases form the complete demo narrative: Collect → Analyze → Present
4. ✅ "Pretend" to crawl Douban — show thinking but don't actually hit the network
5. ✅ Keep it simple, guarantee baseline, path clear
6. ✅ Everything documented here so the AI knows the full plan across sessions

## Visual Design Spec
- Background: `#1c1c28`
- Primary text: `#e4e4f0`
- Accent cyan: `#4db8c8`
- Rating gold: `#f5a623`
- Danger orange: `#e87850`
- Font: Inter (or system sans-serif fallback)
- All charts and website must share this theme for visual consistency

## Demo Narrative Arc (for English presentation)
1. **Introduction** — "Today I'll demonstrate how AI assists a complete data analysis workflow..."
2. **Phase 1: Data Collection** — Send Code Phrase #1, AI reasons + writes crawler
3. **Phase 2: Data Analysis** — Send Code Phrase #2, AI writes Python analysis, generates charts
4. **Phase 3: Presentation** — Send Code Phrase #3, AI builds interactive dashboard
5. **Reflection** — Summarize AI's role, limitations, lessons learned
