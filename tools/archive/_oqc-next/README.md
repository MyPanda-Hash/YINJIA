# 出厂检验报告两级审批 + 报表导出 端到端验证（task-4，2026-11-04）

本目录是任务「端到端验证：出厂检验报告两级审批 + 导出 PDF/打印预览/Excel + 去页脚/签署落值」的
**验证脚本、证据与结论**。所有结论均为本机实跑，非预期值；复跑命令见第 7 节。

## 0. 结论（2026-11-04 19:16）

**阶段 B 全 PASS：112 项断言 / 0 失败。**

| 组 | 结果 | 证据 |
|---|---|---|
| API + DB（前置/建单/直审拦截/两级审批/导出/清理） | **PASS 50 / FAIL 0** | `phaseB/phaseB-summary-20261104111553.{json,txt}` |
| UI 草稿态（Playwright，8091 新前端） | **PASS 19 / FAIL 0** | `phaseB/ui/draft/ui-draft.{json,-result.txt}` |
| UI 待二级审批态 | **PASS 22 / FAIL 0** | `phaseB/ui/pending2/ui-pending2.{json,-result.txt}` |
| UI 已审核态 | **PASS 21 / FAIL 0** | `phaseB/ui/audited/ui-audited.{json,-result.txt}` |
| 阶段 A 改前基线复核 | **PASS 8 / FAIL 0** | `baseline/old-baseline-check.{json,txt}` |

**关键结论**：
1. 出厂检验报告已按「检验员=编制 / 审核=一级审批人 / 批准=超级管理员」跑通**两级审批全流程**：
   提交审批（检验员自动=提交人）→ 一级审批通过（状态=待二级审批、审核人+审核时间落值）→
   二级审批通过（状态=已审核、审批人+审批时间落值），`yj_form_approval` 留痕
   `SUBMIT/PENDING` + `APPROVE_L1(node=1)` + `APPROVE(node=2)`。
2. 直接「审核」接口对 OQC **被拒**（HTTP 409，提示「走两级审批…不支持直接审核」），前端侧栏
   **已无「审核」直审入口**。
3. 导出报表 PDF / XLSX / UI 打印预览 **去页脚**（不再出现 `water-agplus`/`惠州大亚湾`/`5583930`），
   签署行按头字段落值：**检验员：系统管理员 审核：系统管理员 批准：系统管理员**。
4. 8091 新代码实例验证完毕：测试单已清理（`AUTO_` 残留 0、四表 0 残留），8091 已关停；
   宿主 8090/5173/1433 未动。

## 1. 环境与实例口径

| 项 | 值 |
|---|---|
| 工作区 | `D:\workspace\yinjia`（git HEAD `1b36909ae` + 本次任务未提交改动） |
| 数据库 | `127.0.0.1:1433`，`HSDZ_MES`（本地正式库，验证数据可弃）；两账套迁移均已落库（测试库见 `phaseB/testdb-precheck.txt`） |
| 新代码实例 | **8091**（本任务用 `_build-8091.sh` 从当前工作区源码打包后启动；连同一套本机库） |
| 旧实例 | 8090（宿主会话旧 jar，仅用于改前基线/模板导出对照；**未停未换 jar**） |
| JDK | `C:/Users/vigna/.jdks/ms-25.0.4`（PATH 上的 java 是 1.8，脚本已钉 JAVA_HOME=ms-25） |
| 前端 | 本机 5173（vite，宿主会话）；8091 用打包进 jar 的 `BOOT-INF/classes/static` |
| 登录 | `admin / 123456`，登录工厂 `YINJIA-MES`（= HSDZ_MES 正式库）；均返回姓名「系统管理员」 |

构建产物指纹（`phaseB/build-info.txt`）：

```
git HEAD:      1b36909ae feat: 组装物料清单产品编码改手输 + 工序移出表头(...)
jar:           .tmp/oqc-verify/backend-build/target/yinjia-mes-backend-0.1.0.jar
jar sha256:    4e6d681131709c5bf92e8ae97916bfda31f9e6b3818f71146a7db19f06169977
jar size:      97,798,852 字节（94MB；BOOT-INF/lib 128 个依赖，非瘦 jar）
jar 前端入口:  BOOT-INF/classes/static/assets/index-B9i_S5xx.js
jar 自检:      ButtonService.class 含 "QC_OQC_REPORT"（新代码）
```

## 2. 构建 / 起停（可复跑）

