# 测试库「物料清单 / 半成品混料清单」补齐 + 生成领料单逻辑核查 — 2026-11-18

> 用户口径:「帮我补齐测试库的物料清单,对着未开单的工单补齐。而且检查生成领料单的逻辑。
> 生成混料领料单的时候是否是根据带TB半成品来生成的。」

## 一、结论速览

| 问题 | 结论 |
|---|---|
| 混料领料单是不是按「带 TB 的半成品」生成? | **是**。取工单产品《组装物料清单》里**编码含 `**TB`** 的那一行 → 再去查该半成品**自己的**《组装物料清单》(`bs_asm_bom`,工序=组装)→ 有明细才出单;需求 = 工单排产数量 × 该半成品在成品清单里的单件用量 |
| 为什么以前出不来混料单? | 半成品清单**全库为空**:656 个 `**TB` 半成品里只有 `D-02-03**TB` 一个有清单 |
| 补齐做了什么 | 25 个半成品清单(127 行)+ 成品《物料清单》mate(132 行 / 26 个产品)+ 2 个「连组装清单都没有」的产品的组装清单(12 行) |
| 顺带发现的环境问题 | 两账套都缺 `wo_bom`(2026-11-13 的迁移没跑)⇒ **任何工单点「生成领料/退料单」都 500**(对象名 'dbo.wo_bom' 无效);已按规范在两账套补跑 `migrate-wo-bom-20261113.sql` |

## 二、补齐数据(只进测试库)

脚本:**`tools/seed-test-mix-bom-20261118.sql`**(硬库名闸门 `HSDZ_MES_TEST`,正式库直接 THROW;幂等可重跑)

| 写入 | 数量 | 取数源 |
|---|---|---|
| `bs_asm_bom` 半成品清单 | **25 张 / 127 行**(来源 `测试库演示_混料配方套用_20261118`) | 服务器快照里**仍在用**的 5 份真实混料配方(`rd_mold_proc_detail`),按半成品名称归品类套用 |
| `bs_asm_bom` 产品组装清单 | **2 张 / 12 行**(`D-01-18`、`T042-6`) | 整份复制同品类真实清单(`A-32-06_V0003`、`B-35-05-3_V0001`),只替换第 1 行半成品 |
| `mate` 成品《物料清单》 | **132 行 / 26 个产品** | 与半成品清单同一套配方(扫码混料 `MixScanService.bomOf` 按成品编码取) |
| `bs_inv` 计量单位 | 2 个物料补 `kg` | `KG-AJE-A01`、`Sr-35200` 档案没单位,生单会被拦 |

配方来源(服务器快照 `HSDZ_SRVSNAP` ← `服务器数据库备份\HSDZ_MES_manual_20261111-110118.bak`):

| 代号 | 来源产品 | 配方行 |
|---|---|---|
| R0 | `D-02-03**TB`(唯一有真实清单的半成品) | 依品晟椰壳炭 / 破碎料2# / M2-D胶粉 / BHP-12 |
| R1 | `A-48-41-tb` PP复合阻垢炭棒 | 鑫恒80-250 / 依品晟250-400 / 破碎料2# / M2-D胶粉 / 4012T1 / HP-12 |
| R2 | `A-48-43-tb` A级烧结炭棒/滤芯 | 鑫恒酸洗80-250 / M2-D胶粉 / M3-D胶粉 |
| R3 | `A-54-08` 阻垢炭棒滤芯 | 鑫恒酸洗80-250 / 依品晟250-400 / M2-D胶粉 / 4012T1 / ANGEL-阻垢 |
| R4 | `A-54-11` A+级阻垢炭棒/滤芯 | 鑫恒酸洗 / 依品晟 / 自制载银炭粉 / 抑菌陶瓷粉 / M4-D胶粉 / HP-08 |
| R5 | `A-54-12-tb` A+级烧结炭棒滤芯 | 英克瑞斯椰壳炭 / 依品晟 / M2-D胶粉 / M4-D胶粉 / 富锶A-1 |

⚠ **是演示数据,不是真实工艺**:配方「单支物料含量」按服务器配方原值(g)取,落到清单按物料计量单位换算
(kg ⇒ /1000,HP-08 本身是 g ⇒ 原值);每行 `行备注`/`bz` 都写了「测试库演示:套用「<源配方产品>」」,
便于日后一眼分辨、也便于按 `来源` / `bz` 精确删除。

## 三、核查「生成领料单」的逻辑(实测 + 读码)

### 3.1 两条生成入口行为不同(重要)

| 入口 | 落什么 | 有没有明细 | 有没有混料单 |
|---|---|---|---|
| 生产工单列表「转领料单」(`WorkOrderPickingService.toPicking`) | `bd_material_out` 草稿 | **空明细**(源码注释:自建 BOM 下架后无可用材料来源,材料由仓库补) | 无 |
| 手机扫码/开单工作台「生成领料/退料单」(`MobilePickController.generateOne`) | `wo_pick_doc` 台账 + `wo_pick_line` 领料明细(材料出库单等提交才建) | 有,按 BOM 展开 | **有**,按 `**TB` 半成品清单 |

⇒ 现场要出「组装+混料两张单」,必须走**手机扫码/开单工作台**,点工单列表那个按钮只会得到空明细出库单。

### 3.2 混料单的生成链路(源码位置)

