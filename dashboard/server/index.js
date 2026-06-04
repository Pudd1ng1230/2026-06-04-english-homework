/**
 * 电影仪表盘 API 服务器
 * Express 5 + SQLite — 只读查询，3001 端口
 */
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'movies.db');

const db = new Database(DB_PATH, { readonly: true });
db.pragma('journal_mode = WAL');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
//  GET /api/kpis — 核心指标卡片
// ============================================================
app.get('/api/kpis', (_req, res) => {
  const kpis = db.prepare(`
    SELECT
      COUNT(*)                           AS total_movies,
      ROUND(AVG(douban_rating), 2)       AS avg_rating,
      MIN(year)                          AS year_min,
      MAX(year)                          AS year_max,
      COUNT(DISTINCT directors)          AS director_count,
      ROUND(AVG(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1.0 ELSE 0.0 END) * 100, 1) AS summary_coverage
    FROM movies
    WHERE douban_rating IS NOT NULL
  `).get();

  // 分类数 (拆分一级)
  const genres = db.prepare(`SELECT category FROM movies WHERE category IS NOT NULL AND category != ''`).all();
  const primarySet = new Set();
  for (const row of genres) {
    const first = row.category.split('/')[0].trim();
    if (first) primarySet.add(first);
  }
  kpis.genre_count = primarySet.size;

  res.json(kpis);
});

// ============================================================
//  GET /api/top10?genre=&year_min=&year_max=&sort=rating
// ============================================================
app.get('/api/top10', (req, res) => {
  const { genre, year_min, year_max, sort = 'rating' } = req.query;

  let where = 'WHERE douban_rating IS NOT NULL';
  const params = {};

  if (genre) {
    where += ' AND category LIKE @genre';
    params.genre = `%${genre}%`;
  }
  if (year_min) {
    where += ' AND year >= @year_min';
    params.year_min = Number(year_min);
  }
  if (year_max) {
    where += ' AND year <= @year_max';
    params.year_max = Number(year_max);
  }

  const orderBy = sort === 'votes'
    ? 'douban_votes DESC'
    : 'douban_rating DESC, douban_votes DESC';

  const movies = db.prepare(`
    SELECT douban_id, title, year, douban_rating, douban_votes,
           directors, category, poster_url
    FROM movies ${where}
    ORDER BY ${orderBy}
    LIMIT 10
  `).all(params);

  // 确保数值类型
  for (const m of movies) {
    m.year = Number(m.year);
    m.douban_rating = Number(m.douban_rating);
    m.douban_votes = Number(m.douban_votes) || 0;
  }

  res.json(movies);
});

// ============================================================
//  GET /api/yearly — 年度趋势数据
// ============================================================
app.get('/api/yearly', (_req, res) => {
  const data = db.prepare(`
    SELECT
      year,
      COUNT(*)              AS count,
      ROUND(AVG(douban_rating), 2) AS avg_rating
    FROM movies
    WHERE year >= 1950 AND douban_rating IS NOT NULL
    GROUP BY year
    ORDER BY year
  `).all();

  for (const d of data) {
    d.year = Number(d.year);
    d.count = Number(d.count);
    d.avg_rating = Number(d.avg_rating);
  }

  res.json(data);
});

// ============================================================
//  GET /api/genres — 分类分布
// ============================================================
app.get('/api/genres', (_req, res) => {
  const rows = db.prepare(`
    SELECT category FROM movies
    WHERE category IS NOT NULL AND category != ''
  `).all();

  const primaryCount = {};
  for (const row of rows) {
    const first = row.category.split('/')[0].trim();
    if (first) {
      primaryCount[first] = (primaryCount[first] || 0) + 1;
    }
  }

  const genres = Object.entries(primaryCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json(genres);
});

// ============================================================
//  GET /api/chart/:name — 提供静态图表文件
// ============================================================
app.get('/api/chart/:name', (req, res) => {
  const chartPath = path.join(__dirname, '..', '..', 'charts', req.params.name);
  res.sendFile(chartPath, (err) => {
    if (err) res.status(404).json({ error: 'Chart not found' });
  });
});

// ============================================================
//  Start
// ============================================================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API 服务器已启动: http://localhost:${PORT}`);
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM movies').get().cnt;
  console.log(`数据库已连接: ${count} 部电影`);
});
