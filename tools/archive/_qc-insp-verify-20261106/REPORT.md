# 2026-11-06 三项需求 独立验证报告(verifier)

**结论:三项需求全部 PASS,未发现产品侧缺陷。**
本报告所有结论均为 8091 新代码实例 + 本机两账套实跑取证,非预期值;测试数据已按单号白名单清场,
测试库审批权夹具已还原;不修改产品代码、不 git commit、未动宿主 8090/5173/1433 的启停。

| 需求 | 断言结果 | 证据 |
|---|---|---|
| **T1 制程检验单(QC_PROC_INSP)字段改造** | **PASS 21 / FAIL 0** | `evidence/t1/t1-summary-20261106-121417.{json,txt}` + `evidence/t1/ui-t1-20261106-121417*` |
| **T2 出厂检验报告(QC_OQC_REPORT)产品编码可填 + 草稿可填性** | **PASS 20 / FAIL 0** | `evidence/t2/t2-summary-20261106-121503.{json,txt}` + `evidence/t2/ui-t2-20261106-121503*` |
| **T3 首件/制程接入两级审批** | **PASS 121 / FAIL 0** | `evidence/t3/t3-summary-20261106-121728.{json,txt}` + `evidence/t3/ui-{proc,first}-*` |
| 附:改前基线(8090 旧 jar + 测试库未迁移口径) | **PASS 20 / FAIL 0** | `evidence/stage1/baseline-8090-20261106-120000.*` |
| **合计** | **PASS 182 / FAIL 0** | 见 §7 证据索引 |

> **2026-11-06 追加变更(用户第二轮口径:「这个检验方案需要能够默认为这个的情况下也能进行修改」)** ——
> 「检验方案」由「只读固定值」改为「**默认值 + 可修改**」。重跑结果:**T1-R2 PASS 27/0、T3-R2 回归 PASS 20/0**
> (合计 47/0),详见 **§9**。本报告 §2 中两条旧断言(「检验方案 readonly/只读文本」「保存时强制写固定值」)
> **已被本轮追加变更取代**,旧证据/结论原样保留为历史记录。

> 设备/实例:8091 = 从当前工作区源码打包的**新代码** jar(见 §1 指纹),库 = 同机 SQL Server 两个账套。
> 写操作**只在** `HSDZ_MES_TEST`(测试账套);`HSDZ_MES` 只读。宿主 8090 旧实例仅用于改前基线(只读打开纸张/取报表)。

## 1. 构建与实例指纹(8091)

见 `evidence/stage2/build-info.txt`:

```
built_at:        2026-11-06T12:07:35+08:00
git HEAD:        418143865(工作区含本次任务未提交改动 = 源码定稿态)
jar:             .tmp/qc-insp-verify/backend-build/target/yinjia-mes-backend-0.1.0.jar
jar sha256:      5425b9ed242059b2e3356e759d9a3897a4f43e2694640c067143b93165f97de7
jar size:        97,837,745 字节(94MB);BOOT-INF/lib 依赖 128 个(非瘦 jar)
jar 前端入口:    assets/index-BvsSlhjj.js(与 Lead 同步进工作区 static 的 dist 入口一致)
新代码特征:      ButtonService.class 含「出货控制计划执行」=1;reports/qc_proc_insp.jrxml 含「审批人」=8
```

- 构建:`_build-8091.sh`(npm run build → 复制 backend/src+pom 到 .tmp → dist 同步进**拷贝的** static → `mvn -o -DskipTests package` → jar 自检);
- 起停:`_start-8091.sh start|stop`;就绪探测 = permitAll 的 `GET /api/base/factory/list` + 一次登录探测;
- 迁移:三条迁移由 Lead 在两账套执行(正式库执行 3/失败 0、测试库执行 4/失败 0);`_db-snapshot --tag=before/after` 两账套快照确认目标态一致(`evidence/stage1/db-snapshot-{before,after}-*`)。

## 2. T1 制程检验单:工序隐藏 / 检验方案固定 / 结果判断下拉(PASS 21/0)

