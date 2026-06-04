export default function KpiCards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    {
      label: '电影总数',
      value: kpis.total_movies?.toLocaleString(),
      sub: `${kpis.year_min} - ${kpis.year_max}`,
      accent: '',
    },
    {
      label: '豆瓣均分',
      value: kpis.avg_rating,
      sub: `满分 10.0`,
      accent: 'gold',
    },
    {
      label: '一级分类',
      value: kpis.genre_count,
      sub: `${kpis.director_count?.toLocaleString()} 位导演`,
      accent: '',
    },
    {
      label: '简介覆盖率',
      value: `${kpis.summary_coverage}%`,
      sub: '2,240 / 2,243 部',
      accent: 'orange',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div key={c.label} className={`kpi-card ${c.accent}`}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
