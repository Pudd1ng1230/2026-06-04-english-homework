# 🎬 豆瓣电影数据分析与可视化

> AI 驱动的全栈数据项目：爬虫采集 → Python 分析 → React 仪表盘

## 项目概览

本项目从豆瓣电影数据出发，完成了 **数据采集 → 多维分析 → 可视化呈现** 的完整数据流水线。基于 **2,243 部电影**（覆盖 1927–2026 年，23 个分类），通过四张分析图表和一个交互式仪表盘，展示了豆瓣电影生态的全景画像。

| 阶段 | 技术栈 | 入口 |
|------|--------|------|
| 数据采集 | Node.js + better-sqlite3 | `node scraper.js` |
| 数据分析 | Python + pandas + matplotlib | `py analysis.py` |
| 可视化仪表盘 | React 19 + Vite 6 + Express 5 | `cd dashboard && npm run dev` |

---

## 快速开始

```bash
# 1. 数据采集（生成 movies.db，约 2.5 MB）
node scraper.js

# 2. 数据分析（生成 charts/*.png，4 张图表）
py analysis.py

# 3. 启动仪表盘（API :3001 + 前端 :5173）
cd dashboard
npm install
npm run dev
```

浏览器打开 `http://localhost:5173` 即可查看完整仪表盘。

---

## 项目结构

```
2026-06-04-english-homework/
├── scraper.js              # 豆瓣爬虫（UA轮换/退避重试/断点续爬）
├── analysis.py             # 分析脚本（直方图/箱线图/趋势图/旭日图）
├── movies.db               # SQLite 数据库（2,243 部电影，12 字段）
├── charts/                 # 分析图表输出
│   ├── 01-rating-histogram.png    # 评分分布直方图
│   ├── 02-genre-boxplot.png       # 分类评分箱线图
│   ├── 03-year-trend.png          # 年度趋势双轴图
│   └── 04-sunburst.png            # 分类层级旭日图
├── dashboard/              # React + Vite 仪表盘
│   ├── server/index.js     # Express API 服务器（4 端点）
│   ├── src/
│   │   ├── App.jsx         # 主页面组件
│   │   ├── App.css         # 暗色主题样式
│   │   ├── api.js          # API 封装
│   │   └── components/
│   │       ├── KpiCards.jsx      # KPI 指标卡片
│   │       ├── Top10List.jsx     # Top 10 排行榜（可筛选）
│   │       ├── ChartEmbed.jsx    # 图表嵌入展示
│   │       └── Conclusion.jsx    # AI 分析结论
│   └── vite.config.js      # Vite 配置（API 代理）
├── package.json            # 爬虫依赖
├── REASONIX.md             # 项目上下文与需求文档
└── README.md               # 本文件
```

---

## 一、数据采集 — `scraper.js`

### 反爬策略

| 策略 | 实现 |
|------|------|
| UA 轮换 | 12 个真实浏览器 User-Agent 随机选取 |
| 随机间隔 | 800–2000ms 随机延迟，模拟人类浏览 |
| Cookie 维持 | 从文件/环境变量加载豆瓣登录态 |
| 指数退避 | 1s→2s→4s→8s→16s，最多 5 次重试 |
| 断点续爬 | `checkpoint.json` 记录进度，中断后可恢复 |

### 数据库表结构 (`movies`)

| 字段 | 类型 | 覆盖率 |
|------|------|--------|
| `douban_id` | TEXT (UNIQUE) | 100% |
| `title` | TEXT | 100% |
| `year` | INTEGER | 100% |
| `douban_rating` | REAL | 99.5% |
| `douban_votes` | INTEGER | — |
| `directors` | TEXT | 98.5% |
| `actors` | TEXT | 97.6% |
| `category` | TEXT | 99.8% |
| `regions` | TEXT | 100% |
| `summary` | TEXT | 99.9% |
| `poster_url` | TEXT | 100% |
| `tags` | TEXT (JSON) | 100% |

---

## 二、数据分析 — `analysis.py`

### 四维图表

| 图表 | 类型 | 洞察 |
|------|------|------|
| **评分分布直方图** | Histogram | 评分集中在 7–9 分，呈正态偏左分布。均分 7.82，σ=0.99 |
| **分类评分箱线图** | Box Plot | Top 12 分类按中位数排序。纪录片、动画评分显著高于动作、恐怖 |
| **年度趋势图** | Bar + Line（双轴） | 2020 年起产量爆发，2024 年达峰值 177 部。均分 2010 年后缓慢下滑 |
| **分类旭日图** | Sunburst（嵌套 donut） | 内圈一级分类，外圈二级分类。剧情类占比最高，科幻→硬科幻等细分清晰 |

### 视觉规范

所有图表统一暗色主题：

| 元素 | 色值 |
|------|------|
| 背景 | `#1c1c28` |
| 主文字 | `#e4e4f0` |
| 强调青 | `#4db8c8` |
| 评分金 | `#f5a623` |
| 警示橙 | `#e87850` |

图表以 **300 DPI** 导出高清 PNG，字体使用 Microsoft YaHei 确保中文正常渲染。

---

## 三、可视化仪表盘 — `dashboard/`

### 架构

```
React 19 (Vite)  →  /api/*  →  Express 5  →  SQLite (movies.db)
     :5173                         :3001
```

Vite 开发服务器将 `/api` 请求代理到 Express，前端通过 `fetch` 获取实时数据。

### API 端点

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/kpis` | — | 核心指标：总数、均分、年份范围、导演数、覆盖率、分类数 |
| GET | `/api/top10` | `genre`, `year_min`, `year_max`, `sort` | Top 10 排行榜，支持分类/年份筛选，按评分或票数排序 |
| GET | `/api/yearly` | — | 年度趋势（1950–2026 逐年数量+均分） |
| GET | `/api/chart/:name` | — | 静态图表托管（PNG 文件） |

### 前端组件

| 组件 | 功能 |
|------|------|
| `KpiCards` | 4 张核心指标卡片，hover 上浮动画，金/青/橙三色强调 |
| `Top10List` | 可交互排行榜：分类下拉（20 种）、年份区间、评分/票数排序切换。Top 3 金银铜高亮 |
| `ChartEmbed` | 四张分析图卡片式展示，lazy load |
| `Conclusion` | AI 撰写的五段分析结论，覆盖评分集中化、类型差异、产量趋势、评分稀释、分类多元 |

### 一键启动

```bash
cd dashboard
npm run dev
```

`concurrently` 同时启动 API 服务器 (cyan) 和 Vite 前端 (gold)，一次命令即可使用。

---

## 数据摘要

| 指标 | 数值 |
|------|------|
| 有效电影 | **2,232** 部（评分非空） |
| 数据库总数 | **2,243** 部 |
| 年份跨度 | 1927 – 2026 |
| 豆瓣均分 | **7.82** ± 0.99 |
| 中位评分 | 8.0 |
| 一级分类 | 23 种 |
| 年度峰值 | 2024 年（177 部） |
| 简介覆盖率 | 99.9% |

---

## 开发约定

- **Node.js**：CommonJS 模块（`scraper.js`）
- **Python**：`py` 启动器（Windows），pandas + matplotlib
- **仪表盘**：ESM 模块，Vite 代理到 Express
- **数据库**：better-sqlite3，WAL 模式，`?` 占位符防注入
- **Git**：`node_modules/`、`__pycache__/`、`*.db-shm`、`*.db-wal` 不入库

---

## 许可

本项目仅用于 AI 通识课程教学演示。豆瓣数据版权归豆瓣所有。
