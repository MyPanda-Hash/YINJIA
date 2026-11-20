const BASE = 'http://127.0.0.1:8090/api'
const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const r = await (await fetch(`${BASE}/px/queryFormDataList`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'SAMPLE_REG', pageNo: 1, pageSize: 100, condition: {} }) })).json()
const doc = r?.data?.list?.[0]
const tab = doc?.detail ? Object.keys(doc.detail)[0] : null
const rows = tab ? doc.detail[tab] : []
const seq = rows.map(x => x['序号'])
console.log('totalSize=', r?.data?.totalSize, 'rows=', rows.length)
console.log('默认(id DESC)从上到下的序号:",', seq.join(','))
const asc = [...rows].sort((a,b)=>Number(a['序号'])-Number(b['序号']))
console.log('点「序号」表头升序后:', asc.map(x=>`${x['序号']}.${x['检测元素']}`).join(' | '))
console.log('序号集合 1..55 且无重号:', seq.length===55 && new Set(seq.map(Number)).size===55 && Math.min(...seq)===1 && Math.max(...seq)===55)
