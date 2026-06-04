"""
豆瓣电影数据分析 — 四维可视化
================================
直方图 · 箱线图 · 趋势图 · 旭日图
暗色主题 #1c1c28，高清 300 DPI 导出
"""

import sqlite3
import os
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # 无 GUI 后端
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.patches import FancyBboxPatch
from collections import Counter

# ============================================================
#  0. 全局暗色主题配置
# ============================================================

BG_COLOR    = '#1c1c28'
TEXT_COLOR  = '#e4e4f0'
ACCENT_CYAN = '#4db8c8'
RATING_GOLD = '#f5a623'
WARN_ORANGE = '#e87850'
GRID_COLOR  = '#2a2a3a'
CARD_BG     = '#252535'

# 评分梯度色（低→高）
RATING_CMAP_COLORS = ['#e87850', '#e8965a', '#f5a623', '#7ec8a0', '#4db8c8']

plt.rcParams.update({
    'figure.facecolor': BG_COLOR,
    'axes.facecolor': BG_COLOR,
    'axes.edgecolor': GRID_COLOR,
    'axes.labelcolor': TEXT_COLOR,
    'text.color': TEXT_COLOR,
    'xtick.color': TEXT_COLOR,
    'ytick.color': TEXT_COLOR,
    'grid.color': GRID_COLOR,
    'grid.alpha': 0.4,
    'font.family': 'sans-serif',
    'font.sans-serif': ['Microsoft YaHei', 'SimHei', 'DejaVu Sans'],
    'font.size': 11,
    'axes.unicode_minus': False,  # 避免负号显示为方框
    'legend.facecolor': CARD_BG,
    'legend.edgecolor': GRID_COLOR,
    'legend.labelcolor': TEXT_COLOR,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
    'savefig.facecolor': BG_COLOR,
})

# 输出目录
CHARTS_DIR = os.path.join(os.path.dirname(__file__), 'charts')
os.makedirs(CHARTS_DIR, exist_ok=True)

# 数据加载
DB_PATH = os.path.join(os.path.dirname(__file__), 'movies.db')
conn = sqlite3.connect(DB_PATH)
df = pd.read_sql('SELECT * FROM movies', conn)

# 预处理
df['year'] = pd.to_numeric(df['year'], errors='coerce')
df['douban_rating'] = pd.to_numeric(df['douban_rating'], errors='coerce')
df['douban_votes'] = pd.to_numeric(df['douban_votes'], errors='coerce')
df = df.dropna(subset=['year', 'douban_rating'])

# 拆分 category 首级分类
def primary_genre(cat):
    if pd.isna(cat) or not cat.strip():
        return '其他'
    return cat.split('/')[0].strip()

df['genre_primary'] = df['category'].apply(primary_genre)

print(f'数据加载完成: {len(df)} 部有效电影')


# ============================================================
#  1. 直方图 — 评分分布
# ============================================================

def plot_rating_histogram():
    """豆瓣评分分布直方图，展示评分的集中趋势与离散程度"""
    fig, ax = plt.subplots(figsize=(12, 6))

    ratings = df['douban_rating'].dropna()
    bins = np.arange(4.0, 10.1, 0.25)

    counts, edges, patches = ax.hist(
        ratings, bins=bins,
        color=ACCENT_CYAN, edgecolor=BG_COLOR, linewidth=0.5,
        alpha=0.85
    )

    # 渐变着色：低分偏橙，高分偏青
    norm = plt.Normalize(4, 10)
    for i, patch in enumerate(patches):
        bin_center = (edges[i] + edges[i + 1]) / 2
        t = (bin_center - 4) / 6  # 0~1
        r = int(0xe8 * (1 - t) + 0x4d * t)
        g = int(0x78 * (1 - t) + 0xb8 * t)
        b = int(0x50 * (1 - t) + 0xc8 * t)
        patch.set_facecolor(f'#{r:02x}{g:02x}{b:02x}')

    # 均值线
    mean_rating = ratings.mean()
    ax.axvline(mean_rating, color=RATING_GOLD, linewidth=2, linestyle='--',
               label=f'均值 {mean_rating:.2f}')

    # 中位数线
    median_rating = ratings.median()
    ax.axvline(median_rating, color='white', linewidth=1.5, linestyle=':',
               label=f'中位数 {median_rating:.1f}')

    ax.set_xlabel('豆瓣评分', fontsize=13)
    ax.set_ylabel('电影数量', fontsize=13)
    ax.set_title('豆瓣电影评分分布直方图', fontsize=16, fontweight='bold',
                 color=RATING_GOLD, pad=15)
    ax.legend(loc='upper left', framealpha=0.8)
    ax.set_xlim(4, 10)
    ax.grid(axis='y', alpha=0.3)

    # 信息标注
    textstr = f'n = {len(ratings):,}\nσ = {ratings.std():.2f}'
    ax.text(0.98, 0.95, textstr, transform=ax.transAxes, fontsize=10,
            verticalalignment='top', horizontalalignment='right',
            bbox=dict(boxstyle='round,pad=0.5', facecolor=CARD_BG, edgecolor=GRID_COLOR, alpha=0.8))

    path = os.path.join(CHARTS_DIR, '01-rating-histogram.png')
    fig.savefig(path)
    plt.close(fig)
    print(f'  ✓ 直方图: {path}')


