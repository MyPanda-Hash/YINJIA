# -*- coding: utf-8 -*-
"""生成 AI 日报晨报仪表盘（单文件 HTML）

数据源：AIHOT 公开 v1 API `/api/v1/dailies/latest`
 - report.sections : 四个正式版块（含来源 / 摘要 / 原文链接，无发布时间）
 - report.flashes  : 快讯条目（含来源 / 链接 / publishedAt）
本脚本按五个固定版块分组、全局连续编号，输出纯静态单文件 HTML。
"""
import json, sys, html, datetime, os

sys.stdout.reconfigure(encoding='utf-8')
D = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/') + '/'
OUT = D + 'aihot-ai-briefing-2026-10-09.html'

LABELS = ['模型发布/更新', '产品发布/更新', '行业动态', '论文研究', '技巧与观点']

api = json.load(open(D + '_aihot_latest.json', encoding='utf-8'))
rep = api['report']
flashes = rep.get('flashes') or []

# 精选条目池：日报 sections/flashes 本身不含每条发布时间，
# 用 /api/v1/items 的 publishedAt 按标题回填，保证每张卡都能显示北京时间。
try:
    feed = (json.load(open(D + '_aihot_items.json', encoding='utf-8')).get('items') or [])
except Exception:
    feed = []
BY_TITLE = {f['title']: f for f in feed}

# ---------- 1. 正式版块条目 ----------
items = []
for s in rep['sections']:
    lab = s['label'] if s['label'] in LABELS else '行业动态'
    for it in s['items']:
        m = BY_TITLE.get(it['title'], {})
        items.append({
            'sec': lab,
            'title': it['title'],
            'summary': it.get('summary', ''),
            'source': it['source']['name'],
            'url': it['links'].get('original') or it['links'].get('aihot') or '',
            'publishedAt': it.get('publishedAt') or m.get('publishedAt') or '',
            'flash': False,
        })

# ---------- 2. 快讯分派（按标题语义人工判定版块）----------
FLASH_SEC = {
    'Arena 公布 Claude Haiku 5.5 (High) 真实评测结果：Code Arena 1587 分首秀第 30 名': '模型发布/更新',
    'Zenity 研究人员发现一条提示词即可劫持 AWS 账户内全部 AgentCore 智能体': '行业动态',
    'Artificial Analysis 评测 Google Nano Banana 2.1，两榜居第 4 且价格为前代一半': '模型发布/更新',
    'Google 开源 ML Drift 端侧 GPU 推理引擎，接替 TFLite GPU delegate': '产品发布/更新',
    'Arena 完成 2 亿美元 B 轮融资，估值 31 亿美元并发布 Alignment Index': '行业动态',
    'GPT-6.1 Sol ultrafast 发布，Codex steering 改进为即时响应': '模型发布/更新',
    'Anthropic 用 Claude Managed Agents 构建定时智能体自动化的实践指南': '技巧与观点',
    'Tessl 工程博客：AI 不是笨，是瞎——企业级 Agent 记忆的三个关键设计决策': '技巧与观点',
    'Google 开源 AQuA 环境质量智能体，自动诊断生产环境中的 Agent 故障': '产品发布/更新',
    'Claude 九月回顾：Chat 与 Cowork 合一，Claude 5.5 系列模型上线': '模型发布/更新',
}

# 与正式版块重复的条目不再重复展示（URL / 标题双重比对）
seen_url = {it['url'] for it in items if it['url']}
seen_title = {it['title'] for it in items}

for f in flashes:
    url = f['links'].get('original') or f['links'].get('aihot') or ''
    if url in seen_url or f['title'] in seen_title:
        continue
    seen_url.add(url)
    seen_title.add(f['title'])
    m = BY_TITLE.get(f['title'], {})
    items.append({
        'sec': FLASH_SEC.get(f['title'], '行业动态'),
        'title': f['title'],
        # 日报 flashes 字段不含摘要，用精选池同条摘要补齐
        'summary': f.get('summary') or m.get('summary') or '',
        'source': f['source']['name'],
        'url': url,
        'publishedAt': f.get('publishedAt') or m.get('publishedAt') or '',
        'flash': True,
    })

# ---------- 3. 按版块顺序排列并全局连续编号 ----------
ordered = []
for lab in LABELS:
    ordered += [it for it in items if it['sec'] == lab]
for i, it in enumerate(ordered, 1):
    it['no'] = i

