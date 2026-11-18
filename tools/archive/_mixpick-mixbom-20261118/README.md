# 混料领料 / 扫码混料 改用《混料物料清单》(2026-11-18)

> 用户口径(原话):
> 「生成工单领料的时候,关联物料清单生成混料领料单,从根据物料清单领料改为根据混料物料清单生成。
>  扫码混料也是一样,扫工单码查询对应的物料清单,带出需要称重的物料,带入的bom从物料清单改为混料物料清单」

## 一、改了什么

| 链路 | 改前 | 改后 |
|---|---|---|
| 生成工单领料 → **混料领料单** | 半成品的《组装物料清单》`bs_asm_bom`(`WorkOrderBomService.standardOf`) | **《混料物料清单》`bs_mix_bom`**(`MixBomService.of`) |
| 手机扫码 → **扫码混料** | 遗留表 `mate`(面板 WLBOM《物料清单》,正式库 0 行) | **《混料物料清单》`bs_mix_bom`**(`MixBomService.rowsOf`) |

- 新增深模块 `backend/src/main/java/com/yinjia/mes/service/MixBomService.java`:
  定位键 =`产品编号`+`烧结类型`(优先烧结工艺清单,不合并两种烧结的行);
  编码归一 `C-87**TB → C-87`、`A-48-41-tb → A-48-41`;
  单件用量 = `单支含量g` 按存货计量单位换算(kg ⇒ ÷1000)。
- `MixScanService.bomRowsOf` 改为委托 `MixBomService`,行键保持不变(页面/闸门零改动);
  `MobilePickController.generateOne` 的混料分支改读 `MixBomService`(组装分支不变)。
- 契约文档:`docs/development/混料领料-两张单与物料清单口径.md`、`docs/development/扫码混料-20261118.md`。

## 二、验证(ego 浏览器 + 8090 新 jar)

### 2.1 扫码混料(正式库 YJ,只读)

工单 `GD-2026-09-0135 #1`(产品 A-48-41,排产 1005)→ 明细 2 项,取自 `MIX-2026-11-0001`:

| 物料 | 单位 | 单支含量 | 应投 |
|---|---|---|---|
| YJ-KG-C12 阻垢料 | g | 324 | 324 × 1005 = **325620 g** |
| YJ-HKK-007 竹炭活性炭80-200 | kg | 231 g | 0.231 × 1005 = **232.155 kg** |

证据:`ego/round-04-mixdoc-detail.png`、`ego/round-13-final-prod-mixdoc.png`。

### 2.2 生成工单领料(测试库 YJ_TEST)

为 A-48-41 临时补一张混料清单(`fixture-test-mixbom-a48-41.sql`),开单工作台扫 `GD-2026-09-0135`:

| 台账 | 领料类型 | 单号 | 行数 | 来源 |
|---|---|---|---|---|
| 2007 | 组装 | LL-2026-11-0010 | 6 | 组装物料清单 A-48-41_V0001 |
| **2008** | **混料** | **LL-2026-11-0011** | **2** | **混料物料清单 MIX-2026-11-0001** |

混料行(查 `wo_pick_line`,证据 `q10.sql`):

| 物料 | 单位 | 需求 |
|---|---|---|
| YJ-KG-C12 | g | 324 × 1005 = 325620 |
| YJ-HKK-007 | kg | 0.231 × 1005 = 232.155 |

### 2.3 清理

测试库造的数据已全部删除(复核 `pick_docs/links/nos/fixture_rows` 全 0):
`cleanup-test-mixpick-demo.sql`。正式库**未写入任何数据**(扫码混料只读)。

## 三、复现/复核命令(tools 目录)

```powershell
$env:YINJIA_SQL_PASS='Yinjia@2026'
# 混料清单能否被定位 + 单位换算后的应投
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env `
  archive\_mixpick-mixbom-20261118\q05.sql
```

> ⚠ 正式库 `bs_mix_bom` 当前只有 3 行演示数据(2026-11-18)。真实数据要靠「烧结工艺清单 /
> X烧结工艺清单」归档同步;上线前已归档的老单需要管理员跑一次 `POST /api/px/procBom/resync`。
