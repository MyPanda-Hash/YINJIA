// 在服务器标准库里找「NSF 42-余氯 / NSF 42氯胺」这两条到底存在哪个 lib(只读)
const base = 'http://36.140.66.163:8090'
const r = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const t = (await r.json()).data.token

const queries = ['', '?all=1', '?lib=lab.test_item&all=1', '?lib=lab.test_item']
for (const q of queries) {
  const res = await fetch(base + '/api/stdlib/list' + q, { headers: { Authorization: 'Bearer ' + t } })
  const j = await res.json()
  const rows = j.data || []
  const hit = rows.filter((x) => /NSF 42/.test(x.item || ''))
  console.log(`q="${q}" rows=${rows.length} hit=${JSON.stringify(hit.map((x) => ({ lib: x.lib, item: x.item, seq: x.seq, en: x.enabled, len: (x.content || '').length })))}`)
}

// 再把 lab.test_item 的 7 条完整打出来(含 content 前 40 字)
const res = await fetch(base + '/api/stdlib/list?lib=lab.test_item&all=1', { headers: { Authorization: 'Bearer ' + t } })
const rows = (await res.json()).data || []
console.log('--- lab.test_item 全量 ---')
for (const x of rows) console.log(`  id=${x.id} item=${x.item} seq=${x.seq} en=${x.enabled} len=${(x.content || '').length} head=${JSON.stringify((x.content || '').slice(0, 40))}`)
