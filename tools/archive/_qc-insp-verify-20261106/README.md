# 2026-11-06 三项需求 独立验证 harness(verifier)

本目录是任务「**T1 制程检验单字段改造 + T2 出厂检验报告产品编码可填 + T3 首件/制程接入两级审批**」
的**独立验证脚本、证据与结论**。所有结论以 8091 新代码实例 + 本机测试账套 `HSDZ_MES_TEST`
（写操作）与正式库 `HSDZ_MES`（只读）实跑为准；不修改产品代码、不 git commit、不碰宿主 8090/5173/1433 的启停。

> 状态:**阶段 2 已完成(2026-11-06 12:21)** —— 8091 新代码实例构建并跑完 T1/T2/T3,
> 最终 **PASS 182 / FAIL 0**(T1 21 + T2 20 + T3 121 + 改前基线 20);测试数据已按单号白名单清场、
> 测试库审批权夹具已原值还原、8091 已停、8090 未动。**最终结论与逐条证据见 [`REPORT.md`](REPORT.md)。**
>
> 阶段 1(harness + 改前基线)完成时的原始记录保留在下面各节(历史事实,供追溯)。

## 0. 阶段 1 已完成内容

| 产物 | 说明 |
|---|---|
| `_build-8091.sh` | 从工作区源码构建新 jar → `.tmp/qc-insp-verify/backend-build/target/…jar`;前端 dist 只同步进 **`.tmp` 拷贝**的 static(不写工作区 static) |
| `_start-8091.sh` | 8091 起/停/状态(pid+日志落 `.tmp/qc-insp-verify/`;就绪探测用 permitAll 的 `GET /api/base/factory/list`,不反复打登录接口) |
| `_lib.mjs` | 登录/自签 JWT/API(callButton 3 次重试)/SQL Server 直连/PDF 文本/XLSX 文本/断言与证据落盘 |
| `_e2e-common.mjs` | 面板元数据、建单、状态/签名格/留痕查询、**测试夹具**(角色审批权授予/还原)、**单号白名单清理**(DB_NAME() 硬闸门) |
| `_e2e-t1.mjs` / `_e2e-t2.mjs` / `_e2e-t3.mjs` | 三项需求端到端断言(API+DB+UI 子进程+导出+清理),**尚未运行**(等阶段 2) |
| `_ui-verify.mjs` | Playwright 纸张断言(`t1-proc-draft` / `t2-oqc-draft` / `t3-paper` 三模式,可填值+保存、可捕获 callButton 响应) |
| `_db-snapshot.mjs` | 两账套只读快照(字段/审批权/物理数据/单据状态)→ `evidence/stage1/db-snapshot-before-*.{json,txt}` |
| `_baseline-8090.mjs` | 8090 旧 jar 改前基线(**只读**:登录测试账套 + 深链打开纸面,不点保存/审批)→ `evidence/stage1/baseline-8090-*.{json,txt,png,pdf}` |

阶段 1 实跑结果:
- `_db-snapshot.mjs --tag=before`:**OK**(见 §2 发现);
- `_baseline-8090.mjs`:**PASS 20 / FAIL 0**(权威证据 `baseline-8090-20261106-120000.*`;
  `stage1/_draft-run-115923/` 是第一次试跑的草稿,断言口径修正后已作废,勿引用);
- `_e2e-common.mjs` 冒烟:`node .tmp/smoke-common.mjs` —— 夹具授予/还原 **same=true**、
  清理闸门在正式库被拒(`cleanup refused: HSDZ_MES`)**PASS**(夹具 SQL 见 `stage1/fixture-*.sql`);
- 全部 `.mjs` 通过 `node --check`;两个 `.sh` 通过 `bash -n`。

## 1. 复跑命令(阶段 2)

```bash
cd D:/workspace/yinjia
# 1) 构建新 jar(npm build → .tmp 拷贝 → mvn -o package → jar 自检)
bash tools/archive/_qc-insp-verify-20261106/_build-8091.sh
# 2) 起 8091(自动轮询就绪)
bash tools/archive/_qc-insp-verify-20261106/_start-8091.sh start
# 3) 三项需求 E2E(每条自带建单、断言、按单号白名单清理)
node tools/archive/_qc-insp-verify-20261106/_e2e-t1.mjs --base http://127.0.0.1:8091
node tools/archive/_qc-insp-verify-20261106/_e2e-t2.mjs --base http://127.0.0.1:8091
node tools/archive/_qc-insp-verify-20261106/_e2e-t3.mjs --base http://127.0.0.1:8091
# 4) 迁移后快照(对照 before)
node tools/archive/_qc-insp-verify-20261106/_db-snapshot.mjs --tag=after
# 5) 收尾停 8091(保留 8090)
bash tools/archive/_qc-insp-verify-20261106/_start-8091.sh stop
```

