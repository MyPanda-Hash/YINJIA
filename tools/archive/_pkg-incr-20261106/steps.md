# 增量部署包 pkg-incr-20261106(换 app.jar + 6 条迁移,其中 1 条删服务器 40 张备份表)

> 解压到 **C:\yj-deploy**;若目录里还有旧包内容(旧 `to-run*.txt` / `tools\`),**先清空目录再解压**,
> 避免两套清单混放。服务器:**管理员 cmd** 执行;下面命令块可直接整段复制(cmd 块内无注释)。
> jar 内嵌前端 `index-joL4T-0s.js`;manifest **724 条**;to-run **6 条**。

## 0. 部署前先核对服务器现状(三条指纹,应当全对)

| 指纹 | 期望值 |
|---|---|
| 现役 jar 内前端入口 | `assets/index-DzVhzlzW.js` |
| `C:\yinjia\app.jar` SHA256 | `e4b6e4541ab4ddcdc8f4295c8e89ea55ce1d2647332b18a3802b510aa4ed8308` |
| `yj_schema_log` 行数 | **754** |

```cmd
cd /d C:\yinjia
certutil -hashfile app.jar SHA256
powershell -NoProfile -Command "$m=Select-String -Path 'C:\yinjia\app.jar' -Pattern 'index-[A-Za-z0-9_-]+\.js' -Encoding Byte -AllMatches -ErrorAction SilentlyContinue; 'text-probe-not-used'"
sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'LEDGER=' + CAST(COUNT(*) AS varchar(10)) FROM HSDZ_MES.dbo.yj_schema_log"
```

> 若 ledger 已经是 755+,说明 21:22 之后又有人在服务器上跑过脚本 —— 先停下问清楚,不要直接 GO。

## 1. CHECK(只读)

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat
```

判据:末行 `RESULT: CHECK-OK`(前面应有 `RESULT: PREFLIGHT-OK` 与 `SYSADMIN=1` / `DB_PRESENT=1`)。

## 2. GO(换库 + 换 jar)

```cmd
cd /d C:\yj-deploy
deploy-incremental.bat GO
```

期望依次出现:`APP-STOPPED` → `BACKUP-GATE-PASSED` → `MIGRATIONS-OK` → `NEW-JAR-IN-PLACE` → `APP-STARTED` → `LOGIN-OK` → **`RESULT: ALL-OK`**。
任一步 `RESULT: FAIL-*` 即停手,把 `logs\deploy-*.log` 尾部发回来(失败处置见《部署说明》§二「闸之外还有一条顺序纪律」)。

## 3. 本包做了什么

### 3.1 to-run 6 条(强制执行,顺序即列表顺序)

| # | 脚本 | 作用 | 幂等 |
|---|---|---|---|
| 1 | `migrate-sample-int-flat-20261106.sql` | 内部开发样品申请单 → 共享表(单表长列表/无审批/可筛选/分页) | 是(重跑打印 `[PASS] …已是共享表`) |
| 2 | `migrate-proc-insp-form-20261106.sql` | 制程检验单:工序隐藏、检验方案默认值、结果判断下拉 | 是 |
| 3 | `migrate-qc-insp-twolevel-20261106.sql` | 首件/制程检验单接入两级审批(加 审批人/审批时间 列 + 字段 + 译名) | 是 |
| 4 | `migrate-qc-proc-insp-tpl-20261106.sql` | 制程检验记录表库内模板补「批准」签名格 | 是 |
| 5 | `migrate-proc-insp-plan-editable-20261106.sql` | 检验方案 editable 0→1(默认值只在空值兜底) | 是 |
| 6 | `migrate-drop-bak-tables-20261106.sql` | **删除服务器 40 张备份/临时表**(见 3.2) | 是(表不存在即 `[跳过]`) |

> 第 1 条在 22:31 那次部署里应已执行(ledger 753→754);本包**故意再放一次**用于兜底 ——
> 脚本幂等,重跑只会打印 `[PASS]`。若你确认 22:31 已生效,它也不会造成任何变化。

### 3.2 删备份表:为什么单独写一支、以及它删的是什么

服务器实测(21:22 备份还原的快照库)残留 **40 张**:

| 家族 | 张数 | 来历 |
|---|---|---|
| `_bak_pc0000_*` | 5 | PC0000 批号归一前的原行 + 基线/中间表 |
| `_bak_qcdraft_*` | 7 | 检验单「空壳草稿」清理前的头/明细/状态快照 |
| `_bak_qcmix_*` | 10 | 品质模块 2026-10-21 09:24 整理前的整行快照 |
| `_bak_qcregen_*` | 10 | 2026-10-21 09:07 重新生成前的整行快照 |
| `qc_*_bak_*` | 8 | 2026-10-21/22 服务器侧手工建的检验整表快照(仅服务器有) |

前两支老脚本(`migrate-drop-bak-snapshots-20261021.sql` / `migrate-drop-bak-qc-snapshots-20261102.sql`)
在服务器上是**「只登记、未执行」**(baseline),根因是它们**互相闸死**:前者「名单外不得有其它备份表」
被 qc 家族挡住,后者同一闸门被 `_bak_pc0000_*` + `qc_*_bak_*` 挡住 ⇒ 单独跑哪支都过不去。
本包第 6 条把三族并成一张名单、一次判一次删,并新增两道闸门(④ 后缀式快照必须「同名现役表存在且行数 ≥ 快照」;
⑤ 不得有视图/过程/函数/触发器/外键依赖)。

**删前证据(快照库实测)**:全仓 grep 无代码引用;无依赖/无外键;现役表行数均为快照超集
(首件头 435≥432、首件明细 39069≥38799、制程头 453≥441、制程明细 2540≥2535);草稿单回流 0 行。
**删后彩排结果**:40 张全部删除、`bak_left=0`、表数 301→261、事务提交。

> ⚠ 这是**不可回滚**的删除(数据即快照本身)。安全网 = 部署前自动备份(`backup\pre-deploy-<TS>.bak`)+
> 你提供的 `HSDZ_MES_manual_20261106-212242.bak`(SHA256 `a2b6817b…`)。

### 3.3 `[4b] baseline` 会刷 125 条历史脚本的哈希 —— 这是正常的

服务器台账里有一批历史脚本的 `content_hash` 与本地当前字节不一致(98 条在 2026-09-21 加过
`IF DB_NAME()` 守卫、其余为行尾/修订漂移)。`[4b] baseline` 只**更新哈希、不执行脚本**,
目的是让随后 `[4c]` 的裸 `DbSync` 变成「执行 0」——**不这么做,下一次任何人跑裸 sync 都会重放那 125 条**(事故形态)。
判据是 `[4c]` 打印 `执行 0`;`ledger` 行数不变。

## 4. 部署后验收(逐条打勾)

```cmd
cd /d C:\yj-deploy\tools
java -cp lib\mssql-jdbc.jar verify\DbNormAudit.java
java -cp lib\mssql-jdbc.jar verify\FourDocAudit.java
```

| # | 判据 | 期望 |
|---|---|---|
| 1 | `DbNormAudit` 第 10 项(备份/临时表) | **PASS(0)**(部署前为 FAIL 40) |
| 2 | `FourDocAudit` | `[PASS]`(四单基线不受影响) |
| 3 | `yj_schema_log` 行数 | **759**(754 + 5 条新增;第 1 条为更新不增行) |
| 4 | 备份表清零 | `sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM HSDZ_MES.sys.tables WHERE name LIKE '%[_]bak%'"` → `0` |
| 5 | 前端入口 | 外网首页 chunk = `index-joL4T-0s.js` |
| 6 | 制程检验单 | 打开 `品质量管理 → 制程品质 → 制程检验单`,记录表底部有「审核人 / 批准」两格,侧栏有「提交审批 / 审批情况」 |
| 7 | 内部开发样品申请单 | 单表长列表(14 列带筛选/排序),工具栏无「提交审批」 |
| 8 | 外部开发样品申请单 | 纸面有「申请 / 审核 / 确认」三格,审批中单据可「审批通过」并弹「一级审批 · 回填配方及工艺要求」 |

## 5. 回滚

- **只回滚 jar**:`copy /y C:\yinjia\backup\app-<TS>.jar C:\yinjia\app.jar` 后 `schtasks /run /tn YINJIA-MES`。
- **回滚库**:需 RDP 用 `sqlcmd -E`(服务器 `yinjia` 账号非 sysadmin):
  `RESTORE DATABASE [HSDZ_MES] FROM DISK = N'C:\yinjia\backup\pre-deploy-<TS>.bak' WITH REPLACE`。
- 回滚后要把 `yj_schema_log` 一起回退(它随库还原),否则下次 sync 会以为脚本已应用。

## 6. 部署完必须记账

在 `deploy/部署台账.md` 追加一行 + 一节:三个指纹(新 `app.jar` SHA256 `9b0422f0…` / 前端入口 `index-joL4T-0s.js` /
`yj_schema_log` 759)、迁移 6 条、被剔除脚本 0 条(`125 条字节漂移走 baseline 未执行`,需写明)、
备份表 40→0 的实测证据、回滚点(`backup\pre-deploy-<TS>.bak` + `backup\app-<TS>.jar`)。