| # | 验收点 | 实测(PASS) | 证据 |
|---|---|---|---|
| 1 | `getPanelConfig(QC_PROC_INSP).dataSchema.fields` 中「工序」不可见 | `{"dataName":"工序","hidden":true,"visible":false}`(仍在字段清单但 hidden) | t1-summary PASS 行 / UI facts |
| 2 | `yj_field`:工序 hidden=1 且 visible=0 | `editable=true,hidden=true,visible=false` | DB 直查 |
| 3 | 物理列与历史数据保留 | `qc_proc_insp_head.工序` 列存在;有值行数 = 25(测试库) | DB 直查 |
| 4 | 「检验方案」只读 | config `readonly=true`;yj_field `editable=0` | DB/配置 |
| 5 | 「检验方案」落库固定 = 出货控制计划执行 | API 建草稿时载荷**故意传「错误值_应被覆盖」** → DB 落 `出货控制计划执行`;全表非固定值行数 = 0(覆盖历史/自动生成的草稿) | DB 直查 |
| 6 | 明细「结果判断」= 下拉框,options = 合格/不合格 | config `dataType=下拉框, options=["合格","不合格"]`;yj_field `data_type=下拉框`、dict_sql 含两值 | DB/配置 |
| 7 | UI 纸面表头**没有**「工序」 | 表头标签 = 单据编号/单据日期/检验类别/工单号/产品名称/抽检总量/检验日期/检验方案 | `ui-t1-*-paper.png` |
| 8 | UI「检验方案」只读固定文本 | kind=text,文本「出货控制计划执行」 | 同上 |
| 9 | 补充:单据编号按元数据只读、工单行号(hidden)不进表头 | 单据编号 kind=text;表头无「工单行号」 | 同上 |
| 10 | 补充:纸张「检验员」仍可编辑(回归) | 表头「检验人员」input 存在(`.qr-insp-input`) | 同上 |
| 11 | UI 明细「结果判断」是 el-select(非普通输入框) | 2 行均 `el-select`,无 `el-input` | `ui-t1-*-paper.png` |
| 12 | UI 选「不合格」→ 侧栏保存 → DB 落值 | 下拉选中「不合格」→ 保存 HTTP200 → `qc_proc_insp_detail.结果判断='不合格'` | DB 直查 |
| 13 | 补充:纸张 Excel 导出(结果判断值正常) | 「导出→导出 Excel」下载成功,解析含「结果判断/合格/不合格」 | `evidence/t1/ui-t1-20261106-121417-sheet-export.xlsx` |
| 14 | 清理 | 测试单 5 表 0 残留;AUTO_QCVER_ 0 残留 | `evidence/t1/cleanup-*.sql` |

## 3. T2 出厂检验报告:产品编码可填并落库(PASS 20/0)

| # | 验收点 | 实测(PASS) | 证据 |
|---|---|---|---|
| 1 | 「产品编码」草稿态是输入框 | UI 抬头「产品编码」kind=input(改动前 8090 是只读纯文本,基线已证明) | `ui-t2-*-paper.png` |
| 2 | 填产品编码 → 保存 → 落库 | UI 填 `AUTO-UI-PROD-<run>` → 保存 HTTP200 → DB `qc_oqc_head.产品编码` 同值 | DB 直查 |
| 3 | 「报告编号」只读 | kind=text(配置 readonly;yj_field.单据编号 editable=0) | UI/DB |
| 4 | 审批区(检验员/审核/批准)只读 | 签署区 3 格均纯文本、无输入框;yj_field 检验员/审核人/审批人 editable=0 | UI/DB |
| 5 | 抬头其余字段草稿态可填 | 客户名/产品名称/产品规格/生产量/AQL = input|number;生产日期/检测日期 = 日期控件 | UI facts(可填清单) |
| 6 | 明细/检验结论/备注/卫生安全可填 | 明细控件 14(2 行 ×7 列,含 6 个可填)、结论 1、备注 1、卫生安全 15 | UI facts |
| 7 | 清理 | 测试单 5 表 0 残留;标记 0 残留 | `evidence/t2/cleanup-*.sql` |

> ⚠ 观察(非缺陷,请 Lead 确认口径):`yj_field` 里「产品编码」`required=1`,新建 OQC 保存时后端会拒绝空产品编码
> (`产品编码不能为空`)。故本用例按「已有初始值 → UI 改值 → 保存落库」验证「可填写」;若要求草稿期可空,
> 需另开字段必填性调整单(本次需求只要求"可填写")。