```bash
cd D:/workspace/yinjia

# 1) 构建新代码 jar（npm build → 复制 backend/src+pom 到 .tmp → 同步 dist 进拷贝的 static → mvn package → 自检）
bash tools/archive/_oqc-next/_build-8091.sh
#    可选:--skip-frontend 复用 frontend/dist;--prepare-only 只复制+同步不打包
#    说明:npm run build 只写 frontend/dist;脚本把 dist 同步进 **.tmp 拷贝**的 static,
#          不改工作区 backend/src/main/resources/static(避免混入别人未提交的静态产物)。

# 2) 起 8091（自动轮询登录端点直到 200）
bash tools/archive/_oqc-next/_start-8091.sh start
bash tools/archive/_oqc-next/_start-8091.sh status|stop|restart

# 3) 阶段 B 全流程(API+DB+UI+导出+清理,约 2~3 分钟)
node tools/archive/_oqc-next/_phaseB.mjs --base http://127.0.0.1:8091

# 4) 阶段 A 基线复核(离线,不依赖服务)
node tools/archive/_oqc-next/_check-old-baseline.mjs
```

## 3. 阶段 A：改前基线（旧代码/旧模板）

`baseline/` 下按时间戳分目录，`baseline/MANIFEST.md` 有逐项说明。

| 证据 | 内容 | 断言结果 |
|---|---|---|
| `baseline/20261104T1904-old-template-HEAD/` | 用 **HEAD（改前）版 qc_oqc.jrxml** 离线重渲染的旧版式 PDF（2 页，数据取 `HSDZ_MES_TEST` 的 `OQC-2026-11-0003`，15 行；不写库） | 页脚三标记齐全；审核/批准 为静态下划线；检验员取头字段值 |
| `baseline/20261104T1857-old-8090/report-templates-baseline.json.txt` | DB 模板落库**前**的 `/api/report/templates` 快照 | 面板级 API 有 qc_oqc（classpath 注册表），模板管理全量列表无 qc_oqc（DB 无行） |
| `baseline/20261104T1911-live-8090-task3-template/` | task-3 模板迁移落库后、旧 8090 立即改走 DB 模板的**现场漂移**记录（footer 消失、签署仍下划线） | 事实记录（drift 模式不判 PASS/FAIL） |
| `baseline/20261104T1917-old-ui-8090/` | 旧 jar 打包前端（8090）纸张面板截图/JSON | 纸面有 `.oqc-footer` 且含三地址串；侧栏有 审核/弃审；签署行空白线 |

> ⚠ 说明：18:57 第一次旧 8090 直出的 PDF 抽取文本在 19:01 复跑时被同名文件覆盖
> （取证脚本事后已加「已存在即拒绝覆盖」守卫，须 `--force` 才覆盖）。
> 旧版式证据以「HEAD jrxml 离线重渲染 + git HEAD 静态串」为准（可通过 `_check-old-baseline.mjs` 复跑）。

## 4. 阶段 B：API + DB 用例（50/50 PASS）

脚本：`_phaseB.mjs`（`phaseB/phaseB-summary-20261104111553.txt` 为逐条 PASS/FAIL）。

| # | 用例 | 关键断言（实测值） |
|---|---|---|
| 1 | 前置：DB/元数据/模板/面板配置 | `qc_oqc_head` 有 审批人/审批时间 列；`yj_field` 5 行（审批人 seq210/审批时间 seq211）；检验员 `editable=false`、审核人/审批人只读；`yj_report_template` 有 qc_oqc 且 enabled=Y（LEN=31292）；`getPanelConfig` 下发审批人/审批时间且 readonly |
| 2 | 建测试草稿（走真实「保存」按钮） | 测试单 `OQC-2026-11-0010`（客户=`AUTO_验证客户_20261104111553`，产品=`AUTO_验证产品`，2 行明细）；**检验员为空**（建草稿不再写登录账号，Lead 补丁生效） |
| 3 | yj_panel 查询列出该单 | `queryFormDataList` totalSize=1 |
| 4 | 直审拦截 | 「审核」→ HTTP 409，msg=`出厂检验报告走两级审批：请用「提交审批」→ 一级「审批通过」→ 超级管理员「批准」，不支持直接审核` |
| 5 | 提交审批 | 状态=审批中(pending=Y,node=1)；`qc_oqc_head.检验员=系统管理员`；审核人/审批人为空；留痕 SUBMIT/PENDING |
| 6 | 一级审批通过 | 状态=待二级审批(pending=Y,node=2)；审核人=系统管理员；审核时间=2026-11-04T19:16:04；审批人为空；留痕 APPROVE_L1@1 |
| 7 | 二级审批通过（管理员再点一次） | 状态=已审核(pending=N,node=0)；审批人=系统管理员；审批时间=2026-11-04T19:16:15；留痕 APPROVE@2（APPROVE_L1 仍在） |
| 8 | 导出 PDF（已审核单） | HTTP200、`%PDF-`、84922 字节、text 可抽取（1253 字符）；**不含** water-agplus/惠州大亚湾/5583930；含 `检验员：系统管理员`、`审核：系统管理员`、`批准：系统管理员`、`YJ-QR-05/A1` |
| 9 | 导出 XLSX | `PK` 头、27561 字节；旧页脚三串均消失；含 检验员/审核/批准 标签与落值人 |
| 10 | 清理 | 测试单 head/detail/yj_doc_status/yj_form_approval 各 0 行；`AUTO_` 标记 0 残留；清理 SQL 见 `phaseB/cleanup-<run>.sql`（含 `DB_NAME()` 硬闸门 + 单号白名单） |

