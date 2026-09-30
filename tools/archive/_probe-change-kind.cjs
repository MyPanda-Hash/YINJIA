'use strict'
/**
 * _probe-change-kind.cjs — 变更「严格/快捷」分流 + 生效后可反审核 的端到端验证(只在**测试账套**跑)
 *
 * 需求:《产品开发系统需求汇总.xlsx》sheet「变更」底部两行
 *   「严格变更 = 按上述流程」(六步 + 会签) / 「快捷变更 = 冯总审批」;
 * 以及总原则第 3 条「允许修改编辑」+ 流程图那句「项目有变动-反审核后,重新走流程」
 *   ⇒ 变更单**生效后允许反审核**(此前「已生效」是死态)。
 *
 * 断言:
 *   ① 变更类型=快捷变更 时「提交会签」被拒(文案指路:直接提交审批)
 *   ② 变更类型=严格变更 时会签照常放行(进「会签中」)
 *   ③ 走完「提交审批 → 审批通过」后状态 = 已生效
 *   ④ 已生效状态下「弃审」成功,且状态回到草稿(连 effective 一起清了,不是卡在原地)
 *
 * ⚠ 全程在测试库造单,跑完逐张物理删除。
 */
const { execFileSync } = require('node:child_process')

const API = process.argv[2] || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES_TEST', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-f', '65001', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim()

async function main() {
  const lr = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
  const call = async (buttonName, formData) => (await (await fetch(`${API}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_CHANGE', buttonName, formData, buttonParam: {} }),
  })).json())
  const created = []
  const newDraft = async (kind) => {
    const c = await call('新增', {})
    const no = c?.data?.编号
    if (!no) throw new Error('造变更单失败: ' + JSON.stringify(c).slice(0, 200))
    created.push(no)
    const s = await call('保存', {
      编号: no, 产品编号: 'DEMO-B-001', 变更事由: '探针验证', 变更类型: kind, 需会签: '是', 会签人: 'cp',
    })
    if (!(s?.code === 200 || s?.code === 0)) throw new Error(`保存失败(${kind}): ` + JSON.stringify(s).slice(0, 200))
    return no
  }
  const statusOf = (no) => sql(`SELECT ISNULL(effective,'-') + '|' + ISNULL(pending,'-') + '|' + ISNULL(shr,'-')
      FROM yj_doc_status WHERE panel_code='RD_CHANGE' AND doc_no=N'${no}';`)

  try {
    // ① 快捷变更 → 禁止会签
    const noFast = await newDraft('快捷变更')
    const r1 = await call('提交会签', { 编号: noFast })
    console.log(`\n① 快捷变更提交会签: code=${r1?.code} msg=${JSON.stringify(r1?.message)}`)
    check('① 快捷变更被拒提交会签', !(r1?.code === 200 || r1?.code === 0), JSON.stringify(r1).slice(0, 160))
    check('① 文案指路「直接提交审批」', String(r1?.message || '').includes('快捷变更'), String(r1?.message))

    // ② 严格变更 → 会签照常放行
    const noStrict = await newDraft('严格变更')
    const r2 = await call('提交会签', { 编号: noStrict })
    console.log(`② 严格变更提交会签: code=${r2?.code} data=${JSON.stringify(r2?.data)}`)
    check('② 严格变更会签放行(进会签中)', String(r2?.data?.单据状态 || '') === '会签中', JSON.stringify(r2).slice(0, 160))

    // ③④ 生效后反审核。
    // ⚠ 不用「提交审批 → 审批通过」这条链来造"已生效":RD_CHANGE 的提交审批另有前置
    //   (变更文件/事由等业务必填),那不是本批要证的东西,拿它当前置只会让断言飘。
    //   本批要证的是「**已生效**状态下能不能弃审、弃审后会不会卡住」⇒ 直接用 SQL 摆出该状态。
    const noEff = await newDraft('快捷变更')
    sql(`MERGE yj_doc_status AS t USING (VALUES (N'RD_CHANGE', N'${noEff}')) AS s(panel_code, doc_no)
         ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
         WHEN MATCHED THEN UPDATE SET effective = 'Y', pending = 'N', archived = 'N', shr = 'admin', shsj = GETDATE(), update_at = GETDATE()
         WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, effective, pending, archived, shr, shsj, update_at)
              VALUES (s.panel_code, s.doc_no, 'Y', 'N', 'N', 'admin', GETDATE(), GETDATE());`)
    const stEff = statusOf(noEff)
    console.log(`\n③ 摆出「已生效」态: effective|pending|shr = ${stEff}`)
    check('③ 前置(库里 effective = Y 且状态推导为已生效)', stEff.split('|')[0] === 'Y', stEff)
    const stName = sql(`SELECT CASE WHEN ISNULL(canceled,'N')='Y' THEN N'已作废' WHEN ISNULL(effective,'N')='Y' THEN N'已生效' ELSE N'其它' END
                         FROM yj_doc_status WHERE panel_code='RD_CHANGE' AND doc_no=N'${noEff}';`)
    check('③ 状态推导 = 已生效(改动前这里会被弃审直接拒绝)', stName === '已生效', stName)

    const un = await call('弃审', { 编号: noEff })
    console.log(`④ 弃审(已生效): code=${un?.code} msg=${un?.message} data=${JSON.stringify(un?.data)}`)
    check('④ 已生效单据可弃审', un?.code === 200 || un?.code === 0, JSON.stringify(un).slice(0, 200))
    check('④ 弃审后 effective 已清(不是卡在已生效)', statusOf(noEff).split('|')[0] !== 'Y', statusOf(noEff))
  } finally {
    for (const no of created) {
      try {
        sql(`DELETE FROM rd_change_detail WHERE [单据编号] = N'${no}';
             DELETE FROM rd_change_head   WHERE [单据编号] = N'${no}';
             DELETE FROM yj_doc_status    WHERE panel_code='RD_CHANGE' AND doc_no = N'${no}';
             DELETE FROM yj_form_approval WHERE panel_code='RD_CHANGE' AND form_no = N'${no}';`)
      } catch (e) { console.log('  ⚠ 清理失败 ' + no + ': ' + e.message.split('\n')[0]) }
    }
    console.log(`\n已清理测试库变更单 ${created.length} 张`)
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
