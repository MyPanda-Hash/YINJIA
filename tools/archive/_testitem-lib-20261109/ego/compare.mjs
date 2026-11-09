// 标准库 lab.test_item:服务器(36.140.66.163:8090)vs 本机(8090)条目比对(只读)
// 结论用于「服务器 5 个测试项目、本地只有 3 个」的核实;拿到差异后再决定怎么补。
import fs from 'node:fs'

const LIB = 'lab.test_item'

async function login(base) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed @' + base)
  return j.data.token
}

async function list(base, token) {
  const r = await fetch(`${base}/api/stdlib/list?lib=${encodeURIComponent(LIB)}&all=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  const rows = j?.data ?? []
  return rows.map((x) => ({
    id: x.id,
    item: x.item ?? x.item_code,
    seq: x.seq,
    enabled: x.enabled,
    len: (x.content || '').length,
    isJson: String(x.content || '').trim().startsWith('{'),
    cols: (() => { try { return (JSON.parse(x.content || '{}').cols || []).length } catch (e) { return -1 } })(),
    content: x.content || '',
  }))
}

const SRV = 'http://36.140.66.163:8090'
const LOC = 'http://127.0.0.1:8090'
const srv = await list(SRV, await login(SRV))
const loc = await list(LOC, await login(LOC))

console.log('SERVER(' + srv.length + '):')
srv.forEach((x) => console.log(`  ${x.item}  seq=${x.seq} enabled=${x.enabled} cols=${x.cols} len=${x.len}`))
console.log('LOCAL(' + loc.length + '):')
loc.forEach((x) => console.log(`  ${x.item}  seq=${x.seq} enabled=${x.enabled} cols=${x.cols} len=${x.len}`))

const locNames = new Set(loc.map((x) => x.item))
const missing = srv.filter((x) => !locNames.has(x.item))
console.log('缺失(服务器有本地没有): ' + JSON.stringify(missing.map((x) => x.item)))
fs.writeFileSync('C:/Users/Lenovo/ego/testitem-lib-20261109/server.json', JSON.stringify(srv, null, 2), 'utf8')
fs.writeFileSync('C:/Users/Lenovo/ego/testitem-lib-20261109/local.json', JSON.stringify(loc, null, 2), 'utf8')