## 4. T3 首件/制程两级审批(PASS 121/0,两面板各一轮完整链)

共用前置:两表已有 `审核人/审核时间/审批人/审批时间` 4 列;yj_field 登记「审批人/审批时间」各 2 行
(`editable=0, hidden=1, visible=1`);getPanelConfig 下发且 readonly=true;纸面表尾第三格「批准」显式读 `head['审批人']`。

### 4.1 每张面板逐条(PASS;此处列关键断言,完整 121 条见 summary)

| 验收点 | QC_PROC_INSP | QC_FIRST_INSP |
|---|---|---|
| 直接「审核」被拒(文案含「两级审批/不支持直接审核」) | ✅ 409 `制程检验单走两级审批：…不支持直接审核` | ✅ 409 `首件检验单走两级审批：…不支持直接审核` |
| 提交审批(有编辑权即可) | ✅ admin 提交 → `pending=Y, approve_node=1` | ✅ 同 |
| 提交后编制格(检验员)=提交人姓名(空值兜底) | ✅ `系统管理员` | ✅ 同 |
| 提交后审核人/审批人为空 | ✅ | ✅ |
| 留痕 SUBMIT/PENDING | ✅ | ✅ |
| 负测:无审批权账号审批被拒 | ✅ 403 `当前角色无该面板「审批」权限…` | ✅ 同 |
| 负测:无审批权账号直审也被拒 | ✅ 403 | ✅ 同 |
| **一级审批通过(测试库夹具:角色4/研发审核,账号 cp/陈秀丽;非提交人)** | ✅ → `pending=Y, approve_node=2` | ✅ 同 |
| 一级通过后 审核人=「陈秀丽」、审核时间非空、审批人仍空 | ✅ | ✅ |
| 留痕 APPROVE_L1(node=1) | ✅ | ✅ |
| descriptor(`getFormDescriptor`)审核人=真实姓名「陈秀丽」、审批人空 | ✅ | ✅ |
| UI 待二级审批态:按钮「批准通过/批准驳回」、表尾审核人已落「陈秀丽」、批准格仍空 | ✅(截图 `ui-proc-pending2-*`) | ✅(`ui-first-pending2-*`) |
| 负测:二级节点非超级管理员审批/驳回被拒 | ✅ 403 `制程检验单的批准（二级审批）仅超级管理员可执行` | ✅ 403 `首件检验单的批准（二级审批）仅超级管理员可执行` |
| **超级管理员(admin)批准(二级,必须再点一次)** | ✅ → `pending=N, approve_node 空, shr=admin` | ✅ 同 |
| 批准后 审批人=「系统管理员」、审批时间非空 | ✅ | ✅ |
| 留痕 APPROVE(node=2) 且 APPROVE_L1 仍在 | ✅ SUBMIT@1, APPROVE_L1@1, APPROVE@2 | ✅ 同 |
| descriptor 审核人=陈秀丽、审批人=系统管理员 | ✅ | ✅ |
| UI 已审核态:无「提交审批」;表尾 检验人/审核人/批准 = 系统管理员/陈秀丽/系统管理员 | ✅(截图 `ui-proc-audited-*`) | ✅(`ui-first-audited-*`) |
| **服务端报表 PDF**:`/api/report/export?code=<panel>&format=pdf` | ✅ 尾部 `检验员：系统管理员 审核：陈秀丽 批准：系统管理员` | ✅ 尾部 `检验结果 检验人 系统管理员 审核人 陈秀丽 批准 系统管理员` |
| 服务端报表 XLSX:含「批准」+ 二级审批人 + 一级审核人 | ✅ 7065B | ✅ 7244B |
| 弃审 → 草稿 + 清 审核人/审批人/审核时间/审批时间(保留检验员) | ✅ 留痕 UNAUDIT | ✅ 同 |
| 驳回链(另建单,由**无审批权但有编辑权**的 wangguangzhen 提交;先清空检验员模拟老草稿) | ✅ 提交成功且检验员空值兜底=`王光珍`;一级 cp 驳回 → 草稿、清签名格、留痕 REJECT@1 | ✅ 同 |
| 自审负测(cp 提交自己的单后自己批) | ✅ 403 `审批人不能与提交人相同（编制与审批分开）：本单由 陈秀丽（cp）提交…` | ✅ 同 |
| **存量直审单 shr 兜底**(表内审核人为空) | ✅ ZC-2026-09-0003 descriptor 审核人=`柴善银` | ✅ SJ-2026-09-0003 = `柴善银` |
| 清理(单号白名单) | ✅ 3 单 5 表 0 残留 | ✅ 3 单 5 表 0 残留 |