stats = {lab: sum(1 for it in ordered if it['sec'] == lab) for lab in LABELS}
TOTAL = len(ordered)

# 保底：任何条目摘要缺失时，用标题兜底，避免出现空白卡片
for it in ordered:
    if not (it['summary'] or '').strip():
        it['summary'] = it['title']

# ---------- 4. 时间 → 北京时间人话 ----------
CST = datetime.timezone(datetime.timedelta(hours=8))
WD_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

def to_cst(iso):
    if not iso:
        return ''
    try:
        t = datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(CST)
    except Exception:
        return ''
    return '%d月%d日 %s %02d:%02d（北京时间）' % (t.month, t.day, WD_CN[t.weekday()], t.hour, t.minute)

def brief(s, n=60):
    s = ' '.join((s or '').split())
    return s if len(s) <= n else s[:n].rstrip('，。、；：,;: ') + '…'

def clean_src(s):
    """去掉来源名尾部的信源类型标注，让 chip 更短"""
    for suf in ('（网页）', '（RSS）', '（RSS · 排除企业/客户案例）', '（发表成果 · 网页）'):
        s = s.replace(suf, '')
    return s.strip()

esc = lambda s: html.escape(s or '', quote=True)

gen = rep['generatedAt'].replace('Z', '+00:00')
gen_dt = datetime.datetime.fromisoformat(gen).astimezone(CST)
gen_s = '%d月%d日 %02d:%02d' % (gen_dt.month, gen_dt.day, gen_dt.hour, gen_dt.minute)

DATE = rep['date']
y, m, d = (int(x) for x in DATE.split('-'))
date_cn = '%d 年 %d 月 %d 日' % (y, m, d)
wd_cn = WD_CN[datetime.date(y, m, d).weekday()]

# 日报窗口（北京时间）
ws = datetime.datetime.fromisoformat(rep['windowStart'].replace('Z', '+00:00')).astimezone(CST)
we = datetime.datetime.fromisoformat(rep['windowEnd'].replace('Z', '+00:00')).astimezone(CST)
window_s = '%d月%d日 %02d:00 — %d月%d日 %02d:00' % (ws.month, ws.day, ws.hour, we.month, we.day, we.hour)

# ---------- 5. 生成 HTML ----------
ICONS = {
    '模型发布/更新': '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.4"/>',
    '产品发布/更新': '<path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><path d="M2 4h20v4H2zM10 12h4"/>',
    '行业动态': '<path d="M3 20h18M6 20V10M11 20V4M16 20v-7M21 20v-4"/>',
    '论文研究': '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M9 7h7M9 11h7"/>',
    '技巧与观点': '<path d="M9.5 17h5M10 21h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
}

nav_html, sec_html = [], []
for idx, lab in enumerate(LABELS, 1):
    sid = 'sec-%d' % idx
    cards = [it for it in ordered if it['sec'] == lab]
    nav_html.append(
        '<a class="nav-item" href="#%s"><span class="nav-no">%02d</span>'
        '<span class="nav-lab">%s</span><span class="nav-cnt">%d</span></a>'
        % (sid, idx, esc(lab), len(cards)))

    if cards:
        body = []
        for it in cards:
            t = to_cst(it['publishedAt'])
            body.append(
                '<article class="card">'
                '<div class="card-top"><span class="card-no">%02d</span>'
                '<span class="chip">%s</span>%s</div>'
                '<h3 class="card-title"><a href="%s" target="_blank" rel="noopener noreferrer">%s</a></h3>'
                '<p class="card-sum">%s</p>'
                '<div class="card-foot"><time class="card-time">%s</time>'
                '<a class="card-link" href="%s" target="_blank" rel="noopener noreferrer">阅读原文'
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>'
                '</a></div></article>'
                % (it['no'], esc(clean_src(it['source'])),
                   '<span class="chip chip-flash">快讯</span>' if it['flash'] else '',
                   esc(it['url']), esc(it['title']), esc(brief(it['summary'])),
                   esc(t if t else '日报收录'), esc(it['url']))
            )
        grid = '<div class="grid">%s</div>' % ''.join(body)
    else:
        grid = ('<div class="empty"><span class="empty-ico">'
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
                '</span><p>本期该版块暂无收录条目</p></div>' % ICONS[lab])

    sec_html.append(
        '<section class="section" id="%s"><header class="sec-head">'
        '<span class="sec-no">%02d</span><span class="sec-ico">'
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
        '</span><h2 class="sec-title">%s</h2><span class="sec-cnt">%d 条</span></header>%s</section>'
        % (sid, idx, ICONS[lab], esc(lab), len(cards), grid))

