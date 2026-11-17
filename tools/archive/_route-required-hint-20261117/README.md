# 工艺路线「必填没体现 / 保存后不提示是哪一行」取证（2026-11-17）

用户报障（截图 + 原话）：

> 「必填项在原来的工艺路线中没有体现为必填，且点击保存后也并没高亮提示是那个数据行」

弹窗当时是这么写的：**「以下内容还没填写完，已用高亮标出，请补齐后再提交」** —— 而界面上
一个高亮都没有，用户无从下手。

## 两条根因（都已核实）

### ① 静态必填标识：2026-11-13「去掉红点」被过度执行

`2c2c032ad feat: 多选弹窗一律点行即勾选；必填红星全部去掉（保留必填属性）` 那条用户口径是**针对弹窗**
说的（「其他的这种弹窗的勾选形式都进行改动……比如客户名称这个，把必填项的红点标识去掉」），
落地时把 `.field label.req::before` / `.col-hdr-text.req::before`（单据卡片表头 + 明细列头）
也一起清空了 ⇒ 用户再也看不出哪些格必填。

处置：只把这两处恢复红星；查询弹窗里的 `.req-star` 保持去掉（2026-11-13 口径不撤）。

### ② 动态高亮：只实现在纸面组件里，单据卡片/网格布局是 no-op

`PanelxList.focusMissingFields` 原来只调 `approvalSheetRef.value?.focusFields(keys)`：

- 纸面面板（RecordSheetPanels / DocSheet / 各 sheet）暴露了 `focusFields` ⇒ 有高亮；
- **工艺路线（ROUTE）等单据卡片 + el-table 布局根本没有 `approvalSheetRef`** ⇒ 可选链恒为 undefined，
  静默 no-op，弹窗却仍宣称「已用高亮标出」。

处置：本组件自己点亮 —— 表头缺口亮 `field-blink`；明细缺口按**行对象身份**（WeakMap，不用行号：
表里混着 `_placeholder` 空行）整行 `row-missing-hint` + 具体格 `cell-blink`；
「请至少添加一行明细」则闪该页签的「新增数据」按钮。

## 现场数据（正式库 HSDZ_MES `yj_field`，`required=1` 的 7 项 —— 配置本身是对的）

```
header          工艺路线名称 / 生效日期 / 失效日期
query,header    工艺路线编码
detail          工序编码 / 加工方式(显示名「工序控制」) / 加工顺序(显示名「工序序列」)
```

即：**不是数据配置问题，是前端没有把它呈现出来**。

## 复跑方式（ego 浏览器，测试库 YJ_TEST，不碰正式库）

脚本按轮次放在本目录，`ego-browser nodejs -e "await import('file:///<本目录绝对路径>/round-NN.mjs')"`。

| 轮次 | 取证内容 | 关键输出 |
|---|---|---|
| round-01/02 | 登录测试库（YJ_TEST） | `hash=#/dashboard` |
| round-03 | 必填红星 | 表头 `工艺路线编码/名称/生效日期/失效日期` 与列头 `工序编码/工序控制/工序序列` 的 `::before` 均为 `"*"`；`.req-star` 计数 = 0（弹窗仍无红星） |
| round-10 | 空白草稿点保存 | 弹窗 4 条；`headBlink = [工艺路线名称, 生效日期, 失效日期]` |
| round-20/21 | 明细缺「工序序列」 | 弹窗「明细第 1 行工序序列不能为空」；`rowMissing=1`（正是那条数据行，整行淡红 + 红左条）；`cellBlink` 命中该空单元格 |
| round-22 | 单元格闪烁抓帧 | `getComputedStyle(td).boxShadow = rgba(255,0,51,.42) 0 0 0 0.84px inset`（动画中） |
| round-23 | 「请至少添加一行明细」 | `btnBlink=[新增数据]`，按钮外圈红环 |

> ⚠ 测试库取证的坑（下次别再踩）：
> 1. 「新增」会在 `sessionStorage.mes_fresh_draft` 留一个 fresh-draft 标记，客户端于是把该单**当空白草稿渲染、
>    不读库** —— 造完 fixture 必须 `sessionStorage.removeItem('mes_fresh_draft')` 再 `goto`；
> 2. `page.goto('...#/panelx/list/ROUTE')` 在**同 URL** 时不触发整页重载（只有 hash 变化），
>    要真正重载得带一个查询参数：`http://localhost:5173/?t=<ts>#/panelx/list/ROUTE`；
> 3. 参照列（工序编码）若编码在目标库里不存在，单元格显示空 —— 测试库要用 `OP-CX` 这类真实存在的编码。

测试数据（`bs_route` 里 GY-2026-11-0002/0003 两张草稿）取证后已 `DELETE` 清掉，
测试库恢复到取证前状态（只剩 GY-2026-11-0001）。
