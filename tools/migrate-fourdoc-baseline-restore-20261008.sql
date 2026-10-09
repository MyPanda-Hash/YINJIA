/* migrate-fourdoc-baseline-restore-20261008.sql — 采购链四单 yj_field 回正到**冻结基线 dump**
 *
 * 【为什么有这条】
 *   docs/development/采购链四单字段与显示字段.md 是四单字段/显示名/顺序的唯一基线。
 *   ⚠ 基线的**真源是下面第【本脚本做什么】节里那份冻结 dump 的 sha256**,不是某个写死的日期 ——
 *     2026-10-03 首次冻结(事故复盘用),2026-10-09 因「采购入库明细启用仓位」刷新过一次
 *     (冻结副本 tools/archive/_dump-out/_head-fields-HSDZ_MES.md ← 当时的现库 dump)。
 *   2026-10-05 07:42 起本地库发生**迁移链整链重放**(79 条脚本因字节变更被 DbSync 判为"未执行"而重跑,
 *   首条即 migrate-sl-supplier-ref.sql),四单的 yj_field 行被整批换成另一代登记:
 *     · 参照源回落:非供应商字段又挂 ref_panel='GFDA'(§5.3 同款越界形态,QC_INSP.部门 = 1 行越界);
 *     · QC_RECV 明细少 10 行(数量2/计量单位2/税率%/含税单价/含税金额/折扣%/预计到货日期/现存量/仓库/批次键),
 *       表头「单据日期」被改名成「日期」、业务员由「参照」掉回「文本」;
 *     · QC_INSP 明细「单位」整行消失;QC_RETURN/PURCHASE_IN 明细多出成批本应隐藏的行;
 *     · hidden 位被整片翻开 ⇒ 列表页宽表明细可见列:QC_RECV 22→37、QC_INSP 14→30、QC_RETURN 12→33。
 *   按文档 §8 复跑取证:§四内部一致性 12/12 ✅(库与后端下发同源,不是显示 bug),
 *   但 §五 参照抽查 4/6 —— QC_RECV「业务员」、QC_INSP「单位」两项 [FAIL]。
 *
 * 【本脚本做什么】
 *   把四单(QC_RECV/QC_INSP/QC_RETURN/PURCHASE_IN)的 yj_field 行**逐字段回正**到基线 dump:
 *     tools/archive/_dump-out/fields-HSDZ_MES.md @ git 35a6bfa373f7(sha256 64f5d36ee202b1c8…)
 *   回正行数:QC_RECV=70 · QC_INSP=54 · QC_RETURN=34 · PURCHASE_IN=171(共 329 行)。
 *   插入顺序 = 基线 (seq, id) 名次 ⇒ seq 并列组的先后与基线逐行一致(§1.2 并列按 id 升序)。
 *   不动物理表、不动 yj_translation、不动 yj_panel(面板名「暂收退料单」与 en 名属 yj_panel 历史差异,不是本次漂移)。
 *   生成器:tools/archive/_gen-fourdoc-restore.mjs(手改本文件无效,请改生成器重跑)。
 *
 * 【血统差异处置(2026-10-03 之后本机表切到了 rebuild/远端血统,基线字段的列有增有减)】
   (无:基线字段的物理列在当前库全部存在)
 *   ⚠ 这几处是「基线文档 vs 现库表结构」的真实差异,本脚本无法凭元数据抹平:
 *     物理列已被删/改名 ⇒ 只回正到"列还在"的范围;要 100% 复刻基线文档的 §3.x「落库表列对照」,
 *     需要另开 DDL 迁移把列加回来(会与 rebuild 血统的存量数据分叉),不在本脚本范围内。
 *
 * 【幂等 / 安全】
 *   ① 逐面板先算「与基线的差异行数」= 现役多出的行 + 基线缺失的行 + 同键但内容不同的行
 *      + **顺序名次不符的行**(只有内容对、id 次序不对也要重建);
 *      为 0 ⇒ 跳过(脚本重跑是空操作);
 *   ② > 0 ⇒ 该面板**整面板重建**:按基线 (seq,id) 名次逐行插入(cursor 保序);
 *   ③ 重建与复核在**同一个事务**里:复核差异非 0 即整体 ROLLBACK + RAISERROR;
 *   ④ 末尾自检:行数对照 + 「越界污染(非供应商语义却指 GFDA)」必须为 0(§5.3 口径)。
 *
 * 【执行】两账套各跑一遍(先 HSDZ_MES、后 HSDZ_MES_TEST),跑到「执行 0、失败 0」;
 *        随后按文档 §8 重跑取证并重生成文档。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------- ⓪ 基线行集(2026-10-03 dump,329 行) ---------- */
IF OBJECT_ID('tempdb..#base') IS NOT NULL DROP TABLE #base;
CREATE TABLE #base (
  ord           int           NOT NULL,
  panel_code    varchar(40)   NOT NULL,
  col_name      sysname       NOT NULL,
  label         nvarchar(120) NOT NULL,
  data_type     nvarchar(40)  NOT NULL,
  dict_sql      nvarchar(1000) NULL,
  ref_panel     varchar(40)   NULL,
  ref_field     sysname       NULL,
  display_field sysname       NULL,
  place         varchar(60)   NOT NULL,
  seq           int           NOT NULL,
  width         int           NULL,
  editable      bit           NOT NULL,
  required      bit           NOT NULL,
  hidden        bit           NOT NULL,
  alias         nvarchar(120) NULL,
  visible       bit           NOT NULL,
  label_en      nvarchar(400) NULL,
  col_group     nvarchar(100) NULL,
  ref_filter    nvarchar(400) NULL
);

