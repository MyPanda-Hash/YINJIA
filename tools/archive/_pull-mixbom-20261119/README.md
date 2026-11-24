# 拉取云端合并 + 混料物料清单落地 · 2026-11-19

## 一、合并结果

| 项 | 值 |
|---|---|
| 本地原 HEAD | `490ae979c`(与 merge-base 相同 ⇒ 无本地独有提交) |
| 云端 origin/main | `e8100a32a`(41 提交) |
| 合并方式 | `git merge --ff-only origin/main`(**快进,无冲突、无合并提交**) |
| 合并后 | `e8100a32a chore(deploy): 部署 a75d08bc1(补齐 11 条未执行迁移 + 换 jar)+ 台账 #56 与取证` |
| 工作区 | 干净(`git status --short` 0 行) |

## 二、混料物料清单(本次重点)

### 2.1 手机扫码为什么会依赖它

`frontend/src/business/mixScan.js` 与后端 `MixScanService.bomRowsOf` 都改读 **`bs_mix_bom`**
(commit `be4897be9 feat: 混料领料与扫码混料改按《混料物料清单》取数`):
扫工单码 → `MixBomService.of(产品编码)` → `bs_mix_bom` 取明细 → 逐项扫物料码称重。
**表不存在 ⇒ 扫码混料接口 500;表存在但没行 ⇒ 页面提示"没有维护用料"。**

### 2.2 执行前(两账套都是缺的)

```text
HSDZ_MES      : bs_mix_bom 不存在 · yj_panel MIX_BOM 0 行 · yj_field MIX_BOM 0 行
HSDZ_MES_TEST : 同上
```

### 2.3 已执行(先正式、后测试,幂等脚本)

```text
DbSync run migrate-mix-bom-20261118.sql          # HSDZ_MES   → [OK] 9 batches
DbSync run migrate-mix-bom-strip-tb-20261118.sql # HSDZ_MES   → [OK] 7 batches
YINJIA_SQL_DB=HSDZ_MES_TEST DbSync run ... 两条    # → [OK] 9 / 7 batches
```

### 2.4 执行后核对(两账套一致)

| 对象 | 实测 |
|---|---|
| `bs_mix_bom` | 建表成功,42 列,主键 + `uq_bs_mix_bom_doc_line` 唯一索引 |
| 表/列中文注明 | 表 + 关键列 `MS_Description` 齐(脚本自检 `@commented >= 26` 通过) |
| `yj_panel` `MIX_BOM` | 1 行(混料物料清单 / 数据建模) |
| `yj_field` | 16 行,全部 visible=1(与脚本自检 `@fields = 16` 一致) |
| 面板译名 | 9 语种(en/ja/ko/es/fr/de/ru/vi/th) |
| 角色授权 | `yj_role_panel` 全角色 view,query |
| 数据行 | **0 行**(见 §四) |

## 三、拉取后必跑的四单回归闸(AGENTS §2.5)

```text
HSDZ_MES      [PASS] QC_RECV 73/73 · QC_INSP 59/59 · QC_RETURN 40/40 · PURCHASE_IN 165/165 · 越界 0
HSDZ_MES_TEST [PASS] 同上,12/12 面板逐项 0 差异
```

(物理列对账:两库 `bl_purchase_in` 均 127 列 vs 文档 126 列,多出列"未登记即不显示",按工具口径不判 FAIL。)

## 四、本地数据现状(重要,别误判成"功能坏了")

| 探测 | HSDZ_MES | 说明 |
|---|---|---|
| `bs_mix_bom` 行数 | 0 | 本地无混料清单数据 |
| `rd_mold_proc_head` | 2 张,`yj_doc_status.archived` 全为 `N` | 没有已归档烧结单 ⇒ 归档同步/回填端点都产生不了行 |
| `rd_x_sinter_head` | 0 张 | 同上 |

