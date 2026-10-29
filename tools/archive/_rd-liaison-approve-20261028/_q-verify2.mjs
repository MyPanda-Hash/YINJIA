/**
 * _q-verify2.mjs —— 2026-10-28 第二轮活体验证(8090)
 *
 * 验证「定级分发按钮并入审批通过」后的四条行为:
 *   ① 新单:管理员保存 → 审批中(走审批流)
 *   ② 审批通过弹窗带 项目等级 + 对接人 → 一步落地(等级与对接人都写库)
 *   ③ 已分发对接人的单:canRepairLiaison = **false**(侧栏看不到「补发对接人」)
 *   ④ 历史单(已审批但无对接人,如 LXA-2026-10-0013):canRepairLiaison = **true**
 *      → 用它补发对接人后变 false,且等级沿用、不被改动
 *   ⑤ 前端产物:含「补发对接人」,不含「定级分发」按钮文案
 *
 * 用法: node _q-verify2.mjs [base] [user] [pass] [factory]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const USER = process.argv[3] || 'admin'
const PASS = process.argv[4] || '123456'
const FACTORY = process.argv[5] || 'YJ'

let token = ''
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

async function api(path, opts = {}) {
  const r = await fetch(BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text }
}

const apiName = (b) => (b === '保存' || b === '保存新增' ? '提交' : b)
const callButton = (panelCode, buttonName, formData) =>
  api('/px/callButton', { method: 'POST', body: { panelCode, buttonName: apiName(buttonName), formData, buttonParam: {} } })

async function docStatus(panelCode, no) {
  const r = await api('/px/queryFormDataList', {
    method: 'POST',
    body: { panelCode, keyword: no, pageNo: 1, pageSize: 200, condition: {} },
  })
  const rows = r.json?.data?.rows || r.json?.data?.list || []
  const hit = rows.find((x) => String(x['单据编号'] || x['编号'] || '') === no)
  return hit ? String(hit['单据状态'] || '') : '(未找到)'
}

const flowState = async (no) => (await api(`/px/rdFlow/state?docNo=${encodeURIComponent(no)}`)).json?.data || {}

async function main() {
  const lr = await api('/auth/login', { method: 'POST', body: { userName: USER, password: PASS, factory: FACTORY } })
  token = lr.json?.data?.token || ''
  if (!token) throw new Error('登录失败: ' + lr.text.slice(0, 200))
  log('login', FACTORY)

  const users = (await api('/px/rdFlow/users')).json?.data || []
  const liaison = (users.find((u) => u.username && u.username !== USER) || users[0] || {}).username || USER
  const liaison2 = (users.find((u) => u.username && u.username !== liaison) || {}).username || ''
  log('候选对接人 A/B', `${liaison} / ${liaison2 || '(无)'}`)

  // ── ① 建草稿 → 保存 = 送审 ──
  const mark = 'PROBE2-' + Date.now()
  const d1 = await callButton('RD_APPROVAL', '保存', { 客户名: mark, 申请立项人: '系统管理员', 立项背景: mark })
  const no = String(d1.json?.data?.['编号'] || '')
  log('① 新建单号', no || '(失败)')
  if (!no) { log('返回', d1.text.slice(0, 400)); return finish() }

  const s1 = await callButton('RD_APPROVAL', '保存', {
    编号: no, 客户名: mark, 申请立项人: '系统管理员', 立项背景: mark, 文档编号: 'YJ-P2-' + Date.now(),
  })
  log('① 保存 code/status', `${s1.json?.code} / ${s1.json?.data?.['单据状态'] || ''}`)
  log('① 管理员保存后状态', await docStatus('RD_APPROVAL', no))
  log('① 断言 = 审批中', String(await docStatus('RD_APPROVAL', no)) === '审批中' ? 'PASS' : 'FAIL')

  // 审批前:无对接人 ⇒ 补救入口应为 true(这是历史口径,建单后未审批时 canRepairLiaison 应为 false,
  // 因为 settled=false)。这里钉的是"未审批时看不到补发按钮"。
  const pre = await flowState(no)
  log('② 审批前 canRepairLiaison(未定形应为 false)', pre.canRepairLiaison)
  log('② 断言 = 未见定形时不给补发入口', pre.canRepairLiaison === false ? 'PASS' : 'FAIL')

  // ── ② 审批通过:定级 + 对接人一步 ──
  const apv = await callButton('RD_APPROVAL', '审批通过', { 编号: no, 项目等级: '四级', 对接人: liaison })
  log('③ 审批通过 code/message', `${apv.json?.code} / ${apv.json?.message}`)
  log('③ 审批后状态', await docStatus('RD_APPROVAL', no))
  const f1 = await flowState(no)
  log('③ level / liaison', `${f1.level || '(空)'} / ${f1.liaison || '(空)'}`)
  log('③ 断言 = 定级与分发一步完成', (f1.level === '四级' && f1.liaison === liaison) ? 'PASS' : 'FAIL')
  log('③ 断言 = 已有对接人 ⇒ canRepairLiaison=false', f1.canRepairLiaison === false ? 'PASS' : 'FAIL')

  // ── ④ 补救入口：用**自己的探针单**验证（不碰真实历史单） ──
  // 步骤：再建一张 → 审批通过时**故意不选对接人** → 该单应出现 canRepairLiaison=true
  //       → 用「补发对接人」补上 → 变 false，且等级沿用不变。
  // ⚠ 不去改真实历史单（LXA-2026-10-0013 / 0018）—— 那是用户的正式数据，
  //   验证只需证明"这类单会看到入口"，不能拿正式单据做写操作。
  const mark2 = 'PROBE3-' + Date.now()
  const e1 = await callButton('RD_APPROVAL', '保存', { 客户名: mark2, 申请立项人: '系统管理员', 立项背景: mark2 })
  const no2 = String(e1.json?.data?.['编号'] || '')
  log('④ 第二张探针单', no2 || '(失败)')
  if (no2) {
    await callButton('RD_APPROVAL', '保存', {
      编号: no2, 客户名: mark2, 申请立项人: '系统管理员', 立项背景: mark2, 文档编号: 'YJ-P3-' + Date.now(),
    })
    // 审批通过：只定级、**不带对接人**（模拟"审批时漏选"的历史单形态）
    const apv2 = await callButton('RD_APPROVAL', '审批通过', { 编号: no2, 项目等级: '二级' })
    log('④ 审批(不带对接人) code/message', `${apv2.json?.code} / ${apv2.json?.message}`)
    const g1 = await flowState(no2)
    log('④ level / liaison', `${g1.level || '(空)'} / ${g1.liaison || '(空)'}`)
    log('④ 断言 = 无对接人 ⇒ canRepairLiaison=true', g1.canRepairLiaison === true ? 'PASS' : 'FAIL')

    const target = liaison2 || liaison
    const rp = await callButton('RD_APPROVAL', '定级分发', { 编号: no2, 项目等级: g1.level || '', 对接人: target })
    log('④ 补发 code/message', `${rp.json?.code} / ${rp.json?.message}`)
    const after = await flowState(no2)
    log('④ 补发后 liaison', after.liaison || '(空)')
    log('④ 补发后 level(应仍为 二级)', after.level || '(空)')
    log('④ 补发后 canRepairLiaison(应 false)', after.canRepairLiaison)
    log('④ 断言 = 补发成功且等级沿用',
      (after.liaison === target && after.level === '二级' && after.canRepairLiaison === false) ? 'PASS' : 'FAIL')
  }

  // ── ④b 真实历史单：**只读**确认它们确实会看到补救入口（不写） ──
  const legacyNos = ['LXA-2026-10-0013', 'LXA-2026-10-0018']
  for (const ln of legacyNos) {
    try {
      const st = await flowState(ln)
      log(`④b 历史单 ${ln} canRepairLiaison / liaison / level`,
        `${st.canRepairLiaison} / ${st.liaison || '(空)'} / ${st.level || '(空)'}`)
    } catch (e) { log(`④b 历史单 ${ln}`, `读不到(${e.message})`) }
  }

  // ── ⑤ 前端产物 ──
  const fs = await import('node:fs')
  const dir = 'C:/INCER/YINJIA-MES/backend/src/main/resources/static/assets'
  let hitPl = null
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('PanelxList-') || !f.endsWith('.js')) continue
    const s = fs.readFileSync(dir + '/' + f, 'utf8')
    hitPl = {
      file: f,
      hasRepairBtn: s.includes('补发对接人'),
      hasOldGradeBtn: /\{\{\s*a\(e\)\("定级分发"\)\s*\}\}/.test(s) || s.includes('tt(\'定级分发\')'),
    }
    break
  }
  log('⑤ PanelxList 产物', hitPl)
  log('⑤ 断言 = 有补发入口 / 无定级分发按钮文案',
    hitPl && hitPl.hasRepairBtn && !hitPl.hasOldGradeBtn ? 'PASS' : 'FAIL')
  log('⑤ 首页 chunk', ((await (await fetch(BASE + '/')).text()).match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [''])[0])

  log('探针单据号(留档)', no)
  finish()
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-verify2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-verify2.json')
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
