/**
 * 沙箱探针 #2(2026-10-14):其他入库/其他出库的**业务类型到底哪个键必填**,以及业务类型档案接口是否存在。
 *
 * 为什么必须定位:上一支探针实测 —— 只发 `trans_type="2"`、或只发 `trans_type_number+name`,
 *   金蝶都报「请填写"业务类型"」;四个键一起发才成功。而**业务类型 id 是按账套不同的**,
 *   转ERP 必须按当前账套解析出正确的 id ⇒ 得先知道哪个键是决定性的、以及从哪个接口取候选。
 *
 * 🔴 只打沙箱(华实创新 579046204055359488)。用法:
 *   node tools/archive/_probe-kingdee-transtype-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-transtype-1014.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeePost, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { ...k, outerInstanceId: k.outerInstanceId || k.sandboxInstanceId }
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = new Date().toISOString().slice(0, 10)
const MATERIAL = '2569796588071402496', UNIT = '1', STOCK = '2569796666798488576'

const out = []
const say = (s) => { out.push(s); console.log(s) }
const BUILT = []
say('# 其他入库/出库「业务类型」键位定位(沙箱实测)')
say('')
say(`- 时间:${new Date().toISOString()}  账套:沙箱 outerInstanceId=${cfg.outerInstanceId}`)
say('')

const base = () => ({ bill_date: today, material_entity: [{ material_id: MATERIAL, qty: '1', unit_id: UNIT, stock_id: STOCK }] })

async function tryIt(docType, label, extra) {
  const body = { ...base(), ...extra }
  const r = await kingdeePost(cfg, token, `/jdy/v2/scm/${docType}`, {}, body)
  if (!r.ok) { say(`- [${docType}] ${label} → ❌ ${String(r.error).slice(0, 110)}`); return }
  const id = String(r.data?.ids?.[0] ?? '')
  const no = String(r.data?.id_number_map?.[id] ?? '')
  BUILT.push({ docType, id, bill_no: no })
  await sleep(400)
  const d = await kingdeeTryGet(cfg, token, `/jdy/v2/scm/${docType}_detail`, { id })
  const dd = d.ok ? d.data || {} : {}
  say(`- [${docType}] ${label} → ✅ ${no}  落库业务类型:id=\`${dd.trans_type_id ?? ''}\` number=\`${dd.trans_type_number ?? ''}\` name=\`${dd.trans_type_name ?? ''}\``)
}

say('## 一、业务类型键位:逐个单独试(其他入库,目标 id=12 / number=QTRKLX01)')
say('')
await tryIt('inv_other_in', '只发 trans_type_id="12"', { trans_type_id: '12' }); await sleep(600)
await tryIt('inv_other_in', '只发 trans_type_number="QTRKLX01"', { trans_type_number: 'QTRKLX01' }); await sleep(600)
await tryIt('inv_other_in', '只发 trans_type_name="其他入库"', { trans_type_name: '其他入库' }); await sleep(600)
await tryIt('inv_other_in', '只发 trans_type="2"', { trans_type: '2' }); await sleep(600)
await tryIt('inv_other_in', 'trans_type_id + trans_type_number', { trans_type_id: '12', trans_type_number: 'QTRKLX01' }); await sleep(600)

say('')
say('## 二、业务类型档案接口探测(能否按账套列出可选业务类型)')
say('')
for (const p of [
  '/jdy/v2/bd/trans_type', '/jdy/v2/scm/trans_type', '/jdy/v2/bd/trans_type_list',
  '/jdy/v2/scm/inv_trans_type', '/jdy/v2/bd/other_in_type', '/jdy/v2/bd/bill_type',
  '/jdy/v2/scm/inv_other_in_type', '/jdy/v2/sys/trans_type',
]) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '20' })
  say(`- ${p.padEnd(32)} ${r.ok ? '✅ count=' + r.data.count + ' 行示例=' + JSON.stringify((r.data.rows || [])[0] || {}).slice(0, 160) : '❌ ' + String(r.error).slice(0, 60)}`)
  await sleep(220)
}

say('')
say('## 三、本次创建的测试单')
say('')
for (const b of BUILT) say(`- [${b.docType}] id=\`${b.id}\` 单号=${b.bill_no}`)

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-transtype-1014.md', import.meta.url), out.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-transtype-1014.md')
