/**
 * _apifetch.mjs — 探针共用的 HTTP 取数(带**网络级**重试)
 *
 * 为什么需要它(2026-09-22 实测):探针连本机后端(8090)偶发一次 `fetch failed` ——
 * node/undici 复用被 Tomcat 关掉的 keep-alive 连接时,请求会在连接上被 RST。
 * 后端没崩(同一 JVM 进程存活、无 hs_err、紧接着的请求全部成功),纯属连接层瞬时抖动;
 * 但探针因此整跑夭折、误报"失败"。这里对 **fetch 抛错(网络层)** 重试,业务错误
 * (响应 code≠0/200)照旧由调用方按失败处理 —— 重试不掩盖真实缺陷。
 *
 * 用法:
 *   import { fetchRetry } from './_apifetch.mjs';
 *   const res = await fetchRetry(API + '/px/...', { method: 'POST', headers: H, body: '...' });
 *   const j = await res.json();
 */

const ATTEMPTS = 3;        // 共 3 次(首试 + 2 重试)
const BACKOFF_MS = 400;    // 线性退避:400ms / 800ms

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch + 网络级重试:只有 fetch **本身抛错**(TypeError: fetch failed / ECONNRESET / ECONNREFUSED
 * 等连接层故障)才重试;拿到响应后(含 4xx/5xx)一律返回,由调用方决定成败 —— 不会把服务端
 * 真实错误吞成"重试后成功"。
 */
export async function fetchRetry(url, opts = {}) {
  let lastErr;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      lastErr = e;
      if (i < ATTEMPTS - 1) {
        console.error(`  [apifetch] 第 ${i + 1} 次网络失败(${e?.message || e}),${BACKOFF_MS * (i + 1)}ms 后重试:${url}`);
        await sleep(BACKOFF_MS * (i + 1));
      }
    }
  }
  throw lastErr;
}
