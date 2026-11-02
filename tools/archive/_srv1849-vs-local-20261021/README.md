# 服务器备份 `HSDZ_MES-manual-20261021-184953.bak` vs 本地 `HSDZ_MES` 差异取证

> 取证日期:2026-10-21(本地比对时刻约 19:00~19:30)
> 取证对象:`db/HSDZ_MES-manual-20261021-184953.bak`(18,918,400 字节)
> 备份头:`ServerName=ECS-38508784`、`DatabaseName=HSDZ_MES`、`UserName=ECS-38508784\Administrator`、
> 备份时间 **2026-10-21 18:49:53 ~ 18:49:54**、备份内数据文件 125,935,616 字节、
> `DatabaseCreationDate=2026-10-20 23:56:37`、兼容级别 100、排序规则 `Chinese_PRC_CI_AS`
> 对照库:本地 `HSDZ_MES`(正式账)
> 方式:把备份**还原到临时库** `HSDZ_MES_SRV1849`(容器内 `/var/opt/mssql/data/_cmp1849.bak`)，
> 再以 `sa` 只读比对，**全程未改动 `HSDZ_MES` / `HSDZ_MES_TEST`**。

---

## 0. 一句话结论

| 维度 | 结论 |
|---|---|
| **备份身份** | 这是**服务器**(`ECS-38508784`)的手工完整备份，不是本地备份；备份时刻 18:49，库内最后一条访问日志 18:47:16 —— 即"打备份前 2 分钟现场还在用"。 |
| **结构** | 几乎一致:视图 111 / 存储过程 31 / 触发器 2 / 索引 362 / 主键唯一键 253 / CHECK 1 **定义哈希全部相同**。列级差异只有 **3 张表**(`wo_mixing_list`、`rd_mold_formula_detail`、`bs_qc_plan`)+ `mate.m_no` 宽度。 |
| **元数据** | `yj_panel` 只差 1 格、`yj_field` 差 1 行 1 格、`yj_translation` 差 1 行；但 **`yj_role` 服务器多 7 个角色、`yj_role_panel` 服务器多 393 条**，且本地把「仓库管理」放开了 29 张面板 + 15 张面板的审核/字段/预警权。 |
| **数据** | 243 张共有表里 **77 张有差异**，总行数 服务器 **173,549** / 本地 **172,902**；服务器独有 8,905 行、本地独有 8,258 行。 |
| **差异性质** | **不是"谁落后"，是两边各走一条路**:服务器 = 10-21 全天真实业务(销售/采购/生产/检验/研发/设备)；本地 = 10-20 17:00 之后本地的**功能迁移 + 造数/改数**(来料检验链整体重建、组装检验明细改版、权限放开)。 |

---

## 1. 取证方式(可复跑)

| # | 工具 | 干什么 |
|---|---|---|
| ① | `_srv1021-vs-local-20261021/_RestoreBak.java` | 读备份头/文件清单，还原成临时库(目标库名有硬闸门，拒绝 `HSDZ_MES`/`HSDZ_MES_TEST`) |
| ② | 同上 `_StructDiff.java` | 全属性结构指纹双向求差(列·默认·索引·键·CHECK·触发器·视图·过程·`MS_Description`)，`--skip-bak` 忽略 `_bak_` 快照表 |
| ③ | 同上 `_DataDiff.java --only-diff` | 逐表行数 + 行级双向 `EXCEPT`(全列转 nvarchar) |
| ④ | **本次新增** `_DocDiff.java` | 按「单据编号/单号/工单号」双向求差 —— 直接给出"哪张单只在服务器 / 只在本地" |
| ⑤ | 同上 `_RowDiff.java` | 单表行级下钻(多重集口径，按业务键) |
| ⑥ | 同上 `_Q.java` | 定点取证查询 |

中间产物:`raw-01-struct-diff.txt`、`raw-02-data-diff.txt`、`raw-03-rowdiff-*.txt`、`raw-04-doc-diff.txt`、`raw-05-rowdiff-*.txt`、`raw-06-rowdiff-*.txt`。

---

## 2. 结构差异(全部就这些)

### 2.1 对象计数

