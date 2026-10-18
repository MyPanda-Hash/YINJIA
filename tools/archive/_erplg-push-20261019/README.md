# _erplg-push-20261019 — ERP导入日志「推送到云端」取证

用户口径(2026-10-19):
1. 「erp导入日志的数据是否有推送到云端」
2. 「推送到云端」

## 结论与做法

| 项 | 事实 |
|---|---|
| 云端服务器(36.140.66.163:8090)ERPLG | **0 行**(`IMP-` 关键字同样 0),`ERPLG_ROW` 0 行 |
| 本机 HSDZ_MES / HSDZ_MES_TEST | 各 **9 批 / 45 明细**(2026-10-18 补录,`tools/archive/_dm-20261018/`) |
| 有没有"推"的代码 | **没有**:`erp_imp_log` 运行期无写入方;`ERPLG`/`ERPLG_ROW` 在 `PanelPermissionService.READONLY_PANELS` 里是只读(读写按钮一律 403);`转ERP`(KingdeePushService)只推业务单据,不推导入日志 |
| 数据上云的唯一通道 | 部署(全量恢复备份 / 增量迁移 `deploy/deploy-all.bat` + `DbSync`) |

⇒ 交付 = **幂等补录迁移脚本** `tools/migrate-erplg-cloud-push-20261019.sql`(已登记 `tools/db-migrations.txt`),
走部署迁移链即上云;也可在服务器 RDP 里单跑这一条(见下)。

## 脚本口径

- 数据源 = 本机 HSDZ_MES 现役 9 行 + 45 行,**原样转写**(批次号/条数/备注/时间戳不重算、不造数);
- 幂等:日志表按 `[批次号]`、行表按 `([批次号],[行号])` 判定,重跑 0 新增;
- 只写 `erp_imp_log` / `erp_imp_row`;两表不在则整段 SKIP;
- 行表 `[批次id]` 用插入后回查的 `id` 关联(跨库 id 不同也能正确挂),不是抄本机的 id;
- 尾部 `RAISERROR(10)` 打 `RESULT: ERPLG-PUSH log=%d row=%d (expect 9 / 45)`。

## 验证(2026-10-19 实测)

```powershell
# ① 生成(从本机库现役行转写)
node tools/archive/_erplg-push-20261019/_gen-erplg-push-sql.mjs

# ② 空表验真:先清测试库的 IMP- 行,再跑脚本 —— 必须插出 9/45(不是"本来就有")
node tools/archive/_erplg-push-20261019/_verify-erplg-push.mjs --wipe-test
cd tools; $env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-erplg-cloud-push-20261019.sql

# ③ 逐列一致性:两账套 9 批 / 45 明细每个字段(含 45 段原始 JSON)、[批次id] 挂接
node tools/archive/_erplg-push-20261019/_verify-erplg-push.mjs
#   -> RESULT: ERPLG-PUSH PARITY-OK

# ④ 幂等:再跑一次两个账套,仍是 log=9 row=45(0 新增)
```

实测结果:`PARITY-OK`;第 2 次执行仍 `log=9 row=45`;两账套 `yj_schema_log` 均已登记本脚本。

## 服务器侧(最后一步,需要 RDP)

只有 `C:\yinjia` + RDP 一条通道(`1433` 未对外)。下次部署走迁移链即自动生效;要立刻生效,
在 RDP 的 cmd 里(需先把本脚本放进服务器 `C:\yinjia\tools\`):

```bat
cd /d C:\yinjia\tools
java -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-erplg-cloud-push-20261019.sql
```

验收(开发机直接打接口,不用截图识字):

```powershell
# 期望 totalSize=9
# POST http://36.140.66.163:8090/api/auth/login {admin/123456} -> token
# POST /api/px/queryFormDataList {panelCode:"ERPLG",pageNo:1,pageSize:5,condition:{}}
```

## 文件

| 文件 | 作用 |
|---|---|
| `_gen-erplg-push-sql.mjs` | 从本机库转写生成迁移 SQL(datetime 用 `CONVERT(121)` 取库里原值,避免 JS Date 的 UTC 偏移) |
| `_verify-erplg-push.mjs` | 两账套行数 + **逐列**比对 + `[批次id]` 错挂检查;`--wipe-test` 清测试库 IMP- 行 |
| `_pending-migrations.mjs` | 只读:清单 vs `yj_schema_log` 差集(判断"敢不敢跑默认同步") |
| `_dump-schema.mjs` | 临时取证:导出两表列定义与行(产物 `schema.json` **不入库**,含客户/金额真实业务数据) |
| `_v-parity-1.out` / `_v-parity-2.out` | 上述 ③ 的实测输出留档 |

## 留意

1. 这 9 批的 `备注` 写的是「金蝶账套测试沙箱 · 实例 580147507460444160」——推到正式账套后,
   备注会原样显示在云端日志里,是否改写由业务口径定(本脚本**不改数据**)。
2. `tools/db-migrations.txt` 里另有 6 条 2026-10-18 的脚本两账套**都未登记**
   (`migrate-sysadmin-panels-to-dm-*` / `migrate-dc-*` / `migrate-proc-process-*` / `migrate-stock-balance-warn-*`),
   与本次无关,但**下次跑默认 `DbSync` 会把它们一起执行**,建议单独核一次再部署。
