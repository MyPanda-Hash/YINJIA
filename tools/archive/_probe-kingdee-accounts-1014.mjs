/**
 * 只读探针(2026-10-14):把「我们手上到底有几个金蝶账套、各自有没有生产工单」一次性列清楚。
 *
 * 起因:用户问「金蝶真实账套有没有生产工单的数据」以及「你说的另一个账套是哪一个」。
 *   本探针回答的正是后者 —— 用 push_app_authorize 接口**枚举本应用被授权的全部账套**,
 *   再逐个查生产相关单据的数量,把口径钉死(不靠猜、不靠记忆)。
 *
 * 已知凭证(两份,别混):
 *   · deploy/config.json      → 应用 clientId 359797(真实账套,MES 基础资料/订单同步用它)
 *   · deploy/push/config.json → 应用 clientId 359220(沙箱;转ERP 推送默认落它)
 *   两份都可能被授权了**多个** outerInstanceId,故这里逐个枚举而不是硬编码。
 *
 * 只读(全部 GET / 只取授权记录),不写任何单据、不改任何配置。
 * 用法:  node tools/archive/_probe-kingdee-accounts-1014.mjs
 * 产物:  tools/archive/_probe-kingdee-accounts-1014.out.txt(UTF-8)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet, makeApiSignature } from '../../deploy/kingdee-client.mjs'

const API_BASE = 'https://api.kingdee.com'
const AUTH_PATH = '/jdyconnector/app_management/push_app_authorize'
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const REDACT = /secret|appkey|token/i

/** 拉某应用的**全部**授权账套记录(appKey/appSecret 等密钥字段一律隐去) */
async function authorizedInstances(cfg) {
  const ts = String(Date.now())
  const nonce = String(Math.floor(Math.random() * 2147483646) + 1)
  const sig = makeApiSignature(cfg.clientSecret, 'POST', AUTH_PATH, {}, nonce, ts)
  const res = await fetch(API_BASE + AUTH_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-ClientID': cfg.clientId,
      'X-Api-Auth-Version': '2.0',
      'X-Api-TimeStamp': ts, 'X-Api-Nonce': nonce,
      'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
      'X-Api-Signature': sig,
      'X-GW-Router-Addr': cfg.domain,
    },
    body: '{}',
  })
  const json = await res.json().catch(() => ({}))
  const list = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : [])
  return list.map((x) => {
    const clean = {}
    for (const k of Object.keys(x || {})) clean[k] = REDACT.test(k) ? '(已隐去)' : x[k]
    return clean
  })
}

const PROBES = [
  ['/jdy/v2/pm/mo_taskbill', '生产任务单'],
  ['/jdy/v2/pm/subm_workorder', '委外加工单'],
  ['/jdy/v2/scm/inv_pick', '生产领料单'],
  ['/jdy/v2/scm/inv_product', '产品入库单'],
  ['/jdy/v2/bd/material', '商品'],
]

say('=== 金蝶账套全量盘点 + 生产工单有无(只读)===')
say(`时间: ${new Date().toISOString()}\n`)

for (const [name, path, tag] of [
  ['真实账套(MES 同步用)', '../../deploy/config.json', 'REAL'],
  ['沙箱(转ERP 默认落它)', '../../deploy/push/config.json', 'SANDBOX'],
]) {
  const cfg = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')).kingdee
  say(`\n########## ${name} —— 应用 clientId=${cfg.clientId}(${tag})##########`)
  let list
  try {
    list = await authorizedInstances(cfg)
    say(`push_app_authorize 返回 ${list.length} 条授权记录:`)
    for (const x of list) {
      say(`  · 企业=${x.accountName || x.agreementCompanyName}  outerInstanceId=${x.outerInstanceId}  instanceId=${x.instanceId}  accountId=${x.accountId}  domain=${x.domain}  到期=${x.instanceExpiresTime}  status=${x.status}`)
    }
  } catch (e) {
    say(`  ❌ 取授权记录失败: ${e.message}`)
    continue
  }
  for (const inst of list) {
    const oid = inst.outerInstanceId
    if (!oid) continue
    say(`\n  --- 账套 [${inst.accountName || inst.agreementCompanyName}] outerInstanceId=${oid} ---`)
    try {
      const { token } = await fetchAppToken({ ...cfg, outerInstanceId: oid })
      for (const [p, label] of PROBES) {
        const r = await kingdeeTryGet({ ...cfg, outerInstanceId: oid }, token, p, { page: '1', page_size: '1' })
        say(`    ${label.padEnd(6)} ${p.padEnd(30)} ${r.ok ? '✅ count=' + r.data.count : '❌ ' + String(r.error).slice(0, 90)}`)
        await sleep(220)
      }
    } catch (e) {
      say(`    ❌ token/查询失败: ${e.message}`)
    }
  }
}

say('\n=== 结论口径 ===')
say('若上述**每个**账套的「生产任务单(mo_taskbill)」都是 0,则:星辰开放接口里没有可拉的生产工单;')
say('工单只可能在生态应用(云蝶轻智造/轻智造云)自有库中,须走该应用方通道 —— 见 deploy/云蝶轻智造对接需求清单.md。')

const f = new URL('./_probe-kingdee-accounts-1014.out.txt', import.meta.url)
writeFileSync(f, out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-accounts-1014.out.txt')
