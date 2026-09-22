export function unwrap(res) {
  if (!res) return res
  return res.data ?? res
}

export function errMsg(e) {
  return e?.response?.data?.message || e?.message || String(e)
}

/**
 * 严格解包:服务端的"body-code"错误(HTTP 200 + code != 200)一律抛出。
 *
 * 为什么需要它(2026-09-22 用户报「无权限面板只显示空表不解释」):
 *   权限拒绝走 AccessDeniedException → GlobalExceptionHandler 归一成 **HTTP 200 + body code 403**
 *   (故意不用 403 状态码 —— 否则前端 axios 拦截器会按"认证失效"把用户登出)。
 *   而 `unwrap` 对这类响应不抛错,返回的是整个 body 对象;列表页 `res.list || []` 拿到空数组,
 *   界面就成了"空表 + 完整工具栏",用户根本看不出是被权限挡住了。
 *
 * 只有"该抛就抛"这一处额外行为,其余语义与 unwrap 完全一致(不改变既有调用方的取值路径)。
 * 抛出的错误带上 code,并伪造 response.data 以便各页统一的 errMsg(e) 取到后端原因。
 */
export function unwrapStrict(res) {
  if (res && typeof res === 'object' && res.code != null && res.code !== 200) {
    const e = new Error(res.message || '服务端拒绝了该请求')
    e.code = res.code
    e.response = { data: res, status: 200 }
    throw e
  }
  return unwrap(res)
}
