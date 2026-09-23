/**
 * _chk-asm-proc-lib.cjs — 校验库里的 asm.proc(组装工艺 4 变体)与设计文件一致
 *
 * 【为什么走后端 API 而不是 sqlcmd】
 *   sqlcmd 的**输出**编码跟控制台代码页(本机 GBK),中文 item_code 打出来是乱码,
 *   据此判断"库里到底有哪几个变体"会得出错误结论(实测)。改成读 /api/stdlib/list:
 *   后端用 JDBC 取 NVARCHAR,JSON 原样返回 UTF-8,不经过控制台,所见即库中所存。
 *
 * 【为什么必须校验"恰好 4 条"】
 *   2026-09-20 实测踩坑:migrate-asm-proc-lib.sql 是 UTF-8,若 sqlcmd 漏掉 `-f 65001`,
 *   文件里的 N'裸棒' 会被按 GBK 读成乱码字面量 ⇒ 脚本里的 IF EXISTS 匹配不上已有行
 *   ⇒ INSERT 出**乱码孪生条目**(item_code 乱码、content 双重编码、json 解析失败)。
 *   这些乱码变体会被「从标准库勾选」原样列出来让用户选。故条目数是硬断言。
 *
 * 【为什么校验 检查比例 里没有 0.03/0.1】
 *   设计《关键控制清单--标准库.xlsx》有 7 格 检查比例 是**百分数格式的数字**
 *   (Excel 存 0.03、显示 3%)。生成器必须取显示值 w,取原始值 v 就会把「3%」写成「0.03」。
 *   这里直接断言库内容不含这两个原始值字面量。
 *
 * 用法:node tools/archive/_chk-asm-proc-lib.cjs   (需后端在 8090)
 */
'use strict'

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const USER = process.env.YINJIA_USER || 'admin'
const PASS = process.env.YINJIA_PASS || '123456'

/** 期望:变体名 → 工序行数(取自设计 4 个 sheet 展开合并单元格后的行数) */
const EXPECT = [
  ['裸棒', 10, 4],
  ['机器包布', 20, 6],
  ['复合半成品', 30, 9],
  ['成品', 40, 18],
]
/** 四列的键必须等于 yj_field.label,否则勾选后落不进明细表 */
const KEYS = ['工序', '工序控制内容', '管控要求', '检查比例']

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS }),
  })).json()
  if (!lr?.data?.token) throw new Error('登录失败:' + JSON.stringify(lr))
  const res = await (await fetch(`${BASE}/api/stdlib/list?lib=asm.proc&all=1`, {
    headers: { Authorization: `Bearer ${lr.data.token}` },
  })).json()
  if (res.code !== 200) throw new Error('stdlib/list 失败:' + JSON.stringify(res))
  const rows = res.data || []

  console.log('== asm.proc 标准库 ==')
  if (rows.length !== EXPECT.length) {
    bad(`条目数 = ${rows.length},期望 ${EXPECT.length}`
      + '(多出来的是乱码孪生条目:本迁移脚本被以错误代码页执行过,需手工删除)')
  } else ok(`恰好 ${EXPECT.length} 个变体,无乱码孪生条目`)

  const bySeq = [...rows].sort((a, b) => a.seq - b.seq)
  EXPECT.forEach(([name, seq, n], i) => {
    const r = rows.find((x) => x.item === name)
    if (!r) { bad(`缺变体「${name}」`); return }
    if (r.enabled !== 1) bad(`变体「${name}」被停用(enabled=${r.enabled})`)
    let j
    try {
      j = JSON.parse(r.content)
    } catch (e) {
      bad(`变体「${name}」content 不是合法 JSON(双重编码?):${e.message}`)
      return
    }
    const rs = j.rows || []
    if (rs.length !== n) bad(`变体「${name}」工序行数 = ${rs.length},期望 ${n}`)
    else ok(`变体「${name}」${n} 道工序`)
    const got = Object.keys(rs[0] || {})
    if (KEYS.some((k) => !got.includes(k))) bad(`变体「${name}」行键 = ${JSON.stringify(got)},缺 ${KEYS}`)
  })
  const seqs = bySeq.map((r) => r.seq)
  if (JSON.stringify(seqs) === JSON.stringify(EXPECT.map((e) => e[1]))) ok('seq 顺序 = 设计 sheet 顺序(裸棒→机器包布→复合半成品→成品)')
  else bad(`seq 顺序 = ${JSON.stringify(seqs)},期望 ${JSON.stringify(EXPECT.map((e) => e[1]))}`)

  const raw = JSON.stringify(rows)
  for (const t of ['"0.03"', '"0.1"']) {
    if (raw.includes(t)) bad(`content 里还有原始百分数值 ${t} —— 生成器取错了单元格(v 而非显示值 w)`)
    else ok(`content 无原始百分数值 ${t}(3%/10% 按设计显示值落库)`)
  }
  const empty = rows.flatMap((r) => JSON.parse(r.content).rows).filter((x) => !x['检查比例']).length
  if (empty) bad(`${empty} 道工序的 检查比例 为空(生成器表头列定位错了?)`)
  else ok('无空 检查比例')

  console.log(failed ? `\n== ${failed} 项 FAIL ==` : '\n== ALL PASSED ==')
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
