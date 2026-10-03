// _probe-whloc.cjs — WHLOC 库位面板 API 实证(2026-09-28)
// 登录 → getPanelConfig(结构/按钮/qrLabel 元数据) → queryFormDataList → callButton 保存两行 → 再查 → 回查留痕
// 运行:node tools\archive\_probe-whloc.cjs
const BASE = 'http://127.0.0.1:8090/api'

async function main() {

async function api(method, path, body, token, raw) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (raw) return res
  const j = await res.json().catch(() => ({}))
  return { status: res.status, body: j }
}

const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
const token = login.body?.data?.token
console.log('login:', login.status, token ? 'token ok' : JSON.stringify(login.body))

const zh = await api('POST', '/px/getPanelConfig', { panelCode: 'WHLOC' }, token)
const meta = zh.body?.data?.metadata || {}
const groups = (meta.buttonGroups || []).map((g) => g.name + ':' + (g.actions || []).join('/'))
console.log('panelName(zh):', meta.panelName, '| singleDoc:', meta.singleDoc)
console.log('buttonGroups:', groups.join('  |  '))
console.log('qrLabel meta:', JSON.stringify({ qrLabelKey: meta.qrLabelKey, qrLabelScopeKey: meta.qrLabelScopeKey, qrLabelKind: meta.qrLabelKind }))
const tab = zh.body?.data?.detail?.tabs?.[0] || {}
console.log('tab.key:', tab.key, '| tab.label:', tab.label)
console.log('fields:', (tab.fields || []).map((f) => `${f.dataName}(${f.dataType}${f.refPanel ? '→' + f.refPanel : ''}${f.isRequired ? ',必填' : ''})`).join('  '))
console.log('queryFields:', (zh.body?.data?.metadata?.panelPageDto?.tablePages?.[0]?.queryFields || []).map((f) => f.dataName).join('/'))

const en = await api('POST', '/px/getPanelConfig', { panelCode: 'WHLOC', locale: 'en' }, token)
const enTab = en.body?.data?.detail?.tabs?.[0] || {}
console.log('panelName(en):', en.body?.data?.metadata?.panelName, '| fields(en):', (enTab.fields || []).map((f) => `${f.dataName}=>${f.displayName || f.dataName}`).join('  '))

const list0 = await api('POST', '/px/queryFormDataList', { panelCode: 'WHLOC', pageNo: 1, pageSize: 50 }, token)
console.log('query before:', list0.status, 'rows:', JSON.stringify(list0.body?.data?.rows || list0.body?.data || '').slice(0, 200))

// 保存两行测试库位(callButton 保存=档案全量明细 upsert)
const save = await api('POST', '/px/callButton', {
  panelCode: 'WHLOC', buttonName: '保存', buttonParam: {},
  formData: {
    detail: {
      locations: [
        { 仓库: '原料仓', 库位编码: 'ZZTEST-KW-001', 库位地址: '测试A区1排1层', 备注: '探针行1' },
        { 仓库: '成品仓', 库位编码: 'ZZTEST-KW-002', 库位地址: '测试B区2排2层', 备注: '探针行2' },
      ],
    },
  },
}, token)
console.log('save:', save.status, JSON.stringify(save.body?.data || save.body).slice(0, 200))

const list1 = await api('POST', '/px/queryFormDataList', { panelCode: 'WHLOC', pageNo: 1, pageSize: 50 }, token)
const rows = list1.body?.data?.rows || []
console.log('query after save:', list1.status, 'rows:', rows.length)
for (const r of rows) console.log('  ', JSON.stringify({ 仓库: r['仓库'], 库位编码: r['库位编码'], 库位地址: r['库位地址'], 备注: r['备注'] }))

// 必填守卫:缺仓库的行应被拒(400)
const badSave = await api('POST', '/px/callButton', {
  panelCode: 'WHLOC', buttonName: '保存', buttonParam: {},
  formData: { detail: { locations: [{ 库位编码: 'ZZTEST-KW-003', 库位地址: '缺仓库行' }] } },
}, token)
console.log('save missing-warehouse:', badSave.status, JSON.stringify(badSave.body?.message || badSave.body?.data || '').slice(0, 160))
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