证据文件：`phaseB/export-OQC-2026-11-0010.{pdf,xlsx,txt}`。

## 5. 阶段 B：UI 用例（Playwright / chromium，8091 打包前端）

脚本：`_ui-e2e.mjs`（真实登录页登录：账号/密码/登录工厂下拉 → 桌面 → 深链
`#/panelx/list/QC_OQC_REPORT?docNo=<单号>` 打开纸张面板）。

### 5.1 草稿态（19/19 PASS）
- `.oqc-footer` **不存在**；侧栏**无「审核」**直审入口；有「提交审批」；「弃审」显示但 **disabled**。
- 检验员格只读（31 个纸面 input 中无 检验员 input）；签署行 检验员/审核/批准 三格无落值。
- 「导出报表」弹窗：模板下拉=出厂检验报告，含 导出 PDF / 打印预览 / 导出 Excel 三项。
- 导出 PDF：捕获 `/api/report/export` 响应 200、`%PDF-`、84186 字节；Excel：`PK`、27548 字节。
- 打印预览：发起 `/api/report/export`、打开新窗口（`newPage=true`）。
- 截图：`phaseB/ui/draft/ui-draft-paper.png`、`ui-draft-dialog-report.png` 等。

### 5.2 待二级审批态（22/22 PASS）
- 侧栏按钮文案 = **批准通过 / 批准驳回**；「弃审」**disabled**。
- 签署行 `signValues = ["系统管理员","系统管理员",""]`：检验员/审核已落值、**批准格仍为空**。
- 导出/预览/Excel 通路与草稿态一致（PDF 84927 字节、XLSX 27565 字节）。
- 证据：`phaseB/ui/pending2/`（含 `ui-pending2-paper.png`）。

### 5.3 已审核态（21/21 PASS）
- 侧栏无 提交审批/审批通过；无「审核」直审入口；「弃审」按设计由**统一审批组**放出（enabled，超级管理员可反审核）。
- 签署行三格均落值 = 系统管理员（`["系统管理员","系统管理员","系统管理员"]`，blankCells=0）；检验员只读。
- 导出报表弹窗、导出 PDF（84922 字节）、打印预览（新窗口）、导出 Excel（27561 字节）全通过。
- 证据：`phaseB/ui/audited/`（含 `ui-audited-paper.png`、`ui-audited-export.pdf/.xlsx`）。

## 6. 证据索引

```
tools/archive/_oqc-next/
├─ _lib.mjs / _db-probe.mjs / _api-baseline.mjs / _check-old-baseline.mjs
├─ _build-8091.sh / _start-8091.sh
├─ _phaseB.mjs / _ui-e2e.mjs
├─ baseline/                       # 改前基线(见 §3 + baseline/MANIFEST.md)
└─ phaseB/
   ├─ phaseB-summary-20261104111553.{json,txt}   # 50/50 PASS 逐条
   ├─ build-info.txt                              # HEAD/jar sha256/大小/前端入口
   ├─ 8091-app.log / frontend-build.log / mvn-package.log
   ├─ stop-8091.txt                               # 关停前后 netstat
   ├─ export-OQC-2026-11-0010.{pdf,xlsx,txt}      # 服务端报表三件套(已审核单)
   ├─ cleanup-<run>.sql                           # 本次清理 SQL(白名单+DB_NAME 闸门)
   ├─ postrun-db-probe.json / testdb-precheck.txt # 清理后 & 测试库复核
   ├─ permission-note.txt                         # 审批权现状
   └─ ui/{draft,pending2,audited}/                # 三态截图/JSON/PDF/XLSX
```

