# _rd-liaison-approve-20261028 —— 立项对接人随审批分发 + 研发管理员取消「保存即归档」

> 用户口径（2026-10-28 截图《立项申请》+《定级分发》弹窗）：
>
> 1. 「立项申请的右上角的文件编号名字改为**项目编号**」
> 2. 「立项申请可以由管理员在**审批定级的时候确定一个对接人进行分发**，后续也默认是这个对接人，
>    除非进行修改，否则默认选择这个对接人」
> 3. 「把所有研发的**管理员的保存就归档去掉，一样走审批流程**，但是管理员可以**自己提交自己审批**」
>
> **第二轮（同日，第一轮推送后追加）**：
>
> 4. 「在审批人点击审批通过的时候弹窗能定级能选对接人，**把定级分发这个按钮去掉**，
>    就是把定级分发的功能合并到审批通过里面」

## 改动总表

### 第一轮（commit `1ec909e4` + `5466cacb`）

| # | 落点 | 改动 |
|---|---|---|
| ① | `frontend/.../docSheetConfigs.js` → `docnoLabel()` | 新增判定表 `{RD_APPROVAL:'项目编号'}`；未登记面板回空串（仍「文档编号：」） |
| ① | `frontend/.../DocSheet.vue` | 右上编号格标识改由 `docnoLabelText` 派生，删掉写死的 `tt('文档编号：')` |
| ② | `ButtonService.approveApproval`（RD_APPROVAL 分支） | 定级后读 `formData['对接人']`，走 `assignLiaison` 一并分发 |
| ② | `ButtonService.assignLiaison`（新增） | 三条路共用：落 `rd_approval.备用1` + LIAISON 留痕 + `LIAISON_ASSIGNED` 通知 |
| ② | `ButtonService.gradeAndDispatch` | 删掉「对接人不能重复分发」硬拒；改人由 `assignLiaison` 留痕写「改派：A→B」 |
| ② | `PanelxList.vue` 审批弹窗 | 加「对接人」下拉，打开时**默认带出已有对接人**；空选不发键（兼容旧前端/老单） |
| ③ | `ButtonService.saveDoc` | 管理员「保存即归档」分支**整段删除**，管理员与普通用户同走送审；`WLBOM`（无审批基础数据）仍保存即归档 |
| ③ | `ButtonService.ADMIN_SAVE_DEFERS_TO_FLOW` | 一并删除（原白名单只剩 RD_PROD_INFO，已无意义；只留注释记历史） |

### 第二轮（本轮）

| # | 落点 | 改动 |
|---|---|---|
| ④ | `PanelxList.vue` 侧栏 | **删除**「定级分发」按钮（`v-if` / `:class` / `:title` / `@click` 整块） |
| ④ | `PanelxList.vue` | **删除**「定级分发」弹窗、`gradeDispatchVisible/Busy`、`openGradeDispatch/confirmGradeDispatch`、`gradeDispatchTip`、`gradeLevelLocked` |
| ④ | `PanelxList.vue` 新增 | 极窄补救入口「补发对接人」：只对「已审批但无对接人」的单显示，等级**只读沿用** |
| ④ | `ButtonService.rdApprovalFlowState` | 新增 `canRepairLiaison = settled && liaison.isEmpty() && canApprove(user,"RD_APPROVAL")` |
| ④ | `ButtonService.rdApprovalFlowState` | `canGradeDispatch` 保留但**不再驱动任何按钮**（只为兼容仍在缓存的旧前端包） |

**为什么还留一个「补发对接人」**：审批弹窗里对接人是**选填**（clearable），历史单审批时
压根没有这个字段 —— 正式账套实测 **2 张已审批无对接人**（`LXA-2026-10-0013` / `LXA-2026-10-0018`，
两张都没有下游实施计划）。按钮一删干净，它们就永久卡在「已审批、未分发」且再无入口写 `备用1`。
补救入口判据极窄（已定形 ∧ 无对接人 ∧ 有审批权）⇒ **正常单据永远看不到它**。

**只改显示名，数据键不动**（ADR-0001 红线）：落库列仍是 `rd_approval.文档编号`，
`yj_field.col_name` 仍是「文档编号」，下游实施计划按「文档编号」参照的链路一字未改
⇒ 老单据零迁移、下游零影响。

## 验证证据（两个账套都跑过）

