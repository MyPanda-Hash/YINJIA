# _sysadmin-dm-migrate-1020 — 迁移链阻塞排查(2026-10-20)

**用户报障**:「start-prod.ps1 启动时的数据库增量同步会在 `migrate-sysadmin-panels-to-dm-20261018.sql` 上失败」

## 结论(已修复,数据库侧已生效)

| 项 | 结果 |
|---|---|
| 根因 | 该脚本自检写死「数据建模 = 36 张、既有 4 张全在数据建模」;`migrate-erp-integ-config-20261018.sql` 已把 `ERPLG`/`ERPLG_ROW` 改归「ERP系统集成」⇒ 实际 34 ⇒ 自检恒失败 ⇒ `DbSync` `break` ⇒ **其后 5 个迁移永远轮不到** |
| 累计损失 | `bs_dc_*` 7 表全缺(`/api/dc/stats` 500)、`bs_dc_gateway.api_key` 缺、`v_stock_balance.预警数量` 缺、生产 10 单参照未刷、`WO_COMPLETION_LIST` 面板/视图/字段/授权全缺 |
| 已修 | ① 自检改判据(两账套 / ERP 迁移跑没跑都成立);② `RAISERROR` 只能吃常量变量(`@a+@b`、`DB_NAME()` 都报「附近有语法错误」);③ 补跑时重建 `WO_COMPLETION_LIST`;④ 样例数据两账套「登记不执行」 |
| 验证 | 两账套链对账 `未登记 = 0`、`DbSync sync` **执行 0 / 跳过 584 / 失败 0**、`/api/dc/stats` **500→200**、完工明面 15 列可查、`v_stock_balance.预警数量` 可查 |

## ⚠ 交接:上传云端时**必须先做**的一件事

本地库对 `migrate-proc-process-samples-20261018.sql` 的登记用的是**旧文件哈希**;
而远端(`7e416617`)已把该脚本改成「头+明细」⇒ **合并后会变成新哈希**:

```
旧(本地当前 / 我在 yj_schema_log 登记的) : cfadb6b344bdc4d6a14a07fd6e16fd8722c253d95361fe8a8046a4b8f00c9845
新(合并后 / origin/main 上的)            : 6223d661e1c3badbef69b1dff21a267c49e0cf181ffe52f0fb62478a7590cc3f
```

**后果**:若合并后直接跑 `DbSync sync`(或启动 `start-prod.ps1`),它会认为"内容变了要重跑"⇒
**往正式库插入 7 张演示单据**(RB/TR/HH/LZ/WB/FX/YC-2026-10-0001)。

**处置(二选一)**:
1. 保持"正式库不插演示数据":合并后立刻把登记更新为新哈希 ——
   ```sql
   UPDATE yj_schema_log SET content_hash = '6223d661e1c3badbef69b1dff21a267c49e0cf181ffe52f0fb62478a7590cc3f'
   WHERE script_name = 'migrate-proc-process-samples-20261018.sql';
   ```
   (两个账套都要;测试库同理)
2. 或者让它跑,然后按脚本尾部的清理语句删掉那 7 张单。

## 产物

| 文件 | 用途 |
|---|---|
| `_QChain.java` | **链对账**:清单(584) vs `yj_schema_log`,列出「排在失败脚本之后因而永远轮不到」的脚本 —— 本次就是靠它定位到 5 个 |
| `_QGroup.java` | `yj_panel.module_group` 分布 + 数据建模/系统管理平台 逐张清单 |
| `_QLog.java` / `_QName.java` / `_QWo.java` | 登记情况(名字/哈希/时间)、有没有以别名登记 |
| `_QImpact.java` / `_QDc.java` / `_QObj.java` / `_QMissing.java` | 被挡脚本的目标对象到底存不存在(表/列/视图/面板/字段/授权) |
| `_QView.java` | `v_stock_balance.预警数量` 可用性 |
| `_baseline-samples.sql` | 两账套把样例脚本登记为「已执行但不插入」 |

复跑:

```powershell
cd D:\YINJIA-main\tools
set YINJIA_SQL_PASS=Yinjia@2026
java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QChain.java HSDZ_MES
java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QChain.java HSDZ_MES_TEST
```

## 已知非本任务问题

* `DbNormAudit` 第 12 项把 `migrate-enable-rcsi-20261018.sql` 报「未登记」—— 它是**库级开关、故意不进链**
  (`db-migrations.txt` 有说明),属体检脚本待补的例外。
* `DbNormAudit` 其余 FAIL(03/04/05/09/10)与本次改动前**逐条相同**,均为存量问题。