即:**本地能显示「混料物料清单」面板(空表),但扫码混料会提示"没有维护用料"**;
服务器侧台账 #56 记录已跑同一批迁移,且服务器有真实单据
(`MIX-2026-11-0001` = A-48-41、`MIX-2026-11-0002` = B-92-25,见
`docs/development/工艺清单归档同步基础数据清单-20261118.md` §九)。
**手机扫码走的是服务器,不受本地空表影响**;要在本地演练,需先在本地归档一张烧结工艺清单,
或调 `POST /api/px/procBom/resync`。

## 五、阻塞项:迁移链还剩 43 / 45 条(本地库历史遗留,不是本次合并造成的)

`DbSync sync` 在第 1 条就中止:

```text
[新增] migrate-qc-proc-insp-batch-table-20261111.sql
[SQL失败] 出货检验功能记录表(批次矩阵)迁移自检失败:见脚本第 7 节各项
```

逐项核对(`q-selfcheck.sql` / `q-hide13.sql`):7.1 列 / 7.2 注明 / 7.3 字段行 / 7.4 seq 不撞号 /
7.6 译名 / 7.7 改名 / 7.8 代号·底表·前缀 / 7.9 派生列 **全部通过**;
**唯一不过的是 7.5**:脚本要求 `处理方式` 仍 `hidden=1`,而本库是 `hidden=0`。

根因在更早的 `hide-qc-proc-insp-spare-head-fields.sql`:

| 事实 | 实测 |
|---|---|
| 该脚本在 `yj_schema_log` 的登记时间 | 2026-11-09 16:27:59(当天共登记 **732 条**) |
| 该脚本的效果(13 个表头字段 hidden=1) | **库里不存在**,13 个全部 hidden=0 |
| 同批:建 `工单行号` 字段的脚本也已登记 | 但 `yj_field` 里 **没有 `工单行号` 这一行** |

⇒ 本地库的"已执行"记录与库内真实结构不一致(登记了但没生效),属历史遗留漂移。

**本次没有强行改这些元数据**:`处理方式` / `工序` 的隐藏状态会直接改用户界面,
且 `/api` 无法备份库(`yinjia` 账号无 `BACKUP DATABASE` 权限),不宜在无确认的情况下动。

## 六、未做 / 待定

1. 其余 **43 条**(测试库 45 条)迁移未执行 —— 等用户选择:① 逐条 `DbSync run` 取证后补
   (预计 QC 那几条仍需先修元数据);② 先用服务器备份重建本地库再整链补;③ 维持现状。
2. **本地 jar 未重建**:`backend/target/*.jar` 是 2026-11-18 16:42 的,`jar tf` 里**没有 `MixBomService`**
   ⇒ 若起 8090,扫码混料仍是旧口径。本机 `mvn` 不在 PATH(未安装),重建需先装 Maven。
3. 本地 8090 当前**未运行**(`Get-NetTCPConnection -LocalPort 8090` = 0)。

## 七、文件

| 文件 | 用途 |
|---|---|
| `Pending.java` / `PendingList.java` | 只读比对 `db-migrations.txt` 与 `yj_schema_log`(列/写待执行清单) |
| `q-check.sql` | 混料清单对象核对(表/列/面板/字段/译名) |
| `q-selfcheck.sql` / `q-hide13.sql` | 制程检验单自检各项与 13 个隐藏字段逐项状态 |
| `q-logdates.sql` / `q-arch.sql` / `q-docstatus.sql` | 登记日期分布、烧结单归档情况 |
| `pending-*.txt` | 两账套合并后仍待执行的脚本清单 |

⚠ 四单闸/建表/去 -tb 的原始输出是 `.log`,被 `.gitignore` 忽略(`*.log`)未入库;重跑命令:

```powershell
cd tools
java -cp lib/mssql-jdbc.jar verify\FourDocAudit.java HSDZ_MES
java -cp lib/mssql-jdbc.jar verify\FourDocAudit.java HSDZ_MES_TEST
java ..\_scratch\pull-mixbom-20261119\Pending.java HSDZ_MES   # 待执行清单(取 PendingList 同理)
```
