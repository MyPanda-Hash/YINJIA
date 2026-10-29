/**
 * _q-verify.mjs —— 2026-10-28 三项改动的活体验证(8090 正式账套)
 *
 * 验证:
 *   ① 立项申请「管理员保存」后 = 审批中(不再 已归档)
 *   ② 管理员自己「审批通过」放行(编制审批分离对管理员豁免),通过后 = 已归档
 *   ③ 审批通过时带「对接人」→ 一步完成分发;再点「定级分发」改人 → 允许且换人生效
 *   ④ 前端产物里含新标识/新文案(项目编号： / 对接人（选填）)
 *
 * 用法: node _q-verify.mjs [base] [user] [pass]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const USER = process.argv[3] || 'admin'
const PASS = process.argv[4] || '123456'

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

async function login() {
  const r = await api('/auth/login', { method: 'POST', body: { userName: USER, password: PASS, factory: 'YJ' } })
  token = r.json?.data?.token || ''
  if (!token) throw new Error('登录失败: ' + r.text.slice(0, 200))
  log('login', 'ok')
}

/** 前端 engine.callButton 的口径:保存/保存新增 → 提交 */
const apiName = (b) => (b === '保存' || b === '保存新增' ? '提交' : b)
async function callButton(panelCode, buttonName, formData) {
  return api('/px/callButton', {
    method: 'POST',
    body: { panelCode, buttonName: apiName(buttonName), formData, buttonParam: {} },
  })
}

/** 单据状态:走列表查询(该面板没有单独的 docStatus 接口) */
async function docStatus(panelCode, no) {
  const r = await api('/px/queryFormDataList', {
    method: 'POST',
    body: { panelCode, keyword: no, pageNo: 1, pageSize: 200, condition: {} },
  })
  const rows = r.json?.data?.rows || r.json?.data?.list || []
  const hit = rows.find((x) => String(x['单据编号'] || x['编号'] || '') === no)
  return hit ? String(hit['单据状态'] || '') : '(未找到 ' + rows.length + ' 行)'
}

async function flowState(no) {
  const r = await api(`/px/rdFlow/state?docNo=${encodeURIComponent(no)}`)
  return r.json?.data || {}
}