# ============================================================
#  2. 箱线图 — 分类评分分布
# ============================================================

def plot_genre_boxplot():
    """Top 12 分类的评分箱线图，展示各类别的评分中位数与离散度"""
    # 统计 top 分类（按电影数量）
    genre_counts = df['genre_primary'].value_counts()
    top_genres = genre_counts.head(12).index.tolist()

    # 准备箱线图数据
    box_data = [
        df[df['genre_primary'] == g]['douban_rating'].dropna().values
        for g in top_genres
    ]

    # 按中位数排序
    medians = [np.median(d) for d in box_data]
    sorted_idx = np.argsort(medians)
    top_genres_sorted = [top_genres[i] for i in sorted_idx]
    box_data_sorted = [box_data[i] for i in sorted_idx]
    counts_sorted = [genre_counts[g] for g in top_genres_sorted]

    fig, ax = plt.subplots(figsize=(14, 7))

    bp = ax.boxplot(
        box_data_sorted,
        vert=False,
        patch_artist=True,
        widths=0.6,
        medianprops={'color': RATING_GOLD, 'linewidth': 2},
        whiskerprops={'color': TEXT_COLOR, 'linewidth': 1},
        capprops={'color': TEXT_COLOR, 'linewidth': 1},
        flierprops={'marker': 'o', 'markerfacecolor': WARN_ORANGE, 'markersize': 4,
                    'markeredgecolor': WARN_ORANGE, 'alpha': 0.5},
    )

    # 箱体着色
    cmap = plt.get_cmap('RdYlGn')
    for i, (patch, data) in enumerate(zip(bp['boxes'], box_data_sorted)):
        norm_val = (np.median(data) - 6.5) / 3.0  # normalize ~6.5-9.5
        norm_val = max(0, min(1, norm_val))
        color = cmap(0.3 + norm_val * 0.7)
        patch.set_facecolor(color)
        patch.set_alpha(0.7)

    # Y 轴标签带数量
    labels = [f'{g}  ({c}部)' for g, c in zip(top_genres_sorted, counts_sorted)]
    ax.set_yticklabels(labels, fontsize=10)

    ax.set_xlabel('豆瓣评分', fontsize=13)
    ax.set_title('Top 12 分类评分箱线图', fontsize=16, fontweight='bold',
                 color=RATING_GOLD, pad=15)
    ax.set_xlim(3.5, 10.2)
    ax.grid(axis='x', alpha=0.3)

    path = os.path.join(CHARTS_DIR, '02-genre-boxplot.png')
    fig.savefig(path)
    plt.close(fig)
    print(f'  ✓ 箱线图: {path}')


# ============================================================
#  3. 趋势图 — 年度电影数量
# ============================================================

def plot_year_trend():
    """电影数量年度趋势 + 均分变化，双轴图"""
    # 年度统计
    yearly = df.groupby('year').agg(
        count=('douban_id', 'count'),
        avg_rating=('douban_rating', 'mean'),
    ).reset_index()
    yearly = yearly[yearly['year'] >= 1950]  # 过滤早期稀疏年份

    fig, ax1 = plt.subplots(figsize=(16, 7))

    # 柱状图 — 电影数量
    bars = ax1.bar(
        yearly['year'], yearly['count'],
        color=ACCENT_CYAN, alpha=0.35, width=0.8,
        label='电影数量'
    )
    ax1.set_xlabel('年份', fontsize=13)
    ax1.set_ylabel('电影数量', fontsize=13, color=ACCENT_CYAN)
    ax1.tick_params(axis='y', labelcolor=ACCENT_CYAN)
    ax1.set_xlim(yearly['year'].min() - 1, yearly['year'].max() + 1)

    # 折线 — 均分（滑动平均）
    ax2 = ax1.twinx()
    yearly['rating_ma'] = yearly['avg_rating'].rolling(window=5, center=True).mean()

    ax2.plot(
        yearly['year'], yearly['rating_ma'],
        color=RATING_GOLD, linewidth=2.5, marker='.', markersize=2,
        label='均分 (5年滑动)'
    )
    ax2.set_ylabel('豆瓣均分', fontsize=13, color=RATING_GOLD)
    ax2.tick_params(axis='y', labelcolor=RATING_GOLD)
    ax2.set_ylim(6.0, 9.0)

    # 标注关键拐点
    # 2020年后的爆发增长
    recent = yearly[yearly['year'] >= 2000]
    if len(recent) > 0:
        max_idx = recent['count'].idxmax()
        ax1.annotate(
            f"{int(yearly.loc[max_idx, 'year'])}年\n{int(yearly.loc[max_idx, 'count'])}部",
            xy=(yearly.loc[max_idx, 'year'], yearly.loc[max_idx, 'count']),
            xytext=(0, 20), textcoords='offset points',
            fontsize=9, color=ACCENT_CYAN, ha='center',
            arrowprops=dict(arrowstyle='->', color=ACCENT_CYAN, alpha=0.6)
        )

    ax1.set_title('豆瓣电影年度趋势 (1950-2026)', fontsize=16, fontweight='bold',
                  color=RATING_GOLD, pad=15)

    # 合并图例
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', framealpha=0.8)

    ax1.grid(axis='y', alpha=0.3)

    path = os.path.join(CHARTS_DIR, '03-year-trend.png')
    fig.savefig(path)
    plt.close(fig)
    print(f'  ✓ 趋势图: {path}')


