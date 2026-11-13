# 生产工单:日期范围控件统一为「订单结转」同款 + 刷新/渲染分页防卡(2026-11-09)

用户两条口径(本次任务):

1. **把生产工单页的日期范围组件改成与「订单结转」页相同的组件实现**(截图:改前是两个独立日期框,改后是单框 daterange + 快捷档);
2. **修改生产工单的刷新/取数规则** —— 原实现日期范围一拉大,返回行数一多,页面就卡住。

## 结论(已验收)

| 项 | 改前 | 改后 |
|---|---|---|
| 日期范围控件 | 两个独立 `el-date-picker type="date"` + 「-」 | 单控件 `el-date-picker type="daterange"` + 6 个快捷档(今日/本周/本月/近7天/近30天/上月),与订单结转**同一组件文件** |
| 表格渲染行数(大范围全量 399 行) | **399 行**(× 88~119 列 ≈ 3.5 万单元格) | **50 行/页**(分页,可选 50/100/200;399 行 = 8 页) |
| 大范围查询(2020-01-01~2030-12-31)从触发到恢复可交互 | **>15 秒主线程阻塞,evaluate 直接超时(页面无响应)** | **4.26 / 4.30 / 4.46 秒(3 样本)**;主线程最后长任务 3.69~3.89s |
| 整表重渲次数 | 3 段(首渲 36 列 → dayPlan 回来重渲 119 列 → 行数据再渲) | **1 段**(先取 dayPlan、并入未上屏行对象,最后一次性赋值) |
| 后端耗时 | 非瓶颈 | 非瓶颈(列表 337~350ms、dayPlan 401~422ms,resource timing 实测) |

验收判据 8 项:T3 轮 7 PASS / 1 FAIL(5s 硬指标未达)→ T4 修复后 T5 轮 **8/8 PASS**(3 个冷查询样本全部 ≤5s;7 项回归全 PASS,控制台 0 error/0 warning)。证据与逐轮脚本见 [`ego-proof/VERIFY-README.md`](ego-proof/VERIFY-README.md)。

## 改动文件(3 个)

| 文件 | 改动 |
|---|---|
| `frontend/src/core/ui/DateRangeQuery.vue`(新增 65 行) | 通用日期范围查询控件:单控件 daterange + 快捷档(复用 `@core/dashboard/dateRange` 的 PRESETS);`width` prop 默认 260px(两页同宽);清空统一抛 `[]`;反序由调用页处理(**两页共用同一份实现**,不平行复制) |
| `frontend/src/views/modules/plan/OrderConvert.vue` | 回接共用控件,行为零变化(默认 [今天,今天]、快捷档、反序交换、查询触发全部留在本页);删掉只被它使用的 `dateShortcuts` computed / PRESETS import / 无用 `.oc-daterange` CSS |
| `frontend/src/views/modules/plan/WorkOrderList.vue` | ①日期范围换共用控件(默认仍是最近 15 天;清空=全量);②刷新规则改前端分页:**默认 50 行/页**、页码 `[50,100,200]`;查询/日期变更/筛选回第 1 页、动作后的 load() 保持当前页、越界自动夹回、`?focus=` 跳转录带翻页与清筛选;③`load()` 重构为**单次渲染**(先取 dayPlan 并入未上屏行对象,最后赋值 rows) |

> 只改前端,后端零改动(接口 `日期从/日期到` 口径不变)。

## 为什么默认是 50 行/页,不是 100?

本表列数极多:基础 36 列 + 后端按数据生成的「日排产」日期列(全量时共 **119 列**)。
验收实测(同一会话对照):**100 行/页 10.74~11.50s(FAIL)、50 行/页 4.08~4.16s(PASS)**;把 3 段重渲合并成 1 段后,50 行/页 3 样本 4.26~4.46s。
所以默认 50 是实测结论,不是拍脑袋;100/200 仍可在分页条自选(代价是更慢)。

## 复跑方法

- 服务:`http://localhost:5173`(vite dev,源码即时生效;8090 是 jar 内旧前端,验本改动别用 8090)。
- 脚本:
  - 改前基线(会复现 15s+ 无响应):`baseline/_baseline-freeze-round-01.mjs`(完成登录后把两个日期框填 2020-01-01/2030-12-31 点「查找」)
  - 接口成本探针:`baseline/_probe-api-cost.mjs`(不同日期区间的返回字节/行数/耗时;只读)
  - 验收/T4 复测:`ego-proof/round-01.mjs` ~ `round-12.mjs`(每轮独立文件,原始在 `C:/Users/vigna/ego/wo-daterange-verify-20261109/`)
  - 执行:`ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/<task-space>/round-NN.mjs')"`
- 账号 `admin` / `123456`,登录工厂默认(YINJIA-MES 正式库)。

## 目录

```
baseline/    改前基线脚本与截图、接口成本探针、Lead 修复后自测脚本
ego-proof/   verify-ui 的 T3(验收)/T5(复测)全部脚本+截图+VERIFY-README(含逐轮索引与只读声明)
```

⚠ **截图按仓库口径不入库**(2026-10-15 用户口径「截图不要入库」,`.gitignore` 的 `*.png`):
本目录里的脚本/说明已入库,`*.png` 只在本地(`C:/Users/vigna/ego/wo-daterange-verify-20261109/`、
`C:/Users/vigna/ego/wo-daterange-perf-20261109/`)作证据,复跑脚本可重新生成。

## 备注

- 新增 UI 没有任何新文案:快捷档与「开始日期/结束日期」在 `i18n/locales/*.js` 均已有译名(已核 en.js),多语言规范无需新增词条。
- 未改 8090(jar 内前端)/未部署服务器;本次交付=源码 + 构建产物静态同步(单独 chore 提交)。
