/**
 * _probe-prodinfo-layout.cjs — 产品信息表版式自检(不依赖浏览器)
 *
 * 校验用户提的「所有行都对齐长度」是否真的成立:
 *   渲染器(td v-for pair)每对 = 标签 td(lspan,缺省 1) + 值 td(vspan,缺省 1)
 *   pair.cells 时:各 cell 的 colspan = 1(最后一个 = vspan)
 * ⇒ 每行的列数和必须都等于网格列数(4)。
 * 列和不等于 4 的行,纸面会出现宽度参差(本次修的就是这个)。
 *
 * 用法:node tools/archive/_probe-prodinfo-layout.cjs
 */
'use strict'
const path = require('node:path')

async function main() {
  const mod = await import('file://' + path.join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views', 'recordSheetConfigs.js').replace(/\\/g, '/'))
  const cfg = mod.recordSheetConfigs.RD_PROD_INFO
  const nCols = (cfg.grid || []).length
  console.log(`网格 = [${cfg.grid.join(', ')}] ⇒ ${nCols} 列;标题/信息块跨度 head = ${JSON.stringify(cfg.head)}`)

  let pass = 0, fail = 0
  const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

  console.log('\n① 报告头信息块行序(编辑人在上、日期在下)')
  const infoLabels = (cfg.info || []).map((i) => i.label)
  console.log('   info =', infoLabels.join(' → '))
  check('编辑人在单据日期之前', infoLabels[0] === '编辑人' && infoLabels[1] === '单据日期', infoLabels.join(','))

  console.log('\n② 每行列数和 = 网格列数(对齐长度)')
  for (const sec of cfg.sections || []) {
    console.log(`  【${sec.bar}】`)
    for (const [ri, row] of (sec.rows || []).entries()) {
      let span = 0
      const parts = []
      for (const p of row.pairs || []) {
        const l = p.lspan || 1
        let v
        if (p.cells) v = p.vspan || 1   // 最后一个 cell 吃 vspan,其余各 1
        else v = p.vspan || 1
        span += l + v
        parts.push(`${p.label}[${l}+${v}${p.cells ? ' ×' + p.cells.length + '格' : ''}]`)
      }
      check(`第 ${ri + 1} 行 列和=${span}`, span === nCols, parts.join(' '))
    }
  }

  console.log('\n③ 炭棒尺寸三格(内径/外径/长度 + 提示词)')
  const rodRow = (cfg.sections || []).flatMap((s) => s.rows || []).find((r) => (r.pairs || []).some((p) => p.label === '炭棒尺寸'))
  const rod = rodRow && rodRow.pairs.find((p) => p.label === '炭棒尺寸')
  console.log('   ', JSON.stringify(rod))
  check('炭棒尺寸为 3 格', !!rod && Array.isArray(rod.cells) && rod.cells.length === 3)
  const wantKeys = ['炭棒内径', '炭棒外径', '炭棒长度']
  const wantPh = ['内径(mm)', '外径(mm)', '长度(mm)']
  check('三格顺序 = 内径*外径*长度(照设计原文)',
    !!rod && JSON.stringify(rod.cells.map((c) => c.key)) === JSON.stringify(wantKeys),
    rod ? JSON.stringify(rod.cells.map((c) => c.key)) : '')
  check('三格都有 placeholder 提示词(不是空数组)',
    !!rod && rod.cells.every((c, i) => c.ph === wantPh[i]),
    rod ? JSON.stringify(rod.cells.map((c) => c.ph)) : '')

  console.log('\n④ 两级审批人各占一行')
  const labels = (cfg.sections || []).flatMap((s) => s.rows || []).flatMap((r) => (r.pairs || []).map((p) => p.label))
  check('有 审核人（一级审批人）', labels.includes('审核人（一级审批人）'))
  check('有 审核人（二级审批人）', labels.includes('审核人（二级审批人）'))
  const sameRow = (cfg.sections || []).flatMap((s) => s.rows || [])
    .some((r) => (r.pairs || []).some((p) => p.label === '审核人（一级审批人）')
      && (r.pairs || []).some((p) => p.label === '审核人（二级审批人）'))
  check('两级审批人**不在同一行**', !sameRow)

  console.log('\n⑤ 产品功能类别 为下拉(select),不再手填')
  const fn = (cfg.sections || []).flatMap((s) => s.rows || []).flatMap((r) => r.pairs || []).find((p) => p.label === '产品功能类别')
  console.log('   ', JSON.stringify(fn))
  check('产品功能类别 type=select', !!fn && fn.type === 'select', fn ? String(fn.type) : '')

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('自检异常:', e.message); process.exit(1) })