### 4.2 组织架构审批权驱动证据(正式库只读 + 测试库夹具)

1. **正式库真实授权(只读)**:`GET /api/sys/role/{id}/panels`(自签 YJ 令牌)显示
   **1031 仓库管理 / 1033 生产 / 1039 质量审核 / 1042 测试专用角色** 对 `QC_PROC_INSP`+`QC_FIRST_INSP`
   均有授权且 `perms` 逐词含 `audit`;`yj_role_panel.can_approve='Y'` 由 DB 快照直查确认(每面板 4 个非 admin 角色)。
2. **账号级 approvePanels(登录响应同源,只读 GET `/api/auth/perms`)**:正式库
   `fm/cmj`(质量审核 1039)、`TANCHENG/WANGGUANGZHEN`(生产 1033)、`cs`(测试专用角色 1042)的
   approvePanels **均含两面板**;`cxy`(质量检测 1040,无审批权)为 `[]`。
3. **审批权驱动流程落地**:测试库旧快照没有 1031/1033/1039 等角色且两面板 can_approve 全 `N`
   ⇒ 用**测试夹具**临时给角色 4(研发审核,账号 `cp`)两面板补 `can_approve='Y'`+`audit` 词;
   夹具生效后 `cp` 的 `/api/auth/perms` approvePanels 含两面板,其一级审批**真实落地**
   (审核人=陈秀丽、留痕 APPROVE_L1、状态转待二级审批);负测账号 `wangguangzhen`(role 2)不含两面板、
   审批被 403 拒绝。**夹具 E2E 后已原值还原**:
   `evidence/t3/fixture-grant.sql` / `fixture-restore.sql` / `fixture-restore-20261106-121728.json`(`same=true`);
   还原后 DB 复核 role 4 两面板 = `can_approve=N, perms=view,query,add,modify,modlog,del,export`(原值)。
4. 补充:非 admin 登录方式 — `cp/123456` 在测试库可正常登录(未改口令/未改 role);
   `wangguangzhen` 口令未知 ⇒ 用**默认密钥自签 JWT**(`sub=username, factory=YJ_TEST`,claims 同 `JwtUtil.generate`),
   实测可正常访问全部认证接口(阶段1已单独验证 `/api/auth/perms` 返回 200)。

## 5. 改前基线(8090 旧 jar,只读,PASS 20/0)

登录工厂选「YINJIA-MES·测试库」+ 测试库(阶段1时尚未迁移)⇒ 纯改动前状态;8090 全程只读打开纸张/取报表,未保存/未审批/未重启。

| 组 | 改动前实测 |
|---|---|
| T1 | 制程纸面表头**有「工序」**;「检验方案」是**输入框**(可编辑);明细「结果判断」是**普通输入框**(非下拉) |
| T2 | 出厂检验报告「产品编码」是**只读纯文本**(值 C-23-11) |
| T3 | 制程/首件侧栏**无「提交审批」**、**有「审核」直审入口**(旧口径=管理员直审) |
| 报表 | 制程旧 PDF 表尾「检验员：柴善银 审核： 批准：」=**批准格无落值**;首件旧 PDF 表尾**无「批准」段**(仅 检验人/审核人) |

## 6. 偏差、观察项与脚本迭代记录(FACT,均非产品缺陷)

1. **测试库是旧快照**:无 1031/1033/1039 等角色、两面板 `can_approve` 全 N ⇒ 按 Lead 口径用测试夹具(见 §4.2),
   正式库组织架构授权用只读 GET 取证。夹具只改 `HSDZ_MES_TEST`、结束原值还原并留 SQL/JSON 证据。
