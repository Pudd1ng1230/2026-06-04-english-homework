import { useState, useEffect } from 'react';
import { fetchKpis } from './api.js';
import KpiCards from './components/KpiCards.jsx';
import Top10List from './components/Top10List.jsx';
import ChartEmbed from './components/ChartEmbed.jsx';
import Conclusion from './components/Conclusion.jsx';

export default function App() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchKpis()
      .then(setKpis)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">正在加载数据</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="header">
          <h1>豆瓣电影数据分析仪表盘</h1>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--orange)', padding: 60 }}>
          <p>⚠️ 数据加载失败</p>
          <p style={{ color: 'var(--text-dim)', marginTop: 8, fontSize: '0.9rem' }}>
            请确保 API 服务器已启动 (npm run dev:api)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎬 豆瓣电影数据分析仪表盘</h1>
        <p>SQLite 实时查询 · 2,243 部电影 · 暗色主题可视化</p>
      </header>

      <KpiCards kpis={kpis} />
      <Top10List />
      <ChartEmbed />
      <Conclusion />

      <footer className="footer">
        AI 驱动的电影数据分析 · pandas + matplotlib + React + Express · 豆瓣数据仅用于学习研究
      </footer>
    </div>
  );
}
