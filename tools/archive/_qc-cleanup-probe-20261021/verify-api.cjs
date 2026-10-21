const BASE = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ'
const CRED = { userName: 'admin', password: '123456' }

async function main() {
  const lr = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ...CRED, factory: FACTORY }),
  }).then(r => r.json())
  const token = lr?.data?.token
  if (!token) throw new Error('login failed: ' + JSON.stringify(lr).slice(0, 300))
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

  async function list(panel, pageSize = 500) {
    const r = await fetch(BASE + '/px/queryFormDataList', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize, condition: {} }),
    }).then(r => r.json())
    return r?.data?.list ?? []
  }

  const insp = await list('QC_INSP')
  console.log('QC_INSP list:', insp.length)
  for (const d of insp.slice(0, 20)) console.log(' ', d['编号'], d['单据日期'], d['批次号'], d['审核人'], d['单据状态'], d['总结论'])

  const cat = await list('QC_CATALOG')
  console.log('QC_CATALOG list:', cat.length, cat.map(d => d['编号']).join(','))

  const rec = await list('QC_INSP_REC')
  console.log('QC_INSP_REC list:', rec.length)
  for (const d of rec.slice(0, 5)) console.log(' ', d['编号'], d['单据日期'], d['检验结论'], d['检验人'], d['单据状态'])

  const ret = await list('QC_RETURN')
  console.log('QC_RETURN list:', ret.length)
  for (const d of ret.slice(0, 20)) console.log(' ', d['编号'], d['单据日期'], d['检验单号'], d['数量'], d['单据状态'])

  const pi = await list('PURCHASE_IN')
  const mine = pi.filter(d => /^IJ-/.test(String(d['来源单号'] || '')))
  console.log('PURCHASE_IN list:', pi.length, 'from QC_INSP:', mine.length)
}

main().catch(e => { console.error(e); process.exit(1) })