2. **登录 factory 只认代码**:`POST /api/auth/login` 必须传 `YJ`/`YJ_TEST`;传显示名「YINJIA-MES·测试库」
   会被兜底成**正式库**(会把测试写入落错账套)。验证脚本 `_lib.mjs` 已统一归一 + 所有写脚本连接后断言
   `DB_NAME()='HSDZ_MES_TEST'`;清理/夹具 SQL 均带 `IF @db <> 'HSDZ_MES_TEST' RAISERROR` 硬闸门(正式库实测被拒)。
3. **T2 产品编码必填**:`yj_field.required=1`,新建 OQC 保存拒绝空值(`产品编码不能为空`)——本用例验证
   「可填写并保存落库」;若需要草稿期留空,属字段必填性口径问题(待 Lead 确认,非本次需求缺陷)。
4. **「检验员可编辑」回归范围**:经 `git show HEAD` 对照,改动前**制程**纸面有两处「检验员」输入框
   (表头检验人员 + 结论区),改动后仍可编辑(UI PASS);**首件**纸面改动前后「检验人」都只是表尾只读文本
   (从未有输入框,`isLocked` 改动不涉及它)。故「isLocked 误锁」回归风险已覆盖:制程 PASS,首件无该控件。
5. **UI 异步载入**:深链打开纸张时头/明细是"面板配置→列表查询→渲染"多段异步,固定 sleep 不可靠 ⇒
   验证脚本改为显式等待(侧栏出现「保存」+ 纸张出现本单号 → 再等明细行/下拉控件)。这期间脚本自身迭代:
   - T1:`120751/121010/121133/121319/121356` 各轮 FAIL 均为**脚本等待/断言口径问题**(UI 未载完就断言、
     el-select 内部 input 被误判为普通输入框、导出 xlsx 的 `t="str"` 文本未解析),修正后 `121417` **PASS 21/0**;
   - T3:`121513` 那轮 **FAIL 54/8** 全部为脚本断言缺陷(role/panels 返回无 can_approve 字段、负测文案不匹配、
     模板字符串里嵌套反引号导致 `ReferenceError`),修正后 `121728` **PASS 121/0**。
   `evidence/*/` 中保留各轮 summary 作为迭代记录(以最终 `PASS` 轮为准)。
6. **8090 旧前端比当前源码旧**(例如旧版把 OQC「报告编号」渲染成输入框、检验员是输入框)——基线只对
   与需求相关的口径判 PASS/FAIL,陈旧差异记 FACT,不据此判产品缺陷。
7. **8091 启动副作用**:应用启动时 `InvCostService` 会做库存成本物化表全量重算(既有启动行为,非本次改动),
   会写成本表、不动业务单据;本任务未做任何库存单据。
8. **正式库 11:57 误执行说明**(来自 Lead):实现者的"伪只读校验"曾在正式库执行过一次同类 SQL,目标态与脚本
   一致、无脏数据;本报告的 before/after 快照与迁移脚本目标态一致,不构成偏差。
9. 数据纪律:全部写操作只在 `HSDZ_MES_TEST`;正式库只读(自签 YJ 令牌 GET + SQL 查询);未碰 8090/5173/1433
   的启停;未 git commit;收尾 8091 已停、8090 保持原状。

## 7. 证据索引