## 2. 阶段 1 发现(影响阶段 2 设计,已通报 Lead)

1. **正式库已先迁移、测试库尚未迁移**(2026-11-06 11:58 快照):
   - `HSDZ_MES`:工序 hidden=1/visible=0、检验方案 editable=0、结果判断 下拉框、
     `qc_proc_insp_head`/`qc_first_insp_head` 已有 审批人/审批时间 列且回填 检验方案=出货控制计划执行(445 行);
   - `HSDZ_MES_TEST`:仍是改前口径 —— 工序可见、检验方案可编辑、结果判断=文本、两表**无** 审批人/审批时间 列。
   ⇒ 阶段 2 的「改前基线」只能对 8090 + 测试账套做(`_baseline-8090.mjs` 就是这么做的);
   新代码断言要在测试库迁移完成后再跑。
2. **测试账套无审批人可用(旧快照)**:`yj_role` 只有 id 1~7;
   `QC_PROC_INSP`/`QC_FIRST_INSP` 的 `yj_role_panel.can_approve` 全为 `N`;
   正式库才有 1031 仓库管理 / 1033 生产 / 1039 质量审核 / 1042 测试专用角色 = `Y`。
   ⇒ 阶段 2 用**测试夹具**:临时给测试库角色 4(研发审核,账号 `cp`/陈秀丽)补
   `can_approve='Y'` + `audit` 词,结束**原值还原**(`fixture-grant.sql`/`fixture-restore.sql` 落证据);
   组织架构「真实授权驱动流」用**正式库只读 GET**取证(自签 YJ 令牌 → `/api/auth/perms`、
   `/api/sys/role/{id}/panels`)。
3. **登录 factory 必须传代码**:`POST /api/auth/login` 只认 `YJ`(正式)/`YJ_TEST`(测试);
   传显示名「YINJIA-MES·测试库」会被兜底成**正式库** —— 写操作就落错账套。
   `_lib.mjs` 的 `normalizeFactory()` 已统一归一(含「测试」⇒ `YJ_TEST`),所有写脚本额外断言
   `DB_NAME()='HSDZ_MES_TEST'`。
4. **测试库账号口令未知** ⇒ `loginOrSign()`:先试 `123456` 登录,失败自动**自签 JWT**
   (`sub=username, factory=YJ_TEST`,默认密钥 `CHANGE_ME_YINJIA_RANDOM_HEX_…`,claims 同 `JwtUtil.generate`);
   自签令牌可直接打 `/api/auth/perms` 等认证接口,不必改测试库口令哈希。
5. **8090 属宿主旧 jar(旧前端+旧后端)**,其前端比当前源码更旧(例如旧版把 OQC「报告编号」渲染成输入框、
   检验员是输入框);故 `_baseline-8090.mjs` 只对**需求相关**的项目做 PASS/FAIL,陈旧差异记为 FACT。
   8090 全程只读打开,未保存/未审批/未重启。
6. **jar 自检新代码特征**:旧 `ButtonService.class` 里本来就有 `QC_PROC_INSP` 字符串(2 处),
   单靠它不能区分新旧 ⇒ `_build-8091.sh` 除任务要求的该检查外,追加两个**强特征**:
   `ButtonService.class` 含 `出货控制计划执行`(本轮 save() 固定值)、`reports/qc_proc_insp.jrxml` 含 `审批人`。

## 3. 改前基线(8090 旧 jar + 测试库未迁移口径)PASS 20/0

| 组 | 断言 |
|---|---|
| T1 | 工序可见(hidden≠true)、检验方案可编辑、纸面表头有「工序」、检验方案是 input、明细结果判断是普通输入框(非下拉) |
| T2 | 出厂检验报告纸面「产品编码」是只读纯文本(值 C-23-11) |
| T3 | 制程/首件侧栏**无**「提交审批」、**有**「审核」直审入口(旧口径=管理员直审) |
| 报表 | 制程旧 PDF 表尾「检验员：柴善银 / 审核： / 批准：」(**批准格无落值**);首件旧 PDF 表尾**无「批准」段**(只有 检验人/审核人) |