INSERT INTO #base (ord,panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,alias,visible,label_en,col_group,ref_filter) VALUES
  (1,N'QC_RECV',N'单据编号',N'单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',10,140,0,1,0,NULL,1,NULL,NULL,NULL),
  (2,N'QC_RECV',N'单据编号',N'单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',10,150,0,0,0,NULL,1,NULL,NULL,NULL),
  (3,N'QC_RECV',N'单据日期',N'单据日期',N'日期',NULL,N'GFDA',N'mc',N'mc',N'query,header',20,120,1,1,0,NULL,1,NULL,NULL,NULL),
  (4,N'QC_RECV',N'物料编码',N'物料编码',N'参照',NULL,N'INV',N'存货编码',N'存货名称',N'query,detail',20,130,1,1,0,NULL,1,NULL,NULL,NULL),
  (5,N'QC_RECV',N'业务员',N'业务员',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'query,header',30,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (6,N'QC_RECV',N'采购单号',N'采购单号',N'参照',NULL,N'PU_ORDER',N'单据编号',N'单据编号',N'detail',30,140,1,0,0,NULL,1,NULL,NULL,NULL),
  (7,N'QC_RECV',N'供应商代码',N'供应商代码',N'参照',NULL,N'GFDA',N'dm',N'mc',N'query,header',40,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (8,N'QC_RECV',N'采购订单行号',N'采购订单行号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',40,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (9,N'QC_RECV',N'供应商',N'供应商',N'参照',NULL,N'GFDA',N'mc',N'mc',N'query,header',50,180,1,0,0,NULL,1,NULL,NULL,NULL),
  (10,N'QC_RECV',N'物料名称',N'物料名称',N'参照',NULL,N'INV',N'存货名称',N'存货名称',N'detail',50,160,1,0,0,NULL,1,NULL,NULL,NULL),
  (11,N'QC_RECV',N'规格型号',N'规格型号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',60,140,1,0,0,NULL,1,NULL,NULL,NULL),
  (12,N'QC_RECV',N'金额',N'金额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'header',60,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (13,N'QC_RECV',N'税额',N'税额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'header',70,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (14,N'QC_RECV',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'detail',70,150,0,0,0,NULL,1,NULL,NULL,NULL),
  (15,N'QC_RECV',N'物料描述',N'物料描述',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',80,200,1,0,0,NULL,1,NULL,NULL,NULL),
  (16,N'QC_RECV',N'总金额',N'总金额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'header',80,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (17,N'QC_RECV',N'单价',N'单价',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',90,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (18,N'QC_RECV',N'来料性质',N'来料性质',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',90,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (19,N'QC_RECV',N'部门',N'部门',N'参照',NULL,N'DEPT',N'部门名称',N'部门名称',N'header',100,120,1,0,0,NULL,1,NULL,NULL,NULL),
  (20,N'QC_RECV',N'数量',N'数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',100,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (21,N'QC_RECV',N'仓库',N'仓库',N'参照',NULL,N'WH',N'仓库名称',N'仓库名称',N'query,header',110,150,1,0,1,NULL,0,NULL,NULL,NULL),
  (22,N'QC_RECV',N'计量单位',N'计量单位',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',110,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (23,N'QC_RECV',N'部门名称',N'部门名称',N'文本',NULL,N'GFDA',N'mc',N'mc',N'header',120,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (24,N'QC_RECV',N'数量2',N'数量2',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',120,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (25,N'QC_RECV',N'计量单位2',N'计量单位2',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',130,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (26,N'QC_RECV',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'query,header',130,160,1,0,0,NULL,1,NULL,NULL,NULL),
  (27,N'QC_RECV',N'数量',N'数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'header',140,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (28,N'QC_RECV',N'金额',N'金额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',140,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (29,N'QC_RECV',N'附件1',N'附件1',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',150,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (30,N'QC_RECV',N'日期',N'日期',N'日期',NULL,N'GFDA',N'mc',N'mc',N'detail',150,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (31,N'QC_RECV',N'附件2',N'附件2',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',160,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (32,N'QC_RECV',N'税率%',N'税率%',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',160,80,1,0,0,NULL,1,NULL,NULL,NULL),
  (33,N'QC_RECV',N'附件3',N'附件3',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',170,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (34,N'QC_RECV',N'含税单价',N'含税单价',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',170,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (35,N'QC_RECV',N'附件4',N'附件4',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',180,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (36,N'QC_RECV',N'税额',N'税额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',180,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (37,N'QC_RECV',N'附件5',N'附件5',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',190,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (38,N'QC_RECV',N'含税金额',N'含税金额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',190,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (39,N'QC_RECV',N'附件6',N'附件6',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',200,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (40,N'QC_RECV',N'折扣',N'折扣',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',200,80,1,0,1,NULL,0,NULL,NULL,NULL),
  (41,N'QC_RECV',N'供应商',N'供应商',N'参照',NULL,N'GFDA',N'mc',N'mc',N'detail',210,160,1,0,1,NULL,0,NULL,NULL,NULL),
  (42,N'QC_RECV',N'采购订单号',N'采购订单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',210,150,1,0,0,NULL,1,NULL,NULL,NULL),
  (43,N'QC_RECV',N'入库数量',N'入库数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',220,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (44,N'QC_RECV',N'审核人',N'审核人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'header',220,100,0,0,0,NULL,1,NULL,NULL,NULL),
  (45,N'QC_RECV',N'入库单号',N'入库单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',230,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (46,N'QC_RECV',N'审核时间',N'审核时间',N'文本',NULL,N'GFDA',N'mc',N'mc',N'header',230,140,0,0,0,NULL,1,NULL,NULL,NULL),
  (47,N'QC_RECV',N'领料单号',N'领料单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',240,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (48,N'QC_RECV',N'批次键',N'批次键',N'整数',NULL,N'GFDA',N'mc',N'mc',N'header',240,80,0,0,1,NULL,0,NULL,NULL,NULL),
  (49,N'QC_RECV',N'结案',N'结案',N'下拉框',N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)',N'GFDA',N'mc',N'mc',N'detail',250,80,1,0,1,NULL,0,NULL,NULL,NULL),
  (50,N'QC_RECV',N'税别代码',N'税别代码',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',260,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (51,N'QC_RECV',N'税别说明',N'税别说明',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',270,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (52,N'QC_RECV',N'总金额',N'总金额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',280,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (53,N'QC_RECV',N'订单号',N'订单号',N'参照',NULL,N'SO_ORDER',N'单据编号',N'单据编号',N'detail',290,140,1,0,1,NULL,0,NULL,NULL,NULL),
  (54,N'QC_RECV',N'箱数',N'箱数',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',300,80,1,0,1,NULL,0,NULL,NULL,NULL),
  (55,N'QC_RECV',N'部门',N'部门',N'参照',NULL,N'DEPT',N'部门名称',N'部门名称',N'detail',310,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (56,N'QC_RECV',N'部门名称',N'部门名称',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',320,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (57,N'QC_RECV',N'折扣%',N'折扣%',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',330,80,1,0,0,NULL,1,NULL,NULL,NULL),
  (58,N'QC_RECV',N'预计到货日期',N'预计到货日期',N'日期',NULL,N'GFDA',N'mc',N'mc',N'detail',340,120,1,0,0,NULL,1,NULL,NULL,NULL),
  (59,N'QC_RECV',N'备注',N'备注',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',350,200,1,0,0,NULL,1,NULL,NULL,NULL),
  (60,N'QC_RECV',N'现存量',N'现存量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',360,90,1,0,1,NULL,0,NULL,NULL,NULL),
  (61,N'QC_RECV',N'仓库',N'仓库',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',370,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (62,N'QC_RECV',N'折扣金额',N'折扣金额',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',380,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (63,N'QC_RECV',N'条码',N'条码',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,detail',390,140,1,0,1,NULL,0,NULL,NULL,NULL),
  (64,N'QC_RECV',N'发货数量',N'发货数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',400,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (65,N'QC_RECV',N'剩余数量',N'剩余数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',410,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (66,N'QC_RECV',N'退料数量',N'退料数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',420,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (67,N'QC_RECV',N'报废数量',N'报废数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',430,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (68,N'QC_RECV',N'制单号',N'制单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',440,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (69,N'QC_RECV',N'品质复核人',N'品质复核人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'detail',450,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (70,N'QC_RECV',N'品质复核时间',N'品质复核时间',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',460,140,1,0,1,NULL,0,NULL,NULL,NULL),
  (1,N'QC_INSP',N'单据编号',N'单据编号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',10,140,0,1,0,NULL,1,N'Document Number',NULL,NULL),
  (2,N'QC_INSP',N'物料编码',N'物料编码',N'参照',NULL,N'INV',N'存货编码',N'存货名称',N'query,detail',10,120,1,1,0,NULL,1,N'Material Code',NULL,NULL),
  (3,N'QC_INSP',N'单据日期',N'单据日期',N'日期',NULL,N'GFDA',N'mc',N'mc',N'query,header',20,120,1,1,0,NULL,1,N'Document Date',NULL,NULL),
  (4,N'QC_INSP',N'物料名称',N'物料名称',N'参照',NULL,N'INV',N'存货名称',N'存货名称',N'detail',20,160,1,0,0,NULL,1,N'Material Name',NULL,NULL),
  (5,N'QC_INSP',N'规格型号',N'规格型号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',30,140,1,0,0,NULL,1,N'Specification',NULL,NULL),
  (6,N'QC_INSP',N'业务员',N'业务员',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'header',30,100,1,0,0,NULL,1,N'Salesperson',NULL,NULL),
  (7,N'QC_INSP',N'暂收单号',N'暂收单号',N'参照',NULL,N'QC_RECV',N'单号',N'单号',N'query,header',40,140,1,0,0,NULL,1,NULL,NULL,NULL),
  (8,N'QC_INSP',N'采购订单行号',N'采购订单行号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',40,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (9,N'QC_INSP',N'单位',N'单位',N'参照',NULL,N'UOM',N'计量单位名称',N'计量单位名称',N'detail',50,70,1,0,1,NULL,0,N'UOM',NULL,NULL),
  (10,N'QC_INSP',N'采购订单号',N'采购订单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',50,150,1,0,0,NULL,1,N'Purchase Order Number',NULL,NULL),
  (11,N'QC_INSP',N'单价',N'单价',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',60,100,1,0,0,NULL,1,N'Unit Price',NULL,NULL),
  (12,N'QC_INSP',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'query,header',60,160,0,0,0,NULL,1,NULL,NULL,NULL),
  (13,N'QC_INSP',N'供应商',N'供应商',N'参照',NULL,N'GFDA',N'mc',N'mc',N'query,header',70,180,1,0,0,NULL,1,N'Vendor',NULL,NULL),
  (14,N'QC_INSP',N'计量单位',N'计量单位',N'参照',NULL,N'UOM',N'计量单位名称',N'计量单位名称',N'detail',70,90,1,0,0,NULL,1,N'Unit of measurement',NULL,NULL),
  (15,N'QC_INSP',N'送检数量',N'送检数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',80,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (16,N'QC_INSP',N'供应商代码',N'供应商代码',N'文本',NULL,N'GFDA',N'dm',N'mc',N'query,header',80,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (17,N'QC_INSP',N'合格数量',N'合格数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',90,100,1,1,0,NULL,1,NULL,NULL,NULL),
  (18,N'QC_INSP',N'部门',N'部门',N'参照',NULL,N'DEPT',N'部门名称',N'部门名称',N'header',90,140,1,0,0,NULL,1,NULL,NULL,NULL),
  (19,N'QC_INSP',N'不合格数量',N'不合格数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',100,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (20,N'QC_INSP',N'部门编码',N'部门编码',N'参照',NULL,N'DEPT',N'部门编码',N'部门名称',N'header',100,140,1,0,0,NULL,1,NULL,NULL,NULL),
  (21,N'QC_INSP',N'检验员',N'检验员',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'header',110,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (22,N'QC_INSP',N'报废数量',N'报废数量',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',110,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (23,N'QC_INSP',N'检验日期',N'检验日期',N'日期',NULL,N'GFDA',N'mc',N'mc',N'header',120,120,1,0,0,NULL,1,NULL,NULL,NULL),
  (24,N'QC_INSP',N'损耗',N'损耗',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',120,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (25,N'QC_INSP',N'检验编号',N'检验编号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',130,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (26,N'QC_INSP',N'损耗率',N'损耗率',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',130,90,1,0,0,NULL,1,NULL,NULL,NULL),
  (27,N'QC_INSP',N'检验方案',N'检验方案',N'参照',NULL,N'QC_PLAN',N'方案名称',N'方案名称',N'header',140,140,1,0,0,NULL,1,N'Inspection Plan',NULL,NULL),
  (28,N'QC_INSP',N'生产日期',N'生产日期',N'日期',NULL,N'GFDA',N'mc',N'mc',N'detail',140,120,1,0,0,NULL,1,NULL,NULL,NULL),
  (29,N'QC_INSP',N'执行标准',N'执行标准',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',150,180,1,0,0,NULL,1,NULL,NULL,NULL),
  (30,N'QC_INSP',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'detail',150,150,0,0,0,NULL,1,NULL,NULL,NULL),
  (31,N'QC_INSP',N'处置方式',N'处置方式',N'下拉框',N'SELECT v FROM (VALUES (N''入库''),(N''退货''),(N''让步入库'')) AS t(v)',N'GFDA',N'mc',N'mc',N'detail',160,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (32,N'QC_INSP',N'检验类型',N'检验类型',N'下拉框',N'SELECT v FROM (VALUES (N''全检''),(N''抽检''),(N''免检'')) AS t(v)',N'GFDA',N'mc',N'mc',N'header',160,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (33,N'QC_INSP',N'总结论',N'总结论',N'下拉框',N'SELECT v FROM (VALUES (N''合格''),(N''不合格''),(N''让步接收'')) AS t(v)',N'GFDA',N'mc',N'mc',N'query,header',170,100,1,0,0,NULL,1,NULL,NULL,NULL),
  (34,N'QC_INSP',N'条码',N'条码',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,detail',170,140,1,0,1,NULL,0,NULL,NULL,NULL),
  (35,N'QC_INSP',N'成品编号',N'成品编号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',180,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (36,N'QC_INSP',N'附件1',N'附件1',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',180,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (37,N'QC_INSP',N'物料描述',N'物料描述',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',190,160,1,0,1,NULL,0,NULL,NULL,NULL),
  (38,N'QC_INSP',N'附件2',N'附件2',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',190,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (39,N'QC_INSP',N'箱数',N'箱数',N'小数',NULL,N'GFDA',N'mc',N'mc',N'detail',200,80,1,0,1,NULL,0,NULL,NULL,NULL),
  (40,N'QC_INSP',N'附件3',N'附件3',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',200,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (41,N'QC_INSP',N'日期',N'日期',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',210,100,1,0,1,NULL,0,N'Date',NULL,NULL),
  (42,N'QC_INSP',N'附件4',N'附件4',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',210,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (43,N'QC_INSP',N'结案',N'结案',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',220,80,1,0,1,NULL,0,NULL,NULL,NULL),
  (44,N'QC_INSP',N'附件5',N'附件5',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',220,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (45,N'QC_INSP',N'部门',N'部门',N'参照',NULL,N'DEPT',N'部门名称',N'部门名称',N'detail',230,100,1,0,1,NULL,0,N'Department',NULL,NULL),
  (46,N'QC_INSP',N'附件6',N'附件6',N'附件',NULL,N'GFDA',N'mc',N'mc',N'header',230,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (47,N'QC_INSP',N'备注',N'备注',N'文本',NULL,N'GFDA',N'mc',N'mc',N'header,detail',240,220,1,0,1,NULL,0,N'Remark',NULL,NULL),
  (48,N'QC_INSP',N'单据状态',N'单据状态',N'文本',NULL,N'GFDA',N'mc',N'mc',N'query,header',240,90,0,0,1,NULL,0,N'Doc status',NULL,NULL),
  (49,N'QC_INSP',N'部门名称',N'部门名称',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',250,100,1,0,1,NULL,0,N'Department Name',NULL,NULL),
  (50,N'QC_INSP',N'审核人',N'审核人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'header',260,90,0,0,0,NULL,1,N'Approved by',NULL,NULL),
  (51,N'QC_INSP',N'入库单号',N'入库单号',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',260,130,0,0,0,NULL,1,N'Receipt No.',NULL,NULL),
  (52,N'QC_INSP',N'审核时间',N'审核时间',N'文本',NULL,N'GFDA',N'mc',N'mc',N'header',270,140,0,0,0,NULL,1,N'Approved at',NULL,NULL),
  (53,N'QC_INSP',N'仓库代码',N'仓库代码',N'文本',NULL,N'GFDA',N'mc',N'mc',N'detail',270,120,1,0,1,NULL,0,N'Warehouse Code',NULL,NULL),
  (54,N'QC_INSP',N'批次键',N'批次键',N'整数',NULL,N'GFDA',N'mc',N'mc',N'header',280,80,0,0,1,NULL,0,NULL,NULL,NULL),
  (1,N'QC_RETURN',N'单据编号',N'单据编号',N'文本',NULL,NULL,NULL,NULL,N'query,header',10,140,0,1,0,NULL,1,N'Document Number',NULL,NULL),
  (2,N'QC_RETURN',N'单据日期',N'单据日期',N'日期',NULL,NULL,NULL,NULL,N'query,header',20,120,1,1,0,NULL,1,N'Document Date',NULL,NULL),
  (3,N'QC_RETURN',N'物料编码',N'物料编码',N'参照',NULL,N'INV',N'存货编码',N'存货名称',N'query,detail',20,120,1,1,0,NULL,1,N'Material Code',NULL,NULL),
  (4,N'QC_RETURN',N'检验单号',N'检验单号',N'参照',NULL,N'QC_INSP',N'单据编号',N'单据编号',N'query,header',30,140,1,0,0,NULL,1,NULL,NULL,NULL),
  (5,N'QC_RETURN',N'物料名称',N'物料名称',N'参照',NULL,N'INV',N'存货名称',N'存货名称',N'detail',30,160,1,0,0,NULL,1,N'Material Name',NULL,NULL),
  (6,N'QC_RETURN',N'规格型号',N'规格型号',N'文本',NULL,NULL,NULL,NULL,N'detail',40,140,1,0,0,NULL,1,N'Specification',NULL,NULL),
  (7,N'QC_RETURN',N'采购订单号',N'采购订单号',N'文本',NULL,NULL,NULL,NULL,N'query,header',40,150,1,0,0,NULL,1,N'Purchase Order Number',NULL,NULL),
  (8,N'QC_RETURN',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'query,header',50,160,0,0,0,NULL,1,NULL,NULL,NULL),
  (9,N'QC_RETURN',N'供应商',N'供应商',N'参照',NULL,N'GFDA',N'mc',N'mc',N'query,header',60,180,1,0,0,NULL,1,N'Vendor',NULL,NULL),
  (10,N'QC_RETURN',N'单位',N'单位',N'参照',NULL,N'UOM',N'计量单位名称',N'计量单位名称',N'detail',60,70,1,0,1,NULL,0,N'UOM',NULL,NULL),
  (11,N'QC_RETURN',N'单价',N'单价',N'小数',NULL,NULL,NULL,NULL,N'detail',70,90,1,0,0,NULL,1,N'Unit Price',NULL,NULL),
  (12,N'QC_RETURN',N'退货类型',N'退货类型',N'下拉框',N'SELECT v FROM (VALUES (N''退供应商''),(N''报废''),(N''让步接收'')) AS t(v)',NULL,NULL,NULL,N'header',70,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (13,N'QC_RETURN',N'退货数量',N'退货数量',N'小数',NULL,NULL,NULL,NULL,N'detail',80,100,1,1,0,NULL,1,NULL,NULL,NULL),
  (14,N'QC_RETURN',N'仓库',N'仓库',N'参照',NULL,N'WH',N'仓库名称',N'仓库名称',N'query,header',80,150,1,0,0,NULL,1,N'Warehouse',NULL,NULL),
  (15,N'QC_RETURN',N'送检数量',N'送检数量',N'小数',NULL,NULL,NULL,NULL,N'detail',85,100,0,0,0,NULL,1,NULL,NULL,NULL),
  (16,N'QC_RETURN',N'特采',N'特采',N'是否',NULL,NULL,NULL,NULL,N'detail',88,60,1,0,0,NULL,1,NULL,NULL,NULL),
  (17,N'QC_RETURN',N'退货原因',N'退货原因',N'文本',NULL,NULL,NULL,NULL,N'header',90,260,1,0,0,NULL,1,N'Reason for return',NULL,NULL),
  (18,N'QC_RETURN',N'计量单位',N'计量单位',N'参照',NULL,N'UOM',N'计量单位名称',N'计量单位名称',N'detail',90,90,1,0,0,NULL,1,N'Unit of measurement',NULL,NULL),
  (19,N'QC_RETURN',N'经手人',N'经手人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'header',100,100,1,0,0,NULL,1,N'Person in charge',NULL,NULL),
  (20,N'QC_RETURN',N'采购订单行号',N'采购订单行号',N'文本',NULL,NULL,NULL,NULL,N'detail',100,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (21,N'QC_RETURN',N'单据状态',N'单据状态',N'文本',NULL,NULL,NULL,NULL,N'query,header',110,90,0,0,0,NULL,1,N'Doc status',NULL,NULL),
  (22,N'QC_RETURN',N'不良原因',N'不良原因',N'参照',NULL,N'REJECT',N'不合格原因',N'不合格原因',N'query,detail',110,150,1,0,0,NULL,1,NULL,NULL,NULL),
  (23,N'QC_RETURN',N'审核人',N'审核人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'header',120,90,0,0,0,NULL,1,N'Approved by',NULL,NULL),
  (24,N'QC_RETURN',N'报废数量',N'报废数量',N'小数',NULL,NULL,NULL,NULL,N'detail',120,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (25,N'QC_RETURN',N'审核时间',N'审核时间',N'文本',NULL,NULL,NULL,NULL,N'header',130,140,0,0,0,NULL,1,N'Approved at',NULL,NULL),
  (26,N'QC_RETURN',N'剩余数量',N'剩余数量',N'小数',NULL,NULL,NULL,NULL,N'detail',130,100,1,0,1,NULL,0,NULL,NULL,NULL),
  (27,N'QC_RETURN',N'备注',N'备注',N'文本',NULL,NULL,NULL,NULL,N'header,detail',140,220,1,0,0,NULL,1,N'Remark',NULL,NULL),
  (28,N'QC_RETURN',N'附件1',N'附件1',N'附件',NULL,NULL,NULL,NULL,N'header',150,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (29,N'QC_RETURN',N'附件2',N'附件2',N'附件',NULL,NULL,NULL,NULL,N'header',160,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (30,N'QC_RETURN',N'附件3',N'附件3',N'附件',NULL,NULL,NULL,NULL,N'header',170,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (31,N'QC_RETURN',N'附件4',N'附件4',N'附件',NULL,NULL,NULL,NULL,N'header',180,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (32,N'QC_RETURN',N'附件5',N'附件5',N'附件',NULL,NULL,NULL,NULL,N'header',190,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (33,N'QC_RETURN',N'附件6',N'附件6',N'附件',NULL,NULL,NULL,NULL,N'header',200,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (34,N'QC_RETURN',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'detail',206,150,0,0,0,NULL,1,NULL,NULL,NULL),
  (1,N'PURCHASE_IN',N'存货编码',N'存货编码',N'参照',NULL,N'INV',N'存货编码',N'存货名称',N'query,detail',10,120,1,1,0,NULL,1,N'Inventory Code',NULL,NULL),
  (2,N'PURCHASE_IN',N'单据日期',N'单据日期',N'日期',NULL,NULL,NULL,NULL,N'query,header',10,140,1,1,0,NULL,1,N'Document Date',NULL,NULL),
  (3,N'PURCHASE_IN',N'单据编号',N'单据编号',N'文本',NULL,NULL,NULL,NULL,N'query,header',20,140,1,1,0,NULL,1,N'Document Number',NULL,NULL),
  (4,N'PURCHASE_IN',N'存货名称',N'存货名称',N'参照',NULL,N'INV',N'存货名称',N'存货名称',N'detail',20,140,1,1,0,NULL,1,N'Inventory Name',NULL,NULL),
  (5,N'PURCHASE_IN',N'规格型号',N'规格型号',N'文本',NULL,NULL,NULL,NULL,N'detail',30,140,1,0,0,NULL,1,N'Specification',NULL,NULL),
  (6,N'PURCHASE_IN',N'入库类别',N'入库类别',N'下拉框',N'SELECT v FROM (VALUES (N''采购入库''),(N''其他入库'')) AS t(v)',NULL,NULL,NULL,N'query,header',30,110,1,0,0,NULL,1,N'In type',NULL,NULL),
  (7,N'PURCHASE_IN',N'汇率',N'汇率',N'小数',NULL,NULL,NULL,NULL,N'header',40,110,1,0,0,NULL,1,N'Exchange rate',NULL,NULL),
  (8,N'PURCHASE_IN',N'实收数量',N'实收数量',N'小数',NULL,NULL,NULL,NULL,N'detail',40,110,1,1,0,NULL,1,N'Actual received quantity',NULL,NULL),
  (9,N'PURCHASE_IN',N'供应商编码',N'供应商编码',N'参照',NULL,N'GFDA',N'dm',N'mc',N'query,header',50,140,1,0,0,NULL,1,N'Vendor code',NULL,NULL),
  (10,N'PURCHASE_IN',N'计量单位',N'计量单位',N'下拉框',N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)',NULL,NULL,NULL,N'detail',50,140,1,1,0,NULL,1,N'Unit of measurement',NULL,NULL),
  (11,N'PURCHASE_IN',N'供应商',N'供应商',N'参照',NULL,N'GFDA',N'mc',N'mc',N'query,header',60,140,1,1,0,NULL,1,N'Vendor',NULL,NULL),
  (12,N'PURCHASE_IN',N'实收数量2',N'实收数量2',N'小数',NULL,NULL,NULL,NULL,N'detail',60,110,1,0,0,NULL,1,N'Paid-in quantity 2',NULL,NULL),
  (13,N'PURCHASE_IN',N'计量单位2',N'计量单位2',N'下拉框',N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)',NULL,NULL,NULL,N'detail',70,140,1,0,0,NULL,1,N'Unit of measurement 2',NULL,NULL),
  (14,N'PURCHASE_IN',N'匹配来源单号',N'匹配来源单号',N'文本',NULL,NULL,NULL,NULL,N'query,header',70,130,1,0,1,NULL,0,N'Matched source no.',NULL,NULL),
  (15,N'PURCHASE_IN',N'经手人',N'经手人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'query,header',80,140,1,0,0,NULL,1,N'Person in charge',NULL,NULL),
  (16,N'PURCHASE_IN',N'单价',N'单价',N'小数',NULL,NULL,NULL,NULL,N'detail',80,110,1,1,0,NULL,1,N'Unit Price',NULL,NULL),
  (17,N'PURCHASE_IN',N'金额',N'金额',N'小数',NULL,NULL,NULL,NULL,N'detail',90,110,1,0,0,NULL,1,N'Amount',NULL,NULL),
  (18,N'PURCHASE_IN',N'附件1',N'附件1',N'附件',NULL,NULL,NULL,NULL,N'header',90,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (19,N'PURCHASE_IN',N'税率%',N'税率%',N'小数',N'SELECT v FROM (VALUES (N''0''),(N''3''),(N''6''),(N''9''),(N''13'')) AS t(v)',NULL,NULL,NULL,N'detail',100,110,1,0,0,NULL,1,N'Tax rate%',NULL,NULL),
  (20,N'PURCHASE_IN',N'附件2',N'附件2',N'附件',NULL,NULL,NULL,NULL,N'header',100,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (21,N'PURCHASE_IN',N'含税单价',N'含税单价',N'小数',NULL,NULL,NULL,NULL,N'detail',110,110,1,0,0,NULL,1,N'Unit price including tax',NULL,NULL),
  (22,N'PURCHASE_IN',N'附件3',N'附件3',N'附件',NULL,NULL,NULL,NULL,N'header',110,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (23,N'PURCHASE_IN',N'含税金额',N'含税金额',N'小数',NULL,NULL,NULL,NULL,N'detail',120,110,1,0,0,NULL,1,N'Incl. tax amt',NULL,NULL),
  (24,N'PURCHASE_IN',N'附件4',N'附件4',N'附件',NULL,NULL,NULL,NULL,N'header',120,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (25,N'PURCHASE_IN',N'批号',N'批号',N'文本',NULL,NULL,NULL,NULL,N'detail',130,120,1,0,1,NULL,0,N'Lot No.',NULL,NULL),
  (26,N'PURCHASE_IN',N'附件5',N'附件5',N'附件',NULL,NULL,NULL,NULL,N'header',130,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (27,N'PURCHASE_IN',N'是否来料检验',N'是否来料检验',N'下拉框',N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)',NULL,NULL,NULL,N'detail',140,90,0,0,0,NULL,1,NULL,NULL,NULL),
  (28,N'PURCHASE_IN',N'附件6',N'附件6',N'附件',NULL,NULL,NULL,NULL,N'header',140,220,1,0,0,NULL,1,NULL,NULL,NULL),
  (29,N'PURCHASE_IN',N'特采',N'特采',N'下拉框',N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)',NULL,NULL,NULL,N'detail',150,90,0,0,0,NULL,1,NULL,NULL,NULL),
  (30,N'PURCHASE_IN',N'验货人',N'验货人',N'参照',NULL,N'EMP',N'员工名称',N'员工名称',N'query,header',150,100,1,0,1,NULL,0,N'Inspector',NULL,NULL),
  (31,N'PURCHASE_IN',N'行号',N'行号',N'文本',NULL,NULL,NULL,NULL,N'detail',160,120,1,0,1,NULL,0,N'Line No.',NULL,NULL),
  (32,N'PURCHASE_IN',N'采购订单号',N'采购订单号',N'文本',NULL,NULL,NULL,NULL,N'header',160,140,1,0,0,NULL,1,N'Purchase Order Number',NULL,NULL),
  (33,N'PURCHASE_IN',N'现存量',N'现存量',N'小数',NULL,NULL,NULL,NULL,N'detail',170,110,1,0,0,NULL,1,N'Current inventory',NULL,NULL),
  (34,N'PURCHASE_IN',N'来源单据',N'来源单据',N'文本',NULL,NULL,NULL,NULL,N'query,header',170,110,1,0,1,NULL,0,N'Source doc',NULL,NULL),
  (35,N'PURCHASE_IN',N'创建时间',N'创建时间',N'日期',NULL,NULL,NULL,NULL,N'header',180,130,1,0,0,NULL,1,N'Created at',NULL,NULL),
  (36,N'PURCHASE_IN',N'商品id',N'商品id',N'文本',NULL,NULL,NULL,NULL,N'detail',180,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (37,N'PURCHASE_IN',N'来源单号',N'来源单号',N'文本',NULL,NULL,NULL,NULL,N'query,header',190,120,1,0,1,NULL,0,N'Source no.',NULL,NULL),
  (38,N'PURCHASE_IN',N'仓库',N'仓库',N'参照',NULL,N'WH',N'仓库名称',N'仓库名称',N'detail',190,140,1,1,0,NULL,1,NULL,NULL,NULL),
  (39,N'PURCHASE_IN',N'仓位编码',N'仓位',N'参照',NULL,N'WHLOC',N'仓位编码',N'仓位编码',N'detail',195,120,1,0,0,NULL,1,N'Bin',NULL,N'仓库=$仓库'),
  (40,N'PURCHASE_IN',N'单据关闭状态',N'单据关闭状态',N'文本',NULL,NULL,NULL,NULL,N'header',200,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (41,N'PURCHASE_IN',N'商品是否多单位',N'商品是否多单位',N'文本',NULL,NULL,NULL,NULL,N'detail',200,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (42,N'PURCHASE_IN',N'商品是否序列号',N'商品是否序列号',N'文本',NULL,NULL,NULL,NULL,N'detail',210,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (43,N'PURCHASE_IN',N'销售订单号',N'销售订单号',N'文本',NULL,NULL,NULL,NULL,N'query,header',210,130,1,0,1,NULL,0,N'Sales order no.',NULL,NULL),
  (44,N'PURCHASE_IN',N'经手人编码',N'经手人编码',N'文本',NULL,NULL,NULL,NULL,N'header',220,130,1,0,1,NULL,0,N'Handler code',NULL,NULL),
  (45,N'PURCHASE_IN',N'商品是否辅助属性',N'商品是否辅助属性',N'文本',NULL,NULL,NULL,NULL,N'detail',220,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (46,N'PURCHASE_IN',N'交货方式',N'交货方式',N'文本',NULL,NULL,NULL,NULL,N'header',230,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (47,N'PURCHASE_IN',N'商品是否保质期',N'商品是否保质期',N'文本',NULL,NULL,NULL,NULL,N'detail',230,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (48,N'PURCHASE_IN',N'交货方式编码',N'交货方式编码',N'文本',NULL,NULL,NULL,NULL,N'header',240,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (49,N'PURCHASE_IN',N'商品是否批次',N'商品是否批次',N'文本',NULL,NULL,NULL,NULL,N'detail',240,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (50,N'PURCHASE_IN',N'结算状态',N'结算状态',N'文本',NULL,NULL,NULL,NULL,N'header',250,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (51,N'PURCHASE_IN',N'仓库id',N'仓库id',N'文本',NULL,NULL,NULL,NULL,N'detail',250,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (52,N'PURCHASE_IN',N'修改时间',N'修改时间',N'日期',NULL,NULL,NULL,NULL,N'header',260,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (53,N'PURCHASE_IN',N'仓库启用仓位管理',N'仓库启用仓位管理',N'文本',NULL,NULL,NULL,NULL,N'detail',260,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (54,N'PURCHASE_IN',N'创建人',N'创建人',N'文本',NULL,NULL,NULL,NULL,N'header',270,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (55,N'PURCHASE_IN',N'仓位id',N'仓位id',N'文本',NULL,NULL,NULL,NULL,N'detail',270,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (56,N'PURCHASE_IN',N'修改人',N'修改人',N'文本',NULL,NULL,NULL,NULL,N'header',280,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (57,N'PURCHASE_IN',N'源单行号',N'采购订单行号',N'文本',NULL,NULL,NULL,NULL,N'detail',290,110,1,0,0,NULL,1,NULL,NULL,NULL),
  (58,N'PURCHASE_IN',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'query,header',290,160,0,0,0,NULL,1,NULL,NULL,NULL),
  (59,N'PURCHASE_IN',N'辅助属性id',N'辅助属性id',N'文本',NULL,NULL,NULL,NULL,N'detail',300,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (60,N'PURCHASE_IN',N'ERP单号',N'ERP单号',N'文本',NULL,NULL,NULL,NULL,N'header',300,120,0,0,0,NULL,1,NULL,NULL,NULL),
  (61,N'PURCHASE_IN',N'转ERP操作人',N'转ERP操作人',N'文本',NULL,NULL,NULL,NULL,N'header',310,100,0,0,0,NULL,1,NULL,NULL,NULL),
  (62,N'PURCHASE_IN',N'批次号',N'批次号',N'文本',NULL,NULL,NULL,NULL,N'detail',310,150,0,0,0,NULL,1,NULL,NULL,NULL),
  (63,N'PURCHASE_IN',N'辅助属性名称',N'辅助属性名称',N'文本',NULL,NULL,NULL,NULL,N'detail',320,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (64,N'PURCHASE_IN',N'转ERP时间',N'转ERP时间',N'日期',NULL,NULL,NULL,NULL,N'header',320,130,0,0,0,NULL,1,NULL,NULL,NULL),
  (65,N'PURCHASE_IN',N'辅助属性编码',N'辅助属性编码',N'文本',NULL,NULL,NULL,NULL,N'detail',330,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (66,N'PURCHASE_IN',N'是否已转ERP',N'是否已转ERP',N'文本',NULL,NULL,NULL,NULL,N'header',330,80,0,0,1,NULL,0,NULL,NULL,NULL),
  (67,N'PURCHASE_IN',N'部门',N'部门',N'参照',NULL,N'DEPT',N'部门名称',N'部门名称',N'header',340,130,1,0,1,NULL,0,N'Department',NULL,NULL),
  (68,N'PURCHASE_IN',N'辅助属性1id',N'辅助属性1id',N'文本',NULL,NULL,NULL,NULL,N'detail',340,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (69,N'PURCHASE_IN',N'部门编码',N'部门编码',N'参照',NULL,N'DEPT',N'部门编码',N'部门名称',N'header',350,130,1,0,1,NULL,0,N'Department Code',NULL,NULL),
  (70,N'PURCHASE_IN',N'辅助属性1名称',N'辅助属性1名称',N'文本',NULL,NULL,NULL,NULL,N'detail',350,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (71,N'PURCHASE_IN',N'客户',N'客户',N'文本',NULL,NULL,NULL,NULL,N'header',360,130,1,0,1,NULL,0,N'Customer',NULL,NULL),
  (72,N'PURCHASE_IN',N'辅助属性1编码',N'辅助属性1编码',N'文本',NULL,NULL,NULL,NULL,N'detail',360,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (73,N'PURCHASE_IN',N'客户编码',N'客户编码',N'文本',NULL,NULL,NULL,NULL,N'header',370,130,1,0,1,NULL,0,N'Customer Code',NULL,NULL),
  (74,N'PURCHASE_IN',N'辅助属性2id',N'辅助属性2id',N'文本',NULL,NULL,NULL,NULL,N'detail',370,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (75,N'PURCHASE_IN',N'联系人电话',N'联系人电话',N'文本',NULL,NULL,NULL,NULL,N'header',380,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (76,N'PURCHASE_IN',N'辅助属性2名称',N'辅助属性2名称',N'文本',NULL,NULL,NULL,NULL,N'detail',380,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (77,N'PURCHASE_IN',N'联系人国家名称',N'联系人国家名称',N'文本',NULL,NULL,NULL,NULL,N'header',390,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (78,N'PURCHASE_IN',N'辅助属性2编码',N'辅助属性2编码',N'文本',NULL,NULL,NULL,NULL,N'detail',390,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (79,N'PURCHASE_IN',N'联系人国家编码',N'联系人国家编码',N'文本',NULL,NULL,NULL,NULL,N'header',400,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (80,N'PURCHASE_IN',N'辅助属性3id',N'辅助属性3id',N'文本',NULL,NULL,NULL,NULL,N'detail',400,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (81,N'PURCHASE_IN',N'联系人省份名称',N'联系人省份名称',N'文本',NULL,NULL,NULL,NULL,N'header',410,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (82,N'PURCHASE_IN',N'辅助属性3名称',N'辅助属性3名称',N'文本',NULL,NULL,NULL,NULL,N'detail',410,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (83,N'PURCHASE_IN',N'联系人省份编码',N'联系人省份编码',N'文本',NULL,NULL,NULL,NULL,N'header',420,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (84,N'PURCHASE_IN',N'辅助属性3编码',N'辅助属性3编码',N'文本',NULL,NULL,NULL,NULL,N'detail',420,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (85,N'PURCHASE_IN',N'联系人市区名称',N'联系人市区名称',N'文本',NULL,NULL,NULL,NULL,N'header',430,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (86,N'PURCHASE_IN',N'条形码',N'条形码',N'文本',NULL,NULL,NULL,NULL,N'detail',430,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (87,N'PURCHASE_IN',N'联系人市区编码',N'联系人市区编码',N'文本',NULL,NULL,NULL,NULL,N'header',440,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (88,N'PURCHASE_IN',N'产地',N'产地',N'文本',NULL,NULL,NULL,NULL,N'detail',440,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (89,N'PURCHASE_IN',N'联系人区县名称',N'联系人区县名称',N'文本',NULL,NULL,NULL,NULL,N'header',450,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (90,N'PURCHASE_IN',N'注册证号',N'注册证号',N'文本',NULL,NULL,NULL,NULL,N'detail',450,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (91,N'PURCHASE_IN',N'联系人区县编码',N'联系人区县编码',N'文本',NULL,NULL,NULL,NULL,N'header',460,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (92,N'PURCHASE_IN',N'生产许可证',N'生产许可证',N'文本',NULL,NULL,NULL,NULL,N'detail',460,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (93,N'PURCHASE_IN',N'联系地址',N'联系地址',N'文本',NULL,NULL,NULL,NULL,N'header',470,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (94,N'PURCHASE_IN',N'保质期到期日',N'保质期到期日',N'日期',NULL,NULL,NULL,NULL,N'detail',470,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (95,N'PURCHASE_IN',N'付款方式',N'付款方式',N'文本',NULL,NULL,NULL,NULL,N'header',480,130,1,0,1,NULL,0,N'Payment Method',NULL,NULL),
  (96,N'PURCHASE_IN',N'有效期至',N'有效期至',N'文本',NULL,NULL,NULL,NULL,N'detail',480,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (97,N'PURCHASE_IN',N'预付金额',N'预付金额',N'文本',NULL,NULL,NULL,NULL,N'header',490,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (98,N'PURCHASE_IN',N'保质期类型',N'保质期类型',N'文本',NULL,NULL,NULL,NULL,N'detail',490,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (99,N'PURCHASE_IN',N'付款账户',N'付款账户',N'文本',NULL,NULL,NULL,NULL,N'header',500,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (100,N'PURCHASE_IN',N'保质期',N'保质期',N'文本',NULL,NULL,NULL,NULL,N'detail',500,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (101,N'PURCHASE_IN',N'保险金额',N'保险金额',N'文本',NULL,NULL,NULL,NULL,N'header',510,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (102,N'PURCHASE_IN',N'序列号清单',N'序列号清单',N'文本',NULL,NULL,NULL,NULL,N'detail',510,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (103,N'PURCHASE_IN',N'到期日',N'到期日',N'日期',NULL,NULL,NULL,NULL,N'header',520,130,1,0,0,NULL,1,NULL,NULL,NULL),
  (104,N'PURCHASE_IN',N'序列号流转ID',N'序列号流转ID',N'文本',NULL,NULL,NULL,NULL,N'detail',520,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (105,N'PURCHASE_IN',N'结算期限编码',N'结算期限编码',N'文本',NULL,NULL,NULL,NULL,N'header',530,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (106,N'PURCHASE_IN',N'基本单位id',N'基本单位id',N'文本',NULL,NULL,NULL,NULL,N'detail',530,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (107,N'PURCHASE_IN',N'结算期限',N'结算期限',N'文本',NULL,NULL,NULL,NULL,N'header',540,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (108,N'PURCHASE_IN',N'基本单位名称',N'基本单位名称',N'文本',NULL,NULL,NULL,NULL,N'detail',540,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (109,N'PURCHASE_IN',N'发货人',N'发货人',N'文本',NULL,NULL,NULL,NULL,N'header',550,130,1,0,1,NULL,0,N'Shipper',NULL,NULL),
  (110,N'PURCHASE_IN',N'基本单位编码',N'基本单位编码',N'文本',NULL,NULL,NULL,NULL,N'detail',550,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (111,N'PURCHASE_IN',N'发货电话',N'发货电话',N'文本',NULL,NULL,NULL,NULL,N'header',560,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (112,N'PURCHASE_IN',N'单位id',N'单位id',N'文本',NULL,NULL,NULL,NULL,N'detail',560,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (113,N'PURCHASE_IN',N'发货地址',N'发货地址',N'文本',NULL,NULL,NULL,NULL,N'header',570,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (114,N'PURCHASE_IN',N'单位编码',N'单位编码',N'文本',NULL,NULL,NULL,NULL,N'detail',570,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (115,N'PURCHASE_IN',N'发货国家名称',N'发货国家名称',N'文本',NULL,NULL,NULL,NULL,N'header',580,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (116,N'PURCHASE_IN',N'辅助单位id',N'辅助单位id',N'文本',NULL,NULL,NULL,NULL,N'detail',580,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (117,N'PURCHASE_IN',N'发货国家编码',N'发货国家编码',N'文本',NULL,NULL,NULL,NULL,N'header',590,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (118,N'PURCHASE_IN',N'辅助单位编码',N'辅助单位编码',N'文本',NULL,NULL,NULL,NULL,N'detail',590,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (119,N'PURCHASE_IN',N'发货省份名称',N'发货省份名称',N'文本',NULL,NULL,NULL,NULL,N'header',600,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (120,N'PURCHASE_IN',N'换算率2',N'换算率2',N'文本',NULL,NULL,NULL,NULL,N'detail',600,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (121,N'PURCHASE_IN',N'发货省份编码',N'发货省份编码',N'文本',NULL,NULL,NULL,NULL,N'header',610,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (122,N'PURCHASE_IN',N'基本数量',N'基本数量',N'文本',NULL,NULL,NULL,NULL,N'detail',610,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (123,N'PURCHASE_IN',N'发货市区名称',N'发货市区名称',N'文本',NULL,NULL,NULL,NULL,N'header',620,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (124,N'PURCHASE_IN',N'库存基本数量',N'库存基本数量',N'文本',NULL,NULL,NULL,NULL,N'detail',620,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (125,N'PURCHASE_IN',N'发货市区编码',N'发货市区编码',N'文本',NULL,NULL,NULL,NULL,N'header',630,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (126,N'PURCHASE_IN',N'默认浮动数量',N'默认浮动数量',N'文本',NULL,NULL,NULL,NULL,N'detail',630,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (127,N'PURCHASE_IN',N'发货区县名称',N'发货区县名称',N'文本',NULL,NULL,NULL,NULL,N'header',640,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (128,N'PURCHASE_IN',N'辅助换算系数',N'辅助换算系数',N'文本',NULL,NULL,NULL,NULL,N'detail',640,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (129,N'PURCHASE_IN',N'发货区县编码',N'发货区县编码',N'文本',NULL,NULL,NULL,NULL,N'header',650,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (130,N'PURCHASE_IN',N'换算系数',N'换算系数',N'文本',NULL,NULL,NULL,NULL,N'detail',650,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (131,N'PURCHASE_IN',N'仓库编码',N'仓库编码',N'参照',NULL,N'WH',N'仓库编码',N'仓库名称',N'header',660,130,1,0,1,NULL,0,N'Warehouse Code',NULL,NULL),
  (132,N'PURCHASE_IN',N'折扣额',N'折扣额',N'文本',NULL,NULL,NULL,NULL,N'detail',660,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (133,N'PURCHASE_IN',N'仓位',N'仓位',N'文本',NULL,NULL,NULL,NULL,N'header',670,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (134,N'PURCHASE_IN',N'源单编号',N'源单编号',N'文本',NULL,NULL,NULL,NULL,N'detail',670,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (135,N'PURCHASE_IN',N'仓位编码',N'仓位编码',N'文本',NULL,NULL,NULL,NULL,N'header',680,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (136,N'PURCHASE_IN',N'源单类型id',N'源单类型id',N'文本',NULL,NULL,NULL,NULL,N'detail',680,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (137,N'PURCHASE_IN',N'源单类型名称',N'源单类型名称',N'文本',NULL,NULL,NULL,NULL,N'detail',690,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (138,N'PURCHASE_IN',N'批次键',N'批次键',N'整数',NULL,NULL,NULL,NULL,N'header',690,80,0,0,1,NULL,0,NULL,NULL,NULL),
  (139,N'PURCHASE_IN',N'源单类型编码',N'源单类型编码',N'文本',NULL,NULL,NULL,NULL,N'detail',700,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (140,N'PURCHASE_IN',N'单据状态_bill_status',N'单据状态_bill_status',N'文本',NULL,NULL,NULL,NULL,N'header',700,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (141,N'PURCHASE_IN',N'源单内部id',N'源单内部id',N'文本',NULL,NULL,NULL,NULL,N'detail',710,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (142,N'PURCHASE_IN',N'审核时间_audit_time',N'审核时间_audit_time',N'日期',NULL,NULL,NULL,NULL,N'header',710,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (143,N'PURCHASE_IN',N'源单日期',N'源单日期',N'日期',NULL,NULL,NULL,NULL,N'detail',720,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (144,N'PURCHASE_IN',N'创建人编码',N'创建人编码',N'文本',NULL,NULL,NULL,NULL,N'header',730,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (145,N'PURCHASE_IN',N'源单分录id',N'源单分录id',N'文本',NULL,NULL,NULL,NULL,N'detail',730,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (146,N'PURCHASE_IN',N'创建人编码',N'创建人编码',N'文本',NULL,NULL,NULL,NULL,N'header',730,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (147,N'PURCHASE_IN',N'分录结算状态',N'分录结算状态',N'文本',NULL,NULL,NULL,NULL,N'detail',740,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (148,N'PURCHASE_IN',N'修改人编码',N'修改人编码',N'文本',NULL,NULL,NULL,NULL,N'header',750,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (149,N'PURCHASE_IN',N'折扣率%',N'折扣率%',N'文本',NULL,NULL,NULL,NULL,N'detail',750,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (150,N'PURCHASE_IN',N'修改人编码',N'修改人编码',N'文本',NULL,NULL,NULL,NULL,N'header',750,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (151,N'PURCHASE_IN',N'成本视图',N'成本视图',N'文本',NULL,NULL,NULL,NULL,N'detail',760,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (152,N'PURCHASE_IN',N'审核人_auditor_name',N'审核人_auditor_name',N'文本',NULL,NULL,NULL,NULL,N'header',760,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (153,N'PURCHASE_IN',N'单位成本视图',N'单位成本视图',N'文本',NULL,NULL,NULL,NULL,N'detail',770,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (154,N'PURCHASE_IN',N'审核人编码',N'审核人编码',N'文本',NULL,NULL,NULL,NULL,N'header',780,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (155,N'PURCHASE_IN',N'退货数量',N'退货数量',N'文本',NULL,NULL,NULL,NULL,N'detail',780,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (156,N'PURCHASE_IN',N'审核人编码',N'审核人编码',N'文本',NULL,NULL,NULL,NULL,N'header',780,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (157,N'PURCHASE_IN',N'价税合计本位币',N'价税合计本位币',N'文本',NULL,NULL,NULL,NULL,N'detail',790,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (158,N'PURCHASE_IN',N'未结算金额本位币',N'未结算金额本位币',N'文本',NULL,NULL,NULL,NULL,N'header',800,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (159,N'PURCHASE_IN',N'是否赠品',N'是否赠品',N'文本',NULL,NULL,NULL,NULL,N'detail',800,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (160,N'PURCHASE_IN',N'未结算金额本位币',N'未结算金额本位币',N'文本',NULL,NULL,NULL,NULL,N'header',800,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (161,N'PURCHASE_IN',N'送检数量',N'送检数量',N'小数',NULL,NULL,NULL,NULL,N'detail',810,100,0,0,1,NULL,0,NULL,NULL,NULL),
  (162,N'PURCHASE_IN',N'付款方式编码',N'付款方式编码',N'文本',NULL,NULL,NULL,NULL,N'header',820,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (163,N'PURCHASE_IN',N'部门名称',N'部门名称',N'文本',NULL,NULL,NULL,NULL,N'detail',820,120,0,0,1,NULL,0,N'Department Name',NULL,NULL),
  (164,N'PURCHASE_IN',N'付款方式编码',N'付款方式编码',N'文本',NULL,NULL,NULL,NULL,N'header',820,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (165,N'PURCHASE_IN',N'生产日期',N'生产日期',N'日期',NULL,NULL,NULL,NULL,N'detail',830,110,0,0,1,NULL,0,NULL,NULL,NULL),
  (166,N'PURCHASE_IN',N'付款账户编码',N'付款账户编码',N'文本',NULL,NULL,NULL,NULL,N'header',840,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (167,N'PURCHASE_IN',N'付款账户编码',N'付款账户编码',N'文本',NULL,NULL,NULL,NULL,N'header',840,130,1,0,1,NULL,0,NULL,NULL,NULL),
  (168,N'PURCHASE_IN',N'仓库名称_sp_name',N'仓库名称_sp_name',N'文本',NULL,NULL,NULL,NULL,N'detail',840,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (169,N'PURCHASE_IN',N'换算率_conversion_rate',N'换算率_conversion_rate',N'文本',NULL,NULL,NULL,NULL,N'detail',850,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (170,N'PURCHASE_IN',N'本次结算金额本位币',N'本次结算金额本位币',N'文本',NULL,NULL,NULL,NULL,N'detail',860,120,1,0,1,NULL,0,NULL,NULL,NULL),
  (171,N'PURCHASE_IN',N'备注',N'备注',N'文本',NULL,NULL,NULL,NULL,N'detail',870,200,0,0,0,NULL,1,NULL,NULL,NULL);
GO

/* ---------- ① 差异行数 → ② 逐面板回正 → ③ 复核 → ④ 自检(单批次 + 单事务) ---------- */
DECLARE @gap TABLE (panel_code sysname PRIMARY KEY, gap_rows int NOT NULL);

INSERT INTO @gap (panel_code, gap_rows)
SELECT p.panel_code,
       (SELECT COUNT(*) FROM yj_field f
      WHERE f.panel_code = p.panel_code AND NOT EXISTS (
        SELECT 1 FROM #base b
         WHERE b.panel_code = f.panel_code
      AND b.col_name = f.col_name
      AND b.label = f.label
      AND b.place = f.place
      AND b.seq = f.seq
      AND ISNULL(b.width,-1) = ISNULL(f.width,-1)
      AND b.editable = f.editable
      AND b.required = f.required
      AND b.hidden = f.hidden
      AND b.visible = f.visible
      AND ISNULL(b.data_type,N'') = ISNULL(f.data_type,N'')
      AND ISNULL(b.alias,N'') = ISNULL(f.alias,N'')
      AND ISNULL(b.ref_panel,N'') = ISNULL(f.ref_panel,N'')
      AND ISNULL(b.ref_field,N'') = ISNULL(f.ref_field,N'')
      AND ISNULL(b.display_field,N'') = ISNULL(f.display_field,N'')
      AND ISNULL(b.ref_filter,N'') = ISNULL(f.ref_filter,N'')
      AND ISNULL(b.dict_sql,N'') = ISNULL(f.dict_sql,N'')
      AND ISNULL(b.label_en,N'') = ISNULL(f.label_en,N'')
      AND ISNULL(b.col_group,N'') = ISNULL(f.col_group,N'')))
     + (SELECT COUNT(*) FROM #base b
      WHERE b.panel_code = p.panel_code AND NOT EXISTS (
        SELECT 1 FROM yj_field f
         WHERE b.panel_code = f.panel_code
      AND b.col_name = f.col_name
      AND b.label = f.label
      AND b.place = f.place
      AND b.seq = f.seq
      AND ISNULL(b.width,-1) = ISNULL(f.width,-1)
      AND b.editable = f.editable
      AND b.required = f.required
      AND b.hidden = f.hidden
      AND b.visible = f.visible
      AND ISNULL(b.data_type,N'') = ISNULL(f.data_type,N'')
      AND ISNULL(b.alias,N'') = ISNULL(f.alias,N'')
      AND ISNULL(b.ref_panel,N'') = ISNULL(f.ref_panel,N'')
      AND ISNULL(b.ref_field,N'') = ISNULL(f.ref_field,N'')
      AND ISNULL(b.display_field,N'') = ISNULL(f.display_field,N'')
      AND ISNULL(b.ref_filter,N'') = ISNULL(f.ref_filter,N'')
      AND ISNULL(b.dict_sql,N'') = ISNULL(f.dict_sql,N'')
      AND ISNULL(b.label_en,N'') = ISNULL(f.label_en,N'')
      AND ISNULL(b.col_group,N'') = ISNULL(f.col_group,N'')))
     + (SELECT COUNT(*) FROM (
         SELECT f.label AS label, f.col_name AS col_name, f.place AS place, f.seq AS seq,
                ROW_NUMBER() OVER (ORDER BY f.seq, f.id) AS rn,
                COUNT(*) OVER (PARTITION BY f.label, f.col_name, f.place, f.seq) AS dup
           FROM yj_field f WHERE f.panel_code = p.panel_code) x
       JOIN (SELECT b.label AS label, b.col_name AS col_name, b.place AS place, b.seq AS seq, b.ord AS rn
               FROM #base b WHERE b.panel_code = p.panel_code) y
         ON y.label = x.label AND y.col_name = x.col_name AND y.place = x.place AND y.seq = x.seq
      WHERE x.dup = 1 AND x.rn <> y.rn)
  FROM (VALUES (N'QC_RECV'),(N'QC_INSP'),(N'QC_RETURN'),(N'PURCHASE_IN')) p(panel_code);

SELECT g.panel_code AS 面板, g.gap_rows AS 差异行数,
       CASE WHEN g.gap_rows = 0 THEN N'已与基线一致(跳过)' ELSE N'需回正' END AS 处置
  FROM @gap g ORDER BY g.panel_code;

DECLARE @p sysname, @gap1 int;
DECLARE @cn sysname, @lb nvarchar(120), @dt nvarchar(40), @ds nvarchar(1000),
        @rp varchar(40), @rf sysname, @df sysname, @pl varchar(60), @sq int, @wd int,
        @ed bit, @rq bit, @hd bit, @al nvarchar(120), @vs bit, @le nvarchar(400),
        @cg nvarchar(100), @rflt nvarchar(400);

BEGIN TRAN;

DECLARE panels CURSOR LOCAL FAST_FORWARD FOR
  SELECT g.panel_code, g.gap_rows FROM @gap g WHERE g.gap_rows > 0 ORDER BY g.panel_code;
OPEN panels;
FETCH NEXT FROM panels INTO @p, @gap1;
WHILE @@FETCH_STATUS = 0
BEGIN
  PRINT N'回正 ' + @p + N':与基线差异 ' + CAST(@gap1 AS nvarchar(10)) + N' 行 → 整面板重建';

  DELETE FROM yj_field WHERE panel_code = @p;

  DECLARE ins CURSOR LOCAL FAST_FORWARD FOR
    SELECT b.col_name, b.label, b.data_type, b.dict_sql, b.ref_panel, b.ref_field, b.display_field,
           b.place, b.seq, b.width, b.editable, b.required, b.hidden, b.alias, b.visible,
           b.label_en, b.col_group, b.ref_filter
      FROM #base b WHERE b.panel_code = @p ORDER BY b.ord;
  OPEN ins;
  FETCH NEXT FROM ins INTO @cn, @lb, @dt, @ds, @rp, @rf, @df, @pl, @sq, @wd, @ed, @rq, @hd, @al, @vs, @le, @cg, @rflt;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible,
                          label_en, col_group, ref_filter)
    VALUES (@p, @cn, @lb, @dt, @ds, @rp, @rf, @df, @pl, @sq, @wd, @ed, @rq, @hd, @al, @vs, @le, @cg, @rflt);
    FETCH NEXT FROM ins INTO @cn, @lb, @dt, @ds, @rp, @rf, @df, @pl, @sq, @wd, @ed, @rq, @hd, @al, @vs, @le, @cg, @rflt;
  END
  CLOSE ins; DEALLOCATE ins;

  FETCH NEXT FROM panels INTO @p, @gap1;
END
CLOSE panels; DEALLOCATE panels;

/* ---------- ③ 复核:重建后差异必须为 0,否则整体回滚 ---------- */
DELETE FROM @gap;
INSERT INTO @gap (panel_code, gap_rows)
SELECT p.panel_code,
       (SELECT COUNT(*) FROM yj_field f
      WHERE f.panel_code = p.panel_code AND NOT EXISTS (
        SELECT 1 FROM #base b
         WHERE b.panel_code = f.panel_code
      AND b.col_name = f.col_name
      AND b.label = f.label
      AND b.place = f.place
      AND b.seq = f.seq
      AND ISNULL(b.width,-1) = ISNULL(f.width,-1)
      AND b.editable = f.editable
      AND b.required = f.required
      AND b.hidden = f.hidden
      AND b.visible = f.visible
      AND ISNULL(b.data_type,N'') = ISNULL(f.data_type,N'')
      AND ISNULL(b.alias,N'') = ISNULL(f.alias,N'')
      AND ISNULL(b.ref_panel,N'') = ISNULL(f.ref_panel,N'')
      AND ISNULL(b.ref_field,N'') = ISNULL(f.ref_field,N'')
      AND ISNULL(b.display_field,N'') = ISNULL(f.display_field,N'')
      AND ISNULL(b.ref_filter,N'') = ISNULL(f.ref_filter,N'')
      AND ISNULL(b.dict_sql,N'') = ISNULL(f.dict_sql,N'')
      AND ISNULL(b.label_en,N'') = ISNULL(f.label_en,N'')
      AND ISNULL(b.col_group,N'') = ISNULL(f.col_group,N'')))
     + (SELECT COUNT(*) FROM #base b
      WHERE b.panel_code = p.panel_code AND NOT EXISTS (
        SELECT 1 FROM yj_field f
         WHERE b.panel_code = f.panel_code
      AND b.col_name = f.col_name
      AND b.label = f.label
      AND b.place = f.place
      AND b.seq = f.seq
      AND ISNULL(b.width,-1) = ISNULL(f.width,-1)
      AND b.editable = f.editable
      AND b.required = f.required
      AND b.hidden = f.hidden
      AND b.visible = f.visible
      AND ISNULL(b.data_type,N'') = ISNULL(f.data_type,N'')
      AND ISNULL(b.alias,N'') = ISNULL(f.alias,N'')
      AND ISNULL(b.ref_panel,N'') = ISNULL(f.ref_panel,N'')
      AND ISNULL(b.ref_field,N'') = ISNULL(f.ref_field,N'')
      AND ISNULL(b.display_field,N'') = ISNULL(f.display_field,N'')
      AND ISNULL(b.ref_filter,N'') = ISNULL(f.ref_filter,N'')
      AND ISNULL(b.dict_sql,N'') = ISNULL(f.dict_sql,N'')
      AND ISNULL(b.label_en,N'') = ISNULL(f.label_en,N'')
      AND ISNULL(b.col_group,N'') = ISNULL(f.col_group,N'')))
     + (SELECT COUNT(*) FROM (
         SELECT f.label AS label, f.col_name AS col_name, f.place AS place, f.seq AS seq,
                ROW_NUMBER() OVER (ORDER BY f.seq, f.id) AS rn,
                COUNT(*) OVER (PARTITION BY f.label, f.col_name, f.place, f.seq) AS dup
           FROM yj_field f WHERE f.panel_code = p.panel_code) x
       JOIN (SELECT b.label AS label, b.col_name AS col_name, b.place AS place, b.seq AS seq, b.ord AS rn
               FROM #base b WHERE b.panel_code = p.panel_code) y
         ON y.label = x.label AND y.col_name = x.col_name AND y.place = x.place AND y.seq = x.seq
      WHERE x.dup = 1 AND x.rn <> y.rn)
  FROM (VALUES (N'QC_RECV'),(N'QC_INSP'),(N'QC_RETURN'),(N'PURCHASE_IN')) p(panel_code);

IF EXISTS (SELECT 1 FROM @gap g WHERE g.gap_rows > 0)
BEGIN
  SELECT g.panel_code AS 仍有差异的面板, g.gap_rows AS 差异行数 FROM @gap g WHERE g.gap_rows > 0 ORDER BY g.panel_code;
  ROLLBACK;
  RAISERROR(N'四单回正失败:重建后仍与基线有差异(见上表),已整体回滚', 16, 1);
END
ELSE
BEGIN
  COMMIT;
  PRINT N'✅ 四单 yj_field 已回正到 2026-10-03 基线';
END

/* ---------- ④ 自检:行数对照 + 越界污染(§5.3 口径) ---------- */
SELECT p.panel_code AS 面板,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 现役行数,
       (SELECT COUNT(*) FROM #base b WHERE b.panel_code = p.panel_code) AS 基线行数,
       CASE WHEN (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code)
               = (SELECT COUNT(*) FROM #base b WHERE b.panel_code = p.panel_code)
            THEN N'✅' ELSE N'❌' END AS 结论
  FROM (VALUES (N'QC_RECV'),(N'QC_INSP'),(N'QC_RETURN'),(N'PURCHASE_IN')) p(panel_code)
 ORDER BY p.panel_code;

SELECT COUNT(*) AS 越界污染行数_应为0
  FROM yj_field
 WHERE panel_code IN (N'QC_RECV',N'QC_INSP',N'QC_RETURN',N'PURCHASE_IN') AND data_type = N'参照' AND ref_panel = 'GFDA' AND label NOT LIKE N'%供应商%';
GO
PRINT N'migrate-fourdoc-baseline-restore-20261008 完成';
GO
