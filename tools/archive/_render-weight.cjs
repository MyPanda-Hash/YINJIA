/* 首屏渲染重量(确定性口径,不经浏览器):
     首屏单元格数 = page_size × 该面板列表可见列数
     依据:INV 实测 50 行×56 列=2800 单元格 → DOM 16818(≈6 节点/单元格),故单元格数是渲染重量的可靠代理。
   用法: node tools/archive/_render-weight.cjs <面板清单文件> */
const fs = require('node:fs')
const API = 'http://localhost:8090'
async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
  const panels = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const out = []
  const TRUTH = { SO_ORDER: 16, INV: 56, PURCHASE_IN: 24 }   // 浏览器实测锚点,用于自检路径是否取对
  for (const p of panels) {
    const j = await fetch(`${API}/api/px/getPanelConfig?panelCode=${encodeURIComponent(p)}`, { headers: H }).then((r) => r.json())
    if (j.code !== 200) { out.push({ p, err: j.code }); continue }
    const d = j.data || {}
    const tabs = d.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs || []
    const cols = (tabs[0]?.columns || []).length
    const m = JSON.stringify(d).match(/"pageSize"\s*:\s*(\d+)/)
    const pageSize = m ? Number(m[1]) : 50          // 未显式给定即前端默认 50(INV 实测 50 行)
    const rows = Math.min(pageSize, 50)
    out.push({ p, cols, pageSize, rows, cells: rows * cols, gridTabs: tabs.length })
  }
  const ok = out.filter((x) => !x.err)
  console.log(`面板 ${out.length} 个,配置正常 ${ok.length},失败 ${out.filter((x) => x.err).length}`)
  console.log('自检(浏览器实测真值):')
  for (const [k, v] of Object.entries(TRUTH)) {
    const r = ok.find((x) => x.p === k)
    console.log(`  ${k.padEnd(14)} 配置列数=${r ? r.cols : '?'} 实测=${v} ${r && r.cols === v ? '✓ 路径正确' : '✗ 不一致'}`)
  }
  const withCols = ok.filter((x) => x.cols > 0)
  console.log(`能解析出可见列数的: ${withCols.length} 个(其余为文书面板/无列表列)`)
  console.log('\n=== 首屏单元格数最多 TOP 20(渲染重量代理指标)===') 
  for (const r of withCols.slice().sort((a, b) => b.cells - a.cells).slice(0, 20))
    console.log(`  ${r.p.padEnd(22)} 列${String(r.cols).padStart(3)} × ${r.pageSize || '?'}行/页 = ${String(r.cells).padStart(6)} 单元格 (${r.shape})`)
  const heavy = withCols.filter((x) => x.cells >= 1000)
  console.log(`\n首屏 ≥1000 单元格的面板: ${heavy.length} 个 -> ${heavy.map((x) => x.p).join(', ')}`)
  const veryHeavy = withCols.filter((x) => x.cells >= 2000)
  console.log(`首屏 ≥2000 单元格的面板: ${veryHeavy.length} 个`)
  console.log(`列数 ≥40 的宽表面板: ${withCols.filter((x) => x.cols >= 40).length} 个`)
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
