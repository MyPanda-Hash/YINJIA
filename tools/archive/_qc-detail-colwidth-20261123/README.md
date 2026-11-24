# _qc-detail-colwidth-20261123 —— 报表列「默认完全展开」(2026-11-23)

## 用户口径

> 「这些最基础的内容实现需要默认完全展开而不是关闭的」(附《出货检验（功能）明细表》截图,
> 红框圈住 单据编号 / 工单号 / 产品名称 / 规格型号 / 批次号)

## 根因

列表页报表表格(`PanelxList.vue` 的 `.report-table`)列宽**只按列名字数**推算:

```js
function colW(f) { ... return n.length <= 2 ? 96 : Math.min(Math.max(n.length * 16 + 30, 96), 220) }
```

2 字以上中文列一律 96px,值比列名长就必然省略号。2026-11-23 实测(100 行/页,`round-03.mjs`):

| 列 | 旧列宽 | 内容真实宽 | 被截断行数 |
|---|---|---|---|
| 单据编号 | 96 | 111 | 100/100 |
| 工单号 | 96 | 113 | 97/100 |
| 产品名称 | 96 | 163 | 91/100 |
| 规格型号 | 96 | 215 | 70/100 |
| 检验项目 | 96 | 137 | 2/100 |
| 检验要求 | 96 | 741 | 76/100 |

`yj_field.width`(迁移里早就配了 160/150/200/160/260…)也没被用上。

## 落地

- 新增纯函数 `frontend/src/core/report/colWidth.js`:
  `宽 = min(max(列名宽, yj_field.width, 内容宽 + 内边距), 360)`,内容宽按 12px 表格估算
  (全角 12.2px / 半角 6.8px,**故意偏大**:实测少算 2px 仍出省略号 —— 条码面板
  `CGRK-20261014-03414` 145px 列就截)。
- `PanelxList.vue`:报表列改走 `reportColW()`(读当前页 `list` 的**真实值**);
  撞 360 上限的长段落(「检验要求」741px)标 `wrap`,模板两处
  `:show-overflow-tooltip="!column.wrap"` ⇒ 单元格换行全文显示,不再省略号。
- 单测 `frontend/src/core/report/colWidth.test.js`(7 条):内容宽/元数据下限/上限 wrap/
  偏大取值,外加「组件真接上了纯函数 + 两处模板都按 wrap 关省略号」的源码钉子。

## 取证(ego-browser,5173 源码版)

| 脚本 | 说明 |
|---|---|
| `round-01.mjs` + `round-01-before.png` | 改前现状:18 列全 96px,单号/品名/规格一律省略号 |
| `round-03.mjs` | 改前逐列「内容真实宽 / 被截断行数」 |
| `round-04.mjs` + `round-04.png` | 改后同一页:**19 列 truncated=0**;单据编号 160 / 工单号 150 / 产品名称 200 / 规格型号 246 / 检验要求 360 |
| `round-07.mjs` + `round-07-scrolled.png` | 横向滚到「检验要求」:67 字长段落换行 3 行、`scrollH == clientH`(无竖向裁切) |
| `round-08.mjs` + `round-08-sorted.png` | 真鼠标点「单据编号」表头排序:142 行仍 truncated=0(排序/翻页不破坏宽度) |
| `round-09.mjs` + `round-09-product-cols.png` | 红框里的 产品名称/规格型号/批次号 列截图:值完整(含 `32*12*112.2序号:Z045物料编码:T123`) |
| `round-05.mjs` + `round-05-*.png` | 回归:库存状况表 / 报工记录 / 材料仓条码管理 **truncated=0** |

改后整表宽 3038px(视口 1036)⇒ 横向滚动;这是「内容全部展开」的代价,与 T+ 宽表同形态。

## 复跑

```bash
cd frontend && node --test --experimental-test-isolation=none src/core/report/colWidth.test.js
# 页面取证(需 5173 在跑)
"C:/Users/vigna/.local/share/ego/active_version_dir/ego-browser.exe" nodejs \
  -e "await import('file:///C:/Users/vigna/ego/qc-detail-expand-20261123/round-04.mjs')"
```
