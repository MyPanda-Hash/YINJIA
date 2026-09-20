/**
 * _chk-login-bcrypt-interop.cjs — 端到端互操作:库里的哈希 ↔ 真实登录接口
 *
 * 意义:小程序(C)侧最终要产出的就是"报告里的那串 60 字符";本探针把该值直接写进 yj_user,
 *       再用**明文口令**走 POST /api/auth/login,证明整条链路(哈希格式/UTF-8/校验口径)一致。
 * 断言:
 *   ① 中文口令(银嘉123456)+ 报告里的哈希 → 登录成功并返回 token
 *   ② 错误口令 → 登录失败(非 200),且不是 500
 *   ③ 超 72 字节口令 → 登录失败(非 200、非 500;Spring matches 直接判 false)
 *   ④ 清理临时账号,不留残留
 * 用法:node tools/archive/_chk-login-bcrypt-interop.cjs
 */
'use strict'
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const REPORT = 'docs\\development\\密码哈希口径-BCrypt.md'   // 由 tools/verify/BcryptVerify.java 生成
const USER = 'probe_wx_interop'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

/** 从报告里取向量表(拒绝硬编码:报告变了探针就得跟着变,避免"文档与实现脱节") */
function vectorsFromReport() {
  const md = fs.readFileSync(REPORT, 'utf8')
  const out = {}
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([^`]*)`\s*\|\s*`(\$2[aby]\$[^`]+)`\s*\|$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

;(async () => {
  const vectors = vectorsFromReport()
  const pwCn = '银嘉123456'
  const hashCn = vectors[pwCn]
  if (!hashCn) { console.log(`⊘ 报告 ${REPORT} 里没有 ${pwCn} 的期望哈希,跳过`); process.exit(2) }
  console.log(`报告向量:pw=${pwCn} → ${hashCn}`)

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

  // 临时账号:直接写"报告里的哈希",口令只走明文登录
  sql(`DELETE FROM yj_user WHERE username='${USER}'`)
  const cols = sql(`SELECT c.name+'|'+CAST(c.is_nullable AS varchar) FROM sys.columns c
    WHERE c.object_id=OBJECT_ID('yj_user') AND c.name<>'id' AND c.is_nullable=0`)
  console.log(`  yj_user 非空列(除 id):${cols.split(/\r?\n/).join(' , ') || '无'}`)
  sql(`INSERT INTO yj_user (username, password_hash, real_name, is_admin, enabled) VALUES ('${USER}', '${hashCn}', N'小程序互操作探针', 'N', '1')`)
  console.log(`已插入临时账号 ${USER}(哈希来自报告,不是运行时算的)`)

  const ok = await login(USER, pwCn)
  console.log(`① 中文口令登录 → HTTP ${ok.http} code=${ok.code} msg=${JSON.stringify(ok.msg)} token=${ok.token ? '已返回' : '无'}`)
  chk('中文口令 + 报告哈希 → 登录成功且返回 token', ok.http === 200 && !!ok.token, JSON.stringify(ok.msg))

  const wrong = await login(USER, '银嘉123457')
  console.log(`② 错误口令登录 → HTTP ${wrong.http} code=${wrong.code} msg=${JSON.stringify(wrong.msg)}`)
  chk('错误口令被拒(非 200)且非 500', wrong.http !== 200 && wrong.http < 500, 'HTTP ' + wrong.http)

  const longPw = 'a'.repeat(80)
  const long = await login(USER, longPw)
  console.log(`③ 超 72 字节口令登录 → HTTP ${long.http} code=${long.code} msg=${JSON.stringify(long.msg)}`)
  chk('超长口令被拒(非 200)且非 500', long.http !== 200 && long.http < 500, 'HTTP ' + long.http)

  sql(`DELETE FROM yj_user WHERE username='${USER}'`)
  const left = sql(`SELECT COUNT(*) FROM yj_user WHERE username='${USER}'`)
  console.log(`④ 已清理临时账号,残留=${left}`)
  chk('无残留账号', left === '0', left)

  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 端到端互操作成立:报告里的哈希可直接登录,UTF-8/超长口径一致')
  process.exit(bad ? 1 : 0)
})().catch((e) => {
  try { sql(`DELETE FROM yj_user WHERE username='${USER}'`) } catch { /* 清理尽力而为 */ }
  console.error('异常:', e.stack || e.message)
  process.exit(1)
})
