# _erplg-restore-20261021 — ERP导入日志从历史提交恢复到当前系统

用户口径(2026-10-21):「历史提交中存在 erp 导入日志的数据,帮我导入到当前系统内」

## 一、结论(先摆事实)

| 项 | 结果 |
|---|---|
| 补录前 `HSDZ_MES` / `HSDZ_MES_TEST` | `erp_imp_log` 0 行 / `erp_imp_row` 0 行 |
| 补录后 | 两账套各 **9 个批次 / 45 条明细**,批次合计 **10,710 行** |
| 接口验证(本机 8090) | `ERPLG` totalSize=9、`detail.erplg` 9 条;`ERPLG_ROW` totalSize=45 |
| 两账套一致性 | 逐列 SHA-256:`log=57F6C440…C44D4E`、`row=790C2983…2722AB` **完全相同** |
| 幂等 | 重跑脚本仍是 9 / 45,0 新增 |

## 二、数据从哪来

- 来源提交:**`647fac62`** `db: ERP导入日志 9 个批次补录推到云端(幂等迁移脚本,两账套已验证)`,
  文件 `tools/migrate-erplg-cloud-push-20261019.sql`。
- 该提交 47 秒后被 **`e0f1c9ad` revert**,所以当前工作区与数据库里都没有这份数据。
- 数据本身的原始出处:2026-10-18 `tools/archive/_dm-20261018/` 从金蝶沙箱现读后写入
  (商品/仓库/计量单位/部门/职员/客户/供应商 + 采购订单/销售订单)。
- 本目录脚本 = 上述历史脚本的**原样恢复**:批次号/条数/备注/时间戳/45 段原始 JSON 全部保留,
  **不含任何新造数**;只改了头注和尾部自检(历史版用 `RAISERROR(…,10)` 打印,这里改为 `SELECT`)。

## 三、脚本

`restore-erplg-20261021.sql`(sha256 `6efe87f94399dd5c6db7581c433fbab4f16d9c37f57962844471cf28e171953b`)

- 日志表按 `[批次号]`、行表按 `([批次号],[行号])` 判重,重跑 0 新增;
- 行表 `[批次id]` 用插入后回查的 `id` 关联,不依赖本机自增 id;
- 只写 `erp_imp_log` / `erp_imp_row` 两张表,两表不存在则整段 SKIP;
- 尾部输出 `RESULT` 行数与 9 个批次清单,期望 `log=9 / row=45`。

## 四、执行(两账套)

```bash
cd tools
JAVA="$JAVA_HOME/bin/java"   # 本机用 JDK 25
export YINJIA_SQL_PASS='<本机 yinjia 口令>(见 tools/DbSync.java 默认值,勿写进文档)'

# 正式账套
"$JAVA" -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10" \
  yinjia env "archive/_erplg-restore-20261021/restore-erplg-20261021.sql"

# 测试账套
"$JAVA" -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=10" \
  yinjia env "archive/_erplg-restore-20261021/restore-erplg-20261021.sql"
```

两账套输出一致:`RESULT | 9 | 45` + 9 行批次清单。

## 五、验证

1. **行数/主键唯一**:`log_rows=9`、`row_rows=45`、`distinct_keys=45`、`empty_json=0`,
   `原始JSON` 长度 50~850。
2. **每批 5 条明细**:001~009 均为 `行号 1..5`,且 `批次id` 正确挂到对应日志行。
3. **两账套逐列一致**:对 9 条日志(去除 id)与 45 条明细(去除 id/批次id)做
   `HASHBYTES('SHA2_256', …ORDER BY 批次号,行号)`,两库哈希相同。
4. **接口**:
   - `POST /api/px/queryFormDataList {panelCode:"ERPLG"}` → `totalSize=9`,首行 `detail.erplg` 9 条,
     `IMP-20261018-009 / 销售订单 / 3983 / 已入库 / 金蝶同步`;
   - 同参数 `panelCode:"ERPLG_ROW"` → `totalSize=45`,首行 `ZL-20261017-02 / bd_so_order / 已写入`。
5. **幂等**:对 `HSDZ_MES` 再执行一次,仍 `RESULT 9 / 45`。

## 六、边界说明

- **未登记 `tools/db-migrations.txt`**。用户这次只要求「当前系统」;该脚本历史上进过迁移链又被
  revert,若登记则下次部署会顺带把 9 批推到云端。需要云端也有这份日志时再单开任务:
  在服务器 RDP 里 `DbSync.java run` 本脚本,或登记后走部署。
- 未改任何表结构、未改代码;`erp_imp_log` / `erp_imp_row` 仍是只读面板
  (`PanelPermissionService.READONLY_PANELS`)。

## 七、回退

```sql
DELETE FROM dbo.erp_imp_row WHERE [批次号] LIKE 'IMP-20261018-%';
DELETE FROM dbo.erp_imp_log WHERE [批次号] LIKE 'IMP-20261018-%';
```
