# _pick-main-material-20261104 — 取证探针与验收截图(任务产物)

任务:2026-11-04 用户报障

> 「生产领料和生成生产领料这两个面版的主物料都没有标明物料编码和规格型号和计量单位,
>   而且需求数量在明细里面没有写清楚。在外面就有」

## 一、改了什么(两处抬头 + 两处明细行)

| 面板 | 位置 | 改前 | 改后 |
|---|---|---|---|
| 生产领料(单据详情 `MobilePickDoc.vue`) | 抬头 | 工单号 / 产品 / **规格** / 生产线 / 领料单号 / 退料单号 / 领料进度 | 增 **物料编码**、**计量单位**,「规格」改名「规格型号」 |
| 生产领料 | 明细行 | 右侧 `0/100 支`(裸数字,含义靠标题栏的「已领/需求」) | 两行各带标签:`需求 100 支` / `已领 0 支` |
| 生成工单领料/退料单(抽屉 `MobilePickCreate.vue`) | 抬头 | 工单号 / 产品 / 状态 / 领料进度(且 `.mp-kv` 无布局,标签黏着值: `工单号GD-…`) | 增 **物料编码 / 规格型号 / 计量单位**;`.mp-kv` 改两列网格,标签与值分开 |
| 生成工单领料/退料单 | 抽屉明细行 | 右侧 `0/100 支`(抽屉里连列头都没有) | 两行各带标签:`需求 100 支` / `已领 0 支` |

**数据源(未改后端,字段本来就有)**:
- 物料编码 ← `wo_pick_doc.产品编号`(生单那一刻的快照,`/px/mobilePick/doc` 顶层 `产品编号`);
- 规格型号 / 计量单位 ← 工单行 `plang.gg` / `plang.jldw`(`/px/mobilePick/doc` 的 `工单` 子对象);
- 需求数量 ← 行上的 `BOM用量`(未完成单读 `wo_pick_line.需求数量`,已完成单从 `明细备注` 解析)。

取证 SQL(测试账套,确认两个数据源都非空 —— 否则界面补了字段还是 `—`):

```sql
SELECT pl_no, pl_xc, dm, mc, gg, jldw FROM dbo.plang WHERE pl_no IN ('GD-2026-10-0217','GD-2026-11-0016');
-- GD-2026-11-0016 | 1 | D-18-10 | A+级口感炭棒 | 45*22*97 | 支
SELECT id, 工单号, 工单行号, 产品编号, 产品名称, 领料单号, 状态 FROM dbo.wo_pick_doc ORDER BY id DESC;
-- 827 | GD-2026-11-0016 | 1 | D-18-10 | A+级口感炭棒 | LL-2026-11-0010 | 未完成
```

## 二、验收证据(截图均来自本机 5173 源码实例,测试账套 YJ_TEST)

> ⚠ 截图是 **.png**,仓库 `.gitignore` 第 134 行 `*.png` 全局忽略 ⇒ 这些图**只留在本机**,
> 不入库;复核时按下面第三节的命令重新截一遍即可。

| 文件 | 说明 |
|---|---|
| `after-doc-desktop.png` | 生产领料 LL-2026-11-0010 详情(桌面 1523 宽):抬头有 物料编码 D-18-10 / 规格型号 45*22*97 / 计量单位 支;明细行 `需求 1020 支` / `已领 0 支` |
| `after-create-drawer-desktop.png` | 生成工单领料/退料单 →「看明细」抽屉(桌面):抬头同样三件套,标签与值分列 |
| `after-doc-mobile390.png` | 同上详情页,手机 390 宽:换行正常、无横向滚动 |
| `after-create-drawer-mobile390.png` | 抽屉 390 宽:占满屏宽,需求/已领两行右对齐可读 |
| `after-doc-en.png` | 切 `en` 复核:Material Code / Specification / UOM / Demand / Picked 全部走译名(业务事实数据仍原样) |

## 三、怎么复现这套取证

```powershell
# 1) 起服务(源码生效用 5173;8090 是打包后的 jar,需要 apply-frontend-only.ps1 才会变)
powershell -ExecutionPolicy Bypass -File tools\scripts\start-prod.ps1
cd frontend; cmd /c start-vite.bat

# 2) 浏览器打开 http://localhost:5173 → 登录工厂选「YINJIA-MES·测试库」→ admin/123456
#    生产领料详情:http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?id=827
#    开单工作台:  http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE (展开「已开单」→ 点一行)
```

截图脚本在本目录的 `round-0*.mjs`(ego-browser 任务脚本,按轮次保留;调用方式见
`C:\Users\Lenovo\ego\pick-main-material-20261104\`)。