lead = rep['lead']
lead_src = next((it['source'] for it in ordered if it['title'] == lead['title']), '')
lead_url = next((it['url'] for it in ordered if it['title'] == lead['title']),
                rep['links'].get('aihot', ''))
canon = rep['links'].get('aihot', '')

stat_html = ''.join(
    '<div class="stat"><span class="stat-n">%d</span><span class="stat-l">%s</span></div>'
    % (stats[lab], esc(lab)) for lab in LABELS)

HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="AI 日报晨报 · __DATE_CN__，收录 __TOTAL__ 条 AI 动态">
<title>AI 日报晨报 · __DATE_CN__（周五 · 共 __TOTAL__ 条）</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f4f6f9;--panel:#fff;--ink:#111621;--ink-2:#4a5262;--ink-3:#7d8798;--ink-4:#a6adba;
  --line:#e5e9f0;--line-2:#eef1f6;
  --accent:#1d5cff;--accent-2:#0b3ec9;--accent-soft:#eef3ff;
  --hot:#d92d20;--hot-soft:#fdecea;
  --shadow:0 1px 2px rgba(16,24,40,.04),0 10px 26px -14px rgba(16,24,40,.18);
  --r:15px;
}
html{-webkit-text-size-adjust:100%}
body{
  background:var(--bg);color:var(--ink);line-height:1.6;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC",sans-serif;
  padding-bottom:64px;
}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}