`MobilePickController.generateOne` → `bomService.ofRow()`(临时工单 `wo_bom` 优先 → 产品标准 BOM `bs_asm_bom`)→
在组装清单里找 `isSemiFinished(编码)`(`MobilePickController.SEMI_MARK = "**TB"`,只认双星)→
`bomService.standardOf(半成品编码)` → `createPickDoc(..., KIND_MIX, base = 排产数量 × 半成品单件用量)`。

实测(`GD-2026-11-0010` 第 3 行,A-48-16,排产 1000):

```
领料类型=组装  单号=LL-2026-11-0029  BOM=A-48-16_V0003      物料项数=2   ← 半成品行只显示不领,不计入项数
领料类型=混料  单号=LL-2026-11-0030  BOM=A-48-16**TB_V0001  物料项数=5   ← 按半成品自己的清单
混料明细:英克瑞斯椰壳炭 0.0304 × 1000 = 30.4 kg / 依品晟 7.5 / M2-D 21.2 / M4-D 7.1 / 富锶 9
```

(验证后已把这两张试验单连同明细删掉,工单恢复「未开单」;响应 JSON 留在本目录 `api-generate.json`)

### 3.3 发现的问题 / 风险(按严重度)

1. **🔴 两账套都缺 `wo_bom` ⇒ 生成领料单一律 500**。`WorkOrderBomService.tempOfRow` 直接查 `dbo.wo_bom`,
   没做存在性守卫;2026-11-13 的 `migrate-wo-bom-20261113.sql`(和 `migrate-wo-draft-20261113.sql`)
   **从未在两账套执行过**(`yj_schema_log` 无记录)。已按两账套纪律补跑 `migrate-wo-bom-20261113.sql`
   (正式库 + 测试库各 `[OK] 8 batches`),补后实测 200。`wo_draft_*`(草稿箱)同样缺,建议一并补跑。
2. **混料单失败被吞**:`generateOne` 里 `catch (RuntimeException)` 只 `log.warn`,接口仍返回成功、
   `单据` 数组里没有混料单 —— 现场只看到"少一张单",不知为何。建议返回 `警告` 字段。
3. **`**TB` 判定只认双星是对的**:实测 `YJ-TB-004..013`、`YJ-TBRW-001` 是密封圈/防伪标等**要正常领的料**,
   按裸 `TB` 匹配会把它们吞掉;但反过来,研发「烧结工艺清单」里的半成品编号写作 `A-54-12-tb`(小写连字符),
   两套编码习惯并存,别把 `-tb` 也当半成品。
4. **只取第一个半成品**(`break`):一个产品 BOM 若真有两个不同半成品,只出第一张混料单。
   实测当前数据里**没有**单张单据含 2 个不同半成品(显示"2 行"的都是同产品两个版本),暂不触发。
5. **两处清单要各维护一份**:扫码混料读 `mate`(键=**成品**编码),混料领料读 `bs_asm_bom`(键=**半成品**编码)。
   同一套配方要写两处,天然容易分叉 —— 这次脚本就是从一份配方同时写两表。
6. **7 个物料测试库无库存**(`YJ-YKRS-001`/`YJ-YPS-001`/`YJ-ZX-001`/`PS-2`/`Sr-35200`/`AGC-80250`/`KG-AJE-A01`):
   生单预填仓库为空(`defaultWarehouseOf` 只取有库存的仓),扫码时现场必须选仓,否则提交过账会因仓库为空失败。
   要跑通完整"领料→提交→仓管审批"还需给这些物料做期初/入库。

## 四、复跑命令(tools 目录)

```powershell
$env:YINJIA_SQL_PASS='Yinjia@2026'
# 补齐数据(只在测试库;脚本有硬闸门)
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env seed-test-mix-bom-20261118.sql

# 体检:未开单工单 × 半成品清单 × 能否出两张单
java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env `
  archive\_mix-pick-bom-test-20261118\15-projection.sql

# 服务器快照取证(用完可 DROP DATABASE HSDZ_SRVSNAP)
powershell -ExecutionPolicy Bypass -File archive\_mix-pick-bom-test-20261118\restore-srv-snap.ps1
```

## 五、本目录文件

| 文件 | 内容 |
|---|---|
| `01-state.sql` ~ `07-counts.sql` | 现状体检:未开单口径、BOM 形状、半成品分布、缺清单工单 |
| `restore-srv-snap.ps1` / `_snap-*.sql` / `recipes-server.txt` / `recipes-dedup.txt` | 服务器快照还原与真实配方取证 |
| `09-template.sql` ~ `16-tpl3.sql` | 组装清单模板挑选(半成品行位置、行数) |
| `14-verify.sql` ~ `17-reverify.sql` | 补齐后的核对(25 张半成品清单 / 132 行 mate) |
| `15-projection.sql` | **按代码同口径预演**:28 张未开单工单哪些能出两张单 |
| `18-wobom.sql` ~ `20-log.sql` | `wo_bom` 缺失与 `yj_schema_log` 取证 |
| `api-login.json` / `api-generate.json` / `21-lines.sql` | 真实接口实测:两张单 + 明细需求数量 |
| `api-mixbom.json` | 真实接口实测:`GET /api/px/mix/bom?productCode=A-48-16` 从 `mate` 带出 5 行混料用料(扫码混料那条链) |
| `22-cleanup.sql` | 删掉试验单、恢复未开单 |
| `23-stock.sql` | 配方物料在测试库的库存/仓库预填情况 |
