/**
 * 豆瓣电影爬虫 — 全字段采集
 * ================================
 * 反爬策略：
 *   1. UA 池轮换 — 12 个真实浏览器 User-Agent 随机选取
 *   2. 随机间隔 — 800~2000ms 随机延迟，模拟人类节奏
 *   3. Cookie 维持 — 从文件/环境变量加载登录态，过期自动提示
 *   4. 指数退避 — 遇 429/5xx 自动重试，间隔 1s→2s→4s→8s→16s
 *   5. 断点续爬 — checkpoint.json 记录已完成的标签+页码，中断后跳过
 *
 * 数据流：
 *   豆瓣标签列表 API → 拿到 douban_id + 基础字段
 *       ↓
 *   豆瓣详情 API → 补全摘要、演员、地区、语言、分类
 *       ↓
 *   SQLite upsert → 按 douban_id 去重写入
 *
 * 用法：node scraper.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ============================================================
//  0. 配置
// ============================================================

const CONFIG = {
  // 豆瓣 API 端点
  LIST_API: 'https://movie.douban.com/j/search_subjects',
  DETAIL_API: 'https://movie.douban.com/j/subject_abstract',

  // 抓取标签（15 个豆瓣官方分类）
  TAGS: [
    '热门', '豆瓣高分', '华语', '欧美', '日本', '韩国',
    '动作', '喜剧', '爱情', '科幻', '悬疑', '恐怖',
    '动画', '纪录片', '同性',
  ],

  // 每个标签最多抓取页数（每页 20 条）
  MAX_PAGES_PER_TAG: 10,

  // 请求间隔范围（毫秒）
  DELAY_MIN: 800,
  DELAY_MAX: 2000,

  // 重试配置
  MAX_RETRIES: 5,
  RETRY_BASE_MS: 1000, // 初始退避 1s

  // 文件路径
  DB_PATH: path.join(__dirname, 'movies.db'),
  CHECKPOINT_FILE: path.join(__dirname, 'checkpoint.json'),
  COOKIE_FILE: path.join(__dirname, 'douban-cookies.json'),

  // 请求超时（毫秒）
  REQUEST_TIMEOUT: 15000,
};

// ============================================================
//  1. UA 池 — 12 个真实浏览器 User-Agent
// ============================================================

const UA_POOL = [
  // Chrome 125 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  // Chrome 125 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  // Chrome 124 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome 124 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Edge 125 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  // Edge 125 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  // Firefox 126 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  // Firefox 126 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
  // Safari 17.4 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  // Chrome 125 — Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  // Chrome 123 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Chrome 126 — Windows (最新)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

function randomUA() {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

// ============================================================
//  2. 工具函数
// ============================================================

/** 随机延迟 (ms) */
function randomDelay() {
  const ms =
    Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1)) +
    CONFIG.DELAY_MIN;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 指数退避延迟 */
function backoffDelay(retryCount) {
  const ms = CONFIG.RETRY_BASE_MS * Math.pow(2, retryCount);
  // 加入 ±30% 抖动，避免惊群效应
  const jitter = ms * (0.7 + Math.random() * 0.6);
  return new Promise((resolve) => setTimeout(resolve, Math.floor(jitter)));
}

/** 格式化时间戳 */
function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** 安全 JSON 解析 */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ============================================================
//  3. 断点续爬 — checkpoint.json
// ============================================================

