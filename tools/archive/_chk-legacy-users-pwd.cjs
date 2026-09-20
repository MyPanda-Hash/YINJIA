/**
 * _chk-legacy-users-pwd.cjs — 遗留表 users.Password 是什么格式、App 用不用它(只读,脱敏)
 *
 * 背景:yj_user.password_hash 是 Spring BCrypt($2a$10$);但库里还有一张遗留 users 表带
 *      Password 列且有 5 行非空 —— 小程序接入口令前必须确认它是不是明文/老哈希,
 *      以及现系统登录是否读它(读它就意味着两套口令并存)。
 * 脱敏:只输出"格式判定 + 长度 + 首字符",不输出可用口令内容。
 * 用法:node tools/archive/_chk-legacy-users-pwd.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

console.log('=== users 表结构(口令相关列 + 账号列)===')
console.log(s(`SELECT c.name+' '+ty.name+' len='+CAST(c.max_length AS varchar)+' null='+CAST(c.is_nullable AS varchar)
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
  WHERE c.object_id=OBJECT_ID('users') ORDER BY c.column_id`))

console.log('')
console.log('=== 每一行的口令格式判定(脱敏;账号列是遗留命名 userna)===')
const rows = lines(`SELECT ISNULL(CAST(id AS varchar),'-')+'|'+ISNULL(CAST(userna AS nvarchar(60)),'-')+'|'
  +ISNULL(CAST(Password AS nvarchar(200)),'')+'|'+CAST(LEN(ISNULL(Password,N'')) AS varchar)
  +'|'+ISNULL(CAST(unionid AS nvarchar(60)),'-')+'|'+ISNULL(CAST(islogin AS nvarchar(4)),'-')
  FROM users ORDER BY id`)
for (const row of rows) {
  const [id, user, pwd, len, unionid, islogin] = row.split('|')
  const p = pwd || ''
  let kind = '空'
  if (!p) kind = '空'
  else if (/^\$2[aby]\$\d{2}\$/.test(p)) kind = 'BCrypt(' + p.slice(0, 7) + ', len=' + len + ')'
  else if (/^[0-9a-fA-F]{32}$/.test(p)) kind = '疑似 MD5(32 位十六进制)'
  else if (/^[0-9a-fA-F]{40}$/.test(p)) kind = '疑似 SHA-1(40 位十六进制)'
  else if (/^[0-9a-fA-F]{64}$/.test(p)) kind = '疑似 SHA-256(64 位十六进制)'
  else if (/^[\x20-\x7e]{1,40}$/.test(p)) kind = '⚠ 疑似明文(纯可读字符)'
  else kind = '其它(含非可读字符)'
  console.log(`  id=${id} 账号=${user} 口令长度=${len} 微信unionid=${unionid === '-' ? '无' : '有'} islogin=${islogin} → ${kind}`)
}

console.log('')
console.log('=== 遗留账号与 yj_user 的交集(同名意味着双份口令并存)===')
console.log(s(`SELECT 'users='+CAST((SELECT COUNT(*) FROM users) AS varchar)
  +' yj_user='+CAST((SELECT COUNT(*) FROM yj_user) AS varchar)
  +' 同名='+CAST((SELECT COUNT(*) FROM users u JOIN yj_user y ON y.username=CAST(u.userna AS nvarchar(60))) AS varchar)`))
