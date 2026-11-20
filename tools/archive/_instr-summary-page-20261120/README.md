# `_instr-summary-page-20261120` —— 仪器使用汇总表(独立页面)取证

> 用户口径(2026-11-20):
> 「1.为当前的样品检验汇总表能够勾选检验委托单行,为实现当前导出 excel 的功能能够选择所需的行
>  2.为当前的试验仪器记录表创建一个汇总表,汇总表需要查看的内容如图 1 所示。汇总表实现可以参考样品检验汇总表」
> 追问落点后:「不要这个页签,同时(第 2 项)按照独立页面完成」。

## 一、本轮交付

| # | 需求 | 落点 |
|---|---|---|
| 1 | 样品检验汇总表可勾选委托单行,导出只导所选 | `views/modules/qc/InspSummary.vue`(勾选列 + 工具条回显 + 按钮文案)+ `InspSummaryService#export` 按 `单据编号[]` 精确过滤 |
| 2 | 仪器使用汇总表(用户图 1 的 9 列) | **新独立页面** `views/modules/rd/InstrSummary.vue`(`/rd/instrSummary`,面板码 `INSTR_SUMMARY`),菜单挂在 研发管理 › 测试记录 › 实验室使用记录表 下 |
| — | 仪器使用记录表里的「使用记录汇总」页签 | **撤除**(含 `POST /px/instrUseSummary` 端点);记录表回到单页登记表,纸面一字未动 |

后端:`POST /api/px/instrSummary/summary`、`POST /api/px/instrSummary/export`(POI 生成「实验室仪器使用记录表」)。
迁移:`tools/migrate-instr-summary-page-20261120.sql`(授权 + 面板名 10 语种译名),两账套已执行并写 `yj_schema_log`。
设计契约:`docs/design/仪器使用汇总表.md`;旧契约 `docs/design/实验室仪器使用记录汇总表.md` 顶部已标注"已被取代"。

## 二、接口实测(测试账套,`test-instr-summary.mjs`)

造数:`_scratch/probe-1120/seed-instr.sql` 把 4 条使用记录挂到既有草稿 `IU-2026-11-0001`
(11-20 / 11-19 / 11-18 本周 + 11-10 上周)。执行结果:

```
全部区间:  HTTP 200 行数 4 汇总 {"记录条数":4,"涉及仪器":3,"使用人数":4,"涉及项目":4}
本周(11-16~11-20): 行数 3
上周(11-01~11-15): 行数 1 (马弗炉)
按仪器 ICPMS 过滤: 行数 2     按使用人 张三 过滤: 行数 1
export-all.xlsx        HTTP 200 bytes 4540 PK魔数 true
export-picked2.xlsx    HTTP 200 bytes 4355 PK魔数 true   ← 勾 2 条时明显更小
匿名访问: HTTP 403
```

导出的 xlsx 结构(openpyxl 核对,`export/` 下留档):

| 文件 | 行数 | 结构 |
|---|---|---|
| `export/instr-all-4rows.xlsx` | 4 条数据 | A1:I1 合并大标题「实验室仪器使用记录表」;第 2 行 9 列表头;landscape + fitToWidth=1 + fitToPage;冻结 A3;筛选 A2:I6 |
| `export/instr-picked-2rows.xlsx` | 2 条数据 | 同上,行数 = 勾选数 |

样品检验汇总表勾选导出(第二张委托单 `WT-2026-11-9010` 造数 `seed-insp.sql`):

| 文件 | 数据行 | 说明 |
|---|---|---|
| `export/sendin-all-2docs.xlsx` | 2 | 不勾选 = 导出查询结果全部(原行为不变) |
| `export/sendin-picked-1doc.xlsx` | 1 | 只勾 `WT-2026-11-9009` ⇒ 文件里只有这一张单 |

> `_scratch/probe-1120/cleanup-seed.sql` 已清理:4 条使用记录明细 + 第二张委托单(head/detail)全删,
> 复核 `rd_instr_use_detail=0 / qc_insp_9010_head=0 / qc_insp_9010_detail=0`,委托单总数回到 1。

## 三、ego 浏览器(5173 源码版,登录工厂 = 测试库)

| 截图 | 证据 |
|---|---|
| `ego/round-01-page.png` | 新页面:标题「仪器使用汇总表」、本周默认区间、统计条、9 列表格 |
| `ego/round-02-picked.png` | 勾 2 行 → 「已选 2 条记录 清除选择」+ 按钮变「导出所选 Excel (2)」 |
| `ego/round-02-exported.png` | 点导出 → 提示「已导出 2 条记录」 |
| `ego/round-03-record-sheet.png` | RD_INSTR_USE 只剩单页登记表(无「使用记录汇总」页签、无台账块) |
| `ego/round-05-insp-picked.png` | 样品检验汇总表勾 1 张 → 「已选 1 张委托单」+「导出所选 Excel (1)」 |
| `ego/round-07-picked-2docs.png` | 2 张委托单只勾第 1 张 |
| `ego/round-08-all.png` | 「全部」区间 = 4 条(日期框已清空) |
| `ego/round-15-menu.png` | 侧栏 研发管理 › 测试记录 › 实验室使用记录表 下新增「仪器使用汇总表」,紧跟「仪器使用记录表」 |

