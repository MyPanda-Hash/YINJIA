# 单据「审核」按钮取证（2026-11-13）

用户口径（本次需求原文）：

> 这个审批要有个审核按钮，否则对自填自审的角色来说，操作过于麻烦。单据的按钮界面都需要加上这个按钮。
> 然后只有有审核权限的角色，并且没有提交审批状态的单据才可以点击这个按钮。
> 如果已经提交审批了，就正常用审批通过来就行，不能点击审核按钮。

## 改了什么（对应取证脚本）

| 断言 | 脚本 | 结果 |
|---|---|---|
| 工具栏多出独立的「审核」按钮，位置在「删除」与「审批」之间，且**不带 ▼** | `round-03.mjs` | `toolbar` 序列 = 新增/保存/删除/**审核**/审批/生单/刷新/打印/导入/更多，`审核.caret=false` |
| 「审批 ▼」下拉里**不再**重复出现「审核」 | `round-03.mjs` | `APPROVAL_MENU` = 审批通过/审批驳回/审批情况/弃审 |
| 已审核的单据上「审核」置灰，点了只给原因、不弹确认框 | `round-03.mjs` | tip = `单据状态：已审核，仅草稿可审核`，`dialog=false` |
| 草稿上「审核」可点，点了弹「人工审核确认（审核意见选填）」 | `round-11.mjs` | `PROMPT 人工审核确认 单据：YJ-20261013-01（当前状态：草稿）…… 确认审核` |
| 点「审核」会先落库：必填没填时按审批动作归因提示 | `round-18.mjs` | `审核前需先保存：还有 3 项必填未填写……`（币种/汇率/仓库） |
| **后端**新口径跑通：`审核` → 已审核 + 审核人/审核时间 + AUDIT 留痕 | `round-20.mjs` / `round-21.mjs` | `200 {"单据状态":"已审核"}`；界面刷新后 `审核人：admin`、`审核时间：2026-11-13 10:40:52`；`getApprovalHistory` = `{"action":"AUDIT","operator":"admin","opinion":"【验收】审核按钮直审(测试账套)"}` |
| 状态一变，「审核」立即置灰、生单放开 | `round-20.mjs` | 审核后 `审核.disabled=true`、`生单.disabled=false` |
| 弃审还原：回到草稿、「审核人」清空、「审核」重新可点 | `round-21.mjs` | `{"status":"草稿","cells":["审核人：","审核时间："]}`、`审核.disabled=false` |

## 取证环境（重要）

- **界面断言**跑在 `http://localhost:5173`（vite 源码版），后端是本次重新打包的 jar（8090）。
- **落库往返**（审核 / 弃审）走的是**测试账套** `YINJIA-MES·测试库`（=`HSDZ_MES_TEST`），
  单据 `YJ-20261013-01` 审完立刻弃审还原成草稿 —— 见 `round-09`（切库）、`round-21`（还原）、
  `round-22`（把浏览器账套切回正式库 `YINJIA-MES`，不留用户的会话在测试库）。
- 正式库（`HSDZ_MES`）**只读**：`round-03` 里点的是「已审核」单据（只会弹置灰提示），没有任何写操作。
- ⚠ 这台机器的 ego 浏览器 `Page.captureScreenshot` 一律超时（连登录页都截不了，`round-04/05` 已记录），
  所以取证全部是 **DOM 断言 + 接口原文**，没有截图。

## 为什么用接口补最后一段

`YJ-20261013-01` 这张测试草稿缺 `币种 / 汇率 / 明细仓库` 三个必填，界面点「审核」会被
「审核前需先保存」拦住（`round-18`，本身就是预期行为的取证）；为了验证**后端** `audit()`
的新权限门禁确实放行，改用同会话直接 `POST /api/px/callButton`（`round-20`），
随后再用界面刷新读结果、并立刻弃审还原。

## 复跑

```powershell
# 需要 ego 浏览器 + 8090(jar) + 5173(vite) 都在跑
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_audit-btn-20261113/round-03.mjs')"
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_audit-btn-20261113/round-20.mjs')"
ego-browser nodejs -e "await import('file:///D:/YINJIA-main/tools/archive/_audit-btn-20261113/round-21.mjs')"
```

⚠ `round-09 / round-22` 会**切换登录账套**（需密码 123456）—— 只应在明确要在测试库造数时跑，
跑完务必用 `round-22` 切回正式库。
