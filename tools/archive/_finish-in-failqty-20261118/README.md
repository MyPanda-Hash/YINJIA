# _finish-in-failqty-20261118 —— 产成品入库单:门禁按「是否过程检验」豁免 + 明细「不合格数量」

> 用户口径(2026-11-18):
> 1. 「产成品入库单必须关联「出货检验功能单号」和「出货检验表观单号」后才能提交审批/审核……
>    这个得修改这个,当前物料如果没有选择是否过程检验就不强制这个实现了。」
> 2. 「当前的产成品入库要能填不合格数量在这里」(截图红框 = 产成品入库单明细表格,`实收数量` 右侧)。
> 追问确认:不合格数量 **只记录/展示**,库存与转ERP 仍按「实收数量」,不自动扣减。

## 改了什么

| 层 | 落点 |
|---|---|
| 后端门禁 | `ButtonService.assertFinishInInspLink` 在 MES 自建单判定后调用新方法 `finishInNeedsInsp`;明细商品全部未勾「是否过程检验=是」(或档案查不到该码)⇒ 整条门禁跳过;任一行勾了 = 是 ⇒ 原口径(两单号必填 + 两张都已审核);取数异常/定位不到产品 ⇒ fail-closed 保持门禁。错误话术补「(本单商品「是否过程检验」为是;…)」 |
| 表结构 | `bl_finish_in` **54→55 列**:`[不合格数量] decimal(18,4) NULL` + 列级 `MS_Description`(写明不扣减库存) |
| 元数据 | `yj_field` FINISH_IN/detail/`不合格数量`(小数、**seq 91** 紧跟 实收数量 90、库存数量 92 之前、可编辑、非必填、可见) |
| 多语言 | `yj_translation`(scope=field)补 ja/ko/zh-TW/es/de/fr/ru/vi/th(en `Fail Qty` 原已存在)⇒ 10 语种;前端静态包本来就有「不合格数量」9 语种,无需改前端 |
| 迁移 | `tools/migrate-finish-in-failqty-20261118.sql`(幂等,两账套已执行 `[OK] 6 batches`) |

**没有动**:库存流水(`StockLedgerService.loadRows` FINISH_IN 段只取 `实收数量`)、工单回写
(`ManuWritebackService` 按 实收数量 汇总)、转ERP(`KingdeePushService` 实收数量)、
`v_finish_in_detail` 视图(用户只要求入库单明细可填)。

## 验收证据

### 1) 接口 + 查库(测试账套 HSDZ_MES_TEST)

先在本机新代码实例 8091(`mvn spring-boot:run`,临时)跑通;随后**停 8090 → `mvn -DskipTests package` →
重启**,再用同一脚本对 `http://127.0.0.1:8090` 复跑一遍(现役 jar 已是新 class,`BOOT-INF/lib` 129 条、
`ButtonService.class` 含 `finishInNeedsInsp`),两次结果一致。

夹具:`probe/fixture-setup.sql` 造两张最小草稿 ——
`FI-GATE-QTY-A` 物料 `C-95-43`(是否过程检验=否)、`FI-GATE-QTY-B` 物料 `T410`(验收时临时置=是),
明细各 1 行 `实收数量=4`。

一键复跑:

```bash
bash tools/archive/_finish-in-failqty-20261118/probe/run-verify.sh http://127.0.0.1:8091
```

实跑结果(2026-11-18 22:0x):
- 接口 **7/7 PASS**:登录 / 明细含「不合格数量」/ 紧随「实收数量」/ 可编辑非必填 /
  `不合格数量=2` 保存成功 / 未勾过程检验提交审批 **放行**(code=200) /
  T410 勾了过程检验仍被门禁拦(**409**「产成品入库单必须关联…」)。
- 查库 **8/8 PASS**:`不合格数量=2` 落库、`实收数量` 仍 4、A 提交后 `pending='Y'`、
  B 无 SUBMIT 留痕、T410 开关=是、库存流水未被写。
- 清理:`fixture-cleanup.sql` 后 head/line/status/trail 全 **0**,T410 开关还原 **0**。

### 2) ego 浏览器(5173 源码版 + 8090 打包版,均正式库只读)

正式库草稿 `FI-2026-11-0010`(物料 C-95-43)打开 → 明细表头顺序
`…单价 / 实收数量 / 不合格数量 / 库存数量 / 检验方式…`;点「不合格数量」单元格进入
`el-input-number` 数值编辑器(可录入)。截图:`ego/round-03-panel.png`(表头)、
`ego/round-07-failqty-click.png`(单元格激活)、`ego/round-08-8090.png`(8090 打包版同列)。

### 3) DbNormAudit(两账套)

与改动前**逐字一致**:正式/测试均 `FAIL 3 / WARN 1`(02 表级注明 / 09 缺 en 216 条 / 12 清单 18 处,
均存量);本次新列、新字段未被任何一项点名。

## 文件

| 文件 | 内容 |
|---|---|
| `probe/_Q.java` | 通用 SQL 读写探针(验收脚本调它查库) |
| `probe/fixture-setup.sql` / `fixture-cleanup.sql` | 两张夹具草稿的造/清 + T410 开关置位/还原 |
| `probe/api-check.mjs` | 接口验收(登录/元数据/保存不合格数量/A 放行/B 仍拦) |
| `probe/verify-db.sql` | 查库 8 条 PASS/FAIL |
| `probe/run-verify.sh` | 一键:夹具 → 接口 → 查库 → 清理 |
| `probe/ui-fixture.sql` / `ui-cleanup.sql` | 界面取证用的临时草稿(测试账套,已清理) |
| `ego/round-*.mjs` + `*.png` | ego 浏览器取证脚本与截图 |