| 指标 | 服务器 | 本地 | 说明 |
|---|---|---|---|
| 真实表 | 243 | 243 | 服务器另有 5 张 `_bak_pc0000_*` 遗留快照(本地已按 `migrate-drop-bak-snapshots-20261021.sql` 删除)；本地另有 33 张今天新建的 `_bak_*` 快照(1,037 行) |
| 视图 / 存储过程 / 触发器 | 111 / 31 / 2 | 111 / 31 / 2 | 定义哈希逐条相同 |
| 索引 / 主键唯一键 / CHECK | 362 / 253 / 1 | 362 / 253 / 1 | 全部同名同定义 |
| 扩展属性(含中文注明) | 10,155 | 10,153 | 差异只跟随下面 3 张表 |

### 2.2 列级差异(只有 3 张表 + 1 列宽度)

| 表 | 服务器 | 本地 | 判读 |
|---|---|---|---|
| `wo_mixing_list`(混料清单) | 16 列:`asp_user1..4`/`asp_time1..4`/`asp_print`,且有 8 行真实配料 | 13 列(缺 `asp_user3`/`asp_time3`/`asp_print`),1 行脏数据(`单据编号=1`) | 服务器 08:04 被**旧 ASP 脚本重建**，仍是"另一套口径" |
| `rd_mold_formula_detail`(成型配方行) | `单支物料含量/实际添加比例/设计添加量` = `float` + 默认 0 | 同 3 列 = `nvarchar(50)` 无默认 | 本地口径与仓库迁移 `migrate-rd-prod-sheets.sql` 一致；服务器是旧 ASP 数值型 |
| `bs_qc_plan`(检验标准库) | 无 `适用单据` 列(2 行) | 有 `适用单据 nvarchar(200)`(6 行) | 本地 10-21 新功能(按单据分套) |
| `mate.m_no` | `nvarchar(30)` | `nvarchar(14)` | 遗留表宽度不同，两侧都非当前写入源 |

---

## 3. 元数据与权限差异

### 3.1 面板引擎(几乎一致)

| 表 | 服务器 | 本地 | 差异 |
|---|---|---|---|
| `yj_panel` | 143 | 143 | 1 格:`WO_COMPLETION_LIST.date_col` 本地 = `wgsj`(完工排序迁移) |
| `yj_field` | 4,466 | 4,467 | ① 本地多 1 行 `QC_PLAN.适用单据`(id 18511)；② `ROUTE`(id 266)的「生产车间」下拉 `dict_sql` 本地已换成从 `bs_prod_line`/`bs_route` 动态取 |
| `yj_translation` | 6,828 | 6,829 | 本地多 1 条(对应新字段) |
| `yj_schema_log` | 652 | 657 | 本地多 5 支迁移(见 §3.3) |

### 3.2 🔴 角色与权限(差异最大的元数据)

- **`yj_role`:服务器 19 个 / 本地 12 个** —— 服务器在界面上新建了 7 个管理角色:
  `1042 总经理、1043 仓库审核、1044 采购管理、1045 销售管理、1046 生产管理、1047 品质管理、1048 品质审核`。
- **`yj_user`:服务器 26 / 本地 25** —— 服务器多 `id=43 zjl(冯总, 总经理)`；另 `id=6 cp` 的手机号/MobId 只有服务器是新的。
- **`yj_role_panel`:服务器 1,155 / 本地 762** —— 561 条是上面 7 个角色的授权；
  另有 **30 条本地独有** 与 **15 条同键但权限不同**，全部落在「仓库管理(1031)」和「销售(1029)」:

| 角色 | 本地比服务器多的授权 |
|---|---|
| 仓库管理(1031) | **+29 张面板**:`CGD / KHDD / SO_ORDER / PU_ORDER(_DETAIL/_STATS) / QC_INSP(_REC/_REQ/_REQ_SERIES) / QC_FIRST_INSP / QC_PROC_INSP / QC_ASM_INSP / QC_CATALOG / QC_BHC/BHG/BHZ/SCP/SCY/JJF/LYB/TC_IN / STOCK_* / DC_CONFIG/DC_MONITOR/DC_STATS / PROJECT_FLOW / BARCODE_SCAN_PICK / SALES_ORDER_DETAIL/STATS` |
| 仓库管理(1031) | **15 张面板从"只读+增删改"放开到 `can_approve=Y` + 全权限**(`audit,field,warn`):`OTHER_IN_STATS / TRANSFER_STATS / TRANSFER_DETAIL / STOCK_PICK / STOCK_STATUS / STOCK_BALANCE / STOCK_LEDGER / STOCKTAKE(_DETAIL) / SALE_OUT_DETAIL / FINISH_IN_DETAIL / MATERIAL_OUT_DETAIL/_STATS / BARCODE_WIP / QC_RECV` |
| 销售(1029) | +1 张 `BARCODE_SCAN_PICK` |