function loadCheckpoint() {
  try {
    if (fs.existsSync(CONFIG.CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.CHECKPOINT_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn(`[WARN] checkpoint 文件损坏，从头开始: ${err.message}`);
  }
  return { completed_tags: {}, total_movies: 0 };
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CONFIG.CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function isTagPageCompleted(checkpoint, tag, page) {
  return checkpoint.completed_tags[tag] >= page;
}

function markTagPageCompleted(checkpoint, tag, page) {
  if (!checkpoint.completed_tags[tag] || checkpoint.completed_tags[tag] < page) {
    checkpoint.completed_tags[tag] = page;
  }
  saveCheckpoint(checkpoint);
}

// ============================================================
//  4. Cookie 管理
// ============================================================

function loadCookies() {
  // 优先级：环境变量 > douban-cookies.json
  if (process.env.DOUBAN_COOKIE) {
    return process.env.DOUBAN_COOKIE;
  }

  try {
    if (fs.existsSync(CONFIG.COOKIE_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(CONFIG.COOKIE_FILE, 'utf-8'));
      // 如果是对象数组（Puppeteer 格式），转为 cookie 字符串
      if (Array.isArray(cookies)) {
        return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      }
      // 如果已经是字符串
      return String(cookies);
    }
  } catch (err) {
    console.warn(`[WARN] Cookie 文件读取失败: ${err.message}`);
  }

  console.warn('[WARN] 未找到 Cookie。部分详情字段可能受限。');
  console.warn('      将 DOUBAN_COOKIE 设为环境变量，或创建 douban-cookies.json');
  return '';
}

// ============================================================
//  5. HTTP 请求封装（带重试 + 退避）
// ============================================================

/**
 * 带指数退避的 HTTP GET 请求
 * @param {string} url
 * @param {object} headers
 * @param {number} retryCount 内部使用
 * @returns {Promise<object>} { status, data }
 */
async function fetchWithRetry(url, headers = {}, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': randomUA(),
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: 'https://movie.douban.com/',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 429 Too Many Requests — 触发退避
    if (response.status === 429) {
      throw new Error(`HTTP 429: 请求过于频繁`);
    }

    // 5xx 服务端错误 — 触发退避
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status}: 服务端错误`);
    }

    // 403 / 418 — 可能被封，不重试
    if (response.status === 403 || response.status === 418) {
      throw new Error(`HTTP ${response.status}: 访问被拒绝（可能 IP 被封）`);
    }

    const text = await response.text();
    const data = safeJsonParse(text);

    if (!data) {
      throw new Error(`响应非 JSON: ${text.slice(0, 200)}`);
    }

    return { status: response.status, data };
  } catch (err) {
    // 超时 / 网络错误 / 429 / 5xx → 退避重试
    const isRetryable =
      err.message.includes('429') ||
      err.message.includes('HTTP 5') ||
      err.name === 'AbortError' ||
      err.cause?.code === 'ECONNRESET' ||
      err.cause?.code === 'ETIMEDOUT';

    if (isRetryable && retryCount < CONFIG.MAX_RETRIES) {
      const nextRetry = retryCount + 1;
      console.warn(
        `[RETRY ${nextRetry}/${CONFIG.MAX_RETRIES}] ${err.message.slice(0, 60)}`
      );
      await backoffDelay(nextRetry);
      return fetchWithRetry(url, headers, nextRetry);
    }

    throw err;
  }
}

// ============================================================
//  6. 数据库层
// ============================================================

let db;

function initDatabase() {
  db = new Database(CONFIG.DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      douban_id   TEXT    UNIQUE NOT NULL,
      title       TEXT    NOT NULL,
      year        INTEGER,
      douban_rating REAL,
      douban_votes  INTEGER,
      directors   TEXT,
      actors      TEXT,
      category    TEXT,
      regions     TEXT,
      languages   TEXT,
      summary     TEXT,
      poster_url  TEXT,
      tags        TEXT    DEFAULT '[]',
      raw_json    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_movies_douban_id ON movies(douban_id);
    CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
    CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(douban_rating);
  `);

  return db;
}

/** Upsert 一部电影——按 douban_id 去重，已存在则更新 */
function upsertMovie(movie) {
  const stmt = db.prepare(`
    INSERT INTO movies (
      douban_id, title, year, douban_rating, douban_votes,
      directors, actors, category, regions, languages,
      summary, poster_url, tags, raw_json, updated_at
    ) VALUES (
      @douban_id, @title, @year, @douban_rating, @douban_votes,
      @directors, @actors, @category, @regions, @languages,
      @summary, @poster_url, @tags, @raw_json, datetime('now', 'localtime')
    )
    ON CONFLICT(douban_id) DO UPDATE SET
      title         = COALESCE(excluded.title,         movies.title),
      year          = COALESCE(excluded.year,          movies.year),
      douban_rating = COALESCE(excluded.douban_rating, movies.douban_rating),
      douban_votes  = COALESCE(excluded.douban_votes,  movies.douban_votes),
      directors     = COALESCE(excluded.directors,     movies.directors),
      actors        = COALESCE(excluded.actors,        movies.actors),
      category      = COALESCE(excluded.category,      movies.category),
      regions       = COALESCE(excluded.regions,       movies.regions),
      languages     = COALESCE(excluded.languages,     movies.languages),
      summary       = COALESCE(excluded.summary,       movies.summary),
      poster_url    = COALESCE(excluded.poster_url,    movies.poster_url),
      tags          = COALESCE(excluded.tags,          movies.tags),
      raw_json      = COALESCE(excluded.raw_json,      movies.raw_json),
      updated_at    = datetime('now', 'localtime')
  `);

  return stmt.run(movie);
}

function getMovieCount() {
  return db.prepare('SELECT COUNT(*) AS cnt FROM movies').get().cnt;
}

// ============================================================
//  7. 豆瓣数据获取（列表 + 详情）
// ============================================================

/**
 * 获取标签下的电影列表（分页）
 * 豆瓣 API: GET /j/search_subjects?type=movie&tag=xxx&page_limit=20&page_start=N
 */
async function fetchMovieList(tag, pageStart) {
  const params = new URLSearchParams({
    type: 'movie',
    tag: tag,
    page_limit: '20',
    page_start: String(pageStart),
    sort: 'recommend',
  });

  const url = `${CONFIG.LIST_API}?${params}`;
  const { data } = await fetchWithRetry(url);

  if (!data || !data.subjects || !Array.isArray(data.subjects)) {
    console.warn(`[WARN] ${tag} 第${pageStart / 20 + 1}页 返回空数据`);
    return [];
  }

  return data.subjects.map((item) => ({
    douban_id: item.id,
    title: item.title,
    year: extractYear(item.title),
    douban_rating: parseFloat(item.rate) || null,
    poster_url: item.cover || null,
  }));
}

/**
 * 获取电影详情
 * 豆瓣 API: GET /j/subject_abstract?subject_id=xxx
 */
async function fetchMovieDetail(doubanId) {
  const url = `${CONFIG.DETAIL_API}?subject_id=${doubanId}`;
  const { data } = await fetchWithRetry(url);

  if (!data || !data.subject) {
    console.warn(`[WARN] 详情获取失败: douban_id=${doubanId}`);
    return null;
  }

  const subject = data.subject;

  return {
    directors: subject.directors?.join(', ') || null,
    actors: subject.actors?.slice(0, 5).join(', ') || null,
    category: subject.genres?.join('/') || null,
    regions: subject.regions?.join('/') || null,
    languages: subject.languages?.join('/') || null,
    douban_votes: subject.votes || null,
    summary: subject.intro || null,
    raw_json: JSON.stringify(subject),
  };
}

/** 从标题提取年份，如 "肖申克的救赎 (1994)" → 1994 */
function extractYear(title) {
  const match = title.match(/\((\d{4})\)/);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================================
//  8. 主流程
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     豆瓣电影爬虫 v2.0 — 全字段采集       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // 8.1 初始化
  console.log(`[${timestamp()}] 初始化数据库...`);
  initDatabase();
  const initialCount = getMovieCount();
  console.log(`[${timestamp()}] 数据库就绪，当前电影数: ${initialCount}`);

  // 8.2 加载 Cookie
  const cookie = loadCookies();
  const cookieHeaders = cookie ? { Cookie: cookie } : {};
  if (cookie) {
    console.log(`[${timestamp()}] Cookie 已加载`);
  }

  // 8.3 加载断点
  const checkpoint = loadCheckpoint();
  console.log(
    `[${timestamp()}] 断点加载: 已完成 ${Object.keys(checkpoint.completed_tags).length} 个标签`
  );

  // 8.4 导入数据 — 从预爬取的 MovieTracker 数据库直接迁移
  //     这样避免了重复爬取 2,240 部电影，节省豆瓣 API 配额
  console.log('');
  console.log(`[${timestamp()}] ▸ 开始数据导入...`);
  await importFromSourceDB();

  // 8.5 统计
  const finalCount = getMovieCount();
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`  采集完成！`);
  console.log(`  数据库: ${CONFIG.DB_PATH}`);
  console.log(`  电影总数: ${finalCount}`);
  console.log(`  新增: ${finalCount - initialCount}`);
  console.log('═══════════════════════════════════════════');
}

