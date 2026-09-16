// 金蝶云·星辰 OpenAPI 客户端(认证+签名+GET)
// 算法依据 open.jdy.com 官方文档,并已用文档自带示例值端到端验证通过(见 _verify-signature.mjs):
//   ① app_signature      = Base64( HMAC-SHA256(app_key, key=appSecret) 的16进制小写 )
//   ② X-Api-Signature    = Base64( HMAC-SHA256(签名原文, key=clientSecret) 的16进制小写 )
//      签名原文 = METHOD\n URL编码(path)\n 排序参数(值双重URL编码)\n x-api-nonce:N\n x-api-timestamp:T\n
//      ⚠ 最后一行 x-api-timestamp 后必须带换行符(实测:缺它签名不匹配)
import { createHmac } from 'node:crypto';

const API_BASE = 'https://api.kingdee.com';
const TOKEN_PATH = '/jdyconnector/app_management/kingdee_auth_token';
const AUTH_PATH = '/jdyconnector/app_management/push_app_authorize';

const hmacHexLower = (key, msg) => createHmac('sha256', key).update(msg, 'utf8').digest('hex');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const enc1 = (s) => encodeURIComponent(String(s));          // 一次URL编码(大写十六进制)
const enc2 = (s) => encodeURIComponent(enc1(s));            // 二次URL编码

/** app-token 接口参数 app_signature */
export function makeAppSignature(appKey, appSecret) {
  return b64(hmacHexLower(appSecret, appKey));
}

/** X-Api-Signature 签名原文(尾部换行不可省) */
export function buildSignPlain(method, path, params, nonce, timestamp) {
  const qs = Object.keys(params)
    .sort()                                                    // 参数名 ASCII 升序
    .map((k) => `${k}=${enc2(params[k])}`)
    .join('&');
  return [method.toUpperCase(), enc1(path), qs,
    `x-api-nonce:${nonce}`, `x-api-timestamp:${timestamp}`].join('\n') + '\n';
}

export function makeApiSignature(clientSecret, method, path, params, nonce, timestamp) {
  return b64(hmacHexLower(clientSecret, buildSignPlain(method, path, params, nonce, timestamp)));
}

/** 实际请求 URL:查询串与签名同序(参数名升序)、值单次URL编码 */
function buildUrl(path, params) {
  const qs = Object.keys(params).sort().map((k) => `${k}=${enc1(params[k])}`).join('&');
  return `${API_BASE}${path}?${qs}`;
}

/** 构造带签名的公共 headers */
function signHeaders(cfg, method, path, params) {
  const timestamp = String(Date.now());                        // 毫秒,5分钟内有效
  const nonce = String(Math.floor(Math.random() * 2147483646) + 1); // 随机正整数
  return {
    'Content-Type': 'application/json',
    'X-Api-ClientID': cfg.clientId,
    'X-Api-Auth-Version': '2.0',
    'X-Api-TimeStamp': timestamp,
    'X-Api-Nonce': nonce,
    'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
    'X-Api-Signature': makeApiSignature(cfg.clientSecret, method, path, params, nonce, timestamp),
  };
}

