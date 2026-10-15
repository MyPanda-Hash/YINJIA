/**
 * _mk-token.mjs — 本机开发实例的登录令牌自签(只读探针用,免口令)。
 *
 * 为什么要它:8090 是开发实例,JWT 密钥取 application.yml 默认值(yinjia.jwt.secret,
 * 未用 YINJIA_JWT_SECRET 覆盖),而 yj_user 的口令是 PBKDF2 不可逆 —— 探针(CDP 截图/接口取证)
 * 需要一个 admin 令牌时,按同一算法自签一张即可,不必知道任何人的口令、也不改动任何账号。
 * 输出直接打到 stdout(只在本机进程间传递,不落盘)。
 */
import crypto from 'node:crypto'

const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const head = b64({ alg: 'HS256' })
const body = b64({ sub: process.env.YJ_PROBE_USER || 'admin', factory: process.env.YJ_PROBE_FACTORY || 'YJ', iat: now, exp: now + 8 * 3600 })
const sig = crypto.createHmac('sha256', SECRET).update(head + '.' + body).digest('base64url')
console.log(`${head}.${body}.${sig}`)
