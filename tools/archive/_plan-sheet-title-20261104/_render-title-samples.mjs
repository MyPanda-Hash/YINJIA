/**
 * 排单计划纸表「标题/车间列头随工序产线变」渲染取证(一次性探针,2026-11-04)。
 *
 * 用户 2026-11-04 报障(截图红框圈住纸表标题):
 *   「当前在不同的工序产线显示的这个工序名称也要不同」
 *   —— 打印切炭线/组装线的排单计划时,标题也写「成型车间排单计划」、列头也写「成型车间/成型交期」。
 *
 * 做法:直接调纯函数 `schedPlanSheetHtml()`(与出纸同一份实现)把 5 种场景生成 HTML 落到
 *   `D:\workspace\yinjia\.tmp\plan-sheet\`(临时目录,不入库),并把「标题 / 表头」打出来做人工核对;
 *   真正断言在 `frontend/src/business/print-formats.test.js`(node 单测)。
 *
 * 为什么不在沙箱里截图:本机 agent 会话无法启动 headless 浏览器(Edge 报 OpenProcess 拒绝访问),
 *   且 `npm run build` 因 esbuild spawn EPERM 跑不了 —— 需要看纸面效果请在宿主侧:
 *   5173 打开工单排产 → 选「切炭(自动)」产线 → 勾选行 → 点「排单计划」,浏览器打印预览即为最终纸面。
 *
 * 用法(仓库根):node tools\archive\_plan-sheet-title-20261104\_render-title-samples.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('D:/workspace/yinjia/.tmp/plan-sheet')
fs.mkdirSync(OUT, { recursive: true })

// --- 最小 DOM stub(与 print-formats.test.js 同款;node 里 import 该模块需要) ---
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), id: '', innerHTML: '', textContent: '', style: {}, children: [],
    appendChild(c) { this.children.push(c); if (c && c.id === 'yj-print-host') globalThis.__captured = c.innerHTML; return c },
    remove() { /* noop */ },
  }
}
globalThis.document = { title: '', head: makeEl('head'), body: makeEl('body'), createElement: makeEl, getElementById: () => null, addEventListener() {}, removeEventListener() {} }
globalThis.window = { addEventListener() {}, removeEventListener() {}, print() {} }
globalThis.requestAnimationFrame = (cb) => { cb(); return 1 }
globalThis.alert = () => {}

const modUrl = new URL('../../../frontend/src/business/print-formats.js', import.meta.url).href
const { schedPlanSheetHtml } = await import(modUrl)

const row = (op, line) => ({
  客户等级: 'A', 客户: '深圳鼎泰福精密工业有限公司', 加工单号: 'GD-2026-11-0008', 工单行号: 1, 公司代码: '0',
  物料编码: 'C-58-15', 规格型号: '34*12*162', 生产线: line, 当前工序: op,
  未交量: 5000, 排产数量: 5000, 当前工序完工量: 0,
  交期: '2026-11-19', 交期紧迫度: 15, '7天已排': 5000, '15天已排': 5000, '大于15天已排': 0,
  日计划: { '2026-11-04': 2000, '2026-11-05': 1000, '2026-11-06': 2000 },
})
const dates = ['2026-11-04', '2026-11-05', '2026-11-06']

const cases = [
  ['cutting', '切炭线(截图场景)', [row('切炭', '切炭(自动)')], {}],
  ['molding', '成型线', [row('成型', '1号机')], {}],
  ['assembly', '组装线', [row('组装', '组装(自动)')], {}],
  ['mixed', '未选线混打多工序', [row('成型', '1号机'), row('切炭', '切炭(自动)')], {}],
  ['shop-override', '显式传 shop=成型(覆盖)', [row('切炭', '切炭(自动)')], { shop: '成型' }],
  ['suffix', '档案值自带「车间」后缀', [row('切炭', '切炭(自动)')], { shop: '切炭车间' }],
]

for (const [name, label, rows, opts] of cases) {
  const html = await schedPlanSheetHtml(rows, dates, { today: '2026-11-04', dates, ...opts })
  fs.writeFileSync(path.join(OUT, name + '.html'), html, 'utf8')
  const title = /<span class="t">([^<]+)<\/span>/.exec(html)?.[1]
  const heads = [...html.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]).slice(0, 12).join(' | ')
  console.log(`${label.padEnd(20)} title=${title}`)
  console.log(`${''.padEnd(20)} head =${heads}`)
}
console.log(`\n样例 HTML 已写入 ${OUT}(临时目录,勿入库)`)