> 这一块是**纯权限数据**，没有迁移脚本记录。全量部署会用本地这套覆盖服务器 ⇒ 仓库管理从"收紧"变"全放开"，且 7 个管理角色连同授权全部消失。

### 3.3 迁移登记(本地多 5 支，服务器没有)

`migrate-drop-bak-snapshots-20261021.sql`、`migrate-kucun-recalc-today-20261021.sql`、
`migrate-qc-plan-applicable-doc-20261021.sql`、`migrate-route-workshop-options-20261021.sql`、
`migrate-wo-completion-sort-20261021.sql`。
另 `migrate-kucun-recalc-to-now-20261016.sql` 本地今天 08:00 重跑过一次(服务器仍是 10-16 的原时间)。

---

## 4. 数据差异(243 张共有表,77 张有差异)

### 4.1 服务器独有 —— 10-21 全天的真实业务

| 模块 | 表 | rows 服/本 | 具体单据 |
|---|---|---|---|
| 销售 | `bd_so_order` / `bl_so_order` | 296/290、558/551 | 新增 6 单:`ZL-20261021-01`、`ZXL-20261020-01/03/04`、`ZXL-20261021-01/02` |
| 采购 | `bd_purchase_in` / `bl_purchase_in` | 324/322、861/858 | `PI-2026-10-0024`(admin 11:41)、`PI-2026-10-0025`(Admin 14:45) |
| 标签 | `bd_pu_label` / `bl_pu_label` | 16/13、16/13 | `MQ-2026-10-0014/0015/0016` |
| 送料暂收 | `sl_recv` / `sl_recv_detail` | 308/307、513/512 | `SL-2026-10-0136` |
| 首件检验 | `qc_first_insp_head` | 491/425 | **服务器多 66 张** = 本地 03:04 清掉的 63 张空壳草稿(`SJ-2026-10-0001~0064` 中的 63 个号)+ 今天新开的 `SJ-0168/0169/0170`；合计 270 行明细，仅 12 张有状态行 |
| 制程检验 | `qc_proc_insp_head` | 452/434 | 服务器多 18 张(`ZC-2026-10-0004/0006/0007/0008~0011/0013~0015/0020/0022/0024/0027/0028/0132/0133/0134`) |
| 组装成品检验 | `qc_asm_insp_head` | 436/435 | `ZJ-2026-10-0141` |
| 研发 | `rd_insp_plan_head` | 9/8 | `IP-2026-10-0013`(fengmin 08:30) |
| 研发 | `rd_approval` | 9/7 | `LXA-2026-10-0013`(xieqin 10:35)、`LXA-2026-10-0014`(admin 10:55) |
| 设备 | `equip_check(_detail)` | 3/1、2/0 | `DJ-2026-10-0002`(16:20)、`DJ-2026-10-0003`(16:23) |
| 设备 | `maint_plan(_detail)` | 2/1、1/0 | `BY-2026-10-0002`(16:25) |
| 设备 | `rd_equip_use_head/_detail`、`rd_instr_use_head`、`rd_spike_water_head/_detail` | 服务器独有 2/1/1/3/2 行 | `EU-*`、`IU-2026-10-0001`、`SW-2026-10-0001` 等 |
| 生产 | `wo_process_line` | 66/53 | 服务器多 5 个工单:`GD-2026-10-0198`(09:14)、`0225`(15:20)、`0226`(15:46)、`0227`(16:04)、`0228`(18:14) |
| 生产 | `plang` / `plang_pc` / `scjl` | 473/468、435/430、1288/1283 | 同上的排产行 13 行、排产明细 5 行、报工 6 行 |
| 打印 | `yj_barcode_label_log` | 70/20 | 服务器多 53 条(含 `PI-2026-10-0009~0016`、`CGRK-20261012~14-*`) |
| 号池 | `s_allno` | 4,765/4,776 | 服务器新发 38 个号:`BY/DJ/EU/GD/IP/IU/LL/LXA/MQ/PL/RK/SJ/SL/SW/ZC/ZJ` 各若干(`GD-2026-10-0225~0228`、`SJ-2026-10-0168~0170`、`ZC-2026-10-0132~0134`…) |

### 4.2 🔴 本地独有 —— 今天的"造数/改数"，服务器上没有

