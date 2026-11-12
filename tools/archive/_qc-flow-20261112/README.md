# 品质流程监控(QC_FLOW)任务证据(2026-11-12)

> 本目录 = 该任务的**可复跑证据**:库侦查 SQL、接口对账、i18n 覆盖检查、ego 浏览器实测脚本与截图。
> 结论与口径写在 `docs/development/品质流程监控-QC_FLOW.md`,这里只放"怎么验的、看到了什么"。

## 一、ego 浏览器实测(round-*)

脚本原样来自 `C:/Users/Lenovo/ego/qc-flow-monitor-20261112/`,用
`ego-browser nodejs -e "await import('file:///<绝对路径>/round-0N.mjs')"` 执行(task space 同名可续跑)。
截图前都做了 `Browser.setWindowBounds normal`(最小化时截不到)。

| 轮次 | 做了什么 | 看到什么 | 截图 |
|---|---|---|---|
| `round-01` | 管理员(vite 5173)首进 `/qc/flowMonitor` | 看板渲染 300 行;首列=批号+物料编码;三节点带状态;标题/表头/汇总条齐 | `round-01-board.png` |
| `round-03` | **受限账号**(角色 `sc`:有 QC_FLOW/QC_INSP,**无** QC_RECV/PURCHASE_IN,测试账套 YJ_TEST) | 看板能看(108 行);送料/入库节点带 🔒 且不可点链接;**点送料节点只弹「无查看该面板的权限:送料暂收单」、地址栏不动**;点检验节点正常跳到 `#/panelx/list/QC_INSP` | `round-03-no-perm.png`、`round-03-jump-ok.png` |
| `round-05` | 管理员(正式账套 YJ)看板 + 列表 | 看板 300 行;汇总 `批次行数300 / 未完成300 / 需检验7 / 待检验1 / 待入库294 / 异常0`;列表 10 列全显示 | `round-05-board-prod.png`、`round-05-list-prod.png` |
| `round-06` | 列表列宽收敛后复核 | 10 列,**横向溢出 0px**(`scrollWidth - clientWidth = 0`) | `round-06-board.png`、`round-06-list.png` |
| `round-09` | 菜单浮层核对 | 鼠标悬停「品质管理 → 来料品质」,浮层第一项 = **品质流程监控**,点它回到本页 | `round-09-menu-card.png` |
| `round-10` | **8090 打包版**(jar 内 static + 新后端 class) | 页面正常(该会话在测试账套 → 108 行) | `round-10-8090.png` |
| `round-11` | 检验结论三档复核(合格/部分不合格/不合格) | `60 合格 / 40 不合格` 显示 **「检验 部分不合格」**(橙色 warn),不再一口咬定"不合格" | `round-11-final.png` |

> ⚠ 8090 的静态资源带缓存:rebuild 后首次打开可能仍是旧 chunk(实测出现过"文案新、配色旧"),
> 用带查询串的地址(如 `/?v=20261112b#/qc/flowMonitor`)强制换新即可 —— 与源码版 5173 对照可判定。

> ⚠ `round-03` 用的演示账号 `qcflowdemo`(仅测试账套)**验完即删**:
> 建号 `_mk-demo-user-testdb.sql`、删号 `_rm-demo-user-testdb.sql`,两脚本都在本目录,密码哈希沿用 admin。

## 二、库侦查与迁移复核(SQL)

| 文件 | 查什么 |
|---|---|
| `q-01-columns.sql` / `q-03-cols.sql` | 九张相关表的列清单(compat 100,STRING_AGG 不可用 ⇒ 用 FOR XML PATH) |
| `q-04-data.sql` / `q-05-link.sql` | 三单状态分布、暂收↔检验↔入库 各条关联路径的命中率 |
| `q-06-batch-link.sql` / `q-07-po-link.sql` | 批号/采购订单号能不能当链路键(结论:采购入库单不存采购订单号,批号编码规则也不同) |
| `q-10-chain.sql` | 最终取数原型(送料行 × 检验行 × 入库行三级 OUTER APPLY)+ 覆盖率 |
| `q-11-inv-yes.sql` / `q-12-inv-yes.sql` | `bs_inv.来料检验` 分布(是=13 / 否=3967)与清单 |
| `q-13-verify.sql` | 迁移复核:QC_FLOW 授权 13 个角色、译名 10 条、**yj_panel 行 = 0** |
| `q-14-testdb.sql` / `q-17-users2.sql` / `q-18-perms.sql` | 测试账套状态分布、用户/角色、各角色对三个目标面板的查看权(用来挑"有看板无单"的验证账号) |

执行方式(在 `tools` 下):

```powershell
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=8" `
  yinjia "Yinjia@2026" archive\_qc-flow-20261112\q-13-verify.sql
```

## 三、接口与词条

| 文件 | 用途 |
|---|---|
| `_api-probe.mjs` | 四种状态筛选的汇总 + 环节分布 + 各环节样例 |
| `_api-probe2.mjs` | 有检验单的行明细、`仅需检验` 筛选后的汇总 |
| `_api-probe4.mjs` | 检验结论分布(全部 502 行:空 489 / 部分不合格 3 / 不合格 2 / 合格 8) |
| `_api-probe6.mjs` | 测试账套同一口径复核(部分不合格 30 / 合格 131 / 不合格 32),用来验证三档判定 |
| `_i18n-apply.mjs` | 把本页新增 UI 词条写入 10 个语言包(`biz` 块,幂等:已存在则跳过) |
| `_i18n-check.mjs` | 反查:`QcFlowMonitor.vue` 里每个 `tt('中文')` 在 10 个语言包里是否都有译名(当前:缺 0) |
