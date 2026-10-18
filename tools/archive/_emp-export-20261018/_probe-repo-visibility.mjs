const r = await fetch('https://github.com/MyPanda-Hash/YINJIA', { headers: { 'User-Agent': 'Mozilla/5.0' } })
const t = await r.text()
const m = t.match(/<title>([^<]*)<\/title>/)
console.log('status', r.status, 'title:', m && m[1])
console.log('hasPrivateBadge:', /Private/i.test(t.slice(0, 20000)))
const t2 = await (await fetch('https://github.com/MyPanda-Hash/YINJIA-NOT-EXIST-xyz', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' })).status
console.log('control(nonexistent) status:', t2)
