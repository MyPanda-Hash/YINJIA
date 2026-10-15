/**
 * 「规格书 → 成型工艺清单 检验要求区」映射的**真数据**验收(2026-10-16 用户报障)
 *
 * 用户原话(附两张截图):
 *   「这是规格书的数据,这是成型工艺清单的数据,数据没有对应导入下方表格,比如碳棒尺寸,压降,
 *     抗压强度,其他的未填写的估计也不会导入,要根据规格书的检验项目的名字来对成型工艺清单的
 *     数据进行一个填写,外径的 +-0.5 这个就是公差数据」。
 *
 * 病根(已定位):规格书那张纸的项目名是 `<组名>·<子项名>` 且带 `*`/`#` 装饰(实测 SD-2026-10-0010:
 *   `#*压降` / `*炭棒尺寸`(外径·内径·长度**每行一条**) / `强度·*抗压强度` / `强度·（裸棒）`),
 *   而配置写的是裸名 ⇒ 精确相等一个都没匹配上 ⇒ 三块全空。
 *
 * 本探针不去猜:直接打**活体接口**取真 payload,再用**真配置 + 真纯函数**跑一遍映射,把每格的值打出来。
 *   node spec-mold-mapping.cjs [产品编号]        # 默认 CB-YL-001(测试账套里那份规格书的产品)
 */
const path = require('node:path')

const CODE = process.argv[2] || 'CB-YL-001'
const API = 'http://127.0.0.1:8090/api'
const FE = path.resolve(__dirname, '../../../frontend/src/core')
let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + String(detail).slice(0, 400)}`)
  if (!ok) fails++
}

async function main() {
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const lj = await lr.json()
  const tok = lj?.data?.token
  if (!tok) throw new Error('登录失败(测试账套)')
  const res = await fetch(`${API}/px/specByProductForMold?code=${encodeURIComponent(CODE)}`, {
    headers: { Authorization: 'Bearer ' + tok },
  })
  const body = await res.json()
  const payload = body?.data ?? body
  console.log(`[接口] ${res.status} found=${payload?.found} 规格书=${payload?.单据编号 ?? '-'} 状态=${payload?.单据状态 ?? '-'} 行数=${(payload?.items || []).length}`)

  const { recordSheetConfigs } = await import('file://' + path.join(FE, 'views/recordSheetConfigs.js').replace(/\\/g, '/'))
  const { headFromSpecDetail, detailRowsOf } = await import('file://' + path.join(FE, 'insp/specCarry.js').replace(/\\/g, '/'))
  const afs = recordSheetConfigs?.RD_MOLD_PROC?.autoFillSpec
  chk('取到成型工艺清单的 autoFillSpec', !!afs?.headFromDetail)

  const items = Array.isArray(payload?.items) ? payload.items : []
  const out = headFromSpecDetail(afs, items)
  console.log('[映射结果]', JSON.stringify(out, null, 1))

  // 期望值来自规格书原文(实测):外径34.5±0.5 / 内径12.5±0.5 / ≥30kgf / ≤20kpa / 高度60cm 跌落3次
  // 2026-10-16 续:测试参数取自**检验方法**(间距40mm / 下压速度5mm/min / 测试流速0.9L/min)
  const expect = {
    外径mm: '34.5', 外径公差: '±0.5', 内径mm: '12.5', 内径公差: '±0.5',
    强度要求kgf: '≥30kgf', 压降标准kpa: '≤20kpa', 跌落高度cm: '60', 跌落次数: '3',
    测试间距mm: '40', 压头下降速度: '5', 压降测试流速: '0.9',
  }
  for (const [k, v] of Object.entries(expect)) {
    chk(`检验要求区 · ${k} = ${v}`, out[k] === v, out[k] === undefined ? '(该键没出现)' : out[k])
  }
  chk('跌落要求 = 规格书原句', String(out['跌落要求'] || '').includes('垂直跌落3次') && String(out['跌落要求'] || '').includes('高度60cm'), out['跌落要求'])

  // 出货检验计划表那条链:序号兜底(规格书明细的 序号 不落库)——
  // 口径 = **组号**(同一个检验项目同号,与规格书那张纸一致)
  const planAfs = recordSheetConfigs?.RD_INSP_PLAN?.autoFillSpec
  const planRows = detailRowsOf(planAfs, items)
  const gkey = (s) => String(s ?? '').replace(/\s+/g, '').replace(/[*#＊＃]/g, '').split('·')[0]
  console.log('[出货检验计划表 明细]', JSON.stringify(planRows.map((r) => ({ 序号: r['序号'], 项目: r['控制项目'] }))))
  const byGroup = new Map()
  let grouped = true
  for (let i = 0; i < planRows.length; i++) {
    const g = gkey(items[i]?.['检验项目'])
    if (!byGroup.has(g)) byGroup.set(g, planRows[i]['序号'])
    else if (byGroup.get(g) !== planRows[i]['序号']) grouped = false
  }
  const nums = planRows.map((r) => r['序号'])
  chk('出货检验计划表 · 序号不再是空白', nums.length > 0 && nums.every((n) => String(n).trim() !== ''), nums.join(','))
  chk('出货检验计划表 · 同一个检验项目的行同号(规格书同一口径)', grouped, JSON.stringify([...byGroup.entries()].map(([g, n]) => `${g}=${n}`)))
  chk('出货检验计划表 · 组号按首次出现次序 1..G', new Set(nums).size === byGroup.size && [...new Set(nums)].every((n, i) => Number(n) === i + 1), nums.join(','))
  chk('出货检验计划表 · 控制项目/要求/方法 照搬规格书', planRows[0]?.['控制项目'] === (items[0]?.['检验项目'] ?? ''), JSON.stringify(planRows[0]))

  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