| 对象 | 本地状态 | 证据 |
|---|---|---|
| **来料检验链整体重建** | `qc_insp` **12 张**(`IJ-2026-10-0205~0216`)、明细 16 行、`qc_catalog` **`JYML-2026-10-0001`** + 明细 16 行、`qc_insp_rec` **16 张**(`JYSJ-2026-10-0090~0105`)+ 明细 73 行、`qc_return` **5 张**(`TH-2026-10-0003/0006/0009/0012/0014`)+ 明细 5 行 | `tools/archive/_qc-cleanup-probe-20261021/README.md`(17:00~18:04 一次性重建，来源=12 张送料暂收单，5 行不合格→退料)；服务器仍是旧的 17 张 `IJ-2026-09/10-*`、`JYML-2026-09-0001`、38 张 `JYSJ`、7 张 `TH` |
| **检验标准库补数据** | `bs_qc_item` **+18 条**(`ASM-*` / `FIRST-*` / `PROC-*`)、`bs_qc_plan` **+4 套方案**(`QP-ASM-00/01`、`QP-FIRST-01`、`QP-PROC-01`)、`+适用单据` 列 | 09:47:40 由迁移写入(`asp_user1='migration'`)，服务器完全没有 |
| **组装成品检验明细改版** | `qc_asm_insp_detail` 1,342 行(未作废 1,022) vs 服务器 862 行(未作废 782) | 10:20:47 把约 120 张单的「目数」行软删(240 行)并按标准库新增 4 行(外观/尺寸/重量/性能)，见 `tools/archive/_qc-asm-detail-diff-20261021/` |
| **权限放开** | §3.2 | 无迁移记录 |
| 金蝶导入留痕 | `erp_imp_log` 9 行 + `erp_imp_row` 45 行(10-18 商品/仓库/客户/采购/销售订单导入) | 服务器这两张表是 0 行 |
| 本地号池 | 49 个号:`IJ` 12、`JYSJ` 17、`TH` 12、`MP` 3、`JYML` 1、`PI-2026-10-0026` 1 | 检验链重建 + 研发模板单 |
| 研发模板单 | `rd_mold_proc_head` 多 `MP-2026-10-0005/0009/0010/0011` 4 张 | 本地新建 |
| 库存流水 | `inv_cost_ledger` 本地多 1 行(收入 +303.5) | 与 §4.4 那 1 行 `kucun` 同源 |
| 数据采集 | `bs_dc_sample` 本地多 2 行(id 91/92)+ 1 行值 0.39→0.04 | 测试数据 |

### 4.3 双边各有状态更新(Sales 执行/关闭状态 = 服务器新)

`bd_so_order` 有 **12 行同单不同值**，方向都是"服务器已执行、本地还没执行":

| 单据 | 服务器 | 本地 |
|---|---|---|
| `LZW-20260929-03` | 出入库 `C` / 关闭 `S` / 已执行 2,750 | `Z` / `C` / 550 |
| `ZL-20260928-02` | `C` / `S` / 10,946 | `A` / `C` / 0 |
| `LZW-20261012-01` | `Z` / 已执行 1,425 | `A` / 0 |
| `ZL-20261020-02`、`ZXL-20261017-03`、`ZL-20261013-06/07`、`ZL-20261012-01`、`LZW-20261013-03`、`ZL-20260921-05` 等 | 已执行金额/出入库状态/关闭状态均为服务器新 | 本地仍是旧值(9 行「应收款余额」随之差几千~几万) |
| `ZL-20261013-06` | 审核人 王光珍 / 10-17 08:51 | 冯加劲 / 10-15 17:00 |

> 即:**10-21 的金蝶销售出库回写只落在服务器**(`yj_doc_status` 3 行 `erp_close_state=S`，本地为空)。

### 4.4 只差时间戳/指纹的(业务值不变)