async function httpJson(url, headers, method = 'GET') {
  const res = await fetch(url, { headers, method, body: method === 'POST' ? '{}' : undefined });
  if (res.status === 429) throw new Error('HTTP 429 已被限流(账套级 500次/分钟)');
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * 主动获取授权信息(POST /jdyconnector/app_management/push_app_authorize)
 * 只需 clientId/clientSecret + outerInstanceId,即可拿到当前 appKey/appSecret/domain。
 * 注:appSecret 24小时动态刷新(官方文档),不能写死在配置里,须动态获取。
 */
export async function fetchAuthorization(cfg) {
  const params = { outerInstanceId: cfg.outerInstanceId };
  const json = await httpJson(buildUrl(AUTH_PATH, params),
    { ...signHeaders(cfg, 'POST', AUTH_PATH, params), 'X-GW-Router-Addr': cfg.domain }, 'POST');
  // 该接口响应可能是 errcode/description 或 code/msg 两种格式,兼容处理
  const ok = json.errcode === 0 || json.code === 200;
  if (!ok) throw new Error(`主动获取授权失败: ${JSON.stringify(json).slice(0, 300)}`);
  const list = Array.isArray(json.data) ? json.data : [];
  const hit = list.find((x) => String(x.status) === '1') || list[0];
  if (!hit || !hit.appKey || !hit.appSecret) throw new Error('授权信息响应中缺少 appKey/appSecret');
  return { appKey: hit.appKey, appSecret: hit.appSecret, domain: hit.domain || cfg.domain };
}

/** 用指定 appKey/appSecret 换 app-token */
async function requestToken(cfg, appKey, appSecret) {
  const params = {
    app_key: appKey,
    app_signature: makeAppSignature(appKey, appSecret),
  };
  const json = await httpJson(buildUrl(TOKEN_PATH, params),
    { ...signHeaders(cfg, 'GET', TOKEN_PATH, params), 'X-GW-Router-Addr': cfg.domain });
  if (json.errcode !== 0) {
    // 1030002006: 授权密钥校验失败(多因 appSecret 24h 轮换)
    throw new Error(`获取app-token失败 errcode=${json.errcode} ${json.description || ''}`);
  }
  const token = json.data && json.data['app-token'];
  if (!token) throw new Error('获取app-token失败:响应缺少 app-token 字段');
  return token;
}

/**
 * 获取账套级 app-token(有效期24小时,调用方负责缓存;接口限频2次/分钟,切勿频繁调用)。
 * 配置了 outerInstanceId 时自动先取最新授权信息(appSecret 24h 轮换,不能写死);
 * 未配置时回退用 config 里的 appKey/appSecret(仅沙箱等静态密钥场景)。
 * 返回 { token, domain }(domain 以授权信息返回为准,可能刷新)。
 */
export async function fetchAppToken(cfg) {
  let appKey = cfg.appKey, appSecret = cfg.appSecret, domain = cfg.domain;
  if (cfg.outerInstanceId) ({ appKey, appSecret, domain } = await fetchAuthorization(cfg));
  try {
    return { token: await requestToken(cfg, appKey, appSecret), domain };
  } catch (e) {
    if (/1030002006/.test(String(e.message)) && cfg.outerInstanceId) {
      // appSecret 已轮换 → 重取授权信息再试一次
      ({ appKey, appSecret, domain } = await fetchAuthorization(cfg));
      return { token: await requestToken(cfg, appKey, appSecret), domain };
    }
    throw e;
  }
}

/**
 * 调用业务 GET 接口(自动带 app-token 与 X-GW-Router-Addr),返回 data 部分。
 * 网络错误/限流自动重试(共3次,递增退避)。
 */
export async function kingdeeGet(cfg, token, path, params) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const headers = {
        ...signHeaders(cfg, 'GET', path, params),
        'app-token': token,
        'X-GW-Router-Addr': cfg.domain,
      };
      const json = await httpJson(buildUrl(path, params), headers);
      if (json.errcode !== 0) throw new Error(`星辰接口 errcode=${json.errcode} ${json.description || ''} [${path}]`);
      return json.data;
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * 单次尝试 GET(不重试):探测类场景使用(接口不存在/无权限时快速失败)。
 * 返回 { ok, data?, error? } 而不抛异常。
 */
export async function kingdeeTryGet(cfg, token, path, params) {
  try {
    const headers = {
      ...signHeaders(cfg, 'GET', path, params),
      'app-token': token,
      'X-GW-Router-Addr': cfg.domain,
    };
    const json = await httpJson(buildUrl(path, params), headers);
    if (json.errcode !== 0) return { ok: false, error: `errcode=${json.errcode} ${json.description || ''}` };
    return { ok: true, data: json.data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 调用业务 POST 接口(写入金蝶),返回 { ok, data?, error? }。
 * body 为 JS 对象(自动 JSON 序列化);签名仅对 URL 参数(不含 body)。
 * 自动重试(共3次,递增退避)。
 */
export async function kingdeePost(cfg, token, path, params, body) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const timestamp = String(Date.now());
      const nonce = String(Math.floor(Math.random() * 2147483646) + 1);
      const url = buildUrl(path, params || {});
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-ClientID': cfg.clientId,
          'X-Api-Auth-Version': '2.0',
          'X-Api-TimeStamp': timestamp,
          'X-Api-Nonce': nonce,
          'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
          'X-Api-Signature': makeApiSignature(cfg.clientSecret, 'POST', path, params || {}, nonce, timestamp),
          'app-token': token,
          'X-GW-Router-Addr': cfg.domain,
        },
        body: JSON.stringify(body || {}),
      });
      if (res.status === 429) throw new Error('HTTP 429 已被限流(账套级 500次/分钟)');
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      if (json.errcode !== 0) return { ok: false, error: `errcode=${json.errcode} ${json.description || ''} [POST ${path}]`, raw: json };
      return { ok: true, data: json.data, raw: json };
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return { ok: false, error: lastErr.message };
}
