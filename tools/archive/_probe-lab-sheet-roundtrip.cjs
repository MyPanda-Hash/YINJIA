/**
 * _probe-lab-sheet-roundtrip.cjs —— 文书面板「填→保存→重开」逐格比对(丢值检测)
 *
 * 背景(2026-10-08 用户报):「这个表填写数据之后出现数据丢失」—— 加标水配置记录表。
 * 根因:配置里的数据键必须**逐字等于** yj_field.label,否则渲染取不到值(空白)、
 *   保存时 labelsToCols 按 label 反查不到该键 ⇒ **静默丢值**(填完保存、再打开就没了)。
 *   加标水那张表的列集写在 `variants[].cols` 里,而当时所有断言都只扫 dataTables/cover/报告头,
 *   这第四个盲区没人守 ⇒ 17 个 key 与活库 label 分叉了也没人拦。
 *
 * 本探针不看配置也不看单测,它**只认结果**:拿面板配置自己造一格一格的输入,
 * 保存,再按单据编号读回来,逐格比对。填进去 ≠ 读回来 的格子就是丢值。
 *
 * 用法: node tools/archive/_probe-lab-sheet-roundtrip.cjs [PANEL ...]
 *   不带参数 = 实验室记录表 4 张 + 数据记录表 8 张全跑。
 * 账套:默认 **YJ_TEST**(写库只写测试账套);先跑一遍断言令牌确实是 YJ_TEST。
 */
const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DEFAULT_PANELS = [
  // 实验室使用记录表 4 张
  'RD_SPIKE_WATER', 'RD_DOM_TEST', 'RD_EQUIP_USE', 'RD_INSTR_USE',
  // 数据记录表 8 张(用户口径「所有的实验记录表」一并覆盖)
  'RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT',
  'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC',
]
const PANELS = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PANELS

const TOKEN = (i) => `RT${String(i).padStart(2, '0')}`
const today = new Date().toISOString().slice(0, 10)

async function api(path, body, token, method = 'POST') {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  })
  const text = await res.text()
  let json = null; try { json = JSON.parse(text) } catch { }
  return { status: res.status, json, text }
}

/** 按字段类型给一个合法值;返回 null 表示"这类格子本探针不填"(参照/附件/只读/隐藏) */
function valueFor(f, seq) {
  if (!f || f.hidden || f.readonly || f.editable === 0 || f.editable === false) return null
  const t = String(f.dataType || f.data_type || '文本')
  if (t === '附件') return null
  if (t === '参照') return null          // 参照要真取目标面板的值,不属于"丢值"检测范围
  if (t === '日期' || t === '日期时间') return today
  if (t === '时间') return '08:30'
  if (t === '时间区间') return '08:00-09:00'
  if (t === '下拉框') return (f.options || [])[0] ?? null
  if (t === '是否') return '是'
  if (t === '小数' || t === '整数') return String(seq)
  return TOKEN(seq)
}

;(async () => {
  const login = await api('/auth/login', { userName: 'admin', password: '123456', factory: FACTORY })
  const token = login.json?.data?.token
  if (!token) { console.log('❌ 登录失败: ' + login.text.slice(0, 200)); process.exitCode = 1; return }
  const fac = login.json.data.user.factory
  if (fac !== FACTORY) { console.log(`❌ 令牌账套是 ${fac},不是 ${FACTORY} —— 为避免污染正式库已中止`); process.exitCode = 1; return }
  console.log(`登录成功(账套 ${fac})· 货架:${PANELS.length} 张表\n`)

  let totalFilled = 0, totalLost = 0
  for (const panel of PANELS) {
    const cfg = (await api(`/px/getPanelConfig?panelCode=${panel}`, null, token, 'GET')).json?.data
    if (!cfg) { console.log(`⚠ ${panel}: 取不到面板配置,跳过`); continue }

    // ① 表头:必填且非自动编号的字段填值
    const head = {}
    let seq = 1
    for (const f of cfg.dataSchema?.fields || []) {
      if (!f.isRequired) continue
      if (f.dataName === cfg.metadata?.autoCodeField) continue
      const v = valueFor(f, seq++)
      if (v === null) { console.log(`  ⚠ ${panel}: 必填表头「${f.dataName}」类型 ${f.dataType} 本探针不填(参照/附件类)`); continue }
      head[f.dataName] = v
    }

    // ② 明细一行:每个可填字段都填
    const tab = cfg.detail?.tabs?.[0]
    const row = {}
    const fieldNames = (tab?.fields || []).map((f) => f.dataName)
    for (const f of tab?.fields || []) {
      const v = valueFor(f, seq++)
      if (v === null) continue
      row[f.dataName] = v
    }
    if (!Object.keys(row).length) { console.log(`⚠ ${panel}: 明细无可填字段,跳过`); continue }

    // ③ 保存
    const save = await api('/px/callButton', {
      panelCode: panel, buttonName: '保存',
      formData: { ...head, detail: { [tab.key]: [row] } },
      buttonParam: {},
    }, token)
    const docNo = save.json?.data?.['编号'] || save.json?.data?.['单据编号']
    if (save.status !== 200 || !docNo) {
      console.log(`⚠ ${panel}: 保存失败(可能缺参照类必填) — ${save.text.slice(0, 160)}`)
      continue
    }

    // ④ 按单据编号读回,逐格比对
    const list = await api('/px/queryFormDataList', { panelCode: panel, condition: { 单据编号: docNo }, pageNo: 1, pageSize: 5 }, token)
    const doc = (list.json?.data?.list || []).find((d) => String(d['单据编号'] || d['编号'] || '').trim() === String(docNo).trim())
    if (!doc) { console.log(`❌ ${panel}: 保存成功(${docNo})但列表查不到该单`); totalLost++; continue }
    const got = doc.detail?.[tab.key]?.[0] || doc.detail?.items?.[0] || {}
    const lost = Object.keys(row).filter((k) => String(got[k] ?? '') !== String(row[k]))
    totalFilled += Object.keys(row).length
    totalLost += lost.length
    const headLost = Object.keys(head).filter((k) => String(doc[k] ?? '') !== String(head[k]))
    console.log(`${lost.length || headLost.length ? '❌' : '✅'} ${panel}  ${docNo}  明细填 ${Object.keys(row).length} 格 / 丢 ${lost.length} 格` + (headLost.length ? `;表头丢 ${headLost.length} 格` : ''))
    if (lost.length) console.log(`     丢的格:${lost.join(' | ')}`)
    if (headLost.length) console.log(`     表头丢:${headLost.join(' | ')}`)
    void fieldNames
  }
  console.log(`\n合计:填 ${totalFilled} 格,丢 ${totalLost} 格`)
  if (totalLost) process.exitCode = 1
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