| 表 | rows | 差异列 |
|---|---|---|
| `kucun` | 1,480 / 1,480 | 1,480 行只差 `update_date`/`asp_time2`(服务器 17:57:42 重算 / 本地 08:46:01);**真正的值差只有 1 行**:`YJ-ZZ-001 / YCL-01 / ZZ-20261020` 本地 `rkl=yl=303.5`、服务器 0/0 |
| `inv_cost_ledger` | 5,017 / 5,018 | 全部行差「重算时间」;发出数量合计两侧完全一致 3,583,794.626，收入数量本地多 303.5(即上面多出的 1 行) |
| `bs_inv` | 3,903 / 3,899 | 70 行只差「外部指纹」末段日期(`CF2026-10-21` vs `CF2026-10-20`);2 行价格(服务器 `YJ-KG-JC-B03` 采购价/含税价 0.055、`YJ-QJXCL-001` 入库成本 9.5，本地 0);1 行图片/附件链接签名 |
| `qc_first_insp_detail` | 38,439 / 38,169 | 90 行 `asp_user2=admin / 10-21 10:23`(本地编辑 `SJ-2026-10-0167`)+ 270 行属 §4.1 新增单 |
| `yj_usage_log` | 8,579 / 8,595 | 两侧各自的活动日志(服务器最后一条 18:47) |
| `yj_message` | 3,793 / 3,795 | 站内消息各自增减 |
| `form_flow_link` | 1,372 / 1,153 | 服务器多 240 行：旧检验链 `IJ-2026-09-*`/`JYSJ`/`TH` 的流转 + 今天新单;本地多 21 行：重建链 + `MP-*` |
| `yj_doc_status` | 5,780 / 5,691 | 服务器独有 131 张单的状态行、本地独有 42 张(见 §4.1/§4.2 的单据集合) |
| `yj_form_approval` | 5,098 / 5,101 | 服务器独有 21 张单的审批留痕、本地独有 38 张(重建链的 AUDIT/APPROVE 留痕) |
| `dm_langue`、`yj_lot_seq`、`yj_doc_batch`、`yj_doc_modify_log`、`bs_route`、`qc_tc_in`、`yj_panel/field/translation` | 小 | 会话时间/号段/改动日志等零散差异 |

---

## 5. 时间线(为什么会差成这样)

| 时间 | 事件 | 证据 |
|---|---|---|
| 2026-10-20 23:56 | 服务器库重建(`DatabaseCreationDate`) | 备份头 |
| 10-20 之后 | 本地继续开发:03:04 清 78 张空壳检验草稿、02:52 重算库存成本 | `_bak_qcdraft_*`/`_bak_qcinsp_empty_*` 快照 |
| 10-21 08:00 | 本地重跑 `migrate-kucun-recalc-to-now-20261016.sql`(库存在途重算) | `yj_schema_log.applied_at` |
| 10-21 08:30 / 10:35 / 10:55 | 服务器:研发检验计划 `IP-0013`、立项 `LXA-0013/0014` | `rd_*` |
| 10-21 08:47~08:57 | 服务器:金蝶回写 3~7 张销售单执行/关闭状态 | `bd_so_order`/`yj_doc_status` |
| 10-21 09:14~09:47 | 服务器排 `GD-0198`;**本地**跑 `migrate-qc-plan-applicable-doc`(检验标准库分套) | `wo_process_line` / `bs_qc_item` |
| 10-21 10:20 | **本地**改版组装成品检验明细(目数行→外观/尺寸/重量/性能) | `qc_asm_insp_detail.asp_time1` |
| 10-21 11:41 / 14:45 | 服务器:采购入库 `PI-0024` / `PI-0025` | `bd_purchase_in` |
| 10-21 15:20~18:14 | 服务器排产/报工 `GD-0225~0228` | `wo_process_line` |
| 10-21 16:20~16:25 | 服务器:设备点检 `DJ-0002/0003`、保养 `BY-0002` | `equip_check`/`maint_plan` |
| 10-21 17:00~18:04 | **本地**重建整条来料检验链(12 检验单/16 记录/5 退料) | `_qc-cleanup-probe-20261021/README.md` |
| 10-21 17:57 | 服务器重算库存(`kucun.asp_time2`) | `kucun` |
| **10-21 18:49** | 服务器打本次备份 | 备份头 |

---

## 6. 部署影响(若仍走 AGENTS.md 的"全量恢复备份"路线)

