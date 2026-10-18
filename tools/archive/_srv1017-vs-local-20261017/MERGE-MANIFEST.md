# 本地库「合并态」清单 —— 服务器改动并入 + 本地独有保留(2026-10-17 17:50)

> 一句话:**对比已经做完**;当前 `HSDZ_MES` 就是「服务器侧改动已并入、本地独有改动原样保留」的合并态,
> 并已另存一份副本 `HSDZ_MES-merged-local-20261017-1750.bak`。

---

## 1. 完成度(不是"做不完",而是分层都做完了)

| 层面 | 状态 | 证据 |
|---|---|---|
| **结构**(表/列/索引/主键/唯一/CHECK/默认/触发器/视图/统计/扩展属性) | ✅ 全量逐条比对完成:223 表 / 10,199 条列事实 / 320 索引 / 233 主键唯一 / 687 默认 / 101 视图 / 9,964 扩展属性 | `sql/24`、`raw/24`;221 张表指纹一致,2 张仅差默认约束取值(本地是修正版) |
| **元数据**(面板/字段/译名/角色/权限) | ✅ 完成:`yj_field` 4017 条字段集合与 18 个属性列全等;`yj_translation` 6363 条全等;角色/权限/账号手机绑定已按服务器对齐 | `sql/03`、`_YjFieldAlign`、`raw/03` |
| **数据**(223 张表逐表双向 EXCEPT + 差异表逐列统计) | ✅ 完成:37 张曾有差异 → 同步后 **199 张逐行一致**,剩 26 张已逐张说明理由 | `sql/01`、`sql/22`、`raw/22`、`raw/23` |
| **手机端可用性**(19 张相关表 + 身份种子 + 权限 + 占用链) | ✅ 完成:0 行会丢、0 张表种子落后、权限一致 | `sql/25`、`raw/25` |
| **占用链完整性**(`form_flow_link` 行键) | ✅ 完成取证:服务器 298+287 条悬空,本地 5+8 | `sql/26`、`raw/26` |

---

## 2. 三个集合

### A. 本地独有(服务器没有)—— **原样保留,不删**

| 项 | 量 | 说明 |
|---|---|---|
| `yj_panel.config` 的 `inspGate` / `inspGateLegacy` | 3 行(QC_ASM_INSP / QC_FIRST_INSP / QC_PROC_INSP) | 本地未部署的检验门禁功能,属开发中改动 |
| `yj_schema_log` 登记 | 1 条(`migrate-insp-gate-option-20261016.sql`) | 同上(该脚本尚未提交 git) |
| `inh`/`outh.asp_cancel` 默认约束取值 | 2 条 | 本地 `(N'N')`,服务器 `(N'‘N’')`(中文引号笔误) |

### B. 服务器改动 —— **已并入本地**(`sql/20`,两账套 `SYNC-OK`)

| 类别 | 并入量(`HSDZ_MES`) |
|---|---|
| 业务单据 | `bd_so_order` +20 张、`bl_so_order` +42 行、`qc_tc_in` +1 |
| 检验方案/项目 | `bs_qc_plan` +2、`bs_qc_item` +14 |
| 单据状态/审批 | `yj_doc_status` +26 条登记 / 274 条状态刷新;`yj_form_approval` +13;`form_flow_link` +1 |
| 生产实绩 | `scjl` +2、`wo_process_line` +3、`wo_transfer_log` +1、`plang_pc` +1 |
| 号码池 | `s_allno` +12 |
| 账号/权限 | `yj_user` 2 行手机绑定、`permission` 2 行、`yj_role_panel` 角色 1025 整份(29 行) |
| 属性漂移 | `bs_inv` 106 行、`outh` 14 行、`qc_return`/`qc_return_detail` 各 1 行 |
| 结构 | 2 个默认约束(落成正确取值) |

实测影响(`sql/22` / `raw/23`):全库 111,180 → 111,293 行(**净增 113 行**),覆盖更新 451 行,
删除**仅** 49 行(角色 1025 的旧授权),**没有整库覆盖、没有删表删列**。

