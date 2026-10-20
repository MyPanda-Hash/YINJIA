# 金蝶「生产日期」字段核查(采购订单专项)· 2026-10-20

> 用户问题:「查询一下金蝶数据的接口是否有生产日期这个字段,真实账套的采购订单有没有填写这个字段」
>
> 结论:**接口有**(行级 `kf_date`);**真实账套的采购订单一行都没填**(0/267 行抽样)。

## 一、接口层面:有,但在**行级**,而且只在「查」的方向有

| 接口 | 路径 | 生产日期字段 | 依据 |
|---|---|---|---|
| 采购订单**详情**(v2,现役) | `GET /jdy/v2/scm/pur_order_detail` | 行级 `material_entity[].kf_date` = **生产日期** | `tools/archive/_jdy-doc-catalog.json`「采购订单详情」(v2 那份,38275 字节) |
| 采购订单**详情**(v1 老接口) | `POST /jdy/pur/pur_order_detail` | 行级 `kfdate` = 生产日期 | 同目录「采购订单详情」(17535 字节那份) |
| 采购订单**保存/新增** | `POST /jdy/v2/scm/pur_order` | ❌ **没有** kf_date / kf_period / kf_type | 保存接口的 `MaterialEntity` 字段表(只有 `batch_no`/`pro_place`/`pro_license`/`pro_reg_no`) |
| 批次保质期清单(库存口径) | `GET /jdyscm/warranty/list` | `prodDate` = 生产日期 | 该接口响应字段表 |

同族行级键(v2 详情,实测每行都返回):
`kf_date` 生产日期 / `kf_type` 保质期类型(1天 2月 3年) / `kf_period` 保质期 / `batch_no` 批次号 / `valid_date` 有效期至。

⚠ 因为**保存接口没有这个键**,所以「MES 转 ERP → 金蝶采购订单」这条方向写不进生产日期
(`KingdeePushService` 的订单行也确实没推)。

## 二、真实账套:采购订单**没填**(0%)

只读直连真实账套(clientId 359797 / outerInstanceId 580147507460444160),全部 GET:

| 取样 | 单据 | 明细行 | `kf_date` 非空 |
|---|---|---|---|
| 最新 20 张已审核采购订单 | 20 | 51 | **0** |
| 全账套等距抽样(每 18 张取 1,跨 2025-05 ~ 2026-10) | 120 | 267 | **0** |

同批行级键的非空率(120 张 / 267 行):
`batch_no` 0% / `pro_place` 0% / `valid_date` 0% / `pro_license` 0% / `kf_type` 0%;
`kf_period` 100% 但值恒为 `0`(= 未设保质期);`material_is_batch` 100%(= 商品开了批次管理,但订单行不填批号)。

横向对照(每类 30 张已审核单据,同样 0%):

| 单据 | 明细行 | kf_date 非空 |
|---|---|---|
| 采购入库单 | 90 | 0 |
| 销售订单 | 61 | 0 |
| 产品入库单 | 94 | 0 |

⇒ 不是"采购订单这一种单据漏填",而是**整个账套的金蝶单据都不填生产日期**。

## 三、MES 侧现状(为什么界面也看不到)

1. **`bl_pu_order` 物理上没有「生产日期」列**。只有 `保质期到期日` / `有效期至` / `保质期单位类型` / `kf_period`。
2. 同步映射(`deploy/kingdee-extra-fields.mjs`)把 `kf_date` 落到了 **`保质期到期日`** —— 语义错位
   (同一个键在 `SO_ORDER` 上映射的是「生产日期」)。
3. 这 4 个列在面板 `yj_field(PU_ORDER)` 里全是 `visible=0, hidden=1` ⇒ 界面不显示。
4. 现有 4717 行 `bl_pu_order` 里,这些附加列**全部为 NULL**:
   落库人是 `jdy-sync`(至 2026-09-15)与 `试运行`(2026-10-14),写库的是
   `tools/archive/_pull-kingdee-docs-1014.mjs` —— 它只写核心映射列,不跑 `autoExtraLines`;
   对照组 `商品是否开启批次` 也是 100% NULL 即为此证。
5. MES 里带「生产日期」的表只有 3 张:`bl_purchase_in`(971 行,**0** 行有值)、
   `bl_so_order`(496 行,**0**)、`qc_insp_detail`(25 行,**0**)。
6. 面板里登记了「生产日期」字段的:`QC_INSP`(可见)、`PURCHASE_IN`(隐藏)、`SO_ORDER`(隐藏)、
   `BARCODE_WIP`(可见);**`PU_ORDER` 没有这个字段**。

## 四、如果业务要「采购订单上有生产日期」

需要三件事一起做,缺一件就不成立:

1. **金蝶侧先有人填**:采购订单行录入/导入 `生产日期`(或改用批次管理:填批号 + 有效期,生产日期由批次带出);
2. **MES 侧加列 + 加字段**:`bl_pu_order` 加 `生产日期`,并在 `yj_field(PU_ORDER)` 登记(含多语言词条),
   同步映射把 `kf_date` 改映射到「生产日期」(现在映射到「保质期到期日」是错位);
3. **注意推不回去**:金蝶采购订单保存接口无 `kf_date`,MES 手工填的值只能留在 MES,不能随转 ERP 回写。

## 五、复跑方式(全部只读)

```powershell
# ① 金蝶接口 + 真实账套数据(只 GET)
node tools/archive/_kd-po-kfdate-probe-20261020/pull-kfdate.mjs 20          # 最新 20 张
node tools/archive/_kd-po-kfdate-probe-20261020/sample-kfdate-wide.mjs 120  # 全账套等距抽样
node tools/archive/_kd-po-kfdate-probe-20261020/contrast-kfdate.mjs 30      # 其它单据横向对照

# ② MES 库(只读)
java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_kd-po-kfdate-probe-20261020/Probe.java
java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_kd-po-kfdate-probe-20261020/Probe2.java
java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_kd-po-kfdate-probe-20261020/Probe3.java
java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_kd-po-kfdate-probe-20261020/Probe4.java
```

产物:`out-kfdate.txt`、`out-kfdate-wide.txt`、`out-contrast.txt`、`out-probe1~4.txt`。
