'use strict'
/**
 * _probe-inv-cost-recalc.cjs — 触发「重算成本」按钮并核对成本物化表(库存三表结构 · 任务 4 的验收探针)。
 *
 * 为什么需要它:v_stock_movement 改读流水表(inh/outh)后,**成本重算**是最容易被漏掉的调用方 ——
 * InvCostService 的递归 SQL 直接 `INSERT INTO inv_cost_ledger (src, rid, ...)` 读视图的 src/rid,
 * 而 inv_cost_ledger.rid 是 `int NOT NULL` + PK(src,rid),期初行(src=0)在流水表里 rid 为 NULL。
 * 只跑 SQL 探针不算数:必须走**应用真正的那条路**(面板按钮 → ButtonService.recalcInvCost →
 * InvCostService.recalcAll),才能证明"改完视图后成本还能灌出来"。
 *
 * 用法: node tools/archive/_probe-inv-cost-recalc.cjs [http://127.0.0.1:8090]
 */
const { execFileSync } = require('node:child_process')

const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const LEDGERS = [{ factory: 'YJ', db: 'HSDZ_MES' }, { factory: 'YJ_TEST', db: 'HSDZ_MES_TEST' }]
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

// -I:QUOTED_IDENTIFIER ON —— inh/outh 上有过滤索引,DML 在 OFF 下报 1934。
// 只用 -W -s -h -1(与 _probe-stock-flow.cjs 同款,已跑通);长文本/列清单才需要 JDBC。
const sql = (db, q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', db, '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-I', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()
const num = (db, q) => Number(sql(db, q) || 0)

async function main() {
  for (const { factory, db } of LEDGERS) {
    console.log(`\n===== 账套 ${db}(登录工厂 ${factory})=====`)
    const lr = await (await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
    })).json()
    const token = lr?.data?.token
    if (!token) { check(`${db} 登录`, false, JSON.stringify(lr).slice(0, 160)); continue }
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }

    // 重算前状态
    const before = { mv: num(db, 'SELECT COUNT(*) FROM v_stock_movement;'), cost: num(db, 'SELECT COUNT(*) FROM inv_cost_ledger;') }
    console.log(`  重算前: 视图 ${before.mv} 行 / 成本表 ${before.cost} 行`)

    const res = await (await fetch(`${API}/px/callButton`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: 'STOCK_LEDGER', buttonName: '重算成本', formData: {}, buttonParam: {} }),
    })).json()
    console.log(`  callButton 返回: ${JSON.stringify(res).slice(0, 200)}`)
    check(`${db} 「重算成本」按钮调用成功(code=200 且有 重算行数)`,
      res?.code === 200 && res?.data && res.data['重算行数'] !== undefined, JSON.stringify(res).slice(0, 200))

    // 重算后核对
    const mv = num(db, 'SELECT COUNT(*) FROM v_stock_movement;')
    const cost = num(db, 'SELECT COUNT(*) FROM inv_cost_ledger;')
    const noCost = num(db, 'SELECT COUNT(*) FROM v_stock_movement m LEFT JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid WHERE c.src IS NULL;')
    const dup = num(db, 'SELECT COUNT(*) FROM (SELECT src, rid FROM inv_cost_ledger GROUP BY src, rid HAVING COUNT(*) > 1) t;')
    const nulRid = num(db, 'SELECT COUNT(*) FROM v_stock_movement WHERE rid IS NULL;')
    const sums = sql(db, "SELECT CAST(ISNULL(SUM(收入金额),0) AS decimal(18,4)) AS 视图收入金额, CAST((SELECT ISNULL(SUM(收入金额),0) FROM inv_cost_ledger) AS decimal(18,4)) AS 成本表收入金额, CAST((SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS decimal(18,4)) AS kucun余量合计, CAST((SELECT ISNULL(SUM(结存数量),0) FROM inv_cost_ledger) AS decimal(18,4)) AS 成本表结存数量 FROM v_stock_movement;")
    console.log(`  重算后: 视图 ${mv} 行 / 成本表 ${cost} 行;无成本行的流水 ${noCost};重复 (src,rid) ${dup};rid 为空 ${nulRid}`)
    console.log(`  合计(视图收入金额 | 成本表收入金额 | kucun余量 | 成本表结存数量): ${sums.replace(/\t/g, ' | ')}`)

    check(`${db} 成本表行数 == 视图行数(${cost} == ${mv})`, cost === mv && mv > 0)
    check(`${db} 无成本行的流水为 0`, noCost === 0, String(noCost))
    check(`${db} 成本表 (src,rid) 无重复`, dup === 0, String(dup))
    check(`${db} 视图 rid 全非空(期初合成键生效)`, nulRid === 0, String(nulRid))
    const f = sums.split('\t')
    check(`${db} 成本表结存数量合计 == kucun 余量合计(${f[3]} == ${f[2]})`, f[3] === f[2])
    check(`${db} 成本表收入金额合计 == 视图收入金额合计(${f[1]} == ${f[0]})`, f[1] === f[0])
  }
  console.log(`\n汇总: PASS ${pass} / FAIL ${fail}`)
  process.exit(fail ? 1 : 0)
}
main().catch(e => { console.error('探针异常:', e); process.exit(1) })
