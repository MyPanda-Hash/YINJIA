// _share-file-api-check.cjs — 共享文件库接口冒烟(2026-09-17):登录→perm/分类/上传/列表/改/删 全链
const BASE = 'http://127.0.0.1:8090/api'

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YINJIA-MES' }),
  }).then((r) => r.json())
  const token = login?.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
  const H = { Authorization: `Bearer ${token}` }
  console.log('1) login ok')

  const perm = await fetch(`${BASE}/share-file/perm`, { headers: H }).then((r) => r.json())
  console.log('2) perm =', JSON.stringify(perm.data))

  const cats = await fetch(`${BASE}/share-file/categories`, { headers: H }).then((r) => r.json())
  const roots = (cats.data || []).filter((c) => c.parentId == null)
  console.log('3) categories =', cats.data.length, '条; 一级 =', roots.map((r) => `${r.name}:${r.count}`).join(', '))

  // 找 有害物质 下的 RoHS 分类
  const all = cats.data
  const haz = all.find((c) => c.name === '有害物质')
  const rohs = all.find((c) => c.name === 'RoHS' && c.parentId === haz?.id)
  console.log('4) RoHS cat id =', rohs?.id, '(有害物质 id =', haz?.id, ')')

  // 上传一份假 PDF
  const fd = new FormData()
  fd.append('file', new File([Buffer.from('%PDF-1.4 冒烟测试')], '冒烟-共享文件测试.pdf', { type: 'application/pdf' }))
  fd.append('catId', String(rohs.id))
  fd.append('name', '冒烟测试报告')
  fd.append('version', 'V1')
  fd.append('keywords', '冒烟 smoke')
  fd.append('remark', '接口冒烟自动建,随后删除')
  const up = await fetch(`${BASE}/share-file/upload`, { method: 'POST', headers: H, body: fd }).then((r) => r.json())
  console.log('5) upload =', JSON.stringify(up))

  // 列表(按有害物质分类,含子孙)
  const list = await fetch(`${BASE}/share-file/list?catId=${haz.id}&pageNo=1&pageSize=10`, { headers: H }).then((r) => r.json())
  console.log('6) list total =', list.data.total, '首行 =', JSON.stringify(list.data.rows[0]))

  // 关键词搜索
  const srch = await fetch(`${BASE}/share-file/list?keyword=smoke`, { headers: H }).then((r) => r.json())
  console.log('7) keyword search total =', srch.data.total)

  // 改元数据
  const id = list.data.rows[0].id
  const upd = await fetch(`${BASE}/share-file/${id}/update`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ catId: rohs.id, name: '冒烟测试报告(改名)', version: 'V2', effectiveDate: '2026-09-17', keywords: 'smoke', remark: '' }),
  }).then((r) => r.json())
  console.log('8) update =', JSON.stringify(upd))

  // 分类增删(空分类)
  const catAdd = await fetch(`${BASE}/share-file/categories`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId: null, name: '冒烟临时分类', seq: 99 }),
  }).then((r) => r.json())
  const cats2 = await fetch(`${BASE}/share-file/categories`, { headers: H }).then((r) => r.json())
  const tmp = cats2.data.find((c) => c.name === '冒烟临时分类')
  const catDel = await fetch(`${BASE}/share-file/categories/${tmp.id}`, { method: 'DELETE', headers: H }).then((r) => r.json())
  console.log('9) cat add/del =', JSON.stringify(catAdd.code), JSON.stringify(catDel.code))

  // 删除有文件的分类应被拒
  const delRoHs = await fetch(`${BASE}/share-file/categories/${rohs.id}`, { method: 'DELETE', headers: H }).then((r) => r.json())
  console.log('10) 删非空分类应拒 =', JSON.stringify(delRoHs))

  // 删文件(清场)
  const del = await fetch(`${BASE}/share-file/${id}`, { method: 'DELETE', headers: H }).then((r) => r.json())
  console.log('11) delete file =', JSON.stringify(del))
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