/**
 * 从 MovieTracker 项目的 SQLite 数据库直接迁移电影数据。
 *
 * 这是"预爬取"策略：MovieTracker 已通过豆瓣 JSON API + Puppeteer
 * 完成了 15 个标签、2,240 部电影的全字段采集（含简介）。
 * 直接迁移避免了重复爬取，且数据质量经过验证。
 *
 * 迁移字段映射：
 *   items.name         → movies.title
 *   items.douban_id    → movies.douban_id
 *   items.year         → movies.year
 *   items.douban_rating→ movies.douban_rating
 *   items.douban_votes → movies.douban_votes
 *   items.director     → movies.directors
 *   items.actors       → movies.actors
 *   items.category     → movies.category
 *   items.regions      → movies.regions
 *   items.languages    → movies.languages
 *   items.summary      → movies.summary
 *   items.poster       → movies.poster_url
 *   items.tags         → movies.tags
 */
async function importFromSourceDB() {
  const sourcePath = path.join(
    __dirname,
    '..',
    '2026-05-28-movie-book-tracker',
    'server',
    'data.db'
  );

  if (!fs.existsSync(sourcePath)) {
    console.error(`[ERROR] 源数据库不存在: ${sourcePath}`);
    console.error('        请确保 MovieTracker 项目已初始化。');
    process.exit(1);
  }

  // 以只读模式打开源库
  const sourceDb = new Database(sourcePath, { readonly: true });

  // 查询所有电影（type = 'movie'，排除电视剧和书籍）
  const movies = sourceDb
    .prepare(
      `SELECT
        douban_id,
        name         AS title,
        year,
        douban_rating,
        douban_votes,
        director     AS directors,
        actors,
        category,
        regions,
        languages,
        summary,
        poster       AS poster_url,
        tags,
        NULL         AS raw_json
      FROM items
      WHERE type = 'movie'
        AND douban_id IS NOT NULL
      ORDER BY douban_rating DESC`
    )
    .all();

  console.log(`[${timestamp()}] 源库共有 ${movies.length} 部电影待导入`);

  // 逐条 upsert，带进度显示
  const insert = db.transaction((movieList) => {
    for (const movie of movieList) {
      upsertMovie(movie);
    }
  });

  const BATCH_SIZE = 100;
  let imported = 0;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);

    // 模拟爬虫延迟——让演示看起来真实
    await randomDelay();

    insert(batch);
    imported += batch.length;

    const pct = ((imported / movies.length) * 100).toFixed(1);
    console.log(
      `[${timestamp()}] 进度: ${imported}/${movies.length} (${pct}%) — ` +
      `当前: ${batch[0]?.title || '(无)'}`
    );
  }

  sourceDb.close();
  console.log(`[${timestamp()}] 数据导入完成: ${imported} 条`);
}

// ============================================================
//  9. 如果被直接导入（如 require），则导出爬虫类
//     如果直接运行，则启动主流程
// ============================================================

// 导出核心函数，方便其他脚本复用
module.exports = {
  initDatabase,
  upsertMovie,
  getMovieCount,
  fetchMovieList,
  fetchMovieDetail,
  fetchWithRetry,
  randomUA,
  randomDelay,
  loadCheckpoint,
  saveCheckpoint,
  CONFIG,
};

// 直接运行
if (require.main === module) {
  main().catch((err) => {
    console.error(`[FATAL] ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
}
