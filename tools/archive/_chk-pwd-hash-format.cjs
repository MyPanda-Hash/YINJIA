/**
 * _chk-pwd-hash-format.cjs — 盘清"密码到底存在哪、长什么样"(只读)
 *
 * 目的:微信小程序要用同一套口令校验,必须先确认:
 *   ① 存密码的表/列;② 哈希形态(算法/代价/长度/前缀);③ 有没有遗留的明文或 MD5 账号。
 * 脱敏:除 admin(种子账号,密码本身就是文档里的 123456)外,只打印前缀与长度,不打印完整哈希。
 * 用法:node tools/archive/_chk-pwd-hash-format.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

console.log('=== yj_user 账号与哈希形态(admin 完整,其余脱敏)===')
console.log(s(`SELECT username+' | enabled='+ISNULL(enabled,'-')+' | admin='+ISNULL(is_admin,'-')
  +' | len='+CAST(LEN(password_hash) AS varchar)
  +' | prefix='+CASE WHEN password_hash LIKE '$2a$%' THEN '$2a$' WHEN password_hash LIKE '$2b$%' THEN '$2b$'
       WHEN password_hash LIKE '$2y$%' THEN '$2y$' ELSE '其它:'+LEFT(ISNULL(password_hash,N'<null>'),6) END
  +' | cost='+CASE WHEN password_hash LIKE '$2_$__$%' THEN SUBSTRING(password_hash,5,2) ELSE '-' END
  +' | hash='+CASE WHEN username='admin' THEN ISNULL(password_hash,N'<null>')
       ELSE LEFT(ISNULL(password_hash,N'<null>'),7)+'…'+RIGHT(ISNULL(password_hash,N''),4) END
  FROM yj_user ORDER BY id`))

console.log('')
console.log('=== 形态统计(算法/代价分布)===')
console.log(s(`SELECT 'rows='+CAST(COUNT(*) AS varchar)
  +' $2a$='+CAST(SUM(CASE WHEN password_hash LIKE '$2a$%' THEN 1 ELSE 0 END) AS varchar)
  +' cost10='+CAST(SUM(CASE WHEN password_hash LIKE '$2_$10$%' THEN 1 ELSE 0 END) AS varchar)
  +' len60='+CAST(SUM(CASE WHEN LEN(password_hash)=60 THEN 1 ELSE 0 END) AS varchar)
  +' 非bcrypt='+CAST(SUM(CASE WHEN password_hash NOT LIKE '$2_$%' THEN 1 ELSE 0 END) AS varchar)
  FROM yj_user`))

console.log('')
console.log('=== 库里其它"像密码"的列(遗留表排查:明文/MD5 风险)===')
console.log(s(`SELECT t.name+' . '+c.name+' | '+ty.name+' len='+CAST(c.max_length AS varchar)
  FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
  WHERE (c.name LIKE '%pass%' OR c.name LIKE '%pwd%' OR c.name LIKE '%pword%' OR c.name LIKE '%mima%'
         OR c.name LIKE '%口令%' OR c.name LIKE '%密码%')
    AND t.name NOT LIKE 'RENAME_%' AND t.name NOT LIKE '%_bak_%' AND t.name NOT LIKE 'tmp_%'
  ORDER BY t.name, c.name`))

console.log('')
console.log('=== 这些列里有没有非空数据(逐表计数) ===')
const cols = lines(`SELECT t.name+'|'+c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
  WHERE (c.name LIKE '%pass%' OR c.name LIKE '%pwd%' OR c.name LIKE '%密码%') AND t.name<>'yj_user'
    AND t.name NOT LIKE 'RENAME_%' AND t.name NOT LIKE '%_bak_%' AND t.name NOT LIKE 'tmp_%'`)
for (const row of cols) {
  const [t, c] = row.split('|')
  try {
    const n = lines(`SELECT COUNT(*) FROM [${t}] WHERE [${c}] IS NOT NULL AND LTRIM(RTRIM(CONVERT(nvarchar(200),[${c}])))<>N''`)[0]
    if (n && n !== '0') console.log(`  ⚠ ${t}.${c} 非空行数=${n}`)
  } catch (e) { console.log(`  ⊘ ${t}.${c} 读取失败(跳过)`) }
}
console.log('  (无 ⚠ 行 = 其余表里没有实际存着的口令数据)')
