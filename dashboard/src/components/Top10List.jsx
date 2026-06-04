import { useState, useEffect } from 'react';
import { fetchTop10, fetchGenres } from '../api.js';

export default function Top10List() {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [sort, setSort] = useState('rating');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGenres().then(setGenres).catch(console.error);
    loadMovies();
  }, []);

  function loadMovies() {
    setLoading(true);
    const params = {};
    if (genre) params.genre = genre;
    if (yearMin) params.year_min = yearMin;
    if (yearMax) params.year_max = yearMax;
    params.sort = sort;

    fetchTop10(params)
      .then(setMovies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMovies();
  }, [genre, yearMin, yearMax, sort]);

  function rankClass(i) {
    if (i === 0) return 'rank-1';
    if (i === 1) return 'rank-2';
    if (i === 2) return 'rank-3';
    return '';
  }

  return (
    <div className="section">
      <h2 className="section-title">Top 10 排行榜</h2>

      <div className="top10-controls">
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">全部分类</option>
          {genres.slice(0, 20).map((g) => (
            <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="起始年"
          value={yearMin}
          onChange={(e) => setYearMin(e.target.value)}
          min="1927"
          max="2026"
        />
        <input
          type="number"
          placeholder="结束年"
          value={yearMax}
          onChange={(e) => setYearMax(e.target.value)}
          min="1927"
          max="2026"
        />

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rating">按评分</option>
          <option value="votes">按评价数</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">加载中</div>
      ) : (
        <table className="top10-table">
          <thead>
            <tr>
              <th>#</th>
              <th>电影</th>
              <th>导演</th>
              <th>年份</th>
              <th>评分</th>
              <th>分类</th>
            </tr>
          </thead>
          <tbody>
            {movies.map((m, i) => (
              <tr key={m.douban_id}>
                <td className={`rank-num ${rankClass(i)}`}>{i + 1}</td>
                <td className="movie-title-cell">
                  {m.title}
                </td>
                <td className="movie-director">{m.directors || '-'}</td>
                <td className="movie-year">{m.year}</td>
                <td>
                  <span className="rating-badge">{m.douban_rating}</span>
                  {m.douban_votes > 0 && (
                    <span className="votes-badge">{(m.douban_votes / 10000).toFixed(1)}万人</span>
                  )}
                </td>
                <td className="movie-director">{m.category?.split('/')[0] || '-'}</td>
              </tr>
            ))}
            {movies.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>无匹配结果</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