## 4. 阶段 2 断言设计(脚本已就绪,待运行)

- **T1**(`_e2e-t1.mjs`):`getPanelConfig` 工序不可见 / 检验方案 readonly / 明细结果判断 dataType=下拉框且 options=合格·不合格;
  `yj_field` 三项台账;物理列与历史 工序 数据保留;API 建单保存时载荷塞「错误值」→ DB 落「出货控制计划执行」;
  Playwright 纸面无工序、检验方案只读固定文本、结果判断 el-select 选「不合格」→ 保存 → DB 落值;单号白名单清理。
- **T2**(`_e2e-t2.mjs`):`yj_field`/配置契约(产品编码 editable=1、审批区/单据编号只读);
  API 建草稿(产品编码空)→ Playwright 断言产品编码输入框、报告编号/签署区只读文本、
  抬头其余字段/明细/结论/备注/卫生安全可填 → 填产品编码 → 保存 → DB 落值;可填清单比对;清理。
- **T3**(`_e2e-t3.mjs`):两张面板各跑:直审被拒→提交审批(空检验员兜底=提交人)→负测(无审批权被拒/
  提交人本人不能批)→一级通过(cp)→pending=Y/node=2/审核人=陈秀丽/留痕 APPROVE_L1@1→
  二级节点非管理员被拒→管理员批准→已审核/审批人=系统管理员/留痕 APPROVE@2→descriptor 真实姓名→
  纸面 + PDF/XLSX 显示「审核人(一级)/批准(审批人)」→弃审回草稿并清签名格→驳回链(无审批权账号可提交、
  一级驳回回草稿清签名格、留痕 REJECT)→存量直审单 shr 兜底显示审核人→正式库组织架构授权只读取证→
  夹具还原 + 单号白名单清理 + 0 残留复核。

## 5. 纪律与安全

- 写操作**只**进 `HSDZ_MES_TEST`:建单/审批/夹具均如此;清理与夹具 SQL 都带
  `DECLARE @db sysname=DB_NAME(); IF @db <> 'HSDZ_MES_TEST' RAISERROR(...)` 硬闸门
  (已在正式库实测被拒);`openTestDb()` 连接后再次断言库名。
- 正式库 `HSDZ_MES` **只读**:自签 YJ 令牌做 GET(`/api/auth/perms`、`/api/sys/role/*`) + 快照查询;
  不写、不发邮件/消息(通知由后端审批动作产生,只落测试库)。
- 测试数据按**显式单号白名单**物理删除(头/明细/`yj_doc_status`/`yj_form_approval`/`yj_message`),
  清后逐单 5 表计数 + `AUTO_QCVER_` 标记双复核 0 残留;清理 SQL 落 `evidence/*/cleanup-*.sql`。
- 不碰 8090/5173/1433 启停;8091 收尾停掉;不 git commit。

## 6. 证据索引(阶段 1)

```
tools/archive/_qc-insp-verify-20261106/
├─ _lib.mjs / _e2e-common.mjs / _ui-verify.mjs
├─ _build-8091.sh / _start-8091.sh
├─ _e2e-t1.mjs / _e2e-t2.mjs / _e2e-t3.mjs
├─ _db-snapshot.mjs / _baseline-8090.mjs
└─ evidence/
   └─ stage1/
      ├─ db-snapshot-before-20261106-115841.{json,txt}   # 两账套改前/迁移中快照
      ├─ baseline-8090-20261106-120000.{json,txt}        # 8090 旧 jar 改前基线(PASS 20/0)
      ├─ baseline-8090-20261106-120000-{proc,first,oqc}-paper.png
      ├─ baseline-8090-20261106-120000-qc_{proc,first}_insp.{pdf,txt}   # 旧报表表尾
      ├─ fixture-grant.sql / fixture-restore.sql         # 测试夹具 SQL 冒烟(已还原)
      └─ smoke-cleanup.sql
```

阶段 2 证据将落 `evidence/{t1,t2,t3}/`(JSON/TXT/PNG/PDF/XLSX/清理 SQL),结论写 `REPORT.md`。
