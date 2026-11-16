# 自动打印「打印缓存(离线补打)」2026-11-16

**用户需求(原话)**
> 「能在自动打印里面做个打印缓存吗，就是在打印代理掉了后，重新连接这个打印缓存，会将这期间打印的补回来。」

**后续口径(2026-11-16 二次确认)**
1. 补打印**保留 3 天**(→ `print.cache_hours` 默认 72 小时);
2. 掉线期间手机端点打印 = **进缓存、不退回手机自己打印**(退回等于打两遍)。

---

## 一、改造前为什么"补不回来"

| 旧实现 | 后果 |
|---|---|
| 入队目标 = `onlineStations()`(只算 **90 秒内有心跳**的站点) | 代理一掉线,那台电脑**根本不在目标里** ⇒ 这段时间点的打印**当场丢弃**,事后无从补 |
| 队列是内存 `ConcurrentLinkedDeque` + TTL **5 分钟** | 服务端一重启(每次部署都重启)整队清空;躺过 5 分钟也自动没了 |
| 纸型/回执都挂在内存对象上 | 重启后"最近出纸"与在途任务一起丢 |

## 二、现在的做法

1. **目标站点按"配置"算**:开关打开 + 勾了该打印类型就进 `targets`,**不看在线** —— 掉线那台照样是目标;
2. **任务落库** `yj_print_task`:整条载荷(`payload_json`)落库,二维码图/明细/表头/签名都在里面,
   以后加打印字段**不用改表**;`targets`/`delivered` 是逗号分隔站点名,每站只投一次防重复出纸;
3. **重连即补打**:代理回来第一次 `/pending` 就按 `id` 升序一条条领走(不用人点);
4. **状态机**:PENDING(有站点没拿到)→ SENT(发全等回执)→ DONE / FAILED;超保留时长 → EXPIRED;
5. **面板可管**:「自动打印」页新增卡片 —— 开关、待补打清单(含目标电脑/状态/失败原因)、
   每行「补打 / 删除」、底部「清空缓存」;
6. **保留 3 天**:`yj_app_setting.print.cache_hours`(默认 72;写坏了按默认,不让脏参数停掉打印);
   过期不再派单但**留在列表里**给人看"这单没补上";终态行 7 天后物理清理。

### 接口(新增,均需「配置打印机」权限)

| 接口 | 作用 |
|---|---|
| `POST /api/px/print/cache/config` | `{enabled}` 缓存开关(关掉=回到只发在线站点的旧口径;已缓存的不丢) |
| `POST /api/px/print/cache/retry` | `{id}` 重发一条(清 `delivered`,代理下次轮询就再打) |
| `POST /api/px/print/cache/delete` | `{id}` 删一条(作废单/打错单) |
| `POST /api/px/print/cache/clear` | `{stationName?}` 清空;给站点名=只把这条对它摘掉 |

`GET /api/px/print/station` 的响应里多了 `cache: {enabled, hours, count, items[]}`。

## 三、验证证据(本机 8091 独立实例 + ego 浏览器)

### 3.1 接口全链路(`api-flow-report.txt` 是跑出来的原样输出)

| 步骤 | 结果 |
|---|---|
| 目标站点离线时入队 | `queued=true, online=false, cached=1`,提示「打印电脑「CACHE-OFFLINE-TEST」当前离线:单子已进打印缓存,那台电脑一连上就自动补打」 |
| 面板缓存清单 | `count=1`,行内 `标题/单号/状态=PENDING/目标站点` 齐全 |
| 代理"重连"后 `/pending` | 取到该条,`id=5`、`纸张=A5`、明细 2 行随载荷下发 |
| `/ack {ok:true}` | 缓存条数 4→3(该条转 DONE,不再出现在待补打列表) |
| `/cache/retry` | 影响 1 行,状态回 PENDING,代理下一次 `/pending` 又取到同一条 |
| `/cache/delete`、`/cache/clear` | 影响行数与剩余条数都对得上 |

> 踩到并修掉的坑:落库版的载荷一开始**忘了塞 `id`**,代理回执 `taskId=0` ⇒ 缓存行永远停在 PENDING。
> 现在 `PrintCacheService.takeFor()` 每次下发时补 `id`(与行 id 恒等),有注释记着。

### 3.2 界面(ego 浏览器,`round-0*.mjs`)

| 截图 | 看点 |
|---|---|
| `round-03-cache-with-item.png` | 卡片标题「打印缓存(离线补打) **1**」,行:`2026-11-16 15:50:50 生产领料单 · CACHE-UI-T1 等待补打 目标电脑:DESKTOP-JHUNFT6、缓存测试机 [补打] [删除]`,底部「缓存保留 **3 天**;过期的单子不再补打,列表里还能看到」「清空缓存」 |
| `round-03-after-retry.png` | 点「补打」→ toast「已重新排队,代理下一次轮询就会补打」 |
| `round-04-cache-card-en.png` | 切 English 后整卡为英文:`Print cache (offline catch-up) / Waiting to print / Target computers / Print now / Delete / Cached for 3 days… / Clear cache`(行内「生产领料单」「缓存测试机」是**业务事实**,按 ADR-0001 不翻译) |
| `round-05-back-to-zh.png` | 切回简体中文,卡片清空(0 条) |

### 3.3 数据面

- 迁移 `tools/migrate-print-task-cache-20261116.sql`:**两账套都已执行**(`HSDZ_MES` / `HSDZ_MES_TEST`),
  建表 16 列 + 16 条中文注明(`MS_Description`,含列级)+ `pk_yj_print_task` / `ix_yj_print_task_state`;
  脚本注释用 `sp_updateextendedproperty`,改文案重跑即可刷新(本次把 24 小时改成 3 天就是这么刷的);
- 已登记 `tools/db-migrations.txt`、`tools/db-inuse-tables.txt`、`docs/development/数据库表清单.md`;
- 多语言:`tools/archive/_print-cache-i18n-20261116.mjs`(`--audit` 结果:PrintStation.vue 92 条 tt()、**缺译名 0**)。

## 四、边界(明确没做)

- **代理端零改动**:缓存全在服务端,代理照旧每 4 秒 `/pending` + `/ack`,换不换代理版本都能补打;
- 同一张单发给多台电脑时,"每台各打一张"照旧(`delivered` 按站点记);
- 打失败(代理回执 `ok=false`)不自动重试,只把 `失败原因` 留在行上(避免坏单无限重打),要补就点「补打」;
- 面板开关关掉只影响**后续**任务;已经缓存的仍旧补打(避免以为关一下就清空)。