# ============================================================
#  4. 旭日图 — 分类层级
# ============================================================

def plot_sunburst():
    """
    旭日图：内圈 = 一级分类，外圈 = 二级分类
    纯 matplotlib 实现 — 嵌套 donut chart
    """
    # 解析一级/二级分类
    primary_counter = Counter()
    secondary_map = {}  # {一级: {二级: count}}

    for cat in df['category'].dropna():
        parts = [p.strip() for p in cat.split('/') if p.strip()]
        if len(parts) >= 1:
            p1 = parts[0]
            primary_counter[p1] += 1
            if p1 not in secondary_map:
                secondary_map[p1] = Counter()
            if len(parts) >= 2:
                secondary_map[p1][parts[1]] += 1
            else:
                secondary_map[p1]['其他'] += 1

    # 取 Top 10 一级分类，其余归入"其他"
    top_primary = [g for g, _ in primary_counter.most_common(10)]
    other_count = sum(c for g, c in primary_counter.items() if g not in top_primary)
    if other_count > 0:
        top_primary.append('其他')
        secondary_map['其他'] = Counter({'其他': other_count})

    # 构建内外圈数据
    inner_labels = []
    inner_sizes = []
    inner_colors = []

    outer_labels = []
    outer_sizes = []
    outer_colors = []

    base_colors = plt.cm.tab20.colors
    color_idx = 0

    for i, p in enumerate(top_primary):
        count = primary_counter.get(p, other_count if p == '其他' else 0)
        inner_labels.append(f'{p}\n({count})')
        inner_sizes.append(count)

        base_color = base_colors[color_idx % 20]
        color_idx += 1
        inner_colors.append(base_color)

        # 外圈：二级分类
        sub = secondary_map.get(p, Counter())
        total_sub = sum(sub.values())
        for j, (s, sc) in enumerate(sub.most_common(5)):
            outer_labels.append(f'{s} ({sc})' if sc > total_sub * 0.03 else '')
            outer_sizes.append(sc)
            # 略微调暗外圈颜色
            alpha = 0.5 + 0.5 * (j / max(len(sub), 1))
            outer_colors.append(tuple(c * alpha for c in base_color[:3]) + (0.85,))

    fig, ax = plt.subplots(figsize=(14, 14))

    # 外圈
    wedges_outer, texts_outer = ax.pie(
        outer_sizes,
        radius=1.0,
        labels=None,
        colors=outer_colors,
        wedgeprops=dict(width=0.3, edgecolor=BG_COLOR, linewidth=0.5),
        startangle=90,
    )

    # 内圈
    wedges_inner, texts_inner = ax.pie(
        inner_sizes,
        radius=0.7,
        labels=inner_labels,
        colors=inner_colors,
        wedgeprops=dict(width=0.4, edgecolor=BG_COLOR, linewidth=1.0),
        startangle=90,
        labeldistance=0.5,
        textprops={'fontsize': 8, 'color': '#1c1c28', 'fontweight': 'bold',
                   'ha': 'center', 'va': 'center'},
    )

    # 中心标题
    ax.text(0, 0, f'{len(df):,}\n部电影',
            ha='center', va='center', fontsize=14, fontweight='bold', color=TEXT_COLOR)

    ax.set_title('豆瓣电影分类旭日图', fontsize=18, fontweight='bold',
                 color=RATING_GOLD, pad=25)

    path = os.path.join(CHARTS_DIR, '04-sunburst.png')
    fig.savefig(path)
    plt.close(fig)
    print(f'  ✓ 旭日图: {path}')


# ============================================================
#  5. 执行
# ============================================================

if __name__ == '__main__':
    print('开始生成分析图表...\n')

    plot_rating_histogram()
    plot_genre_boxplot()
    plot_year_trend()
    plot_sunburst()

    print(f'\n✅ 全部图表已生成至 {CHARTS_DIR}/')
    print(f'   数据来源: {DB_PATH} ({len(df)} 部电影)')

    # 统计摘要
    print('\n' + '=' * 50)
    print('📊 数据摘要')
    print('=' * 50)
    print(f'  电影总数:     {len(df):,}')
    print(f'  年份跨度:     {int(df["year"].min())} ~ {int(df["year"].max())}')
    print(f'  豆瓣均分:     {df["douban_rating"].mean():.2f} ± {df["douban_rating"].std():.2f}')
    print(f'  中位评分:     {df["douban_rating"].median():.1f}')
    print(f'  一级分类数:   {df["genre_primary"].nunique()}')
    print(f'  年度峰值:     {int(df.groupby("year").size().idxmax())} 年 ({int(df.groupby("year").size().max())} 部)')
    print('=' * 50)

conn.close()
