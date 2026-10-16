/* =============================================================================
   migrate-qc-item-plan-reseed-20261016.sql — 检验项目 / 检验方案:受控主数据**补播**

   【为什么要有这一条】(2026-10-16 部署包审计实测)
     · 本地开发库:bs_qc_plan 2 行 / bs_qc_item 14 行;
     · 部署包 pkg-full-20261016c.zip 的 HSDZ_MES.bak 还原后:**两张表都是 0 行**,
       而 yj_schema_log 里 `migrate-qc-item-plan.sql` **却登记着"已执行"**
       ⇒ 该脚本的 E 段(播种)在这条链上**没有落到数据**,服务器上线后 QC_ITEM/QC_PLAN 两个
         基础档案面板会是空的(用户口径:「补检验项目/检验方案播种到服务器」)。
     成因无从回溯(可能是"登记来自更早的备份、数据后补清空"),处置方式:**把 E 段抽出来单列成一条
     幂等迁移**,任何账套 sync 一次就补齐;原来那条已登记脚本一字不改(改字节会被 DbSync 判为重跑)。

   【内容】与 migrate-qc-item-plan.sql 的 E 段**逐字一致**(2 个检验方案 + 14 个检验项目:
     · QP-CAS18 成品 Y料:目数 2 项(+20目 / -325目)
     · QP-YCAS23 原料 Y-CAS-23:性能(余氯去除率)1 项 + 卫生安全 11 项重金属)
   【幂等】按 方案编码 / 项目编码 判重;第二次执行插 0 行。
   【口径】这是**受控文件 YJ-Q-125 摘录的真数据**,不是演示数据;要改请在面板 QC_ITEM/QC_PLAN 上维护。
   【两账套】先 HSDZ_MES 后 HSDZ_MES_TEST(DbSync 会自动排队执行)。
   ============================================================================= */
SET NOCOUNT ON;

DECLARE @u nvarchar(50) = N'migration';

/* E1. 检验方案 */
IF NOT EXISTS (SELECT 1 FROM bs_qc_plan WHERE 方案编码 = N'QP-CAS18')
  INSERT INTO bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%], 取样规则, 文件编码, 执行标准, 停用, 备注, 状态, asp_user1, asp_time1)
  VALUES (N'QP-CAS18', N'Y料成品检验方案(CAS-18)', N'Y料', N'功能料-颗粒', N'抽检', NULL,
          N'每50kg成品取样1个，每个样品200g', N'YJ-Q-125', N'YJ-Q-125 Y料原料及成品检验规范 A0', 0,
          N'出自受控文件 YJ-Q-125 §6.2/§7.2;成品=目数(20目/325目筛分占比)', N'启用', @u, SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_qc_plan WHERE 方案编码 = N'QP-YCAS23')
  INSERT INTO bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%], 取样规则, 文件编码, 执行标准, 停用, 备注, 状态, asp_user1, asp_time1)
  VALUES (N'QP-YCAS23', N'Y料原料检验方案(Y-CAS-23)', N'Y-CAS-23', NULL, N'抽检', NULL,
          N'每50kg原料取样1个，每个样品200g', N'YJ-Q-125', N'YJ-Q-125 Y料原料及成品检验规范 A0', 0,
          N'出自受控文件 YJ-Q-125 §6.1/§7.1;原料=性能(余氯去除率)+卫生安全(11项重金属)', N'启用', @u, SYSDATETIME());

/* E2. 检验项目:成品 CAS-18 目数(YJ-Q-125 §6.2「一项多区间」拆两条,才能逐项判合格) */
DECLARE @items TABLE (方案编码 nvarchar(200), 序号 int, 项目编码 nvarchar(200), 项目名称 nvarchar(200),
                      检验内容 nvarchar(200), 检验标准 nvarchar(200), 数据类型 nvarchar(100), 计量单位 nvarchar(200),
                      判定规则 nvarchar(100), 标准下限 decimal(18,4), 标准上限 decimal(18,4),
                      取样要求 nvarchar(200), 检验方法 nvarchar(1000), 合格处置 nvarchar(100), 不合格处置 nvarchar(100), 备注 nvarchar(500));
