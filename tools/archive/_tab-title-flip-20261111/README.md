# 页签名字「反复横跳」现场取证与修复(2026-11-11)

用户报障(附两张截图):**打开多个单据页签后,同一个页签位置的名称在
「销售订单」/「销售订单明细表」之间来回跳。**

## 1. 根因

`PortalLayout` 用 `<component :is :key="route.path">` + `<keep-alive :max="20">`
给**每个页签缓存一份页面实例**(为了切页签保住未保存的填写)。但 `route` 是
**全局共享的** —— 被缓存的旧实例并没有"停手":

| 旧实例干的活 | 后果 |
|---|---|
| `panelCode` / `operationName` / `code` 都是 `route` 派生值,跟着**别人的导航**重算 | 旧实例以为自己换了面板 |
| 面板切换 watch(`[panelCode, operationName]`)照样 `list=[]` + 重新取数 | 按**别人的面板码**发请求,白跑,还把别人的数据装进自己实例 |
| `loadCrg()` 取回配置后执行 `curTab = tabs.find(x => x.path === route.path); curTab.title = panelName` | **把"我"刚取到的面板名,写到"当前正显示的那个页签"上** |
| 请求回包顺序不可控 | 销售订单的配置晚到 ⇒ 明细表页签被改成「销售订单」;明细表的配置再晚到 ⇒ 又改回来 = **横跳** |

`PanelxForm` 同一份病:`load()` 里 `cur.title = 面板名-单号`,缓存实例按
`route.path` 找人,等于给别人的页签改名。

## 2. 复现方法(可重复跑)

现场网络比本地 vite 慢,配置请求几百毫秒 ⇒ 用 CDP 注入 400ms 延迟把竞态窗口放大:

```powershell
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/tab-title-flip-20261111/round-03.mjs')"
```

`round-03.mjs` = 打开 4 个页签(采购入库单/销售订单/采购订单/销售订单明细表)后,
每 250ms 点一次不同页签。**修复前**输出(节选,页签名互相盖):

```
hash=SO_ORDER        act=1 tabs=[我的桌面|销售订单|PURCHASE_IN|采购订单|销售订单明细表]
hash=SALES_ORDER_DETAIL act=4 tabs=[我的桌面|销售订单|PURCHASE_IN|采购订单|销售订单]     ← 明细表被改名
hash=SO_ORDER        act=1 tabs=[我的桌面|销售订单明细表|PURCHASE_IN|采购订单|销售订单]  ← 销售订单被改名
hash=PU_ORDER        act=3 tabs=[我的桌面|销售订单明细表|PURCHASE_IN|销售订单|销售订单]  ← 采购订单被改名
```

**修复后**(`round-04.mjs`,同样的 400ms 延迟 + 12 次快速互点):

```
OK hash=SO_ORDER act=1 want=1(销售订单) tabs=[我的桌面|销售订单|采购入库单|采购订单|销售订单明细表]
… (12 次全 OK) …
VERDICT PASS 页签名不再横跳
```

## 3. 修法

1. **实例私有身份**:`PanelxList` / `PanelxForm` 各加 `ownPath`(创建时的
   `route.path`,与 keep-alive 的 key 同口径)+ `ownPanelCode`,`isFrontPage()`
   = `route.path === ownPath`。
2. **所有"要不要干活"的判断改用它**:面板切换 watch、`?docNo=`/`?new=`/批注/
   批号锁/RD 七个状态接口/仓库档案等 10 处 route 派生 watch,缓存实例一律不干活。
3. **写标题时只写自己那条页签**:`applyPanelTitle()` 先判 `isFrontPage()`,再按
   `ownPath` 找页签;`loadCrg()` 的响应回来还要核对「面板码没变 + 仍是前台」,
   任一不符整份丢弃(不装配置、不写标题)。另:配置拿不到(403)时 `panelName`
   会退回面板码,**这时一个字都不写**,保住菜单给的「采购入库单」。
4. **页签身份归一**:`stores/tabs.js` 新增 `tabKey(path)`(剥 query/hash),
   `open()` 一律用它 —— 此前 `restoreCurrentTab()` 传 `route.fullPath`(带
   `?code=`),去重失效 ⇒ 页签栏会出现两个同名页签,面板也找不到自己那条。
5. 顺手:`unsavedGuard.register/unregister` 的键由 `route.path` 改为 `ownPath`
   (卸载时 `route.path` 早已指向别的页签,用它会注销错键)。

## 4. 验收记录

| 脚本 | 内容 | 结论 |
|---|---|---|
| `round-03.mjs` | 修复前:400ms 延迟 + 快速互点 | 复现横跳(改名/串名) |
| `round-04.mjs` | 修复后同条件 12 次互点 | `VERDICT PASS`,act 与页签名始终一致 |
| `round-06.mjs` | 切走再切回仍是同一张单(`单据：ZL-20261014-01`) | PASS,未回归"切页签丢单/丢填写" |
| `round-07.mjs` | 表单页签(`立项申请-新增`)切走再回 | PASS,名字与内容都没被别的面板改 |
| `round-08.mjs` | 打包版 8090(新 jar)同条件互点 | `VERDICT PASS` |
| `round-09.mjs` | 关非活动/活动页签、重开 | 正常落位、无重名页签 |

`round-05.mjs` 是顺带探到的旁证:`PURCHASE_IN` 在**测试库**对 admin 返回业务码
403(无该面板查看权)⇒ 配置为空 ⇒ 旧代码把页签名写成面板码 `PURCHASE_IN`。
这条不是本次横跳的主因,但同属"名字乱跳",已在 `applyPanelTitle()` 里兜住。

## 5. 复跑前提

```powershell
# 源码即时生效的 5173(vite)与打包版 8090 都要在跑
tools\scripts\start-prod.ps1          # 8090
frontend\start-vite.bat               # 5173
# 纯前端改动要让 8090 用上新包:
powershell -ExecutionPolicy Bypass -File tools\scripts\apply-frontend-only.ps1
```
