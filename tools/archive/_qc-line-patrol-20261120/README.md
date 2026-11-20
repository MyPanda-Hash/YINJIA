# 成型车间巡线记录表（QC_LINE_PATROL）· 2026-11-20 五条修订 · 验收证据

用户口径（2026-11-20，原话逐条）：

1. 「表格处能增加当前的创建时间。让当前的巡线时间能在增加这一行表格的时候填入当前的时间。」
2. 「新增不默认带入三个行，需要自己手动新增行。」
3. 「产品信息确认，一个巡线时间里面就只有一个编号和型号内容（现在有 2 个）。」
4. 「列内容修改：两端密度（伊可普高品质炭棒需要测试）修改为两液密度（伊玛印品耐水煮要求测试）。」
5. 「为当前页面增加一级审批流程。」（追问「审批通过权给谁」→ 选定 **与首件/制程检验单同口径**：生产 / 质量审核 / 总经理 / 品质审核）

> 环境：本地 5173（vite，源码即时生效）+ 登录工厂 **YINJIA-MES·测试库**（HSDZ_MES_TEST），账号 admin。
> 脚本：本目录 `round-01..06.mjs`（ego-browser，每轮独立文件，可复跑；`taskSpace('qc-line-patrol-20261120')`）。
> 截图：按用户 2026-10-15 口径**截图不入库**（`.gitignore` 的 `*.png`）；下表里的 png 只是**本地文件名**，
> 复跑对应 round 脚本即可原样复拍。

## 一、改动清单

| 文件 | 改了什么 |
|---|---|
| `frontend/src/core/qc/QcLinePatrolSheet.vue` | ① `nowStamp()` + `newBlock()` 预填「巡线时间」= `YYYY-MM-DD HH:mm`；② 删掉 `DEFAULT_BLOCKS=3` / `seedBlocksOnce` / 自动铺块的 watch（新单 = 空表 + 「＋ 新增巡线记录」，且建单不再误标脏）；③ 列标题 `两端密度（伊可普高品质炭棒需要测试）` → **`两液密度（伊玛印品耐水煮要求测试）`**（`key` 仍 `两液密度`，物理列不动）；④ 巡线时间列 8%→10% + 12px 字号（原来时间戳会被截成「2026-11-20 17」）；⑤ 头部契约注释按 2026-11-20 口径重写 |
| `frontend/src/core/views/PanelxList.vue` | `hasApprovalBtns` 补 `QC_LINE_PATROL`（2026-11-17 只登记了后端，侧栏没有「提交审批」）；同步 `isApprovalDoc` 里"本期不做审批流"的过期注释 |
| `frontend/src/core/qc/linePatrolKeys.test.js` | 断言按新口径更新：label = 两液密度（…）、无 `DEFAULT_BLOCKS`/`seedBlocksOnce`、`newBlock` 必须 `nowStamp()` 预填巡线时间、产品区只 1 组 |
| `tools/migrate-qc-line-patrol-approval-20261120.sql` | 新增：`yj_role_panel` 给 1033 生产 / 1039 质量审核 / 1042 总经理 / 1048 品质审核 置 `can_approve='Y'`（1048 原先连授权行都没有 → 补行，perms 照 QC_FIRST_INSP）；幂等 + 自检 |
| `tools/db-migrations.txt` | 登记上面这条迁移 |
| `docs/design/成型车间巡线记录表-首版.md` | 契约同步：2 子行/1 组、不默认铺块、巡线时间自动填、列标题口径、§三之一 一级审批、修订实录 |

## 二、验证（5173 实测）

| 条 | 判据 | 结果 | 证据 |
|---|---|---|---|
| 1 | 新建单 → 空表；点「＋ 新增巡线记录」→ 该块「巡线时间」= 当前时间 | 实测填入 `2026-11-20 17:13`（加块时刻），格内可改；列宽 10% 下 16 字符完整显示（见 05-approved.png 的 `2026-11-20 17:29`） | `03-empty-new.png` / `03-one-block.png` / `04-filled-new.png` |
| 2 | 新建单不再自动铺 3 块 | 点「新增」后 `.lp-row` = 0，空表显示「＋ 新增巡线记录」 | `03-empty-new.png`（DOM 读数 `{"rows":0,"empty":"＋ 新增巡线记录"}`） |
| 3 | 一个巡线时间只有 1 组编号/型号 | 每块 2 子行（编号/型号各一行，含标准值/实测），块级格 rowspan=2 | `03-one-block.png`、单测 `linePatrolKeys.test.js`（5/5 通过） |
| 4 | 列标题 = 两液密度（伊玛印品耐水煮要求测试） | 表头实测为该文案；10 个语言包均已有 en 译名 `Two-Liquid Density (Yima printed products boil-resistance test)` | `02-existing.png`、`node --test src/core/qc/linePatrolKeys.test.js` |
| 5 | 草稿 → 提交审批 → 审批通过 → 已审核 → 弃审 → 草稿 | 侧栏出现「提交审批」；提交后左栏状态 `审批中`；管理员「审批通过」后 `已审核` 且纸面「审核人」= 系统管理员；「弃审」回 `草稿` | `05-submitted.png` / `05-approved.png` / `06-unaudited.png` |

### 审批链路 DOM 读数（round-05）

```text
pick XJ-2026-11-0008 → 草稿
click 提交审批 → 左栏「审批中」，侧栏变成 审批通过 / 审批驳回 / 审批情况
click 审批通过 → 左栏「已审核」，纸面审核人 = 系统管理员
```

### 迁移执行（两账套）

```text
java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-line-patrol-approval-20261120.sql
  → [OK] 2 batches（HSDZ_MES）
YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-line-patrol-approval-20261120.sql
  → [OK] 2 batches（HSDZ_MES_TEST）
```

执行后 `yj_role_panel` 实测（`can_approve='Y'`）：

| 库 | 角色 |
|---|---|
| HSDZ_MES | 1033 生产 / 1039 质量审核 / 1042 总经理 / 1043 仓库审核（原有）/ 1048 品质审核（本次补行） |
| HSDZ_MES_TEST | 1033 / 1039 / 1042 / 1048（1043 本来就是 N，未动） |

## 三、测试数据（测试库）与清理

- 造单：`XJ-2026-11-0007`（点「新增」产生的空草稿，17:12）、`XJ-2026-11-0008`（审批链路单，1 个明细块）。
- 清理：UI「删除」（软删 → `yj_doc_status.canceled='Y'`）之后，再按 `_cleanup-test-docs.sql` 物理删除
  `qc_line_patrol_head / _detail / yj_doc_status / yj_form_approval` 四张表里这两单的行。
- 清理后实测：`qc_line_patrol_head` 仅剩 `XJ-2026-11-0004`（2026-11-14 首版验收留档）与
  `XJ-2026-11-0005/0006`（更早已被作废的空草稿，非本轮产生）；`qc_line_patrol_detail` = 0 行；
  `yj_form_approval(QC_LINE_PATROL)` = 0 行。

## 四、未做 / 待办

- **未部署**：服务器（`36.140.66.163:8090`）与本地 8090（jar 内 static）都未更新；本轮只改源码 + 库授权，
  按项目规范部署需单独走 `deploy_src.py` 并写 `deploy/部署台账.md`。
- `backend/src/main/resources/static` 前端产物**未同步**（本轮工作区里还有另一任务的未提交前端改动，
  一并同步会把别人的改动混进静态产物；等那批落地后统一同步）。