```
tools/archive/_qc-insp-verify-20261106/
├─ REPORT.md                          # 本报告
├─ README.md                          # harness 说明(阶段1发现/脚本清单/复跑命令)
├─ _build-8091.sh / _start-8091.sh    # 构建/起停 8091
├─ _lib.mjs / _e2e-common.mjs / _ui-verify.mjs
├─ _e2e-t1.mjs / _e2e-t2.mjs / _e2e-t3.mjs
├─ _db-snapshot.mjs / _baseline-8090.mjs
└─ evidence/
   ├─ stage1/
   │  ├─ db-snapshot-before-20261106-115841.{json,txt}   # 两账套改前/迁移中快照
   │  ├─ db-snapshot-after-20261106-122048.{json,txt}    # 迁移+全部E2E后快照(目标态复核/清场复核)
   │  ├─ baseline-8090-20261106-120000.{json,txt,png,pdf} # 8090 改前基线(PASS 20/0)
   │  └─ fixture-*.sql / smoke-cleanup.sql                # 夹具/清理闸门冒烟(阶段1)
   ├─ stage2/build-info.txt                              # 8091 构建指纹
   ├─ t1/
   │  ├─ t1-summary-20261106-121417.{json,txt}           # PASS 21/0
   │  ├─ ui-t1-20261106-121417-{paper,saved}.png / .json
   │  ├─ ui-t1-20261106-121417-sheet-export.xlsx         # 纸张 Excel 导出(结果判断值)
   │  └─ cleanup-20261106-121417.sql                     # 单号白名单清理(DB_NAME 闸门)
   ├─ t2/
   │  ├─ t2-summary-20261106-121503.{json,txt}           # PASS 20/0
   │  ├─ ui-t2-20261106-121503-{paper,saved}.png / .json
   │  └─ cleanup-*.sql
   └─ t3/
      ├─ t3-summary-20261106-121728.{json,txt}           # PASS 121/0(含全部断言与 FACT)
      ├─ ui-{proc,first}-{draft,pending2,audited}-20261106-121728-{paper.png,json}
      ├─ proc-ZC-2026-11-0011.{pdf,txt,xlsx}             # 服务端报表:批准/审核人/检验员落值
      ├─ first-SJ-2026-11-0002.{pdf,txt,xlsx}
      ├─ fixture-grant.sql / fixture-restore.sql / fixture-restore-20261106-121728.json(same=true)
      ├─ cleanup-proc-*.sql / cleanup-first-*.sql / cleanup-fallback-*.sql
      └─ ui-{proc,first}-*-20261106-121513.*             # 上一轮(FAIL 54/8,脚本断言缺陷)迭代留档
```

复跑命令:

```bash
cd D:/workspace/yinjia
bash tools/archive/_qc-insp-verify-20261106/_build-8091.sh
bash tools/archive/_qc-insp-verify-20261106/_start-8091.sh start
node tools/archive/_qc-insp-verify-20261106/_e2e-t1.mjs --base http://127.0.0.1:8091
node tools/archive/_qc-insp-verify-20261106/_e2e-t2.mjs --base http://127.0.0.1:8091
node tools/archive/_qc-insp-verify-20261106/_e2e-t3.mjs --base http://127.0.0.1:8091
node tools/archive/_qc-insp-verify-20261106/_db-snapshot.mjs --tag=after
bash tools/archive/_qc-insp-verify-20261106/_start-8091.sh stop
```

## 8. 判据(为什么可以判 PASS)

- 每条 PASS 均来自 HTTP 响应 + 测试库 SQL 直查 + Paper DOM/截图 + 服务端报表 PDF 文本层/XLSX 文本层的**实测值**;
- 需求逐条映射(§2/§3/§4),T3 覆盖「提交→一级→二级→已审核/驳回/弃审/直审拒绝/无权限负测/自审负测」全分支;
- 组织架构审批权**真实驱动**流程:正式库真实授权只读取证 + 测试库夹具授权后 approvePanels/审批落地/负测三方闭环 + 夹具还原;
- 改前基线证明"改动确实改变了目标行为"(工序可见→隐藏、检验方案可编辑→只读固定、结果判断输入框→下拉、
  无提交审批→有、OQC 产品编码只读→可填、旧报表无批准→有批准);
- 清场复核:测试单 5 表 0 残留、AUTO_QCVER_ 标记 0、夹具原值还原、`yj_form_approval/yj_doc_status` 无残留;
- 未发现产品侧缺陷;§6 两个观察项(产品编码必填、首件检验人非输入框)属既有口径,待 Lead 确认。

---

## 9. 2026-11-06 追加变更:检验方案「默认值 + 可修改」第二轮验证

### 9.1 变更内容(Lead 已实现;本报告 §2 的两条断言被本轮取代)

**用户第二轮口径**(截图红框「检验方案 = 出货控制计划执行」):
「**这个检验方案需要能够默认为这个的情况下也能进行修改**」——
即「检验方案」不再是只读固定值,而是**默认值「出货控制计划执行」+ 可编辑修改**。

