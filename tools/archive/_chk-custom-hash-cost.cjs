/**
 * _chk-custom-hash-cost.cjs — 「换成自己的简单哈希」到底会怎样(实测,不是推断)
 *
 * 三件事一次测清:
 *   ① 单方面换:把 MD5 / 明文 / 无盐 SHA-256 写进 yj_user,用正确口令登录 → 服务端认不认?
 *      (对照:同样位置的 BCrypt 能登进去) —— 证明"只改小程序"做不到
 *   ② 安全代价:实测简单哈希的爆破速度,折算"6 位纯数字口令枚举完要多久"
 *   ③ 后端对非 BCrypt 输入的具体反应(返回码 + 日志告警原文)
 * 用法:node tools/archive/_chk-custom-hash-cost.cjs
 */
'use strict'
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PW = '123456'
const PREFIX = 'probe_custom_'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

/** 报告里那条 BCrypt 对照值(不硬编码:从文档里取,文档变了这里就得跟着变) */
function bcryptFromDoc() {
  const md = fs.readFileSync(path.join('docs', 'development', '密码哈希口径-BCrypt.md'), 'utf8')
  const m = md.match(/\|\s*`123456`\s*\|\s*`(\$2[aby]\$[^`]+)`\s*\|/)
  return m && m[1]
}

const CANDIDATES = [
  ['MD5(单轮,无盐)', () => crypto.createHash('md5').update(PW, 'utf8').digest('hex')],
  ['明文(不哈希)', () => PW],
  ['SHA-256(单轮,无盐)', () => crypto.createHash('sha256').update(PW, 'utf8').digest('hex')],
  ['MD5(加固定盐,仍单轮)', () => crypto.createHash('md5').update(PW + 'yinjia', 'utf8').digest('hex')],
]

;(async () => {
  let bad = 0
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }
  const login = async (userName, password) => {
    const r = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, password }),
    })
    const j = await r.json().catch(() => ({}))
    return { http: r.status, code: j.code, msg: j.message, token: j.data && j.data.token }
  }
  const putUser = (name, hash) => {
    sql(`DELETE FROM yj_user WHERE username='${name}'`)
    sql(`INSERT INTO yj_user (username, password_hash, real_name, is_admin, enabled)
         VALUES ('${name}', '${String(hash).replace(/'/g, "''")}', N'自定义哈希探针', 'N', '1')`)
  }

  console.log('=== ① 单方面换成"简单哈希"写进库,再用**正确口令**登录 ===')
  const results = []
  for (const [label, make] of CANDIDATES) {
    const name = PREFIX + results.length
    const hash = make()
    putUser(name, hash)
    const r = await login(name, PW)
    results.push({ label, hash: String(hash).slice(0, 24) + '…', ...r })
    console.log(`  ${label.padEnd(24)} 库里存 ${String(hash).slice(0, 20)}…  登录 → HTTP ${r.http} ${JSON.stringify(r.msg)}`)
  }
  const bcryptHash = bcryptFromDoc()
  if (!bcryptHash) {
    console.log('  ⊘ 文档里没找到 BCrypt 对照向量,跳过对照')
  } else {
    const name = PREFIX + 'bcrypt'
    putUser(name, bcryptHash)
    const r = await login(name, PW)
    results.push({ label: 'BCrypt(现方案,对照)', ...r })
    console.log(`  ${'BCrypt(现方案,对照)'.padEnd(24)} 库里存 ${bcryptHash.slice(0, 20)}…  登录 → HTTP ${r.http} ${JSON.stringify(r.msg)}`)
  }
  const allSimpleFailed = results.filter((r) => !r.label.startsWith('BCrypt')).every((r) => r.http !== 200)
  const bcryptOk = results.find((r) => r.label.startsWith('BCrypt'))
  chk('简单哈希/明文写进库 → 正确口令也登不进去', allSimpleFailed,
    results.filter((r) => !r.label.startsWith('BCrypt')).map((r) => `${r.label}=${r.http}`).join(' '))
  if (bcryptOk) chk('同一位置的 BCrypt → 正常登录(对照成立)', bcryptOk.http === 200, 'HTTP ' + bcryptOk.http)

  console.log('')
  console.log('=== ② 简单哈希的爆破代价(本机实测,单线程 JS) ===')
  const N = 400000
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < N; i++) crypto.createHash('md5').update('000000' + i, 'utf8').digest('hex')
  const t1 = process.hrtime.bigint()
  const perSec = N / (Number(t1 - t0) / 1e9)
  const sixDigit = 1e6
  const md5Seconds = sixDigit / perSec
  console.log(`  MD5 速度 ≈ ${Math.round(perSec).toLocaleString()} 次/秒(单线程 JS;C/GPU 还要快几个数量级)`)
  console.log(`  ⇒ 6 位纯数字口令(共 ${sixDigit.toLocaleString()} 个候选)**全部枚举** ≈ ${md5Seconds.toFixed(2)} 秒`)
  console.log(`  ⇒ 8 位纯数字 ≈ ${(1e8 / perSec / 60).toFixed(1)} 分钟;12 位纯数字 ≈ ${(1e12 / perSec / 86400).toFixed(1)} 天`)
  chk('简单哈希对 6 位数字口令 = 秒级破完(即"等于没有防护")', md5Seconds < 60, md5Seconds.toFixed(2) + ' 秒')

  console.log('')
  console.log('=== ③ 后端对"非 BCrypt 输入"的具体反应(日志原文) ===')
  const logs = fs.readdirSync('C:\\INCER\\_rd-work').filter((f) => /^backend-.*\.log$/.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join('C:\\INCER\\_rd-work', f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!logs.length) { console.log('  ⊘ 没找到后端日志,跳过') } else {
    const latest = path.join('C:\\INCER\\_rd-work', logs[0].f)
    const text = fs.readFileSync(latest, 'utf8')
    const hit = text.split(/\r?\n/).filter((l) => /does not look like BCrypt|BCrypt/.test(l)).slice(-3)
    console.log(`  日志文件 ${logs[0].f}:`)
    for (const l of hit) console.log('    ' + l.trim().slice(0, 200))
    if (!hit.length) console.log('    (未捕获到 BCrypt 相关告警行)')
  }

  console.log('')
  console.log('=== 清理 ===')
  sql(`DELETE FROM yj_user WHERE username LIKE '${PREFIX}%'`)
  const left = sql(`SELECT COUNT(*) FROM yj_user WHERE username LIKE '${PREFIX}%'`)
  console.log(`  残留=${left}`)
  chk('探针账号已清理', left === '0', left)

  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 结论成立:单方面换哈希 = 登录不了;简单哈希 = 秒级可破')
  process.exit(bad ? 1 : 0)
})().catch((e) => {
  try { sql(`DELETE FROM yj_user WHERE username LIKE '${PREFIX}%'`) } catch { /* 尽力清理 */ }
  console.error('异常:', e.stack || e.message); process.exit(1)
})
