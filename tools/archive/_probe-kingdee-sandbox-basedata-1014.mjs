/**
 * 探针 0(只读,2026-10-14):锁定沙箱账套口径 + 取基础资料 id。
 *
 * 目的(对应任务步骤 1、2):
 *   ① 用 `deploy/push/config.json`(应用 clientId=359220)的静态 clientSecret 调
 *      `push_app_authorize` **枚举本应用被授权的全部账套**,再用 `/jdy/v2/bd/material` 的 count
 *      判定静态密钥实际打到**哪个** outerInstanceId
 *      (沙箱有两实例:579023121319858176 商品 48 个 / 579046204055359488 商品 298 个);
 *   ② 从该实例取基础资料 id:商品 bd/material、计量单位 bd/measure_unit、仓库 bd/store、
 *      职员 bd/emp、部门 bd/department —— 各取 2~3 个可用样本(id + number + name 全记),
 *      供后面的保存探针直接复用(金蝶保存接口多数情况**收 id 不收编码**)。
 *
 * 🔴 铁律:本探针**只读**(全部 GET + 授权枚举),不 POST 任何业务单据。
 * 🔴 凭证只用 `deploy/push/config.json`(沙箱);**绝不**读 `deploy/config.json`(客户真实账套)。
 *
 * 用法:  node tools/archive/_probe-kingdee-sandbox-basedata-1014.mjs
 * 产物:  tools/archive/_dump-out/kingdee-sandbox-basedata-1014.md(UTF-8)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { fetchAppToken, kingdeeTryGet, makeApiSignature } from '../../deploy/kingdee-client.mjs'

const API_BASE = 'https://api.kingdee.com'
const AUTH_PATH = '/jdyconnector/app_management/push_app_authorize'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT_DIR = path.join(ROOT, 'tools/archive/_dump-out')

const lines = []
const say = (s) => { lines.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const REDACT = /secret|appkey/i

// ── 凭证:沙箱(deploy/push/config.json)─────────────────────────────
const cfgPath = path.join(ROOT, 'deploy/push/config.json')
const cfgRaw = JSON.parse(readFileSync(cfgPath, 'utf8'))
const cfg = { ...cfgRaw.kingdee }
if (!cfg.clientId) throw new Error('deploy/push/config.json 缺 kingdee.clientId')
if (cfg.outerInstanceId) {
  // 防呆:push 配置里若出现 outerInstanceId,说明凭证被换成真实账套了 —— 立刻停,别探测下去
  throw new Error(`deploy/push/config.json 里出现 outerInstanceId=${cfg.outerInstanceId}(疑似真实账套),本探针只许打沙箱,已中止`)
}

say('# 沙箱账套口径 + 基础资料 id(只读探针产物)')
say('')
say(`- 探针: \`tools/archive/_probe-kingdee-sandbox-basedata-1014.mjs\``)
say(`- 抓取时间: ${new Date().toISOString()}`)
say(`- 凭证来源: \`deploy/push/config.json\`(应用 clientId=${cfg.clientId};appKey/appSecret ${cfg.appKey ? '有' : '空'},sandboxInstanceId=${cfg.sandboxInstanceId || '(空)'})`)
say('')

// ── ① 枚举该应用的授权账套 ─────────────────────────────────────────
async function authorizedInstances(k) {
  const ts = String(Date.now())
  const nonce = String(Math.floor(Math.random() * 2147483646) + 1)
  const sig = makeApiSignature(k.clientSecret, 'POST', AUTH_PATH, {}, nonce, ts)
  const res = await fetch(API_BASE + AUTH_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-ClientID': k.clientId,
      'X-Api-Auth-Version': '2.0',
      'X-Api-TimeStamp': ts, 'X-Api-Nonce': nonce,
      'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
      'X-Api-Signature': sig,
      'X-GW-Router-Addr': k.domain,
    },
    body: '{}',
  })
  const json = await res.json().catch(() => ({}))
  if (json.errcode !== undefined && json.errcode !== 0) throw new Error(`errcode=${json.errcode} ${json.description || ''}`)
  const list = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : [])
  return list.map((x) => {
    const clean = {}
    for (const kk of Object.keys(x || {})) clean[kk] = REDACT.test(kk) ? '(已隐去)' : x[kk]
    return clean
  })
}

say('## ① 本应用(clientId=' + cfg.clientId + ')被授权的账套')
say('')
const instances = await authorizedInstances(cfg)
say(`push_app_authorize 返回 **${instances.length}** 条授权记录:`)
say('')
say('| 企业名 | outerInstanceId | instanceId | accountId | domain | status |')
say('|---|---|---|---|---|---|')
for (const x of instances) {
  say(`| ${x.accountName || x.agreementCompanyName || ''} | ${x.outerInstanceId} | ${x.instanceId || ''} | ${x.accountId || ''} | ${x.domain || ''} | ${x.status} |`)
}
say('')

// ── ② 逐个实例查商品 count,判定静态密钥打哪个 ───────────────────────
async function materialCount(k, oid) {
  const authCfg = { ...k, outerInstanceId: oid }
  const { token } = await fetchAppToken(authCfg)
  const r = await kingdeeTryGet({ ...k, outerInstanceId: oid }, token, '/jdy/v2/bd/material', { page: '1', page_size: '1' })
  return { token, r }
}

say('## ② 商品数量判定:静态密钥实际打到哪个实例')
say('')
say('| outerInstanceId | 企业名 | /jdy/v2/bd/material count | 与已知口径对照 |')
say('|---|---|---|---|')
const KNOWN = { 579023121319858176: '48 个商品(小实例)', 579046204055359488: '298 个商品(config.sandboxInstanceId 指向它)' }
let liveToken = null
let liveOid = null
for (const x of instances) {
  const oid = String(x.outerInstanceId || '')
  if (!oid) continue
  try {
    const { token, r } = await materialCount(cfg, oid)
    const cnt = r.ok ? r.data?.count : `❌ ${String(r.error).slice(0, 80)}`
    say(`| ${oid} | ${x.accountName || ''} | ${cnt} | ${KNOWN[oid] || '(未知)'} |`)
    if (r.ok && String(oid) === String(cfg.sandboxInstanceId)) { liveToken = token; liveOid = oid }
  } catch (e) {
    say(`| ${oid} | ${x.accountName || ''} | ❌ ${e.message.slice(0, 80)} | |`)
  }
  await sleep(250)
}
say('')

// 兜底:若枚举里没有 config.sandboxInstanceId,直接按它取
if (!liveToken) {
  const oid = String(cfg.sandboxInstanceId || '')
  if (!oid) throw new Error('config 里没有 sandboxInstanceId,无法定位沙箱实例')
  const { token } = await fetchAppToken({ ...cfg, outerInstanceId: oid })
  liveToken = token; liveOid = oid
  say(`(枚举列表里未含 ${oid},已按 config.sandboxInstanceId 直连)`)
  say('')
}
const authCfg = { ...cfg, outerInstanceId: liveOid }
const { domain } = await fetchAppToken(authCfg)
const call = (p, params) => kingdeeTryGet({ ...cfg, outerInstanceId: liveOid, domain }, liveToken, p, params)

say(`**本次实测账套 = outerInstanceId \`${liveOid}\`**(下面所有基础资料与保存探针都取自它)`)
say('')

// ── ③ 基础资料 id 采样 ─────────────────────────────────────────────
const ARCHIVES = [
  ['商品', '/jdy/v2/bd/material'],
  ['计量单位', '/jdy/v2/bd/measure_unit'],
  ['仓库', '/jdy/v2/bd/store'],
  ['职员', '/jdy/v2/bd/emp'],
  ['部门', '/jdy/v2/bd/department'],
]

say('## ③ 基础资料样本(id + number + name)')
say('')
const samples = {}
for (const [label, p] of ARCHIVES) {
  const r = await call(p, { page: '1', page_size: '5' })
  if (!r.ok) { say(`### ${label} \`${p}\` —— ❌ ${String(r.error).slice(0, 160)}`); say(''); continue }
  const d = r.data || {}
  const rows = d.rows || d.data || (Array.isArray(d) ? d : [])
  samples[label] = rows
  say(`### ${label} \`${p}\`(账套内共 ${d.count ?? '(无 count)'} 条)`)
  say('')
  say('| id | number | name | 其它关键键 |')
  say('|---|---|---|---|')
  for (const row of rows) {
    const extra = Object.keys(row).filter((k) => !['id', 'number', 'name', 'seq'].includes(k)).slice(0, 6)
      .map((k) => `${k}=${JSON.stringify(row[k])}`).join(' ')
    say(`| ${row.id} | ${row.number ?? ''} | ${row.name ?? ''} | ${extra.slice(0, 160)} |`)
  }
  say('')
  await sleep(220)
}

// 落盘(表头/分录字段清单由保存探针补写)
mkdirSync(OUT_DIR, { recursive: true })
const outFile = path.join(OUT_DIR, 'kingdee-sandbox-basedata-1014.md')
writeFileSync(outFile, lines.join('\n') + '\n', 'utf8')
console.log(`\n[产物已落盘] tools/archive/_dump-out/kingdee-sandbox-basedata-1014.md`)
