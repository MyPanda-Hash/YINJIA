# 出货检验（功能）/（表观）纸面「检验项目」长文本自动换行

**日期** 2026-11-23 · **面板** `QC_PROC_INSP`（出货检验（功能））/ `QC_ASM_INSP`（出货检验（表观））
**组件** `frontend/src/core/qc/QcProcInspSheet.vue`（两张单共用同一张纸面，见
`PanelxList.PROC_INSP_SHEET_PANELS`）· **数据库** 未改动（无脚本、无迁移）

## 1 报障

用户截图（红框圈住「检验项目」列）+ 原话：

> 这种文本显示不完全的内容需要能够自动换行，检查当前的出货检验（功能）和出货检验（表观）

截图中可编辑态的项目名被截在格子里，例如「*抗压强度（裸…」「*黑水及颗粒物」只露出前半段。

## 2 根因

「检验项目」格在**可编辑态**用的是**单行** `<el-input>`：

- 单行输入框里的文字不会换行，超出格宽只会横向滚动 ⇒ 肉眼就是「显示不完全」；
- 该列宽度只有 **9%**（`colWidths` 的 `itemPct`；窄屏 636px 表宽下实测 **57px**，
  在生产纸面 840px 最小宽度下约 75px）；
- 只读态本来就用 `.qr-cell-text`（`white-space: pre-wrap`）会换行，所以只有**打开草稿/编辑**时才截断 ——
  和用户截图（有下拉、有删除 ×）的现象一致。

## 3 修改（单组件，两张单同时生效）

`QcProcInspSheet.vue`：

1. 检验项目格由单行 `el-input` 改为与「检验方法/检验要求」同款多行域：
   ```html
   <el-input v-if="editable" :model-value="g.name" type="textarea"
             :autosize="{ minRows: 1, maxRows: 12 }"
             class="qr-cell-input qr-cell-wrap qr-item-input" maxlength="200" ... />
   ```
   （空行仍只占 1 行高，按内容自然增高；只读分支 `.qr-cell-text` 不动。）
2. 新增样式：`.qr-grid td.c-item .qr-cell-wrap :deep(.el-textarea__inner)`
   居中 + `word-break: break-word` + `overflow-wrap: anywhere`
   （项目名里没有空格可断，必须按字符断行，否则 23 字项目名在 57px 列里仍横向溢出）。

列宽（9%/30%/14%…）与 `qcProcInspColWidths.test.js` 的口径**一律不动** —— 本次只解决「显示不全」。

## 4 验证（ego 浏览器，5173 源码版，测试账套 `HSDZ_MES_TEST`）

| 场景 | 断言 | 结果 |
|---|---|---|
| 功能单可编辑 `ZC-2026-10-0131`「*整体尺寸(外包无纺布)」 | 控件 `textarea`、列宽 57px、控件高 58px、`scrollHeight == clientHeight`、`scrollWidth == clientWidth`、`text-align: center` | ✅ 整段换行显示，无横向/纵向溢出 |
| 表观单已审核 `ZJ-2026-10-0135`「*整体尺寸 （内PP棉、外包布、套网、打端盖）」(23 字) | 只读 `.qr-cell-text` `scrollWidth == clientWidth`、`white-space: pre-wrap`、行高 124px | ✅ 整段显示 |
| 表观单可编辑（未保存的新增行注入同一 23 字项目名） | `textarea` 高 130px、`scrollHeight == clientHeight`、无横向溢出 | ✅ 整段换行显示 |

截图（本目录）：

- `p1-proc-item-wrap.png` —— 功能单可编辑：长项目名换成两行，完整可见；
- `p2-asm-item-wrap.png` —— 表观单已审核：23 字项目名整段显示；
- `s6-asm-editable.png` —— 表观单可编辑：注入 23 字项目名后的整页观感；
- `s4-proc-after.png` / `s5-asm-all.png` —— 整页上下文。

复跑脚本：`ego/round-*.mjs`（`ego-browser nodejs -e "await import('file:///.../round-22.mjs')"`；
每个 round 独立文件、不覆盖）。注意读数一律读控件 `value`（单行/多行输入框的值不进 `innerText`）。

## 5 回归

- 新增 `frontend/src/core/qc/qcProcInspItemWrap.test.js`（4 条：可编辑多行域 / 只读态保留 /
  断行样式 / 两张单共用纸面），`node --test` 全绿；
- `qcProcInspColWidths.test.js`（检验方法 > 检验要求、合计 100%）仍全绿；
- `npm run build` 通过；
- 全量 `npm test`：2324 条中 5 条红，均为 `recordSheetConfigs.livedb.test.js` 的**活库连通**
  断言（本 shell 无 `YINJIA_SQL_PASS`，与本次改动无关）。

## 6 注意

- 工作区还带着**上一任务**（qc-flow 改名 / 处理意见「标准库维护」）的未提交改动；
  本次提交只含本任务的 hunk（`QcProcInspSheet.vue` 两段）与新文件，未把别人的改动混进来。
- 未同步 `backend/src/main/resources/static`：工作区有未提交的前端改动，同步会把它们一起打进 jar 的
  静态前端；部署脚本（`deploy/winrm/deploy_src.py`）本身会 `npm run build` + 镜像 dist→static。