关键读数(页面 DOM,非文本猜测):

```
勾选后: {"picked":"已选 2 条记录 清除选择","exportBtn":"导出所选 Excel (2)","checked":2}
导出后: {"messages":["已导出 2 条记录"]}
全部区间: {"dates":["",""] ,"stats":["记录条数4","涉及仪器3","使用人数4","涉及项目4"]}
样品汇总勾选: {"picked":"已选 1 张委托单 清除选择","exportBtn":"导出所选 Excel (1)","checked":1}
```

运行方式(脚本在 `ego/` 目录,每个 round 都是完整脚本,可单独复跑):

```bash
ego-browser nodejs -e "await import('file:///D:/workspace/yinjia/tools/archive/_instr-summary-page-20261120/ego/round-01.mjs')"
```

> 备注:首次进入页面时曾出现一次 `Request failed with status code 500`(重新登录后的第一跳);
> 连续刷新 3 次(`round-08`)与多轮重进均稳定 200,接口直连与 UI 重放也都 200 ⇒ 判定为重启后首请求的瞬时问题,
> 未改代码。

### 打包版(8090,换新 jar 后)复核

`ego/round-16-8090-instr.png` / `ego/round-16-8090-insp.png`:

```
8090 仪器使用汇总表: 标题「仪器使用汇总表」
  表头(9 列): 仪器名称/型号 | 日期 | 起止时间 | 仪器状态 | 是否内校 | 项目名称/内容 | 数量 | 使用人 | 备注
  空态: 当前时间范围内没有使用记录（2026-11-16 ~ 2026-11-20）  ← 造数已清理
8090 样品检验汇总表勾选: {"picked":"已选 1 张委托单 清除选择","exportBtn":"导出所选 Excel (1)"}
8090 仪器使用记录表: pageTabs=[] ledger=0  ← 页签确已撤除
```

## 四、构建 / 测试

- `frontend: node --test "src/core/views/*.test.js"` → 721 项,716 过;5 个 fail 全是
  `recordSheetConfigs.livedb.test.js`(本机缺 `SQLCMD.EXE`,环境性,与本次改动无关)。
- `frontend: npm test`(全量)→ 2307 项,2302 过;同样 5 个 live-DB 环境失败。
- `backend: JAVA_HOME=…/ms-25.0.4 mvn -q -DskipTests compile` → 0
- `frontend: npm run build` → OK;`tools/scripts/rebuild-prod.ps1` → fat jar 129 条 lib、换包自检通过,
  本机 8090 已用新 jar 重启。
- 新增契约测试:`instrSummaryPage.test.js`、`recordSheetInstrSinglePage.test.js`、
  `inspSummarySelection.test.js`;`menus.test.js` 的计数断言同步 +1。

## 五、未做 / 已知边界

- 「全部」区间按单次上限 5000 行截断,页面会提示缩小时间范围;不提供跨页勾选导全库。
- 汇总页只读;登记/改记录仍回「仪器使用记录表」面板。

## 六、第二轮:按送样人也能勾选(2026-11-20 12:20)

用户追加口径:「按送样人也要能勾选」。

实现:**三处入口、一份勾选真源**(`selectedNos` = 单据编号集合)
- 「按送样人」表勾一个送样人 = 他名下全部委托单;表头全选/取消同样生效;
- 展开的「该送样人的委托单」子表可逐张勾/取消(只影响该送样人);
- 「按委托单/样品」表照旧逐张勾;三处互相同步,导出只认真源。

### 实测(测试账套造 3 张单:系统管理员 2 张 + 张三 1 张)

| 轮次/截图 | 读数 |
|---|---|
| `ego/round-20-sender.png` | 表头全选 → 「已选 3 张委托单 / 导出所选 Excel (3)」;**再点取消全选 → 已选 0**(回归:第一版这里点了没反应) |
| `ego/round-20-sender.png` | 只勾「系统管理员」→ 已选 2 |
| `ego/round-22-sender-partial.png` | 勾送样人(2) → 展开子表两行**都已勾上** → 取消子表第一张 → 「已选 1」,送样人行自动取消勾,切「按委托单」页签同样只剩 1 张勾选 |
| 导出 | `export/sendin-all-3docs.xlsx`(全选导出)= 3 行;`export/sendin-sender-2docs.xlsx`(只勾系统管理员)= **2 行,且都是系统管理员名下**(张三那张不在) |

### 两个踩坑(已写进 `docs/design/样品检验汇总表-首版.md` §九)

1. 展开子表**挂载即发空 selection-change** ⇒ 勾选被瞬间清空。子表改听 `@select` / `@select-all`。
2. 同步时若重画"用户刚操作的表",会把 Element 表头全选态搞乱(取消全选点不动) ⇒ `syncTables(origin)` 跳过来源表;
   送样人勾选改为逐人比对真源现状,不再依赖"上一次勾选"做增量。

造数/清理:`sql/seed-insp2.sql` → `sql/cleanup-seed2.sql`(复核 `qc_insp_total=1 / seed_left=0`,已清理)。
