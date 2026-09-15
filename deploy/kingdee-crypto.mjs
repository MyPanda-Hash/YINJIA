// 金蝶云·星辰「敏感数据解密」(官方文档《隐私数据解密》):
//   AES-256-CBC / PKCS7,密钥 = 应用 clientSecret(32 位 ASCII),IV 固定 '5e8y6w45ju8w9jq8',密文为 Base64。
// 用法:setSecret(cfg.kingdee.clientSecret) 后调 dec(密文) —— 失败返回 null 并计数(不阻断同步)。
import { createDecipheriv } from 'node:crypto';

const IV = '5e8y6w45ju8w9jq8';
let secret = null;
let okCount = 0, failCount = 0, lastErr = null;

export function setSecret(s) { secret = (s || '').trim() || null; }

/** 是否形如密文(Base64 且长度>=16,含填充 '=';明文短值不会命中) */
export function looksEncrypted(v) {
  return typeof v === 'string' && v.length >= 16 && /^[A-Za-z0-9+/]+={0,2}$/.test(v) && v.endsWith('=');
}

/** 解密单个敏感字段值;空值原样返回 null;失败记备注并返回 null */
export function dec(v) {
  if (v === undefined || v === null || v === '') return null;
  if (!secret) { failCount++; lastErr = '未配置 clientSecret'; return null; }
  try {
    const d = createDecipheriv('aes-256-cbc', Buffer.from(secret, 'ascii'), Buffer.from(IV, 'ascii'));
    const out = Buffer.concat([d.update(Buffer.from(String(v), 'base64')), d.final()]).toString('utf8');
    okCount++;
    return out;
  } catch (e) {
    failCount++; lastErr = e.message;
    return null;
  }
}

/** 统计(供同步结尾打印:解密成功/失败数,失败原因) */
export function cryptoStats() { return { ok: okCount, fail: failCount, lastErr }; }
export function resetCryptoStats() { okCount = 0; failCount = 0; lastErr = null; }
