const B='http://127.0.0.1:8090'
const t=(await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()).data.token
const m=(await (await fetch(B+'/api/px/getPanelConfig?panelCode=WHLOC',{headers:{Authorization:'Bearer '+t}})).json()).data.metadata
const cols=m.panelPageDto.tablePages[0].gridTabs[0].columns
for (const want of ['大区','存储分区']) {
  const c=cols.find(x=>JSON.stringify(x).includes('"'+want+'"'))
  const f=(m.dataSchema?.fields||[]).find(x=>x.dataName===want) || (m.fields||[]).find(x=>x.dataName===want)
  console.log(`[${want}] 网格列原始对象:`, JSON.stringify(c))
  console.log(`        字段定义:`, JSON.stringify(f))
}
console.log('\nmetadata.fields 是否存在:', Array.isArray(m.fields), ' dataSchema.fields:', Array.isArray(m.dataSchema?.fields))