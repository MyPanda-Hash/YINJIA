# _rd-liaison-approve-20261028 —— 立项对接人随审批分发 + 研发管理员取消「保存即归档」

> 用户口径（2026-10-28 截图《立项申请》+《定级分发》弹窗）：
>
> 1. 「立项申请的右上角的文件编号名字改为**项目编号**」
> 2. 「立项申请可以由管理员在**审批定级的时候确定一个对接人进行分发**，后续也默认是这个对接人，
>    除非进行修改，否则默认选择这个对接人」
> 3. 「把所有研发的**管理员的保存就归档去掉，一样走审批流程**，但是管理员可以**自己提交自己审批**」

## 改了什么

| # | 落点 | 改动 |
|---|---|---|
| ① | `frontend/.../docSheetConfigs.js` → `docnoLabel()` | 新增判定表 `{RD_APPROVAL:'项目编号'}`；未登记面板回空串（仍「文档编号：」） |
| ① | `frontend/.../DocSheet.vue` | 右上编号格标识改由 `docnoLabelText` 派生，删掉写死的 `tt('文档编号：')` |
| ② | `ButtonService.approveApproval`（RD_APPROVAL 分支） | 定级后读 `formData['对接人']`，走 `assignLiaison` 一并分发 |
| ② | `ButtonService.assignLiaison`（新增） | 三条路共用：落 `rd_approval.备用1` + LIAISON 留痕 + `LIAISON_ASSIGNED` 通知 |
| ② | `ButtonService.gradeAndDispatch` | 删掉「对接人不能重复分发」硬拒；改人由 `assignLiaison` 留痕写「改派：A→B」 |
| ② | `ButtonService.rdApprovalFlowState` | `canGradeDispatch` 去掉 `liaison.isEmpty()`（否则已分发后按钮永久灰、改不了人） |
| ② | `PanelxList.vue` 审批弹窗 | 加「对接人」下拉，打开时**默认带出已有对接人**；空选不发键（兼容旧前端/老单） |
| ③ | `ButtonService.saveDoc` | 管理员「保存即归档」分支**整段删除**，管理员与普通用户同走送审；`WLBOM`（无审批基础数据）仍保存即归档 |
| ③ | `ButtonService.ADMIN_SAVE_DEFERS_TO_FLOW` | 一并删除（原白名单只剩 RD_PROD_INFO，已无意义；只留注释记历史） |

**只改显示名，数据键不动**（ADR-0001 红线）：落库列仍是 `rd_approval.文档编号`，
`yj_field.col_name` 仍是「文档编号」，下游实施计划按「文档编号」参照的链路一字未改
⇒ 老单据零迁移、下游零影响。

## 验证证据（两个账套都跑过）

```
frontend:  node --test    → 920 tests / 920 pass / 0 fail
backend :  mvn -o -DskipTests compile → EXIT=0
```

活体探针 `_q-verify.mjs`（正式账套）/ `_q-verify-test.mjs`（测试账套），全 PASS：

| 检查 | 正式账套 | 测试账套 |
|---|---|---|
| 管理员「保存」后状态 = **审批中**（不再是 已归档） | PASS | PASS |
| 管理员自己「审批通过」放行 → 已归档 | PASS | PASS |
| 审批时带对接人 → `level=三级` + `liaison=chaishanyin` 一步落地 | PASS | PASS |
| 已分发后 `canGradeDispatch=true`，改人 → `liaison=cp` | PASS | PASS |
| 前端产物含「项目编号」判定表 + 「对接人（选填）」 | PASS | PASS |
| 英文词条 `Project No.` / `Liaison (optional)` | PASS | PASS |

数据库留痕（正式账套 `LXA-2026-10-0026`，已作废留档）：

```
yj_doc_status : pending=N pending_by=admin archived=Y shr=admin
rd_approval   : 项目等级=三级  备用1=cp  申请立项人=系统管理员
yj_form_approval:
  SUBMIT   PENDING  admin
  APPROVE  APPROVED admin
  GRADE    GRADED   admin  项目定级：三级
  LIAISON  DISPATCHED admin 分发对接人：柴善银（chaishanyin）
  LIAISON  DISPATCHED admin 改派对接人：柴善银（chaishanyin）→ 陈秀丽（cp）,操作人 admin
```

## 文件

| 文件 | 用途 |
|---|---|
| `_q-verify.mjs` | 正式账套活体探针（①②③④ 全链） |
| `_q-verify-test.mjs` | 测试账套同款（登录工厂改 `YJ_TEST`） |
| `_q-verify.mjs` 内 `docStatus()` | 走 `/px/queryFormDataList` 取状态（该面板无独立 docStatus 接口） |
| `out-verify.json` | 最后一次运行的逐项结果 |
| `_red.log` | 阶段 3 的红：改代码前 8 项失败（证明测试能指出行为缺失） |

## 踩到并记下的坑

1. **`callButton` 的返回键是「编号」**，不是「单据编号」/`docNo` —— 探针初期取错，
   导致后续全部 409「仅审批中状态可审批通过」（其实单号根本没建成）。
2. **「保存」首次调用走 directAdd 分支**：不带编号时后端建**空白草稿**并直接
   `return result(no,"草稿")`，**不经过**归档/送审块（既有行为，非本次改动）。要验归档/送审
   必须**第二次带编号保存**。
3. **立项申请「文档编号」是必填**：不带就 `400 文档编号不能为空`。
4. **英文词条是懒加载 chunk**（`en-*.js`），不在首页 `index-*.js` 里 ——
   在首页 chunk 里 grep 中文/英文词条永远是 false。
5. 探针自建单（客户名 `PROBE-*`）已全部 `asp_cancel='Y'` 作废留档，两账套剩余可见数 = 0。