INSERT INTO @items VALUES
 (N'QP-CAS18', 10, N'FIN-MESH-P20',  N'目数(+20目)',  N'目数', N'+20目占比≤15%',  N'定量', N'%', N'上限判定', NULL, 15,
  N'称取100g', N'1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分5min；2.称量计算各区间占比。', N'入库', N'重新筛分', N'YJ-Q-125 §6.2'),
 (N'QP-CAS18', 20, N'FIN-MESH-M325', N'目数(-325目)', N'目数', N'-325目占比≤10%', N'定量', N'%', N'上限判定', NULL, 10,
  N'称取100g', N'1.称取100g Y料成品，从上到下依次放20目、325目筛网进行震动筛分5min；2.称量计算各区间占比。', N'入库', N'重新筛分', N'YJ-Q-125 §6.2'),
 /* 原料 Y-CAS-23:性能(YJ-Q-125 §6.1) */
 (N'QP-YCAS23', 10, N'RCV-PERF-CL', N'性能(余氯去除率)', N'性能', N'余氯去除率≥80%', N'定量', N'%', N'下限判定', 80, NULL,
  N'称取40g', N'1.称取40g 原料封装小T筒，进出水端用海绵压实；2.纯水加次氯酸钠加标，余氯含量2±0.2ppm；3.流速2L/min，冲2min取样测试余氯去除率。', NULL, N'退货', N'YJ-Q-125 §6.1');

/* 原料 卫生安全 11 项重金属(限值单位 mg/L,全部上限判定) */
DECLARE @hm TABLE (序号 int, 项目编码 nvarchar(200), 项目名称 nvarchar(200), 检验标准 nvarchar(200), 限值 decimal(18,4));
INSERT INTO @hm VALUES
 (20, N'RCV-HEALTH-CD', N'卫生安全(镉增加量)', N'镉增加量≤0.0005mg/L', 0.0005),
 (21, N'RCV-HEALTH-PB', N'卫生安全(铅增加量)', N'铅增加量≤0.001mg/L',  0.0010),
 (22, N'RCV-HEALTH-CR', N'卫生安全(铬增加量)', N'铬增加量≤0.005mg/L',  0.0050),
 (23, N'RCV-HEALTH-FE', N'卫生安全(铁增加量)', N'铁增加量≤0.06mg/L',   0.0600),
 (24, N'RCV-HEALTH-MN', N'卫生安全(锰增加量)', N'锰增加量≤0.04mg/L',   0.0400),
 (25, N'RCV-HEALTH-AL', N'卫生安全(铝增加量)', N'铝增加量≤0.02mg/L',   0.0200),
 (26, N'RCV-HEALTH-CU', N'卫生安全(铜增加量)', N'铜增加量≤0.2mg/L',    0.2000),
 (27, N'RCV-HEALTH-ZN', N'卫生安全(锌增加量)', N'锌增加量≤0.2mg/L',    0.2000),
 (28, N'RCV-HEALTH-AG', N'卫生安全(银增加量)', N'银增加量≤0.005mg/L',  0.0050),
 (29, N'RCV-HEALTH-AS', N'卫生安全(砷增加量)', N'砷增加量≤0.001mg/L',  0.0010),
 (30, N'RCV-HEALTH-NI', N'卫生安全(镍增加量)', N'镍增加量≤0.002mg/L',  0.0020);
INSERT INTO @items (方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限, 取样要求, 检验方法, 合格处置, 不合格处置, 备注)
SELECT N'QP-YCAS23', 序号, 项目编码, 项目名称, N'卫生安全', 检验标准, N'定量', N'mg/L', N'上限判定', NULL, 限值,
       N'称取10g', N'1.取10g来料，加入100ml浸泡液润洗两次，加100ml浸泡液浸泡24h±1h，中速滤纸过滤；2.用icp-ms测试离子含量。', NULL, N'退货', N'YJ-Q-125 §6.1'
  FROM @hm;

INSERT INTO bs_qc_item (项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限,
                        方案编码, 序号, 取样要求, 检验方法, 合格处置, 不合格处置, 停用, 备注, 状态, asp_user1, asp_time1)
SELECT i.项目编码, i.项目名称, i.检验内容, i.检验标准, i.数据类型, i.计量单位, i.判定规则, i.标准下限, i.标准上限,
       i.方案编码, i.序号, i.取样要求, i.检验方法, i.合格处置, i.不合格处置, 0, i.备注, N'启用', @u, SYSDATETIME()
  FROM @items i
 WHERE NOT EXISTS (SELECT 1 FROM bs_qc_item c WHERE c.项目编码 = i.项目编码);
GO

/* F. 自检:方案 2 条 / 项目 14 条(缺一 FAIL)*/
DECLARE @plan int = (SELECT COUNT(*) FROM bs_qc_plan WHERE 方案编码 IN (N'QP-CAS18', N'QP-YCAS23'));
DECLARE @item int = (SELECT COUNT(*) FROM bs_qc_item WHERE 项目编码 LIKE N'FIN-MESH-%' OR 项目编码 LIKE N'RCV-%');
DECLARE @dbn sysname = DB_NAME();
IF @plan = 2 AND @item >= 14
  RAISERROR(N'[OK] %s:检验方案 %d 条 / 检验项目 %d 条(受控主数据齐)', 10, 1, @dbn, @plan, @item);
ELSE
  RAISERROR(N'[FAIL] %s:检验方案 %d 条(应 2)/ 检验项目 %d 条(应 ≥14)', 16, 1, @dbn, @plan, @item);
GO
