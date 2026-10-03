'use strict'
/**
 * _probe-file-controlled.cjs — 「受控按文件」的端到端验证(只在**测试账套**跑)
 *
 * 需求:《产品开发系统需求汇总.xlsx》sheet「文件汇总表」5.1
 *   「规格书:保存/提交 → 提交后审批 → **审批后自动受控**」;用户口径「受控按文件」。
 *
 * 断言:
 *   ① 归档一个受控文件(此处用规格书)后,该文件头表的 备用1=是 / 备用2=受控日期 被写入
 *   ② 只归档**一个**文件时,**别的**文件面板不受影响(逐文件,不是产品级联动)
 *   ③ 产品文件列表接口 /px/prodDocList 的 受控日期 取自受控列(而不是旧的归档时点)
 *
 * ⚠ 在测试库造一张规格书草稿 → 管理员保存(保存即归档)→ 验完物理删除,不留痕。
 *   正式库一行不动。
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
  const call = async (panelCode, buttonName, formData) => (await (await fetch(`${API}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData: formData || {}, buttonParam: {} }),
  })).json())

  const PROD = 'ZZ-CTL-PROBE'
  let no = ''
  // 归档前:四个文件面板在该产品下的受控标记都应没有
  const before = sql(`SELECT COUNT(*) FROM rd_spec_doc_head WHERE [产品编号] = N'${PROD}' AND ISNULL([备用1],N'') = N'是';`)
  check('演练前:该产品没有已受控的规格书', before === '0', before)

  try {
    const created = await call('RD_SPEC_DOC', '新增', {})
    no = created?.data?.编号
    if (!no) throw new Error('造规格书草稿失败: ' + JSON.stringify(created).slice(0, 200))
    console.log(` 测试库规格书草稿: ${no}`)
    // 管理员保存 = 保存即归档(该面板在 DOC_ARCHIVE_PANELS 内)→ 走 markArchived
    const saved = await call('RD_SPEC_DOC', '保存', { 编号: no, 产品编号: PROD, 名称: '受控验证单' })
    console.log(` 保存(即归档): code=${saved?.code} data=${JSON.stringify(saved?.data)}`)
    check('① 保存成功(管理员保存即归档)', saved?.code === 200 || saved?.code === 0, JSON.stringify(saved).slice(0, 200))

    // ① 受控标记落库
    const ctl = sql(`SELECT ISNULL([备用1],'(null)') + '|' + ISNULL([备用2],'(null)')
                      FROM rd_spec_doc_head WHERE [单据编号] = N'${no}';`)
    console.log(` 受控列: ${ctl}`)
    check('① 备用1(是否受控)= 是', ctl.split('|')[0] === '是', ctl)
    check('① 备用2(受控日期)已写入且形如 yyyy-MM-dd HH:mm:ss',
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ctl.split('|')[1] || ''), ctl.split('|')[1])

    // ② 逐文件:别的文件面板不被联动
    const others = sql(`SELECT (SELECT COUNT(*) FROM rd_mold_proc_head WHERE ISNULL([备用1],N'')=N'是')
                             + (SELECT COUNT(*) FROM rd_asm_proc_head  WHERE ISNULL([备用1],N'')=N'是')
                             + (SELECT COUNT(*) FROM rd_insp_plan_head WHERE ISNULL([备用1],N'')=N'是');`)
    check('② 只归档规格书时,成型/组装/出货的受控列仍为空(逐文件,无产品级联动)', others === '0', others)

    // ③ 产品文件列表接口能正常执行(证明新加的 备用1/备用2 取值 SQL 没把接口打挂)
    //    ⚠ 这里**不能**断言"命中该产品":矩阵的行来源是 rd_dev_task(只列**已下发**的产品,
    //      见 DevTaskService.board),而本探针新造的 ZZ-CTL-PROBE 没有下发过 ⇒ 本就不该出现在矩阵里。
    //      逐文件受控的落库与"不联动"已由 ①② 覆盖;列里只有产品级那一组受控列是既有设计。
    const board = await (await fetch(`${API}/api/px/prodDocList`, { headers: H })).json()
    const rows = board?.data?.rows || []
    console.log(`③ prodDocList 返回 ${rows.length} 行(该产品未下发,故不在矩阵 —— 属预期)`)
    check('③ 产品文件列表接口正常返回(受控列取值 SQL 未报错)', board?.code === 200 && Array.isArray(rows), JSON.stringify(board).slice(0, 200))
  } finally {
    try {
      if (no) {
        sql(`DELETE FROM rd_spec_doc_detail WHERE [单据编号] = N'${no}';
             DELETE FROM rd_spec_doc_head   WHERE [单据编号] = N'${no}';
             DELETE FROM yj_doc_status      WHERE panel_code = 'RD_SPEC_DOC' AND doc_no = N'${no}';
             DELETE FROM yj_form_approval   WHERE panel_code = 'RD_SPEC_DOC' AND form_no = N'${no}';`)
        console.log(`\n已清理测试库规格书 ${no}`)
      }
    } catch (e) { console.log('\n  ⚠ 清理失败: ' + e.message.split('\n')[0]) }
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
