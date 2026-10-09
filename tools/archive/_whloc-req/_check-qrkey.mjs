const BASE='http://127.0.0.1:8090'
const login = await (await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const token = login.data.token
const cfg = (await (await fetch(BASE+'/api/px/getPanelConfig?panelCode=WHLOC',{headers:{Authorization:'Bearer '+token}})).json()).data.metadata
console.log('qrLabelKey      :', JSON.stringify(cfg.qrLabelKey), '  (期望 "仓位编码")')
console.log('qrLabelScopeKey :', JSON.stringify(cfg.qrLabelScopeKey))
console.log('qrLabelKind     :', JSON.stringify(cfg.qrLabelKind))
const q = (await (await fetch(BASE+'/api/px/queryFormDataList',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({panelCode:'WHLOC',pageNo:1,pageSize:1000})})).json()).data
const items = q.list[0].detail.locations
console.log('仓位总数        :', items.length)
// 模拟前端 qrRowKey:必须有 编码键 且逐行唯一,否则又会"点一行勾全页"
const k = cfg.qrLabelKey, s = cfg.qrLabelScopeKey
const keys = items.map(r => { const c = String(r[k] ?? '').trim(); if (!c) return ''; const sc = s ? String(r[s] ?? '').trim() : ''; return sc ? sc+'\u0001'+c : c })
const empty = keys.filter(x => x === '').length
const uniq = new Set(keys.filter(Boolean)).size
console.log('空行键(应 0)    :', empty)
console.log('唯一行键(应 '+items.length+') :', uniq)
console.log('样例行键        :', keys.slice(0,3).map(x=>x.replace('\u0001','|')).join('  ,  '))