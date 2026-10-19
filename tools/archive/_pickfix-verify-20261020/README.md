# 扫码领料「一工单只能领一次料」修复的核验(2026-10-20)

> 用户报障口径:**「部署到服务器后仍然无法领料」**;要求核对远程提交里这条修复是否正确。
>
> 结论先给:**修复本身是对的,而且服务器上两层(jar + 库)都已经生效**;
> 但这条修复**只解掉"一工单只能领一次料"这一种撞键**,还有两种撞键会留着(见 §五),
> 现场"仍然无法领料"要么是那两种之一,要么已经不是数据库撞键(小程序账号/取数口径)。
> 定位需要**现在的报错原文**(见 §六)。

## 一、被核验的修复

| 项 | 内容 |
|---|---|
| 提交 | `99f3b3cc fix: 库存流水唯一键放细到(单据行×物料×批号),一工单多物料不再撞键`(origin/main 上) |
| 迁移 | `tools/migrate-stock-flow-src-rid-grain-20261020.sql`(幂等;两账套已执行) |
| 文档 | `docs/development/库存流水身份-单据行×物料×批号.md` |
| 代码 | `StockFlowService.post / revive` 的定位键由 `(src,rid)` 改为 `(src,rid,物料编码)` |
| 现场报错 | `2601 不能在具有唯一索引"UX_outh_src_rid"的对象"dbo.outh"中插入重复键的行。重复键值为 (6, 1711)` |

⚠ 与另一件事区分开:`df26118c feat: 条码管理加扫码领料` 是 MES 里的**手机 H5 页面**(`/scm/scanPick`),
不是用户说的那个**直连库写 `outh` 的小程序**。两者的修复没有关系。

## 二、两账套的库层核验(`_q1-indexes.sql`,两库输出一致)

| 对象 | 键列 | 结论 |
|---|---|---|
| `UX_outh_src_rid` | `src,rid,物料编码,批号`(过滤 `rid IS NOT NULL`) | `[PASS]` |
| `UX_inh_src_rid` | 同上 | `[PASS]` |
| `PK_inv_cost_ledger` | `src,rid,存货编码,批号`(NONCLUSTERED) | `[PASS]` |
| `v_stock_ledger` / `v_stock_balance` | JOIN 已补 `存货编码 + 批号` | `[PASS]` |
| `yj_schema_log` | `migrate-stock-flow-src-rid-grain-20261020.sql` 已登记(HSDZ_MES 2026-10-19 15:10 UTC) | `[PASS]` |

`outh` / `inh` 上除了 PK 与这条唯一索引,**没有别的唯一约束、没有触发器**(`_q2-blockers.sql`),
所以"多物料"不会再撞到第二道门。

## 三、插入行为探针(`_q6-insert-probe.sql`,测试账套,事务内插入→统一 ROLLBACK,零残留)

| # | 场景 | 结果 |
|---|---|---|
| 1 | 第 1 件物料(物料A/批号B1) | `[PASS]` 插入成功 |
| 2 | **同一工单第 2 件物料(物料B/批号B1)= 用户报障场景** | `[PASS]` 插入成功,不再撞键 |
| 3 | 同物料同批号重复写入 | `[PASS]` 仍被 2601 拦下(防重复扣账保险还在) |
| 4 | 同物料两个批号(B2/B3)各一行 | `[PASS]` 两行并存(一批一码) |
| 5 | 物料编码留空(NULL)两行 | `[BLOCKED]` 仍撞键 ⇒ 小程序**必须写 `物料编码`** |
| 6 | 物料编码空串两行 | `[BLOCKED]` 同上 |

现有数据里 `物料编码` 为空的行 = **0**(`_q12-outh-rids.sql`),所以第 5/6 条只是理论风险。

## 四、服务器部署核验(两个层面都到位)

| 层面 | 证据 | 结论 |
|---|---|---|
| jar | 服务器首页入口 `assets/index-DyZuO8e1.js` **只**匹配 `deploy/pkg-full-20261019/app.jar`(18b/18c=`DbTpL8RT`、18d=`CzoFkXQv`) | 跑的是 23:51 那个包含本修复的包 |
| jar(功能面) | `/api/sys/backup/overview` 200(该接口是本包新增) | 同上 |
| 库 | 服务器 `v_stock_balance` 行数 876 / `v_stock_ledger` 5017 / `v_stock_pick` 571 / `v_stock_detail` 697,与本地**逐个相等**;末行 `id=876 CK00001 TEST-MAT-A -30` 与本地逐字一致,而这条 `TEST-MAT-A` 的 `kucun` 是**本地 2026-10-19 23:02:55 才写的**(`_q19`) | 服务器库就是本包 `HSDZ_MES.bak` 的还原(该 .bak 与容器内 `HSDZ_MES-pkg-20261019.bak` SHA256 完全一致,取样时间晚于迁移 41 分钟)⇒ **4 键索引在服务器上已经生效** |

配套核对:`deploy/pkg-full-20261019/HSDZ_MES.bak` 的 SHA256 =
`b96b7c7e…55ac4a` = 容器内 `HSDZ_MES-pkg-20261019.bak`(2026-10-19 15:51 UTC)。

## 五、这条修复**没有**解掉的两种撞键(残留缺口)

1. **`rid` 号段与 MES 单据行 id 共用,会撞号。**
   实测 `(src=6, rid=1711)` **早就有一行**:`SCLL-20260908-00004 / YJ-XWR-021 / 批号 NULL`(`_q20-rid1711.sql`)。
   小程序按「工单/工单行 id」写 `rid`,`bl_material_out.id` 也是同一段整数 ⇒ 同一 (src,rid,物料编码,批号)
   两边都写时仍 2601。更麻烦的是 MES 审核时的存在性判断按 `(src,rid,物料编码)` 查:
   - 撞上别人写的行 ⇒ 误判"已记过"而**跳过记流水**(结存≠Σ流水);
   - 弃审/重审 ⇒ `revive` 的 UPDATE 没有批号条件,同 (src,rid,物料) 多批号时会把多行一起改成同一批号 ⇒ 再撞 2601。
2. **同一工单、同一物料、同一批号扫第二次**仍然 2601(设计如此:防重复扣账)。
   现场"扫第二件没扫成"如果其实是同一物料的两张标签,就会表现成"还是不能领"。

## 六、请现场配合的一步(1 分钟)

服务器上跑(只读):

```bat
sqlcmd -S localhost -E -d HSDZ_MES -Q "SET NOCOUNT ON; SELECT i.name, STUFF((SELECT ','+c.name FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0 ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,'') AS cols FROM sys.indexes i WHERE i.object_id=OBJECT_ID('dbo.outh') AND i.name='UX_outh_src_rid'"
```

期望 `src,rid,物料编码,批号`。仍是 `src,rid` ⇒ 库那一半没生效(那就只跑迁移脚本,别整库还原)。

## 七、复跑

```powershell
cd D:\workspace\yinjia\tools
$java = "$env:JAVA_HOME\bin\java"
$env:YINJIA_SQL_PASS = '<本机 SQL 口令>'
& $java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java `
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" `
  yinjia env archive\_pickfix-verify-20261020\_q6-insert-probe.sql
```

- `_q6` 插入探针(自带 ROLLBACK,不会留数据);
- `_probe-scanpick-save.py`:顺带验了手机 H5「扫码领料」的**保存建单**(`df26118c` 的提交说明写明"保存建单未实测")。
  实测测试账套返回 `200`,`LL-2026-10-0001` 草稿两行建单成功,随后已 `deleteForms` 删除。
  ⇒ **H5 那条路是通的**;只是 `业务类型` 写的是 `生产领料`,而面板下拉只有「销售出库/材料出库/其他出库」,
  保存不校验所以能存进去,但会存成一个下拉里选不到的值(建议另修)。

---

## 八、临时解封(2026-10-20 用户口径「20 条左右即可」)

**症状**:小程序按 `plang.id` 写 `rid`,而 MES 历史流水也用 `bl_material_out.id` 当 `rid`,两段号同在 1~4655
⇒ `plang` 466 张工单行里 **462 张的 rid 已被历史流水占着**(`_q26`)。唯一键放宽到 4 键后,
"同一 rid 写第二件物料"不再撞,但**"这个 rid 上已经有同 (物料,批号) 的行"仍撞**——GD-2026-10-0223 行1
(rid=1168)就被 `SCLL-20260919-00013` 的 `YJ-JPL-54/JPL-20260910` 占着(`_q23`、`_q25`)。

**做法**:`tools/migrate-free-pick-rid-20261020.sql` —— 把最近 N(=20)张工单行上挡路的流水
`rid += 900000000`,行/数量/金额/单据编号都不动;`inv_cost_ledger.rid` 同步搬(两个视图按
`src+rid+存货+批号` JOIN 成本表,必须一起搬)。**一行都不删。**

**为什么不删**(`_q29` 实测):删 `(6,1168)` 会让 `YJ-JPL-54` 在 `YCL-01` 的结存凭空 +4、成本台账留孤儿;
按"rid > 200 全清"更是 2923 行 / 824 张单 / 711 个现存量键。删除 = 伪造库存。

**核对结果(本机两账套已执行)**:

| 项 | 搬运前 | 搬运后 |
|---|---|---|
| `v_stock_ledger` 行数 | 5017 | 5017 |
| 收入合计 | 3,239,383.80 | 3,239,383.80 |
| 发出合计 | 3,583,794.626 | 3,583,794.626 |
| `v_stock_balance` 现存量合计 | −344,410.826 | −344,410.826 |
| `outh` 行数 | 3318 | 3318 |
| rid 1149~1168 上的占位行 | 20 | **0** |
| 复测(往小号 rid 插一行) | BLOCKED | **PASS** |

**代价**:被搬过的历史单据(`SCLL-20260919-00013/00014`、`SCLL-20260920-00001`)**不要再弃审/重审** ——
弃审按 `(src,rid,物料)` 找不到搬走的行,重审会再插一行 = 双倍扣账。回退:同脚本 `@offset = -900000000`。

**根治仍是**:小程序 `rid = plang.id + 900000000`(方案 A),或扫码领料独立段号 `src=13`(方案 B)。
