# 待检验目录 + 检验数据记录明细表(2026-11-11)

> 用户口径(原话):
> ①「已经完成检验的就不用显示了,现在这个检验目录,改名成待检验目录,只需要待检验的数据。」
> ②「然后另外做一个检验数据记录的明细表面版(可以查询)。每一条罗列的是都要带来料检验单也要带行号和检验数据记录。」
> ③「还有也要有采购订单,送料暂收单,采购入库单(这3个的单号和行号,但是这个不用跳转,只有上面两个才用)。」
> ④「还有50行一页。」

## 交付物

| 层 | 文件 |
|---|---|
| 迁移 | `tools/migrate-qc-pending-detail-20261111.sql`(改名 + 视图 + 面板 + 字段 + 授权 + 10 语言 + 中文注明) |
| 前端 | `frontend/src/core/views/QcCatalogSheet.vue`(只显示待检验 + 改名)、`frontend/src/core/views/PanelxList.vue`(单号跳转 + 行内「取消完成」)、`frontend/src/core/qc/qcInspRecDetail.js`(本表专属契约,唯一真源)、`frontend/src/business/menus.js`、`frontend/src/i18n/locales/*.js`、`frontend/src/core/dashboard/flowSpec.js` |
| 后端 | `QcCatalogService`(守卫/提示语改口径)、`ButtonService`(「该按钮仅待检验目录可用」) |
| 文档 | `tools/db-migrations.txt`、`tools/db-inuse-tables.txt`、`docs/development/数据库表清单.md`(§附:A + v3.90) |

## 关键口径

- **面板编码 QC_CATALOG / 表 qc_catalog* 一个字节没动**;「只显示待检验」= 纸面按 `检验状态<>'已完成检验'` 过滤,**一行数据没删**。
- 新面板 `QC_INSP_REC_DETAIL` = flat 只读报表,`line_table=v_qc_insp_rec_detail`,`page_size=50`。
- 一行 = 一条检验数据记录(= 来料检验单一行物料),链上五单齐全:来料检验单(号+行号)、检验数据记录(号)、采购订单(号+行号)、送料暂收单(号+行号)、采购入库单(号+行号)。
- **只有 来料检验单号 / 检验数据记录单号 可点跳转**(过 `canViewPanel`);三组采购单号只显示不跳。
- 「已完成检验」的行只剩明细表看得到,故 **「取消完成」搬到了明细表行内**(后端仍是 `QC_CATALOG` 的「修改」按钮),否则反审核挂靠单据的守卫会变成死路。

## 取证(ego 浏览器,测试库 YJ_TEST)

脚本与截图在本目录(`round-NN.mjs` / `round-NN*.png`),复跑方式:

```powershell
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_qc-pending-detail-20261111/round-05.mjs')"
```

| 轮次 | 结论 |
|---|---|
| round-01 | 面板列头 23 列齐全(含「操作」),查询条 14 个查询字段 |
| round-05 | 明细表「共 142 条 / 第 1/3 页」,翻页后第二页仍是 50 行 ⇒ 50 行一页;待检验目录标题「待检验目录」、107 行、状态只有「正在检验中」 |
| round-07 | 接口回包 `totalSize=142`、请求体 `pageSize=50` |
| round-09 / round-10 | 用查询条过滤 `JYSJ-2026-09-0032` ⇒ 共 1 条,行上出现「取消完成」 |
| round-11 | 点「取消完成」→ 确认 → toast「已取消完成（已写入修改记录）」、状态回弹为「正在检验中」;该行五单全链可见:`IJ-2026-09-0141 行1 / YJ-20260909-01 行2 / SL-2026-09-0165 行1 / PI-2026-09-0128 行1` |
| round-12 | 点「IJ-2026-09-0141」跳到 `QC_INSP` 并定位该单;待检验目录行上动作只剩「完成检验 / ✕」(「修改」已迁走) |

⚠ round-11 验证改动了测试库一行(`qc_catalog_detail.id=11`),**已用 `q-17-restore.sql` 复原**:
检验状态退回「已完成检验」、删除本轮写入的 `yj_doc_modify_log` 行。

## 数据库探针(q-NN*.sql)

`q-01` 元数据与物理列 / `q-06` 链上取样 / `q-07` 关联解析率 / `q-13` 视图抽样与填充率 /
`q-14` 模拟 `queryFlat` 取数 SQL / `q-16` 找「已完成检验」样本 / `q-17` 验证后复原 / `q-18` 列数。

跑法(在 `tools/` 下):

```powershell
java '-Dstdout.encoding=UTF-8' -cp "lib\mssql-jdbc.jar" SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" `
  yinjia 'Yinjia@2026' archive\_qc-pending-detail-20261111\q-13-view.sql
```