async function main() {
  await login()

  // ── ① 管理员保存 = 送审(审批中) ──
  // ⚠ 两步:第一次「保存」不带编号 ⇒ 后端 directAdd 分支建空白草稿(该分支直接 return "草稿",
  //   不经过归档/送审块 —— 这是既有行为,不是本次改动);第二次带编号「保存」才进主保存路径。
  const mark = 'PROBE-' + Date.now()
  const draftRes = await callButton('RD_APPROVAL', '保存', {
    客户名: mark, 申请立项人: '系统管理员', 立项背景: '活体探针 ' + mark,
  })
  const dd = draftRes.json?.data || {}
  // ⚠ 返回键是「编号」—— 不是「单据编号」/docNo(实测 directAdd 只回 编号)
  const no = String(dd['编号'] || dd['单据编号'] || dd.docNo || '')
  log('新建单号(directAdd 草稿)', no || '(失败)')
  if (!no) { log('① 建草稿返回', draftRes.text.slice(0, 400)); return finish() }

  // ⚠ 立项申请的「文档编号」是必填(yj_field required),不给就 400「文档编号不能为空」
  const form = {
    编号: no, 客户名: mark, 申请立项人: '系统管理员', 立项背景: '活体探针 ' + mark,
    文档编号: 'YJ-PROBE-' + Date.now(),
  }
  const saveRes = await callButton('RD_APPROVAL', '保存', form)
  log('① 保存返回 code', saveRes.json?.code)
  log('① 保存返回 message', saveRes.json?.message)
  log('① 保存返回 status', saveRes.json?.data?.status || saveRes.json?.data?.['单据状态'] || '')
  const st1 = await docStatus('RD_APPROVAL', no)
  log('① 管理员保存后状态', st1)
  log('① 断言 = 审批中', String(st1) === '审批中' ? 'PASS' : 'FAIL')

  // ── ② 管理员自己审批通过(带定级 + 对接人) ──
  const users = await api('/px/rdFlow/users')
  const list = users.json?.data || []
  const liaison = (list.find((u) => u.username && u.username !== USER) || list[0] || {}).username || USER
  log('② 选作对接人的账号', liaison)

  const apv = await callButton('RD_APPROVAL', '审批通过', { 编号: no, 项目等级: '三级', 对接人: liaison })
  log('② 审批通过 code', apv.json?.code)
  log('② 审批通过 message', apv.json?.message)
  const st2 = await docStatus('RD_APPROVAL', no)
  log('② 审批通过后状态', st2)
  log('② 断言 = 已归档', String(st2) === '已归档' ? 'PASS' : 'FAIL')

  const f = await flowState(no)
  log('③ 流程态 level', f.level || '(空)')
  log('③ 流程态 liaison', f.liaison || '(空)')
  log('③ 断言 = 审批时已分发对接人', (f.level === '三级' && f.liaison === liaison) ? 'PASS' : 'FAIL')
  log('③ canGradeDispatch(已分发后仍可改)', f.canGradeDispatch)

  // ── ③ 改人 ──
  const others = list.filter((u) => u.username && u.username !== liaison)
  const newLiaison = (others[0] || {}).username || ''
  if (newLiaison) {
    const gd = await callButton('RD_APPROVAL', '定级分发', { 编号: no, 项目等级: '三级', 对接人: newLiaison })
    log('③ 改对接人 code', gd.json?.code)
    log('③ 改对接人 message', gd.json?.message)
    const f2 = await flowState(no)
    log('③ 改后人', f2.liaison || '(空)')
    log('③ 断言 = 已改人', f2.liaison === newLiaison ? 'PASS' : 'FAIL')
  } else {
    log('③ 跳过(只有一个启用账号)', 'SKIP')
  }

  // ── ④ 实际下发的语言包 chunk(英文词条按需懒加载,不在首页 chunk 里) ──
  const html = await (await fetch(BASE + '/')).text()
  const chunk = (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [''])[0]
  log('④ 首页 chunk', chunk)
  // 列出 static 下所有 en-* 产物,找含新词条的那一个(名字带内容哈希,不能写死)
  const enHit = await new Promise((resolve) => {
    import('node:fs').then(({ readdirSync, readFileSync }) => {
      const dir = 'C:/INCER/YINJIA-MES/backend/src/main/resources/static/assets'
      for (const f of readdirSync(dir)) {
        if (!f.startsWith('en-') || !f.endsWith('.js')) continue
        const s = readFileSync(dir + '/' + f, 'utf8')
        resolve({ file: f, docno: s.includes('Project No.'), liaison: s.includes('Liaison (optional)') })
        return
      }
      resolve(null)
    })
  })
  log('④ en 产物', enHit)
  log('④ 断言 = 英文词条齐备', enHit && enHit.docno && enHit.liaison ? 'PASS' : 'FAIL')
  // 中文文案:docnoLabel 的判定表 {RD_APPROVAL:'项目编号'} 会被打包进某个产物;
  // 冒号是运行时拼的(`lb + '：'`),所以产物里找的是「RD_APPROVAL + 项目编号」这一组合。
  const pl = await new Promise((resolve) => {
    import('node:fs').then(({ readdirSync, readFileSync }) => {
      const dir = 'C:/INCER/YINJIA-MES/backend/src/main/resources/static/assets'
      let hit = null
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.js')) continue
        const s = readFileSync(dir + '/' + f, 'utf8')
        const docnoMap = /RD_APPROVAL\s*:\s*"项目编号"/.test(s) || /"RD_APPROVAL"\s*:\s*"项目编号"/.test(s)
        const liaison = s.includes('对接人（选填）')
        if (docnoMap) hit = { file: f, docnoMap: true, liaison: hit?.liaison || liaison }
        else if (liaison && !hit) hit = { file: f, docnoMap: false, liaison: true }
      }
      resolve(hit)
    })
  })
  log('④ 前端产物命中', pl)
  log('④ 断言 = 中文文案已打进产物', pl && pl.docnoMap && pl.liaison ? 'PASS' : 'FAIL')
  log('探针单据号(留档)', no)
  finish()
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-verify.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-verify.json')
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
