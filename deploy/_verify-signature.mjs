// 离线验证金蝶星辰 OpenAPI 两套签名算法(与官方文档示例值端到端比对,不联网)
// 文档来源: open.jdy.com 「获取app-token」「X-Api-Signature生成规则」
import { createHmac } from 'node:crypto';

// ---------- 通用工具 ----------
const hmacHex = (key, msg, upper = false) => {
  const h = createHmac('sha256', key).update(msg, 'utf8').digest('hex');
  return upper ? h.toUpperCase() : h;
};
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

// ---------- 1. app_signature(app-token 接口参数) ----------
// 文档: 通过 appSecret 对 app_key 进行 HmacSHA256 加密以 16 进制输出,再进行 Base64 加密
// 示例: app_key=abc, appSecret=abc123 => ZDljMTI3NGIyNTE1MTRkYzlkNjc1MDNhYjUzMzgzNWMyY2M4YTdjMzdmNmM3YTVlNDkxMTkzNjdiOTFjNzUyZQ==
const makeAppSignature = (appKey, appSecret) => b64(hmacHex(appSecret, appKey));

const EXPECT_APP_SIG = 'ZDljMTI3NGIyNTE1MTRkYzlkNjc1MDNhYjUzMzgzNWMyY2M4YTdjMzdmNmM3YTVlNDkxMTkzNjdiOTFjNzUyZQ==';
const gotAppSig = makeAppSignature('abc', 'abc123');
console.log('[1] app_signature');
console.log('    期望:', EXPECT_APP_SIG);
console.log('    实得:', gotAppSig);
console.log('    匹配:', gotAppSig === EXPECT_APP_SIG ? '✅' : '❌');

// ---------- 2. X-Api-Signature(请求头) ----------
// 签名原文 = METHOD\n URL编码(path)\n 排序参数(值双重URL编码)\n x-api-nonce:N\n x-api-timestamp:T [\n?]
const enc1 = (s) => encodeURIComponent(s);          // 一次 URL 编码(大写十六进制)
const enc2 = (s) => encodeURIComponent(enc1(s));    // 二次 URL 编码

const buildPlain = ({ method, path, params, nonce, timestamp, trailingNewline }) => {
  const lines = [
    method.toUpperCase(),
    enc1(path),
    params && Object.keys(params).length
      ? Object.keys(params).sort() // 参数名 ASCII 升序
          .map((k) => `${k}=${enc2(String(params[k]))}`)
          .join('&')
      : '',
    `x-api-nonce:${nonce}`,
    `x-api-timestamp:${timestamp}`,
  ];
  return lines.join('\n') + (trailingNewline ? '\n' : '');
};

const makeApiSignature = (clientSecret, plain) => b64(hmacHex(clientSecret, plain));

// 文档示例值
const DOC = {
  clientId: '200421',
  clientSecret: 'f2adcfef73369bfc4e1384677d38a0ff',
  method: 'GET',
  path: '/jdyconnector/app_management/kingdee_auth_token',
  params: {
    app_key: 'bVZgAZOv1',
    app_signature: 'MzZlYTk0ODk4MWZlNjdiODNmNWU4YzViNzYxNGM5MTFlOGJkN2NjMzk0MTJkZGNhZGM0NzZhN2YxZDJmOTlkZA==',
  },
  nonce: '4427456950',
  timestamp: '1670305063559',
};
const EXPECT_API_SIG = 'OTFiZTliNDFiMjNkYTI3YzVhNzg4MDI4ZGU3MWY1ZTA5ZTk1NjVlNGM1YTI1ZjIxY2Y5YTA3ZGY2OGI1MGQ1MQ==';

console.log('\n[2] X-Api-Signature(尝试尾部换行/十六进制大小写组合)');
for (const trailing of [true, false]) {
  const plain = buildPlain({ ...DOC, trailingNewline: trailing });
  const sig = makeApiSignature(DOC.clientSecret, plain);
  console.log(`    尾部换行=${trailing ? '有' : '无'} => ${sig}  ${sig === EXPECT_API_SIG ? '✅ 匹配文档' : ''}`);
}
console.log('    期望:', EXPECT_API_SIG);

// 打印签名原文供人工比对文档
console.log('\n[3] 签名原文(尾部带换行版本,\\n 显式显示):');
const plainShow = buildPlain({ ...DOC, trailingNewline: true }).replace(/\n/g, '\\n\n');
console.log(plainShow);