## 7. 复跑与判据

- 全部断言以 **HTTP 响应 + DB 查询 + PDF/XLSX 文本层** 为准（PDF 文本用与后端同一 openpdf 的
  `tools/_PdfText.java` 抽取；XLSX 用无依赖 ZIP 解析取 sharedStrings/inlineStr）。
- 复跑阶段 B：`bash _build-8091.sh` → `bash _start-8091.sh start` → `node _phaseB.mjs` →
  `bash _start-8091.sh stop`；脚本会自行创建/清理测试单（单号白名单，实测 0 残留）。
- 阶段 A 基线复核：`node _check-old-baseline.mjs`（PASS 8/8）。
- 8090 旧实例上的对照（`_api-baseline.mjs --expect=drift`）只作为**现场漂移记录**：
  task-3 模板迁移落库后，旧 8090 立刻改走 DB 模板（页脚消失、签署仍下划线）。

## 8. 审批权现状（记录，不算缺陷）

`yj_role_panel` 中 `QC_OQC_REPORT` 仅「测试专用角色」`can_approve=Y`（共 13 行授权），
质量审核等其它角色没有审批权；`admin` 靠管理员旁路完成全部动作（一级通过不受「提交人不能批自己」限制，
两级各点一次）。E2E 全部动作均以 admin 执行。证据：`phaseB/permission-note.txt`。

## 9. 已知说明 / 遗留风险

1. **打印预览**：前端点「打印预览」实测打开新窗口（`newPage=true`），HTTP 响应头为
   `Content-Disposition: attachment`（服务端统一下载头）。按任务判据「disposition=inline **或** 新窗口出现」
   判定 PASS；若要求严格 inline 需另改后端导出头（不在本任务范围）。
2. **弃审入口**：`审核`（直审）已从前端移除；`弃审`仍由**统一审批组**按状态显隐（草稿/待二级 disabled，
   已审核 enabled，管理员反审核用）。这是 task-2 的设计（`hasApprovalBtns += QC_OQC_REPORT`），
   与「直审（审核/弃审）」不是同一入口，README 按此口径断言。
3. **8091 启动副作用**：应用启动时 `InvCostService` 会做库存成本物化表全量重算（日志：5574 行）——
   属应用既有启动行为，不写业务单据；本次验证未做任何库存单据。
4. **旧 8090 前端是旧 static**：新前端只在 8091（本脚本打包）生效；宿主 8090 需另行 `rebuild-prod` 换 jar
   才会看到新纸面（本任务按纪律未动宿主实例）。
5. **库选择**：本次写入只在 `HSDZ_MES`（任务口径「本地正式库=可弃测试数据」），已按单号白名单清理；
   未触碰生产 `36.140.66.163`。
6. 本任务**未提交 git**（按纪律）；提交范围由 Lead 统一决定。

## 10. 文件/脚本清单

| 文件 | 作用 |
|---|---|
| `_build-8091.sh` | 前端构建 → 复制 backend/src+pom 到 `.tmp/oqc-verify/backend-build` → 同步 dist 到拷贝 static → mvn package → jar 自检 |
| `_start-8091.sh` | 8091 起/停/状态（pid+日志落 `.tmp/oqc-verify`，轮询登录端点） |
| `_phaseB.mjs` | 阶段 B 编排：前置→建单→直审拦截→两级审批（分步，中间插 UI）→PDF/XLSX→清理 |
| `_ui-e2e.mjs` | Playwright UI 用例（`--expect=old|new`、`--state=draft|pending2|audited`） |
| `_db-probe.mjs` | 只读 DB 探针（结构/状态/留痕/模板/字段/AUTO_ 残留），`--json` 可机读 |
| `_api-baseline.mjs` | 报表导出基线/回归取证（`--expect=old|new|drift`；证据文件已存在即拒绝覆盖） |
| `_check-old-baseline.mjs` | 阶段 A 改前基线复核（离线，8 条断言） |
| `_lib.mjs` | 公共库：登录/API/PDF 文本/XLSX 文本/断言汇总/证据落盘 |
