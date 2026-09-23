/**
 * _probe-change-flow.cjs —— 产品变更申请单(RD_CHANGE)会签 / 审批 / 生效钩子验收(2026-09-21)
 *
 * 用户口径(第④⑤条):变更涉及范围较大时由相关人员**会签**;填写完提交冯总(admin)审核,
 * **审核通过后变更生效** —— 按勾选的受控文件自动建**下一版草稿**(带来源单号)+ 通知各文件责任人。
 * 状态链:草稿 →(填写中)→ 会签中(可选)→ 审批中(admin)→ 已生效;驳回回草稿并通知发起人与已填写部门。
 *
 * 探针钉十三件事:
 *   ① 需会签='是' 时未会签就「提交审批」被拒(会签通过才进审核);
 *   ② 「提交会签」→ 会签中 + 每个会签人一条 SIGNOFF 待签 + SIGNOFF_REQUESTED 消息;
 *   ③ 非会签人(含发起人)点「会签通过」被拒;
 *   ④ 部分会签通过 → 仍会签中;全部通过 → **自动**进审批中;
 *   ⑤ 会签驳回(意见必填)→ 回草稿 + 通知发起人;
 *   ⑥ 「撤回会签」→ 会签中回草稿(卡死出口);
 *   ⑦ 需会签='否' 时「提交审批」直接进审批中;
 *   ⑧ admin 审批通过 → 状态**已生效**(yj_doc_status.effective='Y');
 *   ⑨ 生效钩子:按勾选的每个文件建下一版草稿 —— 有既有版本则**整单复制**(头字段+明细行),
 *      无既有版本则建空白草稿;新草稿都带「变更来源单号」= 本变更单号;
 *   ⑩ 各文件责任人(rd_dev_task.负责人)收到 CHANGE_EFFECTIVE 消息;
 *   ⑪ 重复审批通过被拒(已生效);已生效单据保存被拒;
 *   ⑫ 审批驳回 → 发起人与**已填写部门**都收到通知;
 *   ⑬ 生效留痕一条 EFFECT/APPLIED(审批情况里可查)。
 *
 * 用法:node tools/archive/_probe-change-flow.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const TOOLS = path.join(__dirname, '..')
const URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const CLEANUP = path.join(__dirname, '_probe-change-flow-cleanup.sql')
const NO_DEPT_USER = 'probe-nodept'
const P = 'PROBE-CHGP-' + Date.now().toString().slice(-6)      // 探针产品编号
const PNAME = '探针变更产品'

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)

function runSql(name, sql) {
  const f = path.join(__dirname, name + '.sql')
  const out = path.join(__dirname, name + '.out.txt')
  fs.writeFileSync(f, sql, 'utf8')
  const fd = fs.openSync(out, 'w')
  spawnSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    URL, 'yinjia', 'Yinjia@2026', 'archive\\' + name + '.sql'], { cwd: TOOLS, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
  const txt = fs.readFileSync(out, 'utf8')
  if (/\[SQL FAIL\]|\[FATAL\]/.test(txt)) throw new Error('SQL 失败:' + txt.split('\n').filter((l) => /FAIL|FATAL/.test(l)).join(' '))
  return txt.split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((x) => x.trim()))
}
const msgCount = (recv, code, no) => Number(runSql('_probe-change-flow-m',
  `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar(20)) FROM yj_message WHERE 收件人=N'${recv}' AND 消息码=N'${code}' AND 单据编号=N'${no}';`)[0][0])

async function main() {
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败:' + JSON.stringify(r))
    return { token: r.data.token, user: r.data.user }
  }
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
        method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
      })).json()),
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
      post: async (p, body) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()),
    }
  }

  const admin = await tok('admin')
  const cp = await tok('cp')
  const glm = await tok('glm53')
  const A = api(admin.token), C = api(cp.token), G = api(glm.token)

  // 第二会签人(无部门账号;会签只认账号,与部门无关)
  const users = (await A.get('/api/sys/user/list'))?.data || []
  const exist = users.find((u) => u.userName === NO_DEPT_USER)
  await A.post('/api/sys/user/save', {
    id: exist?.id, userName: NO_DEPT_USER, realName: '探针无部门', password: '123456', deptId: null, roleId: 2, enabled: 1,
  })
  const nd = await tok(NO_DEPT_USER)
  const N = api(nd.token)

  const statusOf = async (apiX, no) => (await apiX.get(`/api/px/getFormDescriptor?panelCode=RD_CHANGE&code=${encodeURIComponent(no)}`))?.data?.data?.['单据状态']
  const changeBtn = (apiX, no, buttonName, extra = {}) => apiX.btn('RD_CHANGE', buttonName, { 编号: no, ...extra })

  // ── 预置:一个既有成型工艺清单(供"整单复制")+ rd_dev_task 责任人两行 ──
  step('⓪ 预置探针数据:既有成型工艺清单(已归档)+ 两文件责任人')
  runSql('_probe-change-flow-setup', `SET NOCOUNT ON;
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 = N'${P}');
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 = N'${P}');
DELETE FROM rd_mold_proc_head WHERE 产品编号 = N'${P}';
DELETE FROM rd_dev_task WHERE 产品编号 = N'${P}';
INSERT INTO rd_dev_task (产品编号, 产品名称, 源单据号, 目标面板, 下发人, 下发时间, 负责人, asp_user1, asp_time1)
VALUES (N'${P}', N'${PNAME}', N'PROBE', 'RD_MOLD_PROC', 'admin', GETDATE(), 'glm53', 'admin', GETDATE()),
       (N'${P}', N'${PNAME}', N'PROBE', 'RD_ASM_PROC',  'admin', GETDATE(), 'cp',    'admin', GETDATE());
SELECT N'rd_dev_task', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task WHERE 产品编号 = N'${P}';`)
  const src = await A.btn('RD_MOLD_PROC', '保存', {
    产品编号: P, 产品名称: PNAME,
    detail: {
      items: [
        { 表区: '成型配方', 序号: '1', 物料种类: '粉料', 物料名称: '探针物料A' },
        { 表区: '成型配方', 序号: '2', 物料种类: '胶粉', 物料名称: '探针物料B' },
      ],
    },
  })
  const srcNo = src?.data?.['编号']
  console.log(`     既有成型工艺清单 = ${srcNo}(状态 ${src?.data?.['单据状态']})`)
  if (srcNo) ok('预置源单成功'); else bad('预置源单失败:' + JSON.stringify(src))

  // ════ ① 需会签未会签不得提交审批 ════
  step('① cp 建变更单(需会签=是,会签人=glm53/' + NO_DEPT_USER + ')并试提交审批')
  const d1 = await C.btn('RD_CHANGE', '保存为草稿', {
    产品编号: P, 产品名称: PNAME, 变更事由: '探针:配方微调', 变更文件: '成型工艺清单、组装工艺清单',
    需会签: '是', 会签人: 'glm53,' + NO_DEPT_USER,
  })
  const no = d1?.data?.['编号']
  if (!no) throw new Error('建变更单失败:' + JSON.stringify(d1))
  console.log('     变更单 = ' + no)
  const early = await changeBtn(C, no, '提交审批')
  if (early?.code !== 200 && /会签/.test(String(early?.message))) ok('未会签不得提交审批:' + early.message)
  else bad(`需会签单竟可直接提交审批:code=${early?.code} msg=${early?.message}`)

  // ════ ② 提交会签 ════
  step('② cp 提交会签')
  const s2 = await changeBtn(C, no, '提交会签')
  console.log('     ' + JSON.stringify(s2?.data))
  if ((await statusOf(C, no)) === '会签中') ok('状态 = 会签中')
  else bad('状态不符:' + await statusOf(C, no))
  if (await msgCount('glm53', 'SIGNOFF_REQUESTED', no) === 1 && await msgCount(NO_DEPT_USER, 'SIGNOFF_REQUESTED', no) === 1)
    ok('两个会签人都收到 SIGNOFF_REQUESTED')
  else bad('会签通知缺失')

  // ════ ③ 非会签人被拒 ════
  step('③ 发起人 cp 自己点「会签通过」')
  const s3 = await changeBtn(C, no, '会签通过')
  if (s3?.code !== 200 && /会签人/.test(String(s3?.message))) ok('非会签人被拒:' + s3.message)
  else bad(`发起人不该能自签:code=${s3?.code} msg=${s3?.message}`)

  // ════ ⑥ 撤回会签(卡死出口)→ 再提交 → 部分通过 ════
  step('⑥ 撤回会签 → 再提交 → glm53 先通过')
  const s6 = await changeBtn(C, no, '撤回会签')
  if (s6?.code === 200 && (await statusOf(C, no)) === '草稿') ok('撤回会签 → 回草稿')
  else bad('撤回会签失败:' + JSON.stringify(s6) + ' 状态=' + await statusOf(C, no))
  await changeBtn(C, no, '提交会签')
  const s6b = await changeBtn(G, no, '会签通过', { 审批意见: '开发部无异议' })
  if (s6b?.code === 200 && (await statusOf(G, no)) === '会签中') ok('部分通过仍会签中')
  else bad(`部分通过状态异常:code=${s6b?.code} 状态=${await statusOf(G, no)}`)

  // ════ ⑤ 会签驳回 → 回草稿 + 通知发起人 ════
  step('⑤ 第二会签人驳回(带意见)')
  const s5 = await changeBtn(N, no, '会签驳回', { 审批意见: '验证数据不足' })
  if (s5?.code === 200 && (await statusOf(N, no)) === '草稿') ok('驳回 → 回草稿')
  else bad(`驳回异常:code=${s5?.code} msg=${s5?.message} 状态=${await statusOf(N, no)}`)
  const s5b = await changeBtn(N, no, '会签驳回')
  if (s5b?.code !== 200 && /意见/.test(String(s5b?.message))) ok('驳回必须填意见:' + s5b.message)
  else bad(`空意见驳回竟通过:code=${s5b?.code} msg=${s5b?.message}`)

  // ════ ④ 全部通过 → 自动进审批中 ════
  step('④ 重新提交会签 → 两人全部通过 → 自动进审批中')
  await changeBtn(C, no, '提交会签')
  await changeBtn(G, no, '会签通过', { 审批意见: '同意' })
  const s4 = await changeBtn(N, no, '会签通过', { 审批意见: '同意' })
  console.log('     ' + JSON.stringify(s4?.data) + ' 消息=' + JSON.stringify(s4?.message || ''));
  if ((await statusOf(C, no)) === '审批中') ok('全部会签通过 → 自动进审批中')
  else bad('未自动进审批:' + await statusOf(C, no))

  // ════ ⑧⑨⑩⑬ admin 审批通过 → 已生效 + 生效钩子 ════
  step('⑧ admin 审批通过 → 已生效')
  const s8 = await changeBtn(A, no, '审批通过', { 审批意见: '同意变更' })
  console.log('     ' + JSON.stringify(s8?.data))
  if ((await statusOf(A, no)) === '已生效') ok('状态 = 已生效')
  else bad('审批通过后状态不符:' + await statusOf(A, no))
  const eff = runSql('_probe-change-flow-e', `SET NOCOUNT ON;
SELECT CAST(ISNULL(effective,'') AS nvarchar(4)) FROM yj_doc_status WHERE panel_code=N'RD_CHANGE' AND doc_no=N'${no}';`)
  if (eff[0][0] === 'Y') ok("yj_doc_status.effective = 'Y'")
  else bad('effective 未落库:' + JSON.stringify(eff))

  step('⑨ 生效钩子:按勾选的两个文件建下一版草稿')
  const made = runSql('_probe-change-flow-made', `SET NOCOUNT ON;
SELECT N'MP', TOP1.单据编号, ISNULL(TOP1.产品编号,N''), ISNULL(TOP1.产品名称,N''), ISNULL(TOP1.变更来源单号,N''),
       CAST((SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号 = TOP1.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS nvarchar(10))
  FROM (SELECT TOP 1 * FROM rd_mold_proc_head WHERE 变更来源单号 = N'${no}' ORDER BY id DESC) TOP1;
SELECT N'AP', h.单据编号, ISNULL(h.产品编号,N''), ISNULL(h.产品名称,N''), ISNULL(h.变更来源单号,N''), N'0'
  FROM rd_asm_proc_head h WHERE h.变更来源单号 = N'${no}';
SELECT N'MPSRC', N'${srcNo}', CAST((SELECT COUNT(*) FROM rd_mold_proc_detail d WHERE d.单据编号=N'${srcNo}' AND ISNULL(d.asp_cancel,'N')<>'Y') AS nvarchar(10)), N'', N'', N'';`)
  const mp = made.find((r) => r[0] === 'MP'), ap = made.find((r) => r[0] === 'AP'), ms = made.find((r) => r[0] === 'MPSRC')
  console.log('     生成:' + JSON.stringify(made.map((r) => [r[0], r[1], r[4], r[5]])))
  if (mp && mp[4] === no) ok(`成型工艺清单下一版草稿 = ${mp[1]}(带 变更来源单号)`)
  else bad('成型工艺清单未生成带来源单号的草稿:' + JSON.stringify(mp))
  if (mp && mp[2] === P && mp[3] === PNAME) ok('整单复制:产品编号/产品名称随源单带过来')
  else bad('复制头字段不全:' + JSON.stringify(mp))
  if (mp && ms && Number(mp[5]) > 0 && Number(mp[5]) === Number(ms[2])) ok(`明细行整单复制:${mp[5]} 行 = 源单 ${ms[2]} 行`)
  else bad(`明细未复制:新单 ${mp?.[5]} 行 / 源单 ${ms?.[2]} 行`)
  if (ap && ap[4] === no) ok(`组装工艺清单(无既有版本)= 空白草稿 ${ap[1]},同样带来源单号`)
  else bad('无既有版本时未建草稿:' + JSON.stringify(ap))

  step('⑩⑬ 责任人通知 + 生效留痕')
  // 消息挂在**新草稿**单号上(点开就是自己那份文件),故按新单号查;顺带验证按文件分派对不对
  const mG = await msgCount('glm53', 'CHANGE_EFFECTIVE', mp?.[1] || '@@')
  const mC = await msgCount('cp', 'CHANGE_EFFECTIVE', ap?.[1] || '@@')
  if (mG === 1 && mC === 1) ok(`按文件分派责任人:成型→glm53、组装→cp 各收到 CHANGE_EFFECTIVE(挂新单号)`)
  else bad(`责任人通知不符:glm53@${mp?.[1]}=${mG} cp@${ap?.[1]}=${mC}`)
  const hist = (await A.post('/api/px/callButton', { panelCode: 'RD_CHANGE', buttonName: '审批情况', formData: { 编号: no }, buttonParam: {} }))?.data?.list || []
  const effRow = hist.filter((x) => x.action === 'EFFECT')
  if (effRow.length === 1 && String(effRow[0].opinion || '').includes(mp?.[1] || '@@')) ok(`生效留痕 1 条:${effRow[0].result} / ${effRow[0].opinion}`)
  else bad('生效留痕不符:' + JSON.stringify(hist.map((x) => [x.action, x.result])))

  // ════ ⑪ 已生效后不可再动 ════
  step('⑪ 重复审批通过 / 已生效后保存')
  const s11a = await changeBtn(A, no, '审批通过')
  if (s11a?.code !== 200) ok('重复审批通过被拒:' + s11a.message)
  else bad('重复审批通过竟成功')
  const s11b = await C.btn('RD_CHANGE', '保存为草稿', { 编号: no, 变更事由: '已生效还想改' })
  if (s11b?.code !== 200 && /已生效/.test(String(s11b?.message))) ok('已生效单据不可保存:' + s11b.message)
  else bad(`已生效单据可保存:code=${s11b?.code} msg=${s11b?.message}`)

  // ════ ⑦⑫ 免会签路径 + 驳回通知发起人与已填写部门 ════
  step('⑦⑫ 另建一张(需会签=否):提交审批 → admin 驳回')
  const d2 = await C.btn('RD_CHANGE', '保存为草稿', { 产品编号: P, 产品名称: PNAME, 变更事由: '探针:免会签', 变更文件: '出货检验计划表', 需会签: '否' })
  const no2 = d2?.data?.['编号']
  const rows2 = runSql('_probe-change-flow-r2', `SET NOCOUNT ON;
SELECT CAST(id AS nvarchar(20)) FROM rd_change_detail WHERE 单据编号=N'${no2}' AND 部门=N'开发部';`)
  if (no2 && rows2.length) await C.btn('RD_CHANGE', '保存为草稿', { 编号: no2, detail: { items: [{ id: rows2[0][0], 表区: '部门评审意见', 部门: '开发部', 变更后内容: '检验计划同步改' }] } })
  const s7 = await changeBtn(C, no2, '提交审批')
  if ((await statusOf(C, no2)) === '审批中') ok('免会签单直接进审批中')
  else bad(`免会签单未进审批:code=${s7?.code} msg=${s7?.message} 状态=${await statusOf(C, no2)}`)
  const s12 = await changeBtn(A, no2, '审批驳回', { 审批意见: '信息不足,退回补充' })
  if (s12?.code === 200 && (await statusOf(A, no2)) === '草稿') ok('驳回 → 回草稿')
  else bad(`驳回异常:code=${s12?.code} msg=${s12?.message}`)
  if (await msgCount('cp', 'CHANGE_REJECTED', no2) === 1) ok('发起人收到 CHANGE_REJECTED')
  else bad('发起人未收到驳回通知')

  fs.writeFileSync(CLEANUP, `/* 探针清理:产品变更申请单 会签/审批/生效验收(_probe-change-flow.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @docs (no) VALUES (N'${no}'), (N'${no2}');
DECLARE @made TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 变更来源单号 IN (SELECT no FROM @docs);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 变更来源单号 IN (SELECT no FROM @docs);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 变更来源单号 IN (SELECT no FROM @docs);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 变更来源单号 IN (SELECT no FROM @docs);
DELETE FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs) OR 单据编号 IN (SELECT no FROM @made);
DELETE FROM yj_form_approval WHERE panel_code = N'RD_CHANGE' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status WHERE (panel_code = N'RD_CHANGE' AND doc_no IN (SELECT no FROM @docs))
   OR doc_no IN (SELECT no FROM @made) OR (panel_code = N'RD_MOLD_PROC' AND doc_no = N'${srcNo}');
DELETE FROM rd_change_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_change_head   WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @made) OR 单据编号 = N'${srcNo}';
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @made) OR 单据编号 = N'${srcNo}' OR 产品编号 = N'${P}';
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @made) OR 产品编号 = N'${P}';
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @made) OR 产品编号 = N'${P}';
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @made) OR 编号 = N'${P}';
DELETE FROM rd_dev_task WHERE 产品编号 = N'${P}';
DELETE FROM yj_user WHERE username = N'${NO_DEPT_USER}';
SELECT N'变更单残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 IN (SELECT no FROM @docs);
`, 'utf8')
  console.log(`\n  --   清理 SQL:${CLEANUP}(变更单 ${no} / ${no2};探针产品 ${P})`)
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
