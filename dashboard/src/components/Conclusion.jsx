export default function Conclusion() {
  return (
    <div className="section">
      <h2 className="section-title">分析结论</h2>
      <div className="conclusion">
        <p>
          本仪表盘基于 <span className="highlight">2,243 部豆瓣电影</span> 数据（1927–2026），
          覆盖 <span className="highlight">23 个一级分类</span>，通过评分分布、分类对比、年度趋势和层级旭日图四个维度，
          呈现豆瓣电影生态的全景画像。
        </p>

        <p>
          <strong>评分集中化趋势明显：</strong>
          豆瓣均分 <span className="highlight">7.82</span>，中位数 <span className="highlight">8.0</span>，
          评分离散度仅 σ=0.99。这意味着豆瓣用户倾向于打"友好分"——及格线以上的作品占了绝对多数。
          尽管理论上评分范围为 1–10，但实际数据中最低分仅 4.0，且 4–6 分段的电影数量极少。
        </p>

        <p>
          <strong>纪录片和动画领跑：</strong>
          箱线图揭示了一个有趣现象——纪录片和动画类的中位评分显著高于动作、恐怖等类型。
          这表明豆瓣社区对非虚构内容和动画电影有着更高的评价基准，部分原因在于这些类型的
          受众更垂直、作品的筛选门槛更高。
        </p>

        <p>
          <strong>产量爆发式增长：</strong>
          年度趋势图显示，2020 年起电影数据量急剧攀升，<span className="highlight">2024 年达到 177 部的峰值</span>。
          这既反映了流媒体时代内容的井喷，也与豆瓣用户近年更活跃的标记行为有关。
          值得关注的是，均分在 2010 年后呈缓慢下行趋势，可能与内容供给过剩导致评分稀释有关。
        </p>

        <p>
          <strong>分类多元化：</strong>
          旭日图展示了豆瓣电影标签的层级结构——<span className="highlight">剧情类占比最高</span>，
          其次是喜剧、动作、爱情等大众类型。外圈二级分类进一步细分了子类型，科幻→硬科幻、
          动画→宫崎骏等细分标签反映了豆瓣用户的深度分类习惯。
        </p>
      </div>
    </div>
  );
}
