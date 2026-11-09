# _apply-pending-20261109 —— 把本地账套补齐到仓库清单那一版(修「加标水字段对不上」)

> 用户报障(2026-11-09,两张截图):「更新了吗,字段都没对齐,图二是服务器上的,主要是字段问题」
> 图二(服务器)加标水明细有 **试剂用量(g)** / **加标水水质指标** 两排分组列;图一(本机)只有 8 列。

## 根因(不是代码,是本地库落后)

- 加标水的列集**不是写死在前端**,而是「测试项目」这个标准库条目的 `yj_std_lib.content`(JSON `cols`,
  一个条目 = 一套表格样式,见 `tools/migrate-spike-water-layout-20261106.sql` 文件头)。
- 本地开发库当时**落后 26 条迁移**(`DbSync` 默认增量卡在历史遗留的 `migrate-drop-bak-qc-snapshots-20261102.sql`
  两道闸门 —— 库里还有 `_bak_*` 快照表,后面的一条都不跑),其中就包括
  `migrate-spike-water-layout-20261106.sql` / `-fix`(把 3 套列结构写进标准库)与
  `migrate-sample-dev-panels-20261106.sql` / `migrate-testlib-spec-*`(研发面板与检验项目标准库)。
- ⇒ 本地 `yj_std_lib.content` 里没有 `cols` JSON,前端退回最小列集,于是只剩 8 列。

## 处置

`apply-pending.ps1`:按清单顺序对每个账套逐条 `DbSync run <脚本>`(绕过卡住的闸门),失败落日志;
两支「删备份表」脚本(`migrate-drop-bak-qc-snapshots-20261102` / `migrate-drop-bak-tables-20261106`)
因历史遗留的 `_bak_*` 表仍在而按仓库既定做法 `baseline`(只登记不执行)。

| 账套 | 结果 |
|---|---|
| `HSDZ_MES`(正式) | 成功 **23** / baseline **2** / 失败 **1** = `migrate-qc-insp-twolevel-20261106.sql` |
| `HSDZ_MES_TEST`(测试) | 见 `logs`/控制台(同批执行中) |

失败的那条是**脚本自带的守卫**,不是环境坏:它要求「正式账套里 QC_PROC_INSP / QC_FIRST_INSP
各有 ≥1 个**非管理员**角色 `yj_role_panel.can_approve='Y'`」(服务器是 4 个),本地是 0 个 ⇒
`RAISERROR` 拒绝执行(设计如此:一级审批没人配 = 流程走不通)。处置建议:确认这两张单由哪些角色审批后,
先补 `can_approve='Y'` 再重跑该脚本(不动已授权数据)。

## 验证(改完长什么样)

- `yj_std_lib` 三条加标水条目 content 已是 JSON:`NSF 53-除铅（PH8.5）` 1441B / `NSF 53-除汞（PH8.5）` 1340B /
  `NSF 53-除VOC` 1173B;
- 8090 打开「研发管理 › 测试记录 › 加标水配置记录表」,选「测试项目 = NSF 53-除汞（PH8.5）」,
  表头读出(逐列,含屏幕外):
  `测试日期 / 项目名称 / 测试装置 / 测试工位 / 配水量（L） / 配置用水 /`
  **`试剂用量（g）`:碳酸氢钠 / 二水氯化钙 / 盐酸或氢氧化钠 / 汞标准溶液 1000mg/L** +
  **`加标水水质指标`:PH 8.5±0.25 / TDS（mg/L）200-500 / 水温（℃）20±2.5 / 浊度值（NTU）＜1** +
  `负责人 / 手机照片` —— 与服务器截图逐列一致(只多末尾「手机照片」,那是本轮要保留的逐行附件列);
- 截图 `ego/local-8090.png`(本机)、`ego/server-prod.png`(服务器,同一脚本抓的)。

## 复跑

```powershell
powershell -ExecutionPolicy Bypass -File tools\archive\_apply-pending-20261109\apply-pending.ps1 -Db HSDZ_MES
powershell -ExecutionPolicy Bypass -File tools\archive\_apply-pending-20261109\apply-pending.ps1 -Db HSDZ_MES_TEST
```

四面板对照(`tools/archive/_merge-4panel-20261109/compare-panels.mjs`)在本批之后仍是:
测试申请单完全一致,另 3 张只多「手机照片」。