### C. 服务器改动 —— **尚未并入**(26 张表,有意/待定)

| 表 | 差异 | 现状与理由 |
|---|---|---|
| `bd_so_order` 165 行 / `bd_pu_order` 116 行 | 金蝶同步快照字段(外部指纹、客户id、金额、附件地址、状态推进) | 未搬;本地跑一次 `deploy/*.mjs` 同步即追平 |
| `bl_so_order` 300 / `bl_pu_order` 282 行 | 行 **id** 被金蝶同步整体重建(业务键逐行命中,内容一致) | 未搬;强搬会打乱本地行 id |
| `rd_plan`/`rd_approval`/`rd_prod_info_head`/`rd_spec_doc_head`/`rd_spec_doc_detail`/`rd_progress`/`rd_progress_detail`/`rd_dev_task` | 服务器有研发演示数据(37 行) | 未搬;按发布规范本地研发区保持空 |
| `yj_attachment` | 2 行附件元数据 | 未搬;文件本体不在 .bak 里,单搬成死链 |
| `yj_message` / `yj_usage_log` / `dm_langue` | 3 / 38 / 2 行 | 未搬;站内消息、日志、登录会话 |
| `inv_cost_ledger` | 5021 行仅「重算时间」不同 | 未搬;成本数值一致 |
| `yj_doc_status` 9 / `yj_role_panel` 6 / `s_allno` 1 / `outh` 1 | 内容级(id 走自增、时间戳) | 未搬;业务键与取值一致 |

---

## 3. 副本(当前合并态)

| 文件 | 大小 | 说明 |
|---|---|---|
| `D:\workspace\yinjia\deploy\backup\HSDZ_MES-merged-local-20261017-1750.bak` | 14,520,320 B | **当前本地库合并态副本**(备份集名 `HSDZ_MES merged local 20261017-1750`,备份时间 2026-10-17 17:48:39) |
| `D:\sql\data\HSDZ_MES-merged-local-20261017-1750.bak` | 同上 | 容器内同一份 |
| `D:\sql\data\HSDZ_MES-pre-srv1017-sync-20261017.bak` | 14,548,992 B | **施工前**本地库(回滚用) |

> `deploy/backup/` 在 `.gitignore` 里,副本不会被提交;需要归档到别处请自行拷贝。

---

## 4. 回滚 / 再合并

```sql
-- 回到施工前(合并前)
ALTER DATABASE HSDZ_MES SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE HSDZ_MES FROM DISK='/var/opt/mssql/data/HSDZ_MES-pre-srv1017-sync-20261017.bak'
WITH MOVE 'ASPSMT' TO '/var/opt/mssql/data/HSDZ_MES.mdf',
     MOVE 'ASPSMT_log' TO '/var/opt/mssql/data/HSDZ_MES_log.ldf', REPLACE, RECOVERY;
ALTER DATABASE HSDZ_MES SET MULTI_USER;
```

```powershell
# 拿到更新的服务器快照后,再合并一次(幂等,只增不删)
docker exec mssql2019 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P *** -C -d HSDZ_MES -i /var/opt/mssql/data/20-sync-server-to-local.sql
```

---

## 5. 待拍板

1. **C 集合是否要拉平**(金蝶快照字段 / `bl_*` 行 id / `rd_*` / 附件行 / 日志)—— 说"全拉平"我就写第二段脚本;
2. **2 条默认约束**是否也统一成服务器那份(不建议,会把笔误搬回来);
3. **上传前**必须用**部署当时新打的**服务器快照重跑 `sql/24` + `sql/25`(手里这份是 09:17 的)。

---

## 附:环境备注

- `DBCC CHECKDB` 在本机跑不了:`D:\sql\data` 是 Docker 挂载卷,不支持 CHECKDB 需要的稀疏文件快照
  (`CREATE DATABASE SNAPSHOT` 失败),属环境限制,与库完整性无关;备份本身可正常读取备份头。
- 旁库:`HSDZ_MES_SRV1017`(服务器快照)、`HSDZ_MES_PRESYNC1017`(合并前本地),用完可删。
