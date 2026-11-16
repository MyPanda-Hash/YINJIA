# _other-slip-print-20261116 — 其他领料 / 其他退料 / 生产退料 的纸面报表

任务用户口径(2026-11-16,两轮合并):

> 「其他领料,其他退料和生产退料。都要可以打印报表。(这3个都是在提交的时候打印的,可以补打印。
>  其他领料和其他退料要有对应关系的二维码,方便手机扫码后补打印,或查询补打印)。
>  打印格式和生产领料一样,只是名称不同」

## 三种报表 → 面板 / 打印类型 / 纸面标题

| kind | 落库面板 | 打印类型(派单键) | 纸面标题 | 单号示例 |
|---|---|---|---|---|
| `OTHER_PICK` | `OTHER_OUT` 其他出库单 | `OTHER_PICK_SLIP` | 其他领料单 | `OO-2026-11-0005` |
| `OTHER_RET` | `MATERIAL_RET` 生产退料单 | `OTHER_RET_SLIP` | 其他退料单 | `TL-2026-11-0007` |
| `MAT_RET` | `MATERIAL_RET` 生产退料单 | `MAT_RET_SLIP` | 生产退料单 | `TL-2026-11-0008` |

⚠ 其他退料 与 生产退料 **落同一张面板**,只能靠 kind 区分标题与打印类型 ⇒ kind 必须跟着二维码走。

## 二维码 = 对应关系

内容 `YJSLIP:{KIND}:{单号}`,例如 `YJSLIP:OTHER_PICK:OO-2026-11-0005`。

- 印在纸面右上角(与生产领料单同一位置);
- 手机端**扫码框**扫到它 → 直接补打印同一张单(主扫框与「补打印」框都认);
- 与工单码(`0@工单号@1001`)、物料码(`存货编码|批号`)用**不同前缀**,解析分支互不干扰
  (单测里钉死:这两种码都不许被当单据码)。

## 实现落点

| 文件 | 作用 |
|---|---|
| `backend/.../controller/OtherSlipController.java` | 新:`POST /api/px/slip/rows {面板,单据编号}` → 头+行(直接是代理要的键) |
| `backend/.../controller/PrintStationController.java` | `PRINT_TYPES` 加 3 种(派单键;代理版式复用不改) |
| `frontend/src/business/slipPrint.js` | 纯逻辑:kind 口径、二维码生成/解析、载荷拼装(**零 import**,可单测) |
| `frontend/src/business/slipPrintFlow.js` | 编排:取数 → 入队 → 没电脑在线就退回浏览器打印层 |
| `frontend/src/views/mobile/MobileOtherScan.vue` | 提交即打印 + 「补打印」区(扫单据码 / 输单号) |
| `frontend/src/views/mobile/MobilePickDoc.vue` | 生产退料提交即打印 + 抬头「退料单号」旁「补打印」 |
| `frontend/src/business/printStation.js` | 三个类型常量;`qrDataUrl` 导出复用(不复制一份二维码算法) |

**后端为什么必须重编**:`PRINT_TYPES` 是后端硬编码的类型注册表(2026-11-04 口径「类型是派单键」),
不登记的话「自动打印」页勾不到、任务也会被归到默认类型 `PICK_SLIP`。本次已 `rebuild-prod.ps1` 重打包重启。

## 补打印的三条入口

1. 提交成功 → 自动打一次(`queueToPrintStation`,没有电脑在线则浏览器打印层);
2. 手机扫码框扫**纸上的二维码** → 补打印(不用再找单号);
3. 页面底部「补打印」区手输单号 → 补打印;
4. (生产退料)领料单页抬头「退料单号」旁的「补打印」按钮 → 打最近一张退料单。

## 实测

| 项 | 结果 |
|---|---|
| `/api/px/print/station` 类型清单 | 4 种:`PICK_SLIP / OTHER_PICK_SLIP / OTHER_RET_SLIP / MAT_RET_SLIP` |
| `/api/px/slip/rows` | `OO-2026-11-0005`、`TL-2026-11-0007`、`TL-2026-11-0008` 均返回头+行,行键 = 代理要的那套 |
| 入队(无打印电脑) | 返回 `online:false` + 文案「其他领料单没有可用的打印电脑…」⇒ 类型中文名生效 |
| 纸面渲染(真实 `pickSlipHtml`,不调 window.print) | 三张标题/单号/部门/日期/二维码/明细全对(截图见下) |
| 补打印输错单号 | 可读报错「打印失败:OO-NOT-EXIST · 没有找到其他出库单 OO-NOT-EXIST」 |
| 8090 打包版 | 页面与后端接口均生效 |

![其他领料单](round-26-slip.png)
![其他退料单 / 生产退料单](round-27-slips-ret.png)

## 注意(现场要做的两件事)

1. **在「自动打印」页把新类型勾上**:站点配置里的类型清单是**逐台保存**的,老配置只有「生产领料单」;
   不勾新的三种,那三种任务会被判"没有订阅"而退回手机浏览器打印(不会丢单,但不会自动出纸)。
2. **纸面「订单号」列是空的**:这三张单不挂工单,空着比印假工单号好;批号与仓库进「备注」列。

## 复跑

```powershell
ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/start-system-20261110/round-26.mjs')"
# round-26 其他领料:补打印区 + 错误路径 + 纸面渲染
# round-27 其他退料单 / 生产退料单 两张纸面
# round-28 8090 打包版
```

单测 `node --test`:1862 项全 PASS(新增 `slipPrint.test.js` 4 项)。
