# 热更新包 · 作废/删除的研发单据不再追踪（2026-10-30）

> **只换 `app.jar`。** 包里附了一条幂等 SQL（`migrate-prune-voided-progress-20261030.sql`），
> 用于清**存量**孤儿进度行 —— 不跑也不会坏，只是服务器上已有的那 2 行要等下次点「同步进度」才消失。
> 打包来源：本机 `backend/target/app.jar`（`rebuild-prod.ps1` 21:51 打包，前端已随包）
> `app.jar` SHA-256 前 16 位：`78e4576f490fb493`　大小：97,512,785 字节
> （2026-10-29 22:00 重打：除本次作废清理修复外，还含同批的「产品文件列表只显示有产品信息表的产品」
>  与「参照弹窗改读表头字段 / 流程管控第一列改项目编号」，均为已合并主干的最新代码。）

## 一、这个包修的是什么

**用户报障**：「我服务器上已经把这个 213 项目的立项申请和项目实施计划删掉了，但是现在还出现在
项目进度查询，以及项目流程管控那些已经弃审废弃删除的单据流程就不需要再追踪了，现在还能看到，
而且删除不了」。

**服务器实测现状**（2026-10-30 只读核对）：

| 项 | 实测值 |
|---|---|
| 项目流程管控列出立项 | **19 条，其中 14 条已作废**（全在显示） |
| 项目进度查询明细行 | 2 行，**2 行都是孤儿**（一行是「213」项目） |
| 服务器前端 chunk | `index-BaGIfbeI.js`（旧构建） |

**根因两层**：

1. 作废/删除走 `voidDoc`，只写 `yj_doc_status.canceled='Y'`，**不动业务表 `asp_cancel`**；
   而流程管控取数与 `pruneProgressRows` 判「源单据还在不在」时**只查 `asp_cancel`**
   ⇒ 作废的单据一律被当成还活着。
2. 作废后**没有触发**进度清理，要等下一次「同步进度」；而项目进度查询是**只读面板**
   （`READONLY_PANELS`），用户没有任何人工删除入口 ⇒ 表现为「删不掉」。

**修复**：

| 位置 | 改动 |
|---|---|
| `RdProjectFlowService` | 立项 / 实施计划 / 疑似关联候选三处取数补 `NOT EXISTS(yj_doc_status.canceled='Y')` |
| `pruneProgressRows` | 两条 live 子查询补状态表过滤 |
| `voidDoc` | `RD_APPROVAL` / `RD_PLAN` 作废后**立刻**跑一次同步 |
| 迁移 SQL | 清存量孤儿行（软删 `asp_cancel='Y'`，幂等） |

**本机已验证**：测试账套造「作废立项 + 存活进度行」→ 点同步后 `清理孤儿行=1`、该行消失、
`rdFlow projects=0`；两条四级行完整保留（`[说明]=[项目编号]` 守卫生效）。`npm test` 1139/1139。

## 二、怎么执行（在服务器上，RDP 里）

**方式 A（推荐）**：双击本目录的 `apply-update.bat`
（前提：服务器上 `C:\yinjia\update.bat` 存在、`C:\yinjia\update\` 目录可写）

**方式 B（手动两步）**：

```bat
copy /Y "\\tsclient\C\INCER\YINJIA-MES\deploy\hotupdate-prune-voided-20261030\app.jar" C:\yinjia\update\app.jar
C:\yinjia\update.bat
```

脚本依次做：**先查包大小**（< 80 MB 直接判 `RESULT: FAILED - app.jar truncated`，绝不用被截断的包覆盖可用的）
→ 备份现役 jar 为 `C:\yinjia\update\app.jar.bak-before-prune` → 复制新 jar → 调
`C:\yinjia\update.bat`（停 → 换 → 起）→ 等 40 秒探活 → 打印 `RESULT: OK` / `RESULT: FAILED`。
日志写在同目录 `apply-update-log.txt`（可直接在本机通过重定向盘读）。

`.bat` 用 `pushd` 起头，所以**直接在 `\\tsclient\C\...` 双击也能跑**（`cd /d` 在 UNC 路径上会失败）。

## 三、换完 jar 之后的存量清理（二选一）

### 方式 ①（推荐，无需 SQL）点一次「同步进度」

研发管理 → 项目管理 → **项目进度查询** → 纸面上点 **「⟳ 同步进度」**。

新代码的 `pruneProgressRows` 会把作废单来源的进度行软删。返回里看 `清理孤儿行` 数字即可。

### 方式 ② 跑包内 SQL

```cmd
sqlcmd -f 65001 -S localhost -d HSDZ_MES -E -i "\\tsclient\C\INCER\YINJIA-MES\deploy\hotupdate-prune-voided-20261030\migrate-prune-voided-progress-20261030.sql"
```

脚本内置自检：清理后再判一次，仍有残留就 `ROLLBACK` + `RAISERROR`，不会留下半清状态。

> **两种方式判据完全一致，跑任意一种即可；都跑也不会有副作用（幂等，第二次 0 行）。**

## 四、部署后怎么确认

1. `apply-update-log.txt` 末行是 `RESULT: OK`（`[health] http code = 200`）；
2. **项目流程管控**：列表从 19 条降到 **5 条**（14 条作废的消失）；
3. **项目进度查询**：那 2 行孤儿消失（「213」那行不再出现）；
4. 研发管理 → 项目管理 → 立项申请列表本身**不受影响**（作废单据照样能在列表里按状态筛出来，
   只是不再进流程追踪）。

## 五、回滚

```bat
copy /Y C:\yinjia\update\app.jar.bak-before-prune C:\yinjia\app.jar
```
然后重启（`taskkill /f /im java.exe` → `C:\yinjia\start.bat`）。

SQL 侧无需回滚：只是把 `rd_progress_detail.asp_cancel` 从 `N` 改成 `Y`，改回 `N` 该行即复现。