'use strict'
/**
 * _probe-four-level-progress.cjs — 四级项目进「项目进度查询」的端到端验证(只在**测试账套**跑)
 *
 * 需求:《产品开发系统需求汇总.xlsx》sheet「开发相关流程」—— 四级支走「测试流程 →
 *   简单开发/检测申请单(发起人)→ 任务分发 → 打样测试 → 结果输出」= 测试申请单 RD_DOM_TEST;
 *   用户口径:四级项目**要**进「项目进度查询」。
 *
 * 断言:
 *   ① 四级同步前,进度查询里没有该测试单对应的行
 *   ② 调「同步进度」后,rd_progress_detail 出现该行,且 **项目层级=四级**(区别于实施计划来的二/三级)
 *   ③ 该行的业务列按映射落位(项目名称/内容/项目负责),人工列(项目级/实施进度/测试员)仍为空
 *   ④ 幂等:再同步一次不产生重复行(更新而非插入)
 *
 * ⚠ 在测试库造一张测试申请单,跑完删行;进度明细里该行也一并删掉。正式库一行不动。
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

  const PROGRESS_HOST = sql(`SELECT TOP 1 [单据编号] FROM rd_progress WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY [单据编号] DESC;`)
  console.log(`进度查询宿主单: ${PROGRESS_HOST || '(无 —— 四级同步会直接跳过,本探针无意义)'}`)
  if (!PROGRESS_HOST) { console.log('⊘ SKIP:测试库没有 rd_progress 宿主单'); process.exit(2) }

  let docNo = ''
  try {
    const c = await call('RD_DOM_TEST', '新增', {})
    docNo = c?.data?.编号
    if (!docNo) throw new Error('造测试申请单失败: ' + JSON.stringify(c).slice(0, 200))
    const s = await call('RD_DOM_TEST', '保存为草稿', {
      编号: docNo, 申请单类型: '内部委托',
      detail: { items: [{ 表区: '内部申请', 序号: 1, 申请人: 'admin', 发起人: 'admin',
        '测试（检测）内容': '四级探针:打样测试', '测试（检测）背景': '探针背景', 期望完成日期: '2026-10-15' }] },
    })
    console.log(`测试申请单: ${docNo}(保存为草稿 code=${s?.code})`)

    const before = sql(`SELECT COUNT(*) FROM rd_progress_detail WHERE [项目编号] = N'${docNo}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
    check('① 同步前进度查询里没有该测试单的行', before === '0', before)

    const sync = await call('RD_PROGRESS', '同步进度', {})
    console.log(`同步进度: code=${sync?.code} data=${JSON.stringify(sync?.data)}`)
    check('② 同步调用成功', sync?.code === 200 || sync?.code === 0, JSON.stringify(sync).slice(0, 200))
    console.log(`   返回里的四级计数: 四级新增行=${sync?.data?.四级新增行} 四级更新行=${sync?.data?.四级更新行}`)

    const row = sql(`SELECT ISNULL([项目层级],'-') + '|' + ISNULL([项目名称],'-') + '|' + ISNULL([内容],'-') + '|' + ISNULL([项目负责],'-')
                            + '|' + ISNULL([项目级],'') + '|' + ISNULL([实施进度],'') + '|' + ISNULL([测试员],'')
                     FROM rd_progress_detail WHERE [项目编号] = N'${docNo}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
    console.log(`进度行: 项目层级|项目名称|内容|项目负责|项目级|实施进度|测试员 = ${row}`)
    const p = row.split('|')
    check('② 该行已进进度查询', row.length > 0 && row !== '', row)
    check('② 项目层级 = 四级', p[0] === '四级', p[0])
    check('③ 项目名称按映射取到(非空)', (p[1] || '').length > 0 && p[1] !== '-', p[1])
    check('③ 内容按映射取到', (p[2] || '').includes('四级探针'), p[2])
    check('③ 项目负责 = 发起人', p[3] === 'admin', p[3])
    check('③ 人工列(项目级/实施进度/测试员)一律未碰', !p[4] && !p[5] && !p[6], `${p[4]}|${p[5]}|${p[6]}`)

    const cnt1 = sql(`SELECT COUNT(*) FROM rd_progress_detail WHERE [项目编号] = N'${docNo}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
    await call('RD_PROGRESS', '同步进度', {})
    const cnt2 = sql(`SELECT COUNT(*) FROM rd_progress_detail WHERE [项目编号] = N'${docNo}' AND ISNULL(asp_cancel,'N') <> 'Y';`)
    check('④ 幂等:再同步一次仍是 1 行(更新而非重复插入)', cnt1 === '1' && cnt2 === '1', `${cnt1} → ${cnt2}`)
  } finally {
    try {
      if (docNo) {
        sql(`DELETE FROM rd_progress_detail WHERE [项目编号] = N'${docNo}';
             DELETE FROM rd_dom_test_detail WHERE [单据编号] = N'${docNo}';
             DELETE FROM rd_dom_test_head   WHERE [单据编号] = N'${docNo}';
             DELETE FROM yj_doc_status      WHERE panel_code='RD_DOM_TEST' AND doc_no = N'${docNo}';
             DELETE FROM yj_form_approval   WHERE panel_code='RD_DOM_TEST' AND form_no = N'${docNo}';`)
        console.log(`\n已清理测试单与进度行 ${docNo}`)
      }
    } catch (e) { console.log('\n  ⚠ 清理失败: ' + e.message.split('\n')[0]) }
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