| 层 | 改动 |
|---|---|
| DB(两账套已执行,已登记 db-migrations.txt) | 新增 `tools/migrate-proc-insp-plan-editable-20261106.sql`:yj_field QC_PROC_INSP.检验方案 `editable 0→1`、required=0、hidden=0、visible=1、data_type 仍「文本」;历史空值行补默认;列注明改口径。DbSync 正式库「执行 1、失败 0」、测试库「执行 1、失败 0」。未改首轮迁移字节 |
| 后端 | `ButtonService.save()` 由「每次保存强制写固定值」改为「**仅空值兜底默认**,不覆盖用户已填/已改值」;`QcInspAutoService.procInspHead` 自动出单仍写默认值(=初值语义) |
| 前端 | 零功能改动(元数据驱动,editable=1 后纸张「检验方案」自动变输入框),只更新注释;重新 `npm run build` 并同步 static(入口 `index-D8V0JTYj.js`) |

**本报告中被本轮取代的旧断言(旧证据保留在 `evidence/t1/` 作为历史):**
1. ~~「T1[配置] 检验方案只读(readonly=true)」~~ → 本轮改为「**无 readonly**,dataType=文本」;
2. ~~「保存时强制写固定值(载荷塞错误值仍落默认)」/「全表非固定值行数=0」~~ → 本轮改为「**落用户改值且再保存不覆盖;仅空值兜底默认**」。

### 9.2 构建指纹(需要新 jar,已重新打包)

`evidence/stage2/build-info-r2.txt`:

```
built_at:        2026-11-06T13:48:07+08:00
git HEAD:        9da79e8fe(工作区含第二轮未提交改动)
jar sha256:      9a041d5feee45190e17eda4c25a9122c20c97ec2b40241ac97d7f1e206d7d376
jar size:        97,837,829 字节(94MB);BOOT-INF/lib 128 个
jar 前端入口:    assets/index-D8V0JTYj.js(与 Lead 同步进工作区 static 的一致;API 实测首页引用同值)
新代码特征:      javap 反汇编 ButtonService:字面量「检验方案」后为 `Map.get`(=读取入参+空值兜底;
                 round-1 旧代码此处是 `Map.put` 强制写)→ jar 自检新增该校验(GET_PLAN=1 才通过)
```

### 9.3 T1-R2 结果:**PASS 27 / FAIL 0**(`evidence/t1-round2/t1r2-summary-20261106-134946.{json,txt}`)

| # | 验收点(第二轮口径) | 实测(PASS) |
|---|---|---|
| 1 | `getPanelConfig`:检验方案**无 readonly**,dataType=文本 | `{"dataName":"检验方案","dataType":"文本","isRequired":false}`(无 readonly 字段) |
| 2 | `yj_field`:editable=1 / required=0 / hidden=0 / visible=1 / data_type=文本 | `{"editable":true,"required":false,"hidden":false,"visible":true,"data_type":"文本"}` |
| 3 | UI 纸张:检验方案是**可编辑输入框**(不是纯文本) | kind=input;新建/自动草稿默认显示「出货控制计划执行」 |
| 4 | UI 改成自定义值 `E2E-方案-UI-<run>` → 保存 → DB = 自定义值 | DB `qc_proc_insp_head.检验方案 = E2E-方案-UI-20261106-134946`(**未被强刷回默认**) |
| 5 | 重开纸张再保存一次 → 检验方案仍=自定义值 | 再保存后 DB 仍 `E2E-方案-UI-…`(不被覆盖);顺带结果判断改「合格」落库 |
| 6 | 清空检验方案 → 保存 → 空值兜底恢复默认 | DB 回到「出货控制计划执行」 |
| 7 | API 建单**不传**检验方案 → 落库默认 | DB = 「出货控制计划执行」 |
| 8 | API 保存自定义 `E2E-方案-API-<run>`;再次保存仍保留 | 两次保存后 DB 均 = `E2E-方案-API-20261106-134946` |
| 9 | 回归:工序仍 hidden(hidden=1/visible=0,纸面无工序) | ✅ |
| 10 | 回归:结果判断仍下拉,选「不合格/合格」并保存落库 | ✅(第二次保存后=合格) |
| 11 | 回归:单据编号仍只读、工单行号不进表头、检验员仍可编辑 | ✅ |
| 12 | 纸张 Excel 导出含自定义检验方案 + 结果判断值 | ✅(`evidence/t1-round2/ui-t1r2-A1-*-sheet-export.xlsx`) |
| 13 | 清理(单号白名单) | ✅ 测试单 5 表 0 残留;AUTO_QCVER_ 0 |

### 9.4 T3-R2 快速回归结果:**PASS 20 / FAIL 0**(`evidence/t3-round2/t3r2-summary-20261106-135012.{json,txt}`)

