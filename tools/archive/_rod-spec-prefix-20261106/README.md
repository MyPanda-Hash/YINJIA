# 烧结工艺清单「炭棒规格」纸面前缀退役 —— 活体取证（2026-11-06）

## 用户口径（原话）

> 研发管理的烧结工艺清单的炭棒规格的外：、内：、长：，这些表格内背景词去掉

接在 2026-11-06 上一版之后：那一版只删了 **X烧结（RD_X_SINTER）**三格的 placeholder，
本版补的是 **成型工艺清单（RD_MOLD_PROC，纸面名「炭棒工艺管控清单」）**—— 那三格走的是
另一条渲染路径：纸面前缀由 `cell.pre` 渲染（`core/panel/carbonSpec.js` 的 `SPEC_PREFIX`），
删 placeholder 对它无效。

## 改动（commit 928f5974d）

| 文件 | 改什么 |
| --- | --- |
| `frontend/src/core/panel/carbonSpec.js` | `SPEC_PREFIX` 退役（`SPEC_SLOTS` 不再带 `prefix`）—— 前缀唯一来源消失 |
| `frontend/src/core/views/recordSheetConfigs.js` | `RD_MOLD_PROC` 页 0「产品基本信息」三格不再配 `pre`；三格本身保留 |
| `frontend/src/core/views/RecordSheetPanels.vue` | 注释改口径：`cell.pre` / `.rs-pre` 能力保留给别的单用，别挂回这三格 |
| `frontend/src/core/views/recordSheetConfigs.rodSpec.test.js` | 新增单测：①任何面板纸面配置不得再配 `外：/内：/长：` 前缀；②三格键仍是 炭棒规格1/2/3 |

数据口径没动：那三格本来就存**裸数字**（2026-11-03 起），本版只是把"显示"也统一成裸数字。

## 证据

| 文件 | 内容 |
| --- | --- |
| `A-new-sheet.png` | 新构建（vite preview 4179，源码 + 本次改动）打开空白草稿：纸面可编辑，`炭棒规格` 三格只有数字输入框 |
| `C-live-8090.png` | 在跑的 8090（jar 内前端）同一张单：同样只有数字输入框 |
| `D-after-delete.png` | 取证用的空白草稿已删除（`MP-2026-11-0001 已删除`，页码回到 第 0/0） |

探针结果（`round-12.mjs` 在 8090 上跑）：

```
paperInputs   : 92        // 纸面确是可编辑态（有 input，不是只读）
rsPreSpans    : 0         // 没有任何 外：/内：/长： 前缀元素
hasWaiIn      : false     // 正文里也搜不到「外：」
specCellsHtml : <div class="el-input el-input--small rs-t-in"> ×3   // 三格 = 纯输入框
```

单向对照（改前）：`git show 928f5974d^:frontend/src/core/views/recordSheetConfigs.js` 里
三格是 `{ key: '炭棒规格1', pre: SPEC_PREFIX['炭棒规格1'] }` —— `pre` 一旦有值，
`RecordSheetPanels.vue` 就渲染 `.rs-pre-cell > .rs-pre`，即用户截图里那三个灰字。

## 复跑

```bash
cd tools/archive/_rod-spec-prefix-20261106
~/.local/bin/ego-browser nodejs < round-10.mjs   # 4179(新构建) vs 8090(在跑) A/B，会建一张空白草稿
~/.local/bin/ego-browser nodejs < round-12.mjs   # 只读探针：inputs / .rs-pre / 正文关键字
~/.local/bin/ego-browser nodejs < round-13.mjs   # 删除 round-10 建的那张草稿（软删）
```

端口说明：4179 = `vite preview --outDir $TMPDIR/yj-rod-verify-*`（一次性构建产物，不入库）。

## 注意

1. **正式库留痕**：取证时在正式账套建过一张空白草稿 `MP-2026-11-0001`，已在界面上删除
   （单据删除=软删，`yj_doc_status.canceled='Y'`）。出包前的「研发区无数据」自查若要 0 行，
   按既有 RD 清理脚本流程处理那张作废单即可。
2. **8090 现役 jar 是混合版**：入口仍是 `index-4_xPnYej.js`（静态目录 HEAD 是 `index-Mptw3gR1.js`），
   但 `RecordSheetPanels` 那块已经被换成不带 `pre` 的新产物 —— 本单的显示正确，
   若要让 8090 与 HEAD 完全一致，按 `deploy/部署说明.md` 重新打包换 jar。
3. 三格**没有**补「外/内/长」列头：用户口径是"去掉"，且列位顺序固定（外径/内径/长度）。
   若以后要恢复区分，正确做法是改标签行（`炭棒规格` 跨 3 列）而不是把前缀挂回格子。