```
frontend:  node --test    → 927 tests / 927 pass / 0 fail
backend :  mvn -o -DskipTests compile → EXIT=0
四单回归:  FourDocAudit HSDZ_MES → [PASS]
```

### 第一轮 `_q-verify.mjs` / `_q-verify-test.mjs`

| 检查 | 正式账套 | 测试账套 |
|---|---|---|
| 管理员「保存」后状态 = **审批中**（不再是 已归档） | PASS | PASS |
| 管理员自己「审批通过」放行 → 已归档 | PASS | PASS |
| 审批时带对接人 → `level=三级` + `liaison=chaishanyin` 一步落地 | PASS | PASS |
| 已分发后 `canGradeDispatch=true`，改人 → `liaison=cp` | PASS | PASS |
| 前端产物含「项目编号」判定表 + 「对接人（选填）」 | PASS | PASS |
| 英文词条 `Project No.` / `Liaison (optional)` | PASS | PASS |

### 第二轮 `_q-verify2.mjs`（第四参数 `YJ_TEST` 即测试账套）

| 检查 | 正式账套 | 测试账套 |
|---|---|---|
| 管理员保存 → 审批中 | PASS | PASS |
| 审批 **前** `canRepairLiaison=false`（未定形不给补救入口） | PASS | PASS |
| 审批通过同时定级 + 选对接人 → 一步落地，`canRepairLiaison=false` | PASS | PASS |
| 审批时**故意不选**对接人 → `canRepairLiaison=true` | PASS | PASS |
| 用「补发对接人」补上 → `liaison=cp`，等级仍「二级」，`canRepairLiaison=false` | PASS | PASS |
| 产物里有「补发对接人」、**没有**「定级分发」按钮文案 | PASS | PASS |

真实历史单**只读确认**（未做任何写操作）：
正式账套 `LXA-2026-10-0013`（二级，无对接人）与 `LXA-2026-10-0018`（无等级，无对接人）
两张 `canRepairLiaison=true` ⇒ 上线后用户能自己补上，不会卡死。

数据库留痕（正式账套，探针单已作废留档）：

```
yj_doc_status : pending=N pending_by=admin archived=Y shr=admin
rd_approval   : 项目等级=四级  备用1=chaishanyin→cp  申请立项人=系统管理员
yj_form_approval:
  SUBMIT   PENDING  admin
  APPROVE  APPROVED admin
  GRADE    GRADED   admin  项目定级：四级
  LIAISON  DISPATCHED admin 分发对接人：柴善银（chaishanyin）
  LIAISON  DISPATCHED admin 改派对接人：柴善银（chaishanyin）→ 陈秀丽（cp）,操作人 admin
```

## 文件

| 文件 | 用途 |
|---|---|
| `_q-verify.mjs` | 第一轮：正式账套活体探针（①②③④ 全链） |
| `_q-verify-test.mjs` | 第一轮：测试账套同款 |
| `_q-verify2.mjs` | 第二轮：定级分发并入审批通过 + 补救入口（第 4 参数传 `YJ_TEST` 跑测试账套） |
| `out-verify.json` / `out-verify2.json` | 最后一次运行的逐项结果 |
| `_red.log` | 阶段 3 的红：改代码前失败项（证明测试能指出行为缺失） |

## 踩到并记下的坑

1. **`callButton` 的返回键是「编号」**，不是「单据编号」/`docNo` —— 探针初期取错，
   导致后续全部 409「仅审批中状态可审批通过」（其实单号根本没建成）。
2. **「保存」首次调用走 directAdd 分支**：不带编号时后端建**空白草稿**并直接
   `return result(no,"草稿")`，**不经过**归档/送审块（既有行为，非本次改动）。要验归档/送审
   必须**第二次带编号保存**。
3. **立项申请「文档编号」是必填**：不带就 `400 文档编号不能为空`。
4. **英文词条是懒加载 chunk**（`en-*.js`），不在首页 `index-*.js` 里 ——
   在首页 chunk 里 grep 中文/英文词条永远是 false。
5. **源码断言测试的切片要精确到 `</el-dialog>`**：固定长度切片会跨到下一个弹窗，
   撞出"键在另一个弹窗里"的假阴性（本轮第一版就这么红了一次）。
6. 探针自建单（客户名 `PROBE*`）已全部 `asp_cancel='Y'` 作废留档，两账套剩余可见数 = 0；
   真实历史单**未做任何写操作**。

