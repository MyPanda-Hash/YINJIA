/**
 * 账套(工厂)切换的纯判定 —— ADR-0003:一系统两账套,账套**绑在登录令牌里**,
 * 切换账套 = 按目标工厂重新登录。这里只放"可测的判定",真正的重登与页面刷新
 * 在 FactorySwitchDialog / TopBar 里做。
 *
 * 为什么需要这两个函数(2026-09-22):
 *   顶栏原先的"切换"只改了本地对象与 localStorage(stores/user.js 的 switchFactory),
 *   令牌没换 ⇒ 后端 JwtAuthFilter 仍按旧声明路由到旧库 —— 名字变了、数据没变,
 *   用户看到的"无效、并未进行切换"就是这个。所以前端必须:
 *     ① 判断该不该走重登(needsRelogin);
 *     ② 把"当前账套"的认定权交给会话(userinfo.factory),而不是可陈旧/可手改的缓存,
 *        否则顶栏显示的名字会与真正被查询的库对不上,等于换个方式继续骗人。
 */

/** 目标账套是否需要重新登录(同一个 code 不用白跑一趟;没选到目标时不弹窗) */
export function needsRelogin(currentCode, targetCode) {
  const target = String(targetCode ?? '').trim()
  if (!target) return false
  return target !== String(currentCode ?? '').trim()
}

/**
 * 当前账套判定:会话里的工厂码最权威(登录响应/ userinfo 的 factory 字段),
 * 其次本地缓存(mes_factory),最后退回账套清单首项。
 * 认不出的码不原样显示 —— 宁可回退也不让顶栏顶着个不存在的账套名。
 */
export function pickCurrentFactory(factories, { sessionCode, cachedCode } = {}) {
  const list = (Array.isArray(factories) ? factories : []).filter((f) => f && f.code)
  if (!list.length) return null
  const candidates = [sessionCode, cachedCode].map((x) => String(x ?? '').trim()).filter(Boolean)
  for (const code of candidates) {
    const hit = list.find((f) => f.code === code)
    if (hit) return hit
  }
  return list[0]
}