| # | 风险 | 后果 | 建议 |
|---|---|---|---|
| 1 | **服务器 10-21 全天业务被本地覆盖** | 丢 6 张销售单、2 张采购入库、3 张标签、`SL-0136`、`IP-0013`、`LXA-0013/0014`、`DJ-0002/0003`、`BY-0002`、`EU/IU/SW`、`GD-0198/0225~0228` 及配套排产报工、53 条打印日志、38 个已发号 | 部署前先从服务器把这批单据导回本地(或部署改成"只推代码+迁移，不做全量恢复") |
| 2 | **7 个管理角色 + 561 条授权消失** | 服务器上新建的 总经理/仓库审核/采购管理/销售管理/生产管理/品质管理/品质审核 全部不存在;`zjl(冯总)` 账号也没了 | 角色/用户/权限按"服务器 → 本地"反向同步，部署前必须做 |
| 3 | **仓库管理权限被本地那套覆盖** | 本地给了 29 张面板 + 15 张面板的审核/字段/预警 —— 若这不是本意，服务器会被意外放开 | 先确认这 30+15 条是有意还是测试残留 |
| 4 | **服务器 66 张首件 + 18 张制程空壳检验单会被本地"清掉"** | 本地 03:04 的清理脚本结果会带上去(草稿本来该清，但要确认这就是想要的效果) | 保留 `_bak_qcdraft_*` 快照 |
| 5 | **本地造的来料检验链会进正式账** | 12 张 `IJ-2026-10-0205~0216`、16 张 `JYSJ-0090~0105`、5 张 `TH-0003~0014` 全是 17:00 造的演示数据，且已"审核/审批/转 ERP"(ERP 单号 `CGTH-*` 是假写的) | 部署前必须清掉(参照 `_qc-cleanup-probe-20261021/README.md` 的反向操作) |
| 6 | **组装成品检验明细改版 + 检验标准库数据一起上** | 约 120 张单的明细被改写(旧「目数」行软删)、`bs_qc_item`/`bs_qc_plan` 新增 18+4 条 | 这两项若是本次要上线的功能，需连同迁移脚本一起提交并在服务器执行 |
| 7 | **结构上 3 张表的反向覆盖** | `wo_mixing_list` 服务器 8 行真实配料 ↔ 本地 1 行垃圾；`rd_mold_formula_detail` 类型 `float`↔`nvarchar(50)`；`bs_qc_plan.适用单据` 本地新列 | 先定 `rd_mold_formula_detail` 口径；`wo_mixing_list` 8 行要么导回本地要么明确废弃 |
| 8 | `_bak_*` 33 张快照表会随全量包进服务器 | 1,037 行临时数据 + 33 张不在册表(体检第 10 项会 FAIL) | 部署前 DROP，或按约定标注 |
| 9 | 服务器遗留 5 张 `_bak_pc0000_*`(3,413 行) | 全量恢复正好被清掉(这是好事) | 无需处理，部署后确认消失 |

---

## 7. 复跑命令

```powershell
$j = "$env:USERPROFILE\.jdks\ms-25.0.4\bin\java.exe"
$d = "tools\archive\_srv1021-vs-local-20261021"
$n = "tools\archive\_srv1849-vs-local-20261021"

# 0) 先把 bak 拷进容器挂载目录(宿主 D:\sql\data => 容器 /var/opt/mssql/data)
Copy-Item db\HSDZ_MES-manual-20261021-184953.bak D:\sql\data\_cmp1849.bak

# 1) 还原到临时库(目标库名有硬闸门,拒绝正式/测试账套)
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar "$d\_RestoreBak.java" "/var/opt/mssql/data/_cmp1849.bak" "HSDZ_MES_SRV1849"

# 2) 结构差异 / 3) 逐表数据差异
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar "$d\_StructDiff.java" HSDZ_MES_SRV1849 HSDZ_MES --skip-bak
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar "$d\_DataDiff.java" HSDZ_MES_SRV1849 HSDZ_MES --only-diff

# 4) 单据级差异(本次新增工具) / 5) 单表下钻
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar "$n\_DocDiff.java" HSDZ_MES_SRV1849 HSDZ_MES --max 80
& $j -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar "$d\_RowDiff.java" HSDZ_MES_SRV1849 HSDZ_MES bd_so_order 单据编号 --max 25
```

清理(比对完可删临时库,约 130 MB):

```sql
ALTER DATABASE HSDZ_MES_SRV1849 SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE HSDZ_MES_SRV1849;
-- 2026-10-21 上午那轮还留了一个 HSDZ_MES_SRV1021,同样可删
```

> ⚠ 两个坑(复跑必看):
> 1. 从 Git Bash 传 `/var/opt/mssql/data/...` 给 java 会被 MSYS 改写成 `D:/...`,**必须** `MSYS_NO_PATHCONV=1` 前缀。
> 2. 备份兼容级别 100，`STRING_AGG` 不可用;`sys` 目录视图与用户表排序规则不同，`CONCAT` 前统一 `COLLATE DATABASE_DEFAULT`。
