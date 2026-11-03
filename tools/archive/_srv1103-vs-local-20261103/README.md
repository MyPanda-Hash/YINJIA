# _srv1103-vs-local-20261103 — 服务器 jar/库 与本地 HEAD 的对差取证

对象：用户提供的服务器 `app.jar`（`c4c04b55…`）+ 备份 `HSDZ_MES-manual-20261103-232234.bak`。
目的：产出 `deploy/pkg-incr-20261103` 增量包，并留下「凭什么只跑这 3 条迁移」的证据。

## 工具

| 文件 | 作用 |
|---|---|
| `_RestoreBak.java <bak> <目标库>` | 读备份头 + 还原成临时库（目标库名带硬闸门，拒 HSDZ_MES / HSDZ_MES_TEST） |
| `_Q.java <库> "<SQL>"` | 只读查询（默认 sa） |
| `_Exec.java <库> "<SQL>"` | 执行 DDL/DML（sa，用于建 user 映射 / DROP 临时库） |
| `_StructDiff.java <库A> <库B> [--skip-bak]` | 表/列/约束/索引/主键/触发器/视图/过程/扩展属性 全属性双向求差 |
| `_cmp.mjs <服务器日志> <本地日志>` | 清单 vs 两账套 `yj_schema_log`：缺失 / 哈希不符 / 清单外 |
| `_hash-variants.mjs <服务器日志>` | 把「哈希不符」分成「仅行尾/BOM」与「内容真变」 |
| `_strings.mjs <assets目录>` | 抽 JS 包里的中文字面量（跨构建语义比对用） |

## 关键结论（数字都可复核）

- 服务器库：296 表 / 113 视图 / 150 面板 / 4838 字段 / `yj_schema_log` **729** 条
- HEAD 清单 **694** 条 ⇒ 服务器缺 **2** 条；哈希不符 **224** 条（**220** 仅行尾/BOM + **4** 内容真变）
- 服务器多登记 37 条历史脚本（清单已移除，无害）
- 服务器只多不少：仅多 `MANU_ORDER`/`MANU_SCHEDULE` 两个已下架面板 + 174 字段；本地有的字段服务器一个不缺
- 后端字节码：218 class 中仅 `ButtonService`（4 个 class）不同 —— 服务器缺提交 `7c6fbfce8` 的「填写人默认当前登录人」
- 前端中文串：服务器独有 1 条「物料平均水分（参考）」；本包独有 4 条（打印代理自行取任务那批）

## 排练（副本库 HSDZ_MES_REHEARSAL，已随取证结束 DROP）

```
run migrate-wo-pick-return-cleanup-20261030.sql   [OK] 4 batches
run migrate-wo-pick-line-20261101.sql             [OK] 8 batches（wo_pick_line 建好，0 行）
数据：bd_material_out 969→969 / bl_material_out 3404→3404 / kucun 1492→1492
      inh 3154→3154 / outh 3382→3382 / yj_doc_status 11968→11968   全等
baseline                                          新标记 1 个脚本(数据库未改动)
裸 sync 复核                                       执行 0, 跳过 695, 失败 0
```

整链裸跑（反证「不能裸 sync」）：`fullchain-drill.txt` —— 第 16 条
`_bs_part3_data.sql` 撞 `bs_op` 唯一键 `PX001` 后中止，`执行 7 / 跳过 9 / 失败 1`。

## 正式部署实测（2026-11-04 00:25，服务器 `C:\yj-deploy\pkg-incr-20261103`）

原始日志在 `server-deploy-logs/`（`.log` 被 .gitignore 挡，故改存 `.txt`）；台账 §2 第 4 节的数字均来自这里。

```
CHECK  00:25:26  CHECKED=744 MISSING=0 BAD=0 → PACKAGE-OK；sql files 733 → PREFLIGHT-OK
           当前 jar = c4c04b55…（部署前）
GO     00:25:37  APP-STOPPED → BACKUP-GATE-PASSED bak=215048704（26,041 页）
           migrate-wo-mixing-list-20261022.sql        [OK] 1 batches
           migrate-wo-pick-return-cleanup-20261030.sql [OK] 4 batches
           migrate-wo-pick-line-20261101.sql           [OK] 8 batches（两处 (0 rows)）
           baseline 新标记 0 个脚本 → 裸 sync 执行 0 / 跳过 694 / 失败 0 → MIGRATIONS-OK
           NEW-JAR-IN-PLACE old=backup\app-20261104-002537.jar → APP-STARTED
           probe-20261104-002537.txt = LOGIN-OK
```

外网复核（本机 curl）：新入口 `index-DfNyqftU.js` 200、新分块 200、旧入口 `index-BdIOxVW4.js` 404。

**未取到值**：`yj_schema_log` / `yj_panel` / `yj_field` 三个行数（台账里标 ※2，命令见台账 §2 第 4 节）。

## 已知遗留（本包不处理）

1. 服务器 11-03 的两条迁移 `migrate-recipe-materials-backfill-20261103.sql`、
   `migrate-mold-spec-strip-prefix-20261103.sql` **不在任何 git 里**（本地/远端/两份远程分支都搜不到），
   属只改数据的脚本（11-03 无任何对象 create/modify）——源文件找不回，需当时部署的人补交。
2. 服务器前端那条「物料平均水分（参考）」标签不在 HEAD 源码里，部署后会消失。
3. 13 张备份/临时表（5 张 `_bak_pc0000_*` + 8 张 `qc_*_bak_*`）保留不动；
   工作区那条 `migrate-drop-bak-qc-snapshots-20261102.sql` 属未提交内容，不在清单 694 内。

## 复现命令（PowerShell / Git Bash 均可）

```powershell
$j = "$env:USERPROFILE\.jdks\ms-25.0.4\bin\java"
# 1) 备份要放进容器共享卷 D:\sql\data，容器内路径 /var/opt/mssql/data/xxx.bak
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar archive\_srv1103-vs-local-20261103\_RestoreBak.java "/var/opt/mssql/data/_srv1103.bak" HSDZ_MES_SRV1103
# 2) 结构差
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar archive\_srv1103-vs-local-20261103\_StructDiff.java HSDZ_MES_SRV1103 HSDZ_MES --skip-bak
# 3) 账本差
node tools\archive\_srv1103-vs-local-20261103\_cmp.mjs log-HSDZ_MES_SRV1103.txt log-HSDZ_MES.txt
```
