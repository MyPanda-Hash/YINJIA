# KUCUN → 库存报表「库存明细」(2026-10-15)

> 用户口径:「我要用这个 KUCUN 表做库存报表下的库存明细」。
> 本目录是这次落地的**取证与口径留档**(探针 SQL + 上线验收脚本),随任务入库。

## 1. 交付物

| 件 | 位置 | 说明 |
|---|---|---|
| 面板与字段 | `tools/migrate-stock-detail-panel.sql` | `STOCK_DETAIL` **库存明细** = `mode='flat'` + `line_table='kucun'`(直读结存表) |
| 菜单 | `frontend/src/business/menus.js` | 智能供应链 › **库存报表** 组第 4 项(与 状况表/台账/收发存汇总 并列) |
| 多语言 | `frontend/src/i18n/locales/*.js`(10 语言)+ `yj_translation` | 菜单词条(`_add-stock-detail-i18n.cjs` 生成);顺手补齐同组一直缺译名的 库存台账/收发存汇总表 |
| 授权 | 本脚本 ③ | 与三张库存报表同款:`view,query,export,print`,覆盖全部角色 |
| 上线验收 | `_v-stock-detail-api.ps1` | 跑在 8090 上验:面板配置 / 取数 / 三条件精确过滤 |

**面板列**:存货编码 · 仓库 · 批号 · 累计入库量 · 累计出库量 · 现存量 · 结存单价 · 更新时间
(查询区 = 前三个;`存货编码`/`仓库` 声明为**参照** ⇒ 查询弹窗按名称挑选、过滤按**编码精确等值**)。

## 2. KUCUN 的数据画像(做报表必须知道)

| 事实 | 实测值(2026-10-15,HSDZ_MES) |
|---|---|
| 粒度 | `(wzdm 物料编码, ckdm 仓库编码, lot_no 批号)`,2281 行 = 1374 物料 × 5 仓库 × (51 批号 + 无批号) |
| 现存量合计 | **+4,287,547.564**;其中 **542 行为负**(合计 **−3,986,989.206**) |
| 负数是哪来的 | **全部来自「期初导入」**(2004 行)那批:期初挂的批号键(无批号 / 期初批号)与后来出库打的 `PC0000` 不是同一个键 ⇒ 出库那边扣成负数 |
| 累计入/出 | 应用写入的 277 行(`stock:admin`)**全部**满足 `yl = rkl − ckl`;期初导入 2004 行里只有 116 行满足 ⇒ 按用户口径**照原样显示**,不换算不隐藏 |
| 结存单价 | 只有 277 行有值(应用写入时带单据单价);期初导入 2004 行**全为空** |
| 金额列 | **不做**:`kucun.total_je` 全表为 0(遗留零引用列);要金额只能 `单价 × 现存量`,口径另议 |
| 档案命中 | 仓库编码 `ckdm` **2281/2281** 命中 `bs_wh`;物料编码 `wzdm` 2268/2281 命中 `bs_inv`(13 行悬空,多为期初/出库批号错位成的对子) |
| 取数成本 | `UX_kucun_id` 唯一索引(id);面板 `date_col='update_date'` ⇒ 取数 `ORDER BY [update_date] DESC, id DESC`,单页 50 行 |

## 3. 与三张流水报表的关系(口径差异,别当 bug)

同日下午**另一条线**把期初补进了流水(`eba52b4d`「期初结存补进流水(两账套 1,888 行)」),两个时点各测一次:

| 时点 | 库存状况表(v_stock_balance,流水口径) | kucun(结存口径) | 键差异 |
|---|---|---|---|
| 补流水**之前**(q-14/q-15) | 902 行,**Σ现存量 = −323,341.826**(负) | 2281 行,Σ = +4,287,547.564 | 1419 键对不上,其中 717 键状况表无行 |
| 补流水**之后**(同题复跑) | 1634 行,**Σ现存量 = +4,493,375.070** | 同上 | **696 键**,残差 **+205,827.506** |

⇒ 结论:**「库存明细」读的是 kucun,与三张流水报表不保证逐键相等**,残差就是那 542 行负现存量(批号键错位)。
两条线都在动数据,数字以复跑命令为准(见 §4)。

## 4. 复跑命令(仓库根 / tools 目录)

