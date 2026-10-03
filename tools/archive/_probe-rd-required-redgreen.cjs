'use strict'
/**
 * _probe-rd-required-redgreen.cjs — 「产品名称不能为空」的红-绿对照(只在**测试账套** HSDZ_MES_TEST 上跑)
 *
 * 为什么要有这个探针:光看到"保存成功了"不能证明**就是这一处改动**修的 ——
 * 必须先在失败态亲眼看到失败(信息符合预期、因功能缺失而失败),再切到修复态看到通过。
 *
 *   红 :把 yj_field.RD_PROD_INFO.产品名称 的 required 改回 1 → 保存一张**没填产品名称**的单 → 期望报「产品名称不能为空」
 *   绿 :required=0(迁移脚本的结果) → 同样的请求 → 期望保存成功
 *
 * 口径:
 *   · 走**测试账套**(登录 factory=YJ_TEST),正式库一行不动 —— 单据在测试库造、造完删干净;
 *   · 后端 ensureRequiredFilled 是"绕过界面也拦得住"的那一层,API 直连即可复现用户的报错；
 *   · 前端那一层由 _probe-rd-quad-verify.cjs 的 getPanelConfig 断言覆盖(isRequired=false)。
 *   · ⚠ PanelRegistry 有 30s TTL 快照 ⇒ 每次改库后必须等 >30s 再打接口,否则量到的是旧快照。
 *
 * 用法:node tools/archive/_probe-rd-required-redgreen.cjs [http://127.0.0.1:8090]
 */
const { execFileSync } = require('node:child_process')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DB = 'HSDZ_MES_TEST'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

function sql(q) {
  return execFileSync('sqlcmd', ['-S', 'localhost', '-d', DB, '-U', 'yinjia', '-P', 'Yinjia@2026',
    '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()
}
const setRequired = (v) => sql(
  `UPDATE yj_field SET required = ${v} WHERE panel_code='RD_PROD_INFO' AND col_name=N'产品名称';`)

async function main() {
  console.log(`目标实例 ${BASE} / 账套 ${DB}(测试库)\n`)
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败: ' + JSON.stringify(lr).slice(0, 300))
  console.log('  登录工厂 = ' + (lr.data?.user?.factory || '(未回传)'))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
  const call = async (buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName, formData, buttonParam: {} }),
  })).json())

  /** 造一张草稿单 → 不带产品名称去「保存」→ 返回提示语 与 该单是否真落库 */
  async function trySaveWithoutProductName(tag) {
    const created = await call('新增', {})
    const no = created?.data?.编号 || created?.data?.单据编号
    if (!no) throw new Error(`[${tag}] 新增未返回单号: ` + JSON.stringify(created).slice(0, 300))
    const res = await call('保存', { 编号: no, 产品编号: 'ZZ-VERIFY-REQ', 客户项目名称: tag })
    const msg = res?.message || res?.msg || ''
    const ok = res?.code === 0 || res?.code === 200 || res?.success === true
    return { no, ok, code: res?.code, msg }
  }
  const cleanup = async (no) => {
    // 「删除」对已归档的文件类面板走的是 deleteDocFile(发起删除申请),不会真删 ——
    // 测试库是快照副本、可随便折腾,故再补一刀物理删除,保证探针不留痕。
    try { await call('删除', { 编号: no }) } catch {}
    try {
      sql(`DELETE FROM rd_prod_info_detail WHERE [单据编号]=N'${no}';
           DELETE FROM rd_prod_info_head   WHERE [单据编号]=N'${no}';
           DELETE FROM yj_doc_status       WHERE panel_code='RD_PROD_INFO' AND doc_no=N'${no}';
           DELETE FROM yj_doc_modify_log   WHERE doc_no=N'${no}';
           DELETE FROM yj_archive_change_log WHERE doc_no=N'${no}';`)
    } catch (e) { console.log('  ⚠ 物理清理失败: ' + e.message.split('\n')[0]) }
  }

  // ═══ 红:required=1(修复前的状态) ═══
  console.log('\n【红】把 产品名称.required 改回 1(修复前),等注册表快照过期…')
  setRequired(1)
  await sleep(32000)
  const red = await trySaveWithoutProductName('红-复现')
  console.log(`  保存返回 code=${red.code} msg=${JSON.stringify(red.msg)}`)
  check('红:保存被拒(ok=false)', !red.ok, JSON.stringify(red))
  check('红:提示语 = 「产品名称不能为空」', String(red.msg).includes('产品名称不能为空'), '实际: ' + red.msg)
  await cleanup(red.no)

  // ═══ 绿:required=0(迁移脚本的结果) ═══
  console.log('\n【绿】改回 0(迁移脚本的目标态),等注册表快照过期…')
  setRequired(0)
  await sleep(32000)
  const green = await trySaveWithoutProductName('绿-验证')
  console.log(`  保存返回 code=${green.code} msg=${JSON.stringify(green.msg)}`)
  check('绿:保存成功', green.ok, JSON.stringify(green))
  check('绿:提示语不再含「产品名称不能为空」', !String(green.msg).includes('产品名称不能为空'), '实际: ' + green.msg)

  // 落库复核:该单 产品名称 为空仍保存成功 = 纸面没这一格也不影响保存
  const row = sql(`SELECT TOP 1 ISNULL([产品名称],N'<NULL>') FROM rd_prod_info_head WHERE [单据编号]=N'${green.no}';`)
  check('绿:该单已落库且 产品名称 为空', row === '<NULL>' || row === '', '实际列值: ' + JSON.stringify(row))
  await cleanup(green.no)

  // 收尾:确认测试库停在迁移脚本的目标态;并清掉探针造的两张单
  // ⚠ 用 COUNT 判定:同一字段在 yj_field 里有 header/query **两条**记录,
  //    直查 required 会返回两行(首次跑就因此误判成"没停在 0")。
  const badReq = sql(`SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'产品名称' AND required <> 0;`)
  check('测试库 产品名称 的每条记录都停在 required=0', badReq === '0', '仍为必填的记录数: ' + badReq)
  const left = sql(`SELECT COUNT(*) FROM rd_prod_info_head WHERE ISNULL([客户项目名称],N'') LIKE N'%复现%' OR ISNULL([客户项目名称],N'') LIKE N'%验证%';`)
  check('探针造的两张单已清理(残留 0)', left === '0', '残留: ' + left)

  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
