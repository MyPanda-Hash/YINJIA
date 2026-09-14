/**
 * _api-verify.cjs — 数据记录表面板 API 全链路验证(登录/空白新增/带数据保存/读回/删除)
 * 用法: node tools/_api-verify.cjs
 */
const BASE = 'http://localhost:8090/api'

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: res.status, json, text }
}

async function main() {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  if (login.status !== 200) throw new Error('login fail: ' + login.text)
  const token = login.json.data.token
  console.log('LOGIN OK')

  // 1) 空白新增 -> 草稿单号
  const s1 = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '保存', formData: {}, buttonParam: {} }, token)
  console.log('SAVE-EMPTY:', s1.status, JSON.stringify(s1.json && s1.json.data))
  const no = s1.json?.data?.['编号']
  if (!no) throw new Error('no doc no: ' + s1.text)

  // 2) 带头字段+明细行保存(复刻 Excel 碱性首页数据)
  const head = {
    编号: no,
    '文档编号': 'YJ-PD-01', '密级': '保密', '适用范围': '银嘉内部',
    '测试负责人': '冯敏', '报告编号': 'PD-H-F260228002', '测试主题': '伊可普碱性寿命测试',
    '测试目的/背景': '碱性寿命及口感测试', '测试时间': '2026.02.28', '炭棒尺寸': '24*10*120mm',
    '本次实验目的': '浸泡24H后TDS值测试', '测试仪器': 'PH计：梅特勒（普通电极）',
    '测试装置及工位': '二分管，RO纯水（水效水+RO机）-炭棒（伊可普工装）-出水，滤效实验室1#',
    '测试方式': '碳棒组装完成后初始冲洗5min浸泡24H后取水测试，取样水量为100ml取连续五杯测试出水PH及TDS值',
    '原水自来水': '×', '原水超纯水': '×', '原水RO纯水': '√', '原水PH': '6', '原水TDS': '2', '水温': '22',
    detail: {
      items: [
        { '测试时间': '2026.02.28', '测试流速（L/min）': '0.35', '杯数(接水量100ml)': '第一杯', '水温（℃）': '22.5', 'RO水PH': '6.21', 'RO水TDS': '30.4', '滤芯出水PH': '10.5', '滤芯出水TDS': '325', 'PH提升值': '4.29', '钠': '17.578', '镁': '99.114', '钾': '2.814', '钙': '4.977' },
        { '测试时间': '2026.02.28', '测试流速（L/min）': '0.35', '杯数(接水量100ml)': '第二杯', '水温（℃）': '22.5', 'RO水PH': '6.21', 'RO水TDS': '30.4', '滤芯出水PH': '10.45', '滤芯出水TDS': '197', 'PH提升值': '4.24', '钠': '32.701', '镁': '30.626', '钾': '0.881', '钙': '8.551' },
      ],
    },
  }
  const s2 = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '保存', formData: head, buttonParam: {} }, token)
  console.log('SAVE-FULL:', s2.status, JSON.stringify(s2.json && s2.json.data))

  // 3) 读回
  const rb = await api('GET', '/px/getFormDescriptor?panelCode=RD_ALKALINE&code=' + encodeURIComponent(no), null, token)
  const d = rb.json?.data || {}
  console.log('READBACK: topic=' + (d.detail?.['测试主题'] || '') + ' items=' + ((d.detail?.items) || []).length)
  const row1 = (d.detail?.items || [])[0] || {}
  console.log('ROW1: PH=' + row1['滤芯出水PH'] + ' 钠=' + row1['钠'] + ' 杯=' + row1['杯数(接水量100ml)'])

  // 4) 矿化:保存 4 指标块明细
  const m1 = await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '保存', formData: {}, buttonParam: {} }, token)
  const mno = m1.json?.data?.['编号']
  console.log('MINERAL DRAFT:', mno)
  if (mno) {
    const mh = {
      编号: mno, '文档编号': 'YJ-PD-01', '测试主题': '伊可普 RO后置矿化滤芯 纯水寿命测试',
      '产品规格': '24*9*120（mm）',
      detail: {
        items: [
          { '指标': '锶 mg/L', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '0', '浸泡30min': '2.47', '浸泡30min煮沸晾凉': '2.74' },
          { '指标': '锶 mg/L', '测试日期': '20251208', '累计流量L': '300', 'RO出水': '0', '浸泡30min': '1.78', '浸泡30min煮沸晾凉': '2.34' },
          { '指标': '偏硅酸 mg/L', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '0', '浸泡30min': '2.11', '浸泡30min煮沸晾凉': '2.695' },
          { '指标': 'PH', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '6.84', '浸泡30min': '7.2', '浸泡30min煮沸晾凉': '7.86' },
        ],
      },
    }
    const m2 = await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '保存', formData: mh, buttonParam: {} }, token)
    console.log('MINERAL SAVE:', m2.status, JSON.stringify(m2.json && m2.json.data))
    const mrb = await api('GET', '/px/getFormDescriptor?panelCode=RD_MINERAL&code=' + encodeURIComponent(mno), null, token)
    const md = mrb.json?.data || {}
    const items = (md.detail?.items) || []
    console.log('MINERAL READBACK: items=' + items.length + ' 指标s=' + [...new Set(items.map((r) => r['指标']))].join('/'))
    // 清理
    await api('POST', '/px/callButton', { panelCode: 'RD_MINERAL', buttonName: '删除', formData: { 编号: mno }, buttonParam: {} }, token)
    console.log('MINERAL DELETED')
  }

  // 5) 清理碱性测试单
  const del = await api('POST', '/px/callButton', { panelCode: 'RD_ALKALINE', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token)
  console.log('DELETE:', del.status, JSON.stringify(del.json && del.json.data))

  // 6) 其余 5 面板空白新增冒烟(建单即删)
  for (const pc of ['RD_ANTIBACT', 'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK', 'RD_DROP_PREC']) {
    const c1 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const n1 = c1.json?.data?.['编号']
    const c2 = n1 ? await api('POST', '/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: n1 }, buttonParam: {} }, token) : null
    console.log('SMOKE ' + pc + ': create=' + c1.status + '(' + n1 + ') delete=' + (c2 ? c2.status : '-'))
  }
  console.log('ALL DONE')
}

main().catch((e) => { console.error('VERIFY FAIL:', e.message); process.exit(1) })
