const B='http://127.0.0.1:8090'
const t=(await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()).data.token
const md=(await (await fetch(B+'/api/px/getPanelConfig?panelCode=WHLOC',{headers:{Authorization:'Bearer '+t}})).json()).data.metadata
console.log('metadata 顶层键:', Object.keys(md).join(' / '))
const hits=[]
;(function walk(o,path){
  if (!o || typeof o!=='object') return
  if (Array.isArray(o)) { o.forEach((v,i)=>walk(v, path+'['+i+']')); return }
  const nm = o.dataName ?? o.label ?? o.prop
  if ((nm==='存储分区'||nm==='大区') && ('options' in o || 'dataType' in o || 'data_type' in o))
    hits.push({path, dataName:nm, dataType:o.dataType ?? o.data_type, options:o.options})
  for (const k of Object.keys(o)) walk(o[k], path+'.'+k)
})(md,'metadata')
console.log('\n命中的字段对象:')
for (const h of hits) console.log(' ', h.path, '=>', JSON.stringify(h))
if (!hits.length) console.log('  (没找到带 options 的字段对象)')