# 物料清单(WLBOM)「导入商品数据」活体验证(2026-10-21)

用户原话:「把填写物料清单的内容可以通过点击新增数据的下拉栏:导入商品数据,
然后勾选商品里面的数据进行一个批量导入」。

## 怎么跑

```powershell
# 前置:后端 tools/scripts/start-prod.ps1 (8090) + 前端 frontend/start-vite.bat (5173)
node tools\archive\_wlbom-import-20261021\_q-wlbom-import.cjs
```

脚本用 **YJ_TEST 账套(HSDZ_MES_TEST)** 登录 —— 它会点「新增」造一张草稿单,按两账套纪律不进正式库。

## 产物(截图顺序 = 操作顺序)

| 文件 | 证明什么 |
|---|---|
| `_wlbom-panel.png` | 物料清单面板已打开 |
| `_wlbom-newdoc.png` | 明细页签工具栏出现「新增数据 ▾」(下拉形态) |
| `_wlbom-dropdown.png` | 点开是**两项**:新增数据 / 导入商品数据 |
| `_wlbom-dialog.png` | 弹窗列出商品档案:勾选列 + 存货编码/存货名称/规格型号/计量单位,「共 3917 条」分页 50 条/页 |
| `_wlbom-filter.png` | 关键字 `M-00` 过滤后 18 行(按存货编码/名称) |
| `_wlbom-picked.png` | 勾选 2 行(跨筛选/跨页保留),按钮变「确定（带入 2 行）」 |
| `_wlbom-imported.png` | 确认后明细追加 2 行,行序 31/32,映射见下;顶部提示「已带入 2 行 —— 导入后不自动保存，请点「保存」后生效」 |
| `_wlbom-dialog-768.png` / `-375.png` | 窄屏复核:弹窗 min(920px, 94vw) 不溢出视口 |
| `_wlbom-dup.png` | 判重:把同样两行再导一次 → 明细行数不变,提示「勾选的商品已在明细中，不重复添加」 |
| `_wlbom-dialog-en.png` | 英文界面:Import Items / Search item code or name / Selected 0 items / Inventory Code·Inventory Name·Specification·UOM / Cancel·OK(剩余中文是商品数据本身,按 ADR-0001 不翻) |
| `_wlbom-other-INV.png` 等 | 回归:非白名单面板(INV/FINISH_IN/MANU_ORDER)的「新增数据」仍是**原按钮**,没跟着变下拉 |

## 实测证据(脚本控制台输出摘录)

```
HEAD      {"ics":[{"txt":"新增数据 …","hasDropdown":true,"btn":"新增数据"}],"menuItems":[…,"新增数据","导入商品数据"]}
DIALOG    {"title":"导入商品数据","heads":["","存货编码","存货名称","规格型号","计量单位"],"rowCount":50}
FILTERED  {"rowCount":18,"total":"共 3917 条"}
PICKED    {"selected":"已选 2 项","footBtns":["取消","确定（带入 2 行）"]}
PICKED-ROWS [["","YJ-AM-001","阻垢料","M料","kg"],["","YJ-DGM-003","整机（外壳+机头）","4分","套"]]
DETAIL    rowCount 5 → 6;新增行 ["31","YJ-AM-001","阻垢料","M料","kg","1"] / ["32","YJ-DGM-003","整机…","4分","套","1"]
          msg:["已带入 2 行 —— 导入后不自动保存，请点「保存」后生效"]
NARROW-768 {"w":707,"left":31,"overflowX":false}
OTHER-INV {"hasDropdown":false,"btn":"新增数据"}
ERRS      []
```

## 「不自动保存」的库侧证据

跑完脚本后查 HSDZ_MES_TEST:

```
SELECT COUNT(*) FROM mate;                                  -- 24(= 跑之前),无新增行
SELECT COUNT(*) FROM mate WHERE wzdm2 IN ('YJ-AM-001','YJ-DGM-003') OR xc IN (31,32); -- 0
```

界面有行、库里没有 ⇒ 与 ImportDialog 同口径:保存仍由用户点「保存」。

## 字段映射(已按库核对,不是猜的)

`SELECT label, col_name FROM yj_field WHERE panel_code='WLBOM'` 的明细列:

| 商品档案 INV 列 | WLBOM 明细中文数据键 | 说明 |
|---|---|---|
| 存货编码 | 子件代码 | 判重用(同一子件不重复挂) |
| 存货名称 | 子件名称 | |
| 规格型号 | 规格型号 | INV 空值就是空 |
| 计量单位 | 子件单位 | |
| (固定 1) | 标准用量 | 导入后由用户按实际用量改 |
| (递增) | 行序 | 接 `max(已有行数, 已有最大行序)` 往上数,避免撞号 |
