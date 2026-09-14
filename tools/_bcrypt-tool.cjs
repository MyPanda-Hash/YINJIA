// tools/_bcrypt-tool.cjs — 账号密码 BCrypt 工具(与后端 BCryptPasswordEncoder 同参数族)
// 用法:
//   生成(设置/重置密码用): node tools/_bcrypt-tool.cjs hash <明文>        → 打印 $2a$10$... 可直接 UPDATE yj_user
//   校验(核对库里的哈希): node tools/_bcrypt-tool.cjs verify <明文> <哈希>
// 说明:后端 BCryptPasswordEncoder 默认 strength=10、无 salt 手工介入;matches 只认 $2a/$2b 前缀哈希。
const bcrypt = require(require('node:path').join(__dirname, '..', 'frontend', 'node_modules', 'bcryptjs'))

const cmd = process.argv[2]
const arg1 = process.argv[3]
const arg2 = process.argv[4]

if (cmd === 'hash') {
  if (!arg1) { console.error('用法: node tools/_bcrypt-tool.cjs hash <明文>'); process.exit(2) }
  // rounds=10 = Spring BCryptPasswordEncoder 默认强度
  const hash = bcrypt.hashSync(arg1, 10)
  console.log(hash)
  console.log(`\n-- SQL 示例(改 ${'用户名'} 的密码):\nUPDATE yj_user SET password_hash = N'${hash}' WHERE username = N'用户名';`)
} else if (cmd === 'verify') {
  if (!arg1 || !arg2) { console.error('用法: node tools/_bcrypt-tool.cjs verify <明文> <哈希>'); process.exit(2) }
  console.log(bcrypt.compareSync(arg1, arg2) ? 'MATCH ✔' : 'MISMATCH ✘')
} else {
  console.error('用法: node tools/_bcrypt-tool.cjs hash <明文> | verify <明文> <哈希>')
  process.exit(2)
}
