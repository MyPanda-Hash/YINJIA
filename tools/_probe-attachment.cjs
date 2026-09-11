// _probe-attachment.cjs — 附件字段(产品信息表·客户图纸或规格书)API 验收探针(纯 HTTP,无 UI)
// 验证:上传保留原文件名 / 列表元数据(上传人/时间/大小) / 下载回原内容与原文件名 /
//      头字段列同步=文件名列表(打印/导出 PDF 只见文件名) / 删除同步 / 锚点缺失 400 / 未认证 403。
// 用法: node tools/_probe-attachment.cjs [BASE]   默认 http://localhost:8090
const BASE = process.argv[2] || 'http://localhost:8090'
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

async function main() {
  // ── 登录 ──
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  if (!token) { console.error('登录失败', login); process.exit(1) }
  const auth = { Authorization: 'Bearer ' + token }
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', ...auth, ...(opts.headers || {}) } })).json()

  // ── 建一张测试草稿(产品信息表) ──
  const created = await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '保存', formData: {}, buttonParam: {} }) })
  const docNo = created?.data?.['编号'] || created?.data?.formNo
  if (!docNo) { console.error('新建草稿失败', created); process.exit(1) }
  console.log('   测试单据:', docNo)

  const FIELD = '客户图纸或规格书'
  const ANCHOR = `panelCode=RD_PROD_INFO&docNo=${encodeURIComponent(docNo)}&field=${encodeURIComponent(FIELD)}`

  // ── ① 未认证访问 → 403(JWT 保护) ──
  const noAuth = await fetch(`${BASE}/api/attachment/list?${ANCHOR}`)
  ok(noAuth.status === 403, `①未认证访问附件接口返回 403(实际 ${noAuth.status})`)

  // ── ② 锚点缺失 → 400 ──
  const badAnchor = await api(`/api/attachment/list?panelCode=RD_PROD_INFO&docNo=&field=${encodeURIComponent(FIELD)}`)
  ok(badAnchor.code === 400, `②缺单据编号锚点返回 400(实际 code=${badAnchor.code})`)

  // ── ③ 上传两个附件(中文原文件名保留) ──
  const F1 = '客户规格书-样本A.pdf'
  const F2 = '客户图纸 样本B.png'
  const B1 = Buffer.from('%PDF-1.4\n%--yinjia-attachment-probe-A--\n', 'utf8')
  const B2 = Buffer.from('PNG-yinjia-attachment-probe-B')
  const upload = async (name, buf, type) => {
    const fd = new FormData()
    fd.append('file', new Blob([buf], { type }), name)
    fd.append('panelCode', 'RD_PROD_INFO')
    fd.append('docNo', docNo)
    fd.append('field', FIELD)
    return (await fetch(`${BASE}/api/attachment/upload`, { method: 'POST', headers: auth, body: fd })).json()
  }
  const u1 = await upload(F1, B1, 'application/pdf')
  ok(u1.code === 200 && u1.data.names === F1, `③-1 上传A 成功且 names=原文件名(实际 "${u1.data?.names}")`)
  const u2 = await upload(F2, B2, 'image/png')
  ok(u2.code === 200 && u2.data.names === `${F1}、${F2}`, `③-2 上传B 后 names=原文件名列表、分隔(实际 "${u2.data?.names}")`)

  // ── ④ 列表元数据(上传人/时间/大小) ──
  const ls = await api(`/api/attachment/list?${ANCHOR}`)
  const files = ls.data || []
  ok(files.length === 2, `④-1 附件列表 2 条(实际 ${files.length})`)
  ok(files[0].fileName === F1 && files[1].fileName === F2, '④-2 列表文件名=原文件名(顺序按上传)')
  ok(files.every((f) => f.uploader === 'admin' && f.uploadTime && f.fileSize > 0), '④-3 上传人/上传时间/大小齐备')

  // ── ⑤ 下载:回原内容;Content-Disposition 带原文件名(RFC 5987 UTF-8);PDF inline ──
  const dl = await fetch(`${BASE}/api/attachment/${files[0].id}/download`, { headers: auth })
  const dlBytes = Buffer.from(await dl.arrayBuffer())
  ok(dl.status === 200 && dlBytes.equals(B1), '⑤-1 下载内容与上传逐字节一致')
  const cd = dl.headers.get('content-disposition') || ''
  const cdName = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/) || [])[1] || '')
  ok(cdName === F1, `⑤-2 Content-Disposition 原文件名(实际 "${cdName}")`)
  ok(/inline/.test(cd) && (dl.headers.get('content-type') || '').includes('application/pdf'), '⑤-3 PDF inline(浏览器直接查看)')

  // ── ⑥ 头字段列同步=文件名列表(打印/导出 PDF 只显示文件名的数据基础) ──
  const q = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 300 }) })
  const row = (q.data.rows || q.data.list || []).find((r) => (r['单据编号'] || r['编号']) === docNo)
  ok(row && row[FIELD] === `${F1}、${F2}`, `⑥头字段列已同步为文件名列表(实际 "${row && row[FIELD]}")`)

  // ── ⑦ 删除一个 → names/头字段列同步收敛 ──
  const d1 = await api('/api/attachment/delete', { method: 'POST', body: JSON.stringify({ id: files[0].id }) })
  ok(d1.code === 200 && d1.data.names === F2, `⑦-1 删除A 后 names 只剩B(实际 "${d1.data?.names}")`)
  const q2 = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 300 }) })
  const row2 = (q2.data.rows || q2.data.list || []).find((r) => (r['单据编号'] || r['编号']) === docNo)
  ok(row2 && row2[FIELD] === F2, `⑦-2 头字段列同步只剩B(实际 "${row2 && row2[FIELD]}")`)

  // ── ⑧ 清理:删附件B → 列空/头字段列清空 → 删测试单据 ──
  const d2 = await api('/api/attachment/delete', { method: 'POST', body: JSON.stringify({ id: files[1].id }) })
  ok(d2.code === 200 && d2.data.names === '' && d2.data.files.length === 0, '⑧-1 删B 后附件与文件名串为空')
  const del = await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '删除', formData: { 编号: docNo }, buttonParam: {} }) })
  ok(del.code === 200, '⑧-2 测试草稿已删除留痕')

  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
