export default function ChartEmbed() {
  const charts = [
    { src: '/api/chart/01-rating-histogram.png', alt: '评分分布直方图' },
    { src: '/api/chart/02-genre-boxplot.png', alt: '分类评分箱线图' },
    { src: '/api/chart/03-year-trend.png', alt: '年度趋势图' },
    { src: '/api/chart/04-sunburst.png', alt: '分类旭日图' },
  ];

  return (
    <div className="section">
      <h2 className="section-title">可视化图表</h2>
      <div className="chart-grid">
        {charts.map((c) => (
          <div key={c.alt} className="chart-card">
            <img src={c.src} alt={c.alt} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}