```powershell
# 取数口径与数据画像(q-01…q-19;库名换成 HSDZ_MES_TEST 即测试账套)
cd tools
java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" yinjia <口令> archive\_kucun-stock-detail\q-19-kucun-facts.sql
# 面板上线验收(需后端在 8090)
cd ..
powershell -ExecutionPolicy Bypass -File tools\archive\_kucun-stock-detail\_v-stock-detail-api.ps1
# 多语言词条补齐(幂等,已跑过)
node tools\archive\_kucun-stock-detail\_add-stock-detail-i18n.cjs
```

## 5. 文件清单

| 文件 | 用途 |
|---|---|
| `q-01-kucun-shape.sql` | 列定义 + 行数/键 + 索引 + 样本 |
| `q-02-stock-panels.sql` | 三张库存报表/STOCK_STATUS 的面板登记与字段(挂载先例) |
| `q-03-kucun-invariant.sql` | `yl` vs `rkl−ckl` 自洽性(总量 + 逐行) |
| `q-13-kucun-detail.sql` | 逐列画像(样本/不自洽样本/来源/按仓库/单价覆盖) |
| `q-14-kucun-joins.sql` | 仓库/物料命中档案率 + 流水合计 vs 结存 + 流水段号分布 |
| `q-15-kucun-vs-balance.sql` | kucun vs `v_stock_balance` 逐键对账(口径差异规模) |
| `q-16-panel-shape.sql` / `q-17-panel-conventions.sql` / `q-18-perm.sql` | 新建 flat 面板要抄的形态:`yj_panel` 列与先例、字段/参照写法、`yj_role_panel` 授权面 |
| `q-19-kucun-facts.sql` | §2 那张数据画像表(负行/无批号/来源×自洽/悬空物料/索引) |
| `_add-stock-detail-i18n.cjs` | 生成 10 语言菜单词条(幂等) |
| `_v-stock-detail-api.ps1` | 上线验收(接口层):面板配置 / 取数 / 三条件精确过滤(含两个本机坑的说明:BOM / curl 发中文正文) |
| `_v-stock-detail-ui.mjs` | 上线验收(界面层):headless Edge + CDP,读侧栏与表格表头/行数(实测 5173 与 8090 均能出 9 列 × 50 行 / 共 2281 条) |

### 5.1 验收结果(2026-10-15 实测)

| 层 | 结果 |
|---|---|
| 接口(`_v-stock-detail-api.ps1`) | 面板 `库存明细` pageSize=50;明细列 8 个、查询区 3 个;取数 `totalSize=2281`;`存货编码=HP-08` → 3 行、`仓库=YCL-01` → **1010 行**、`批号=SX-20261014` → 54 行(全部按**编码精确等值**,非 LIKE) |
| 界面(`_v-stock-detail-ui.mjs`) | 页面标题 `库存明细 · YINJIA-MES`;表头 = 序号 + 8 列(均可排序);本页 50 行、**共 2281 条 / 46 页**;首行 `A-32-32 / CP-02 / PC0000 / 9726 / 6951 / 2517 / (单价空) / 2026-10-14 21:09:05` |
| 产物 | `frontend/dist` 与 `backend/src/main/resources/static` 的入口 chunk 都含 `STOCK_DETAIL`(菜单随包) |

⚠ **两个地址的差别(2026-10-15 实测)**:`5173`(vite 源码即时生效)= 菜单里已有「库存报表 › 库存明细」;
`8090` 跑的是**打进 jar 的旧前端**(实测入口 chunk `index-qzyu7WYp.js` 里没有 `STOCK_DETAIL`),
所以 **8090 上菜单暂时看不到这一项** —— 但面板路由是通用的,直接开
`http://127.0.0.1:8090/#/panelx/list/STOCK_DETAIL` 照样出数(实测同样 9 列 / 共 2281 条)。
要让 8090 的菜单也出现,需重打 jar(`rebuild-prod.ps1`,会**重启服务**)。

> ⚠ `_v-stock-detail-api.ps1` 必须 **UTF-8 with BOM** 保存,请求体必须走 `curl.exe -d "@文件"`:
> Windows PowerShell 5.1 会把无 BOM 的 .ps1 按 GBK 解码、也会把 `-Body` 里的中文按非 UTF-8 发出去,
> 两者都表现为「条件静默失效」(实测 totalSize 不随条件变化)。
