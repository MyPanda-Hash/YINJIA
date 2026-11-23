# 立项申请表「客户编号」前缀修复 —— 取证（2026-11-20）

## 报障

「立项申请表」(RD_APPROVAL) 选择客户后，客户名后面没有带出客户编号
（期望「A-60 欧科塑胶制品(深圳)有限公司」这种编码 + 名称的前缀效果）。

## 根因（生产实测）

两次改动（`1f84c240d` / `a94ccb531`）都已进入生产 `PanelxList-*.js`，但前缀只加在
**表格式信息条**（`sg-info-row`）与 **vcell 合并竖列**（`q-vrun`）两个分支。

立项申请 `approvalSheetCfg.rows` 是 `{ num, label, key, kind:'input' }`（不是 grid、没有 cells），
「客户名」实际命中模板里的 **单字段行** 分支：

```html
<div class="as-row"><div class="as-name">客户名</div>
  <div class="as-fill"><div class="as-fill-main">
    <div class="as-ref-ctl as-fill-ref">…</div>   <!-- 这里没有 .as-ref-code -->
```

生产实测（LXA-2026-11-0028 草稿，选「欧科塑胶制品(深圳)有限公司」）：

- 客户名格 DOM：`.as-ref-ctl.as-fill-ref` → 只有 `.as-ref-text`，`.as-ref-code` 计数 = 0；
- 「立项编号」el-input 的 value 已变成 `C-11220261120` ⇒ `applyApprovalDocNo` 已取到
  客户编码 C-112 并写入 head（同一分支下一行也写了 `props.head['客户编号']`）；
- 即：**代码取数/写入都对，唯独命中的模板分支没有渲染前缀**。

截图（按仓库口径 `*.png` 不入库，仅本地留证）：
`_scratch/ego-approval-custcode-20261120/round-09-prod-selected.png`
（修复前生产：名称前无编码，立项编号已有值）。

另外旧实现 `props.head['客户编号'] = code` 位于 `if (!code) return` 之后：
编码取不到时既不显示、也不清掉上一次选客户留下的旧编号。本次一并修正为「先写、再决定是否填编号」。

## 修法

1. `DocSheet.vue` 单字段行参照分支补 `<span v-if="custCodeOf(row.key)" class="as-ref-code is-prefix">`；
2. 同分支只读态（已归档/无编辑权）补 `.as-ro-ref` 前缀（老单/归档单也能看到）；
3. `pairs` 分支同样补前缀（其余分支此前已有）；
4. `applyApprovalDocNo`：先写 `客户编号`（取不到写空串），再按规则填 `文档编号`；
5. 参照框在单字段行里撑满值区并允许换行，避免「KH00021 惠州市芯悦…」被 200px 截断；
6. 客户编码解析抽到 `approvalCustomerCode.js`（纯函数，node:test 直接测）。

## 验证

- 单测：`approvalCustomerCodePrefix.test.js`（前缀命中真实分支 / 只读态 / v-if 判空）、
  `approvalDocNoRule.test.js`（写入 head 在提前返回之前 / 编码解析）；相关 82 条全绿。
- 本地 5173 实测：新建单选「广州市鑫万(A-26)」→ 客户名格 DOM
  `A-26` + `广州市鑫万电子商务有限公司`，`truncated:false`；保存为草稿后查库
  `rd_approval.客户编号 = A-26`（保存链路 OK）。
- 只读态实测：临时把测试单置为已归档，`.as-ro-ref` 内前缀 `A-26` 完整显示
  （本地截图 `_scratch/ego-approval-custcode-20261120/round-20-local-readonly.png`）。
- 构建产物（vite build → backend static，4174 preview）实测选客户后同样显示前缀
  （本地截图 `_scratch/ego-approval-custcode-20261120/round-24-build-preview-selected.png`）。
- 375/768/1440 等效视口：客户名格均 `truncated:false`；768 下文档级 7px 横向溢出
  来自顶栏「系统管理员」下拉（`.t-right`），不是本表。

## 已知边界

历史单据的 `客户编号` 列是 2026-11-19 才加的，老单该列为 NULL：
打开老单不会凭空出现前缀，**重新选一次客户即写入并显示**。
如需让老单直接显示，需另做数据回填（按 `dm_kh.mc` 回填 `rd_approval.客户编号`），本次未做。

> 上述截图按用户 2026-10-15 口径不入库（.gitignore 的 `*.png`），只在 `_scratch/` 留本地证据。