/* HERO */
.hero{background:linear-gradient(152deg,#081538 0%,#122a6b 44%,#1d5cff 100%);color:#fff;padding:48px 0 40px;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(760px 280px at 86% -20%,rgba(255,255,255,.20),transparent 62%);pointer-events:none}
.hero .wrap{position:relative;z-index:1}
.hero-tag{display:inline-flex;align-items:center;gap:9px;font-size:11.5px;font-weight:700;letter-spacing:.16em;
  background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.24);padding:6px 13px;border-radius:999px}
.hero-tag i{width:7px;height:7px;border-radius:50%;background:#5ee9a4;box-shadow:0 0 0 4px rgba(94,233,164,.22);display:block}
.hero-date{font-size:clamp(29px,5.2vw,48px);font-weight:800;letter-spacing:-.022em;margin:18px 0 8px;line-height:1.14}
.hero-date em{font-style:normal;color:#9dc0ff}
.hero-sub{color:rgba(255,255,255,.78);font-size:14.5px;margin-bottom:22px;line-height:1.85}
.hero-sub b{color:#fff;font-weight:700}
.hero-sub span{white-space:nowrap}

.lead{display:block;text-decoration:none;color:inherit;background:rgba(255,255,255,.11);
  border:1px solid rgba(255,255,255,.2);border-left:3px solid #5ee9a4;border-radius:14px;
  padding:17px 19px;margin-bottom:24px;transition:background .18s,transform .18s}
.lead:hover{background:rgba(255,255,255,.17);transform:translateX(2px)}
.lead-lab{font-size:11.5px;font-weight:800;letter-spacing:.18em;color:#5ee9a4;display:flex;align-items:center;gap:9px;margin-bottom:9px}
.lead-lab::after{content:"";height:1px;flex:1;background:rgba(255,255,255,.22)}
.lead-title{font-size:17px;font-weight:750;line-height:1.5;margin-bottom:7px}
.lead-text{font-size:14px;color:rgba(255,255,255,.83);line-height:1.75}
.lead-meta{margin-top:11px;font-size:12.5px;color:rgba(255,255,255,.64);display:flex;gap:16px;flex-wrap:wrap}

.stats{display:grid;gap:10px;grid-template-columns:repeat(2,1fr)}
@media(min-width:520px){.stats{grid-template-columns:repeat(3,1fr)}}
@media(min-width:760px){.stats{grid-template-columns:repeat(5,1fr)}}
.stat{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:13px;padding:13px 12px;text-align:center}
.stat-n{display:block;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.15;font-variant-numeric:tabular-nums}
.stat-l{display:block;font-size:11.5px;color:rgba(255,255,255,.75);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* NAV */
.nav{background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}
.nav-inner{display:flex;gap:8px;overflow-x:auto;padding:11px 20px;max-width:1180px;margin:0 auto;scrollbar-width:none}
.nav-inner::-webkit-scrollbar{display:none}
.nav-item{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;text-decoration:none;
  color:var(--ink-2);font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:999px;
  border:1px solid var(--line);background:#fff;transition:all .16s}
.nav-item:hover,.nav-item.on{color:var(--accent-2);border-color:#c3d3ff;background:var(--accent-soft)}
.nav-no{font-size:11px;font-weight:800;color:var(--ink-4);font-variant-numeric:tabular-nums}
.nav-item.on .nav-no{color:var(--accent)}
.nav-cnt{font-size:11.5px;font-weight:700;background:#f0f2f7;color:var(--ink-3);padding:1px 7px;border-radius:999px;font-variant-numeric:tabular-nums}
.nav-item.on .nav-cnt{background:#fff;color:var(--accent)}

/* SECTIONS */
.section{margin-top:46px;scroll-margin-top:76px}
.sec-head{display:flex;align-items:center;gap:12px;padding-bottom:13px;border-bottom:2px solid var(--ink);margin-bottom:20px}
.sec-no{font-size:24px;font-weight:850;color:var(--accent);letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.sec-ico{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--accent-soft);color:var(--accent)}
.sec-ico svg{width:17px;height:17px}
.sec-title{font-size:21px;font-weight:800;letter-spacing:-.015em;flex:1;line-height:1.3}
.sec-cnt{font-size:12.5px;font-weight:700;color:var(--ink-3);background:#fff;border:1px solid var(--line);padding:3px 11px;border-radius:999px;font-variant-numeric:tabular-nums}

.grid{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:660px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1010px){.grid{grid-template-columns:repeat(3,1fr)}}

.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);
  padding:17px 18px 15px;display:flex;flex-direction:column;box-shadow:var(--shadow);
  transition:transform .18s,box-shadow .18s,border-color .18s;position:relative;overflow:hidden}
.card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(180deg,var(--accent),#7ea7ff);opacity:0;transition:opacity .18s}
.card:hover{transform:translateY(-3px);border-color:#d5dcff;
  box-shadow:0 2px 4px rgba(16,24,40,.05),0 18px 34px -18px rgba(16,24,40,.26)}
.card:hover::before{opacity:1}
.card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:11px}
.card-no{font-size:15px;font-weight:850;color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1}
.chip{font-size:11.5px;font-weight:650;color:var(--ink-2);background:#f2f4f8;border:1px solid var(--line-2);
  padding:3px 9px;border-radius:7px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip-flash{background:var(--hot-soft);color:var(--hot);border-color:#f8d7d3;font-weight:700}
.card-title{font-size:15.5px;font-weight:750;line-height:1.52;letter-spacing:-.008em;margin-bottom:9px;overflow-wrap:anywhere}
.card-title a{color:var(--ink);text-decoration:none;transition:color .15s}
.card-title a:hover{color:var(--accent)}
.card-sum{font-size:13.5px;color:var(--ink-2);line-height:1.78;flex:1;margin-bottom:13px}
.card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding-top:11px;border-top:1px solid var(--line-2);margin-top:auto}
.card-time{font-size:11.5px;color:var(--ink-4);font-variant-numeric:tabular-nums}
.card-link{display:inline-flex;align-items:center;gap:3px;flex:none;font-size:12.5px;font-weight:700;
  color:var(--accent);text-decoration:none}
.card-link svg{width:12px;height:12px}
.card-link:hover{color:var(--accent-2);text-decoration:underline}

.empty{background:var(--panel);border:1px dashed var(--line);border-radius:var(--r);
  padding:34px 20px;text-align:center;color:var(--ink-4);font-size:13.5px}
.empty-ico{display:block;margin:0 auto 10px;width:34px;height:34px;opacity:.45}
.empty-ico svg{width:100%;height:100%}

/* FOOTER */
.foot{margin-top:52px;padding-top:22px;border-top:1px solid var(--line);font-size:13px;color:var(--ink-3);line-height:1.9}
.foot b{color:var(--ink);font-weight:700}
.foot-row{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:baseline;justify-content:space-between}
.foot a{color:var(--accent);text-decoration:none}
.foot a:hover{text-decoration:underline}
.foot-note{margin-top:11px;font-size:12px;color:var(--ink-4)}
.top{position:fixed;right:20px;bottom:20px;width:42px;height:42px;border-radius:50%;
  border:1px solid var(--line);background:#fff;color:var(--ink-2);cursor:pointer;
  display:grid;place-items:center;box-shadow:var(--shadow);opacity:0;visibility:hidden;
  transition:all .22s;z-index:60}
.top.on{opacity:1;visibility:visible}
.top:hover{color:var(--accent);border-color:#c3d3ff}
.top svg{width:17px;height:17px}

@media(max-width:640px){
  .wrap{padding:0 15px}
  .hero{padding:34px 0 30px}
  .card{padding:15px 15px 13px}
  .sec-title{font-size:18px}
  .sec-no{font-size:21px}
}
@media print{
  .nav,.top{display:none}
  .hero{background:#122a6b!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .card{break-inside:avoid;box-shadow:none}
}
</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <span class="hero-tag"><i></i>AI DAILY BRIEFING · 晨报仪表盘</span>
    <h1 class="hero-date">__DATE_CN__<em> · __WD__</em></h1>
    <p class="hero-sub">
      <span>人工智能每日要闻 · 本期共 <b>__TOTAL__ 条</b>，分入 <b>5</b> 个版块</span> ·
      <span>覆盖 <b>__WINDOW__</b></span> ·
      <span>出刊 <b>__GEN__</b>（北京时间）</span>
    </p>

    <a class="lead" href="__LEAD_URL__" target="_blank" rel="noopener noreferrer">
      <div class="lead-lab">今日头条</div>
      <div class="lead-title">__LEAD_TITLE__</div>
      <p class="lead-text">__LEAD_TEXT__</p>
      <div class="lead-meta"><span>来源：__LEAD_SRC__</span><span>点击查看原文 →</span></div>
    </a>

    <div class="stats">__STATS__</div>
  </div>
</header>

<nav class="nav" aria-label="版块导航">
  <div class="nav-inner" id="nav">__NAV__</div>
</nav>

<main class="wrap">
__SECTIONS__

  <footer class="foot">
    <div class="foot-row">
      <span>本期共收录 <b>__TOTAL__ 条</b> AI 动态 · 5 个版块 · 全局连续编号 01—__TOTAL__</span>
      <span>数据源：<a href="__CANON__" target="_blank" rel="noopener noreferrer">AIHOT 日报 __DATE__</a></span>
    </div>
    <p class="foot-note">
      由 AIHOT 编辑系统根据公开来源自动编排 · 全部时间已换算为北京时间 ·
      标题与摘要版权归原发布方所有，引用请核对原文。
    </p>
  </footer>
</main>

<button class="top" id="top" aria-label="回到顶部">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
</button>

<script>
(function () {
  var top = document.getElementById('top');
  var nav = document.getElementById('nav');
  var links = Array.prototype.slice.call(nav.querySelectorAll('.nav-item'));
  var secs = Array.prototype.slice.call(document.querySelectorAll('.section'));

  function onScroll() {
    top.classList.toggle('on', window.scrollY > 420);
    var line = window.scrollY + 130, cur = -1;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].offsetTop <= line) cur = i;
    }
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
    if (cur > -1) {
      var a = links[cur], box = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
      if (r.left < box.left || r.right > box.right) {
        nav.scrollLeft += (r.left - box.left) - (box.width - r.width) / 2;
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  top.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); window.scrollTo({ top: t.offsetTop - 70, behavior: 'smooth' }); }
    });
  });
})();
</script>
</body>
</html>
"""

out = (HTML
       .replace('__DATE_CN__', date_cn)
       .replace('__WD__', wd_cn)
       .replace('__TOTAL__', str(TOTAL))
       .replace('__WINDOW__', window_s)
       .replace('__GEN__', gen_s)
       .replace('__LEAD_URL__', esc(lead_url))
       .replace('__LEAD_TITLE__', esc(lead['title']))
       .replace('__LEAD_TEXT__', esc(lead['leadParagraph']))
       .replace('__LEAD_SRC__', esc(clean_src(lead_src)))
       .replace('__STATS__', stat_html)
       .replace('__NAV__', ''.join(nav_html))
       .replace('__SECTIONS__', ''.join(sec_html))
       .replace('__CANON__', esc(canon))
       .replace('__DATE__', DATE))

open(OUT, 'w', encoding='utf-8').write(out)

print('OUT   :', OUT)
print('总条数:', TOTAL, '（正式版块 %d + 快讯 %d）'
      % (sum(1 for it in ordered if not it['flash']),
         sum(1 for it in ordered if it['flash'])))
for lab in LABELS:
    print('  %-12s %d' % (lab, stats[lab]))
print('日期  :', date_cn, wd_cn, '| 窗口', window_s, '| 出刊', gen_s)