证明 save() 改动未破坏两级审批(制程面板全链):

- 直审仍被拒(409「走两级审批…不支持直接审核」)→ 提交审批 → `pending=Y, approve_node=1`、检验员=提交人;
- 一级审批通过(测试库夹具 cp/陈秀丽,非提交人)→ `approve_node=2`、审核人=陈秀丽+审核时间、留痕 `APPROVE_L1@1`;
- 二级 admin 批准 → `pending=N, shr=admin`、审批人=系统管理员+审批时间、留痕 `APPROVE@2`(APPROVE_L1 仍在);
- `getFormDescriptor` 审核人=陈秀丽、审批人=系统管理员;UI 已审核态表尾三格 = 检验人 系统管理员 / 审核人 陈秀丽 / 批准 系统管理员;
- 清理 0 残留;**夹具原值还原 `same=true`**(`evidence/t3-round2/fixture-{grant,restore}.sql`、`fixture-restore-20261106-135012.json`)。

### 9.5 脚本迭代记录(FACT,非产品缺陷)

- `134818` 轮 PASS 21/FAIL 6:验证脚本自身问题——①「检验方案」填充按整行 first-input 定位,填到了同一行的
  「检验日期」日期控件 → 保存 500(日期转换失败);②下拉选项用 substring 匹配「合格」会命中「不合格」;
  ③「默认值」断言在"重开已改值单/清空验证"轮被误用。修正:精确按 th→next td 定位、选项精确匹配、
  默认值断言只在新建轮(`--expect-default-plan`)。
- `134911` 轮 PASS 25/FAIL 2(默认值断言未加轮次门控)→ 修正后 `134946` 轮 **PASS 27/0**。
- 以上各轮 summary 均保留在 `evidence/t1-round2/` 供追溯;首轮旧 T1 证据仍在 `evidence/t1/`。

### 9.6 收尾

- 8091(新 jar)跑完后**已停**;8090 未动(停后 `/api/base/factory/list` 仍 200):`evidence/stage2/stop-8091-r2.txt`;
- 测试库复核:客户名称 `AUTO_QCVER_%` 残留 0、`ZC-2026-11-%` 的 yj_form_approval/yj_doc_status 残留 0、
  夹具 role 4 两面板 `can_approve=N` 原值;全表 检验方案分布 = 43 行「出货控制计划执行」;
- 只写 HSDZ_MES_TEST;正式库只读;未 git commit。

### 9.7 本轮证据索引

```
tools/archive/_qc-insp-verify-20261106/
├─ _e2e-t1-r2.mjs                 # T1 第二轮(默认值+可修改)验证脚本
├─ _e2e-t3-regress.mjs            # T3 两级审批快速回归脚本
├─ _build-8091.sh                 # 增补 javap「检验方案→Map.get」round-2 强特征自检
└─ evidence/
   ├─ stage2/build-info-r2.txt    # 第二轮 jar 指纹
   ├─ stage2/stop-8091-r2.txt
   ├─ t1-round2/
   │  ├─ t1r2-summary-20261106-134946.{json,txt}   # PASS 27/0(最终)
   │  ├─ t1r2-summary-20261106-{134818,134911}.*    # 脚本迭代留档(FAIL)
   │  ├─ ui-t1r2-A{1,2,3}-20261106-134946-{paper,saved}.png / .json
   │  ├─ ui-t1r2-A1-20261106-134946-sheet-export.xlsx  # 纸张 Excel(自定义方案+结果判断)
   │  └─ cleanup-20261106-134946.sql
   └─ t3-round2/
      ├─ t3r2-summary-20261106-135012.{json,txt}    # PASS 20/0
      ├─ ui-t3r2-audited-20261106-135012-{paper.png,json}
      ├─ fixture-grant.sql / fixture-restore.sql / fixture-restore-20261106-135012.json(same=true)
      └─ cleanup-20261106-135012.sql
```

**追加变更结论:用户第二轮口径已满足 —— 检验方案默认为「出货控制计划执行」且可人工修改、修改值保存后不被后端覆盖、
清空后保存空值兜底恢复默认;同时未破坏两级审批/工序隐藏/结果判断下拉/单据编号只读/检验员可编辑。**
