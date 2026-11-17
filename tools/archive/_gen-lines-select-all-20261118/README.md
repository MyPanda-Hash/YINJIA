# 批量生单 / 合单生单弹窗「顶部总全选」取证(2026-11-18)

## 用户报障原话

> 「批量生单和合单生单弹窗最顶部都没有全选按钮。」(附截图:合单生单 → 送料暂收单)

改动前只有**每张来源单行头**有「全选 / 取消全选」⇒ 合单勾七八张单要在七个行头上各点一次。
改完后弹窗最顶部(提示行右端)多一组 `☑ 全选 | 取消全选 | 已选 N 行`,一次作用于**全部来源单的所有行**。
控件在 `frontend/src/core/views/GenerateLinesDialog.vue` 的 `.gl-bar`;两个入口共用同一个组件
(`merge=false` = 批量生单;`merge=true` = 合单生单)。

## 口径(与单张「全选」完全一致)

- 复用 `selectAll(doc)` 逐单执行 ⇒ **只勾可选行**:非「已审核」单据整张不可勾、
  已打印隔离行与「可生单 = 0」的行不会被总全选顺手带进来;
- 勾上时「本次数量」仍按剩余量预填(与手工勾一行同一套逻辑);
- 三态:全勾 = ✓、部分勾 = ▬、一个没勾 = 空;可勾行数为 0 时禁用;
- 「取消全选」只清勾选,不动用户已填的本次数量(与行头那个「取消全选」同款)。

## 复跑方式

```
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/gen-lines-select-all-20261118/round-11.mjs')"
```

固定 task space `gen-lines-select-all-20261118`,地址 `http://localhost:5173/#/panelx/list/PU_ORDER`
(登录工厂 = 测试库;左栏模糊搜索 `PO-2026-10` 全是已审核订单)。

| 脚本 | 干了什么 |
|---|---|
| round-01/02 | 打开采购订单面板,看清楚左栏勾选列与工具栏 `.tb-group` 结构 |
| round-03~05 | 定位「生单 ▼」(`.tb-caret`)与下拉项容器 `.ctx-item` |
| round-06/07 | 左栏表头全选本页(50 张)→ 展开「生单 ▼」下拉,确认两项:批量生单 / 合单生单 |
| round-08~11 | 搜 `PO-2026-10` → 勾前两张已审核 → **合单生单**弹窗(round-11-merge-dialog.png) |
| round-12 | 点顶部全选 → `已选 2 行`、两张单各 `已选 1 行`、灰色行恢复正常;取消一行 → 已选 1 行;再点「取消全选」→ 0 行 |
| round-13 | 三态确证:`.el-checkbox__input` 带 `is-indeterminate`、`aria-checked="mixed"`,裁剪截图 round-13-pickall-clip.png |
| round-14 | **批量生单**弹窗(标题「生单 → 送料暂收单」)同样有顶部全选,点一下跨两张单各勾 1 行 |
| round-15 | 收尾:关弹窗、清左栏勾选 |
| round-16 | 最终版复核:先手工把第一行「本次数量」填 0.5 → 点顶部全选(`已选 2 行`,已填的 0.5 不被覆盖)→ 点「取消全选」(`已选 0 行`,**0.50 仍在**:只清勾选、不清数量) |

入库的截图(其余过程截图体量大,按 `.gitignore` 不入库,`*.mjs` 可复跑重出):
`round-11-merge-dialog.png`(合单弹窗顶部出现全选)、`round-12-pickall-on.png`(点全选后跨两单勾上)、
`round-13-pickall-clip.png`(三态中间态裁剪)、`round-14-batch-dialog.png`(批量生单弹窗同款)、
`round-16-unpick-keeps-qty.png`(取消全选不清数量)。

## 回归闸

`frontend/src/core/views/generateLinesDialog.test.js` 新增
「弹窗最顶部有总全选(批量生单 / 合单生单共用)」一条:守 ① 控件在 `.gl-bar` 里、
② 文案走 `tt()`、③ 总全选必须复用 `selectAll`(不许另写一套勾选)、④ 三态派生存在。

```
cd frontend && node --test src/core/views/generateLinesDialog.test.js
```

## 注意

本次**没有**同步 `backend/src/main/resources/static`(即 8090 的打包前端):工作区里还有另一条
未提交的「采购入库单仓库多选」改动(engine.js / panel-runtime.js / PanelxForm.vue /
PurInMultiWhDialog.vue),现在重新打包会把那条任务的产物一起打进 static。
5173(vite)已即时生效;8090 等下一次 packaging 一并带出。
