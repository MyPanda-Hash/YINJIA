# 批量生单 / 合单生单弹窗「全选」取证(2026-11-18,两轮)

## 用户口径(两轮,同一件事的两次校正)

> 第①轮:「批量生单和合单生单弹窗**最顶部**都没有全选按钮。」
> 第②轮(最终口径):「**全选按钮在行号前面的格子上就行**,和生单保持一致。」

**结论**:全选 = **每张来源单表格「勾选列」的表头格**(紧挨「行号」左边那颗三态勾选框),
第①轮临时放在弹窗顶部提示行右端的那颗,按第②轮口径**已撤掉**;每张单行头那对
「全选 / 取消全选」文字链也一并撤掉(同一块里留两份全选是噪声,表头那颗即唯一入口)。

控件在 `frontend/src/core/views/GenerateLinesDialog.vue`:
- 模板:勾选列 `<el-table-column width="42">` 的 `#header` 里那颗 `el-checkbox`;
- 三态派生:`docStats(doc)`(本节脚本区)按**本单**算 `total / picked / all / some`。

两个入口共用同一个组件(`merge=false` = 批量生单;`merge=true` = 合单生单),N 张来源单 = N 张表 = N 个表头全选。

## 口径(与单张「全选」完全一致,不是另写一套)

- 表头勾上 → `selectAll(doc)`、取消 → `selectNone(doc)` ⇒ **只勾可选行**:非「已审核」单据整张不可勾、
  「可生单 = 0」的行不会被顺手带进来;
- 勾上时「本次数量」仍按剩余量预填(与手工勾一行同一套逻辑);
- 三态:全勾 = ✓、部分勾 = ▬、一个没勾 = 空;本单可勾行数为 0 时**禁用**(点了没反应是最差的体验);
- 跨多张单的「全部一起勾」仍由底部**按剩余量填充**负责(它本来就是全勾 + 按剩余量填量),底部「清空」反之。

## 复跑方式

```
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/gen-lines-select-all-20261118/round-20.mjs')"
```

固定 task space `gen-lines-select-all-20261118`,地址 `http://localhost:5173/#/panelx/list/PU_ORDER`
(登录工厂 = 测试库)。左栏模糊搜索:`PO-2026-10` 全是已审核订单;`YJ-20261012` 里只有 `YJ-20261012-07` 已审核(3 行)。

| 脚本 | 干了什么 |
|---|---|
| round-01/02 | 打开采购订单面板,看清楚左栏勾选列与工具栏 `.tb-group` 结构 |
| round-03~05 | 定位「生单 ▼」(`.tb-caret`)与下拉项容器 `.ctx-item` |
| round-06/07 | 左栏表头全选本页(50 张)→ 展开「生单 ▼」下拉,确认两项:批量生单 / 合单生单 |
| round-08~11 | 搜 `PO-2026-10` → 勾前两张已审核 → **合单生单**弹窗(第①轮:顶部全选) |
| round-12~16 | 第①轮顶栏全选的勾选/取消/三态/不清数量的取证 |
| round-17 | 搜 `YJ-20261012`,确认本页只有 `YJ-20261012-07` 已审核(3 行) |
| round-18 | 打开「生单 → 送料暂收单」:表头格子=全选框、`title=全选本单的全部明细行`;点表头 → 3 行全勾、再取消一行 → `is-indeterminate` 三态 |
| round-20 | **最终版**:3 行默认全勾(表头 ✓)→ 取消第 1 行(表头 ▬、`已选 2 行`、本次合计 4400)→ 表头再点一下(回到 ✓、`已选 3 行`);同时确认行头已无「全选/取消全选」文字链 |

入库截图(其余过程图体量大,按 `.gitignore` 不入库,`*.mjs` 可复跑重出):
`round-20-dialog-partial.png`(最终版整窗)、`round-20-header-clip.png`(表头三态 ▬ 特写)、
`round-18-header-clip.png` / `round-18-header-partial.png`(同一位置的 ✓ 与 ▬)、
第①轮的 `round-11/12/13/14/16-*.png`(顶部全选,已被本轮取代,留档对照)。

## 回归闸

`frontend/src/core/views/generateLinesDialog.test.js`:
- 「全选放在勾选列表头(行号前面的格子),不占顶部条」——守 ① 勾选列(宽 42、在「行号」之前)的 `#header`
  里有全选框且 `title` 走 `tt()`、② 三态派生 `docStats(doc).all/.some` 与 `:disabled="!docStats(doc).total"`、
  ③ 勾上/取消就是 `selectAll(doc) / selectNone(doc)`、④ 三态基数只算可选行、⑤ 顶栏与行头不再重复挂全选;
- 「表头全选的文案在 en.js 有词条」。

```
cd frontend && node --test src/core/views/generateLinesDialog.test.js
```

## 注意

`backend/src/main/resources/static`(8090 打包前端)由打包含出,本任务只在 5173 上取证;
本次 `npm run build` 已通过,static 的同步按仓库惯例单独提交。
