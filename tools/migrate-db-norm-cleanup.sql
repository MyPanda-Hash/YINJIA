-- migrate-db-norm-cleanup.sql — 数据库规范化存量清理(2026-09-28)
-- 依据:《数据库规范》(docs/development/数据库规范.md)+ 全库体检(tools/verify/DbNormAudit.java)
-- 范围(只做"机械可修、零业务影响"的四项;口径收敛类见规范的阶段 3):
--   ① 20 张 qc_/sl_recv 表补表级中文注明(表清单里"无说明表"的全部业务表)
--   ② 删除 1 组完全重复的 yj_field 行(SO_ORDER.备注,place/seq 全同的重复登记)
--   ③ 重建丢失的 v_sales_order_detail 视图(菜单上「销售订单明细表」点开 500 的根因)
--   ④ 修正 PR_SCRAP 唯一一个漂移字段的 col_name(物料/产品名称 → 物料产品名称;标签不动)
-- 幂等:全部 IF NOT EXISTS / IF OBJECT_ID 守卫,可重跑;不改任何业务数据。
-- 执行:tools/DbSync.java run migrate-db-norm-cleanup.sql(两个账套各跑一次)
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库
SET NOCOUNT ON;
GO

-- ===== ① 表级中文注明(据关联面板名与字段据实书写) =====
DECLARE @t TABLE (tbl sysname, descr nvarchar(400));
INSERT INTO @t (tbl, descr) VALUES
 (N'qc_bhc',          N'不合格品处理单(制程)头表——面板 QC_BHC;列名即中文标签'),
 (N'qc_bhc_detail',   N'不合格品处理单(制程)行表——面板 QC_BHC 明细'),
 (N'qc_bhg',          N'不合格报告(制程)头表——面板 QC_BHG;含检验工站/异常时间/责任部门'),
 (N'qc_bhg_detail',   N'不合格报告(制程)行表——面板 QC_BHG 明细'),
 (N'qc_bhz',          N'不合格品处理单(自制物料)头表——面板 QC_BHZ'),
 (N'qc_bhz_detail',   N'不合格品处理单(自制物料)行表——面板 QC_BHZ 明细'),
 (N'qc_insp',         N'检验单头表——面板 QC_INSP;暂收单号/采购订单号/批次号/供应商口径'),
 (N'qc_insp_detail',  N'检验单行表——面板 QC_INSP 明细(检验项目与判定)'),
 (N'qc_jjf',          N'紧急放行申请单头表——面板 QC_JJF'),
 (N'qc_jjf_detail',   N'紧急放行申请单行表——面板 QC_JJF 明细'),
 (N'qc_lyb',          N'来料异常分析报告头表——面板 QC_LYB;供应商/物料批次/不良率'),
 (N'qc_lyb_detail',   N'来料异常分析报告行表——面板 QC_LYB 明细'),
 (N'qc_return',       N'暂收退料单头表——面板 QC_RETURN;退货类型/仓库/供应商代码'),
 (N'qc_return_detail',N'暂收退料单行表——面板 QC_RETURN 明细'),
 (N'qc_scp',          N'试产材料使用申请单头表——面板 QC_SCP'),
 (N'qc_scp_detail',   N'试产材料使用申请单行表——面板 QC_SCP 明细'),
 (N'qc_scy',          N'生产异常分析报告头表——面板 QC_SCY;异常描述/原因分析'),
 (N'qc_scy_detail',   N'生产异常分析报告行表——面板 QC_SCY 明细'),
 (N'sl_recv',         N'送料暂收单头表——面板 QC_RECV;金额/税额/总金额/供应商'),
 (N'sl_recv_detail',  N'送料暂收单行表——面板 QC_RECV 明细;计量单位/批次键随链路流转');

DECLARE @tb sysname, @d nvarchar(400);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, descr FROM @t;
OPEN c;
FETCH NEXT FROM c INTO @tb, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@tb) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@tb) AND ep.minor_id = 0 AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @tb;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @tb;
  END
  FETCH NEXT FROM c INTO @tb, @d;
END
CLOSE c; DEALLOCATE c;
PRINT N'① 表级注明:20 张 qc_/sl_recv 表已补(幂等)';
GO

-- ===== ② 删完全重复的 yj_field 行(SO_ORDER.备注:place/seq 全同,仅 id 不同) =====
-- 保留最早登记的一行(id 最小);仅当同面板同列同 place 同 seq 存在多行时才删较晚的行
DELETE f FROM yj_field f
WHERE EXISTS (
  SELECT 1 FROM yj_field k
  WHERE RTRIM(k.panel_code) = RTRIM(f.panel_code) AND k.col_name = f.col_name
    AND RTRIM(k.place) = RTRIM(f.place) AND k.seq = f.seq AND k.id < f.id);
PRINT N'② 完全重复字段行已清理(同面板/列/place/seq 只留最早一行)';
GO

-- ===== ③ 重建 v_sales_order_detail(链上 migrate-status-align.sql 的 B 段口径;列名对齐面板 24 字段) =====
-- 与 status-align 版的差异:① 存货名称品牌 → 品牌(该列已更名,沿用旧名会创建失败——踩坑台账 D15);
--                          ② 补 存货/计量单位/制单人 三个别名(面板 yj_field 用的就是这三个键);
--                          ③ 保留 line_no/品牌/存货名称/销售单位 等原列(历史报表与脚本引用兼容)。
IF OBJECT_ID('v_sales_order_detail') IS NOT NULL DROP VIEW v_sales_order_detail;
EXEC(N'CREATE VIEW v_sales_order_detail AS SELECT h.[id], h.[单据编号], h.[单据日期], h.[客户], h.[客户编码], h.[结算客户], h.[部门], h.[部门负责人], h.[业务员], h.[项目], h.[预计交货日期], h.[联系人], h.[备注], h.[审核时间], h.[审批人], h.[审批时间], h.asp_user1, h.asp_time1, h.asp_cancel'
  + N', l.[单据编号] AS line_no, l.[品牌], l.[存货名称] AS [存货], l.[存货名称], l.[存货编码], l.[规格型号], l.[数量], l.[销售单位] AS [计量单位], l.[销售单位], l.[单价], l.[税率%], l.[含税单价], l.[金额], l.[含税金额], l.[折扣金额], l.[现存量]'
  + N', h.asp_user1 AS [制单人]'
  + N', CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'''
  + N' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'''
  + N' WHEN s.shr IS NOT NULL THEN N''已审核'''
  + N' ELSE N''草稿'' END AS [单据状态]'
  + N', s.shr AS [审核人]'
  + N' FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]'
  + N' LEFT JOIN yj_doc_status s ON s.panel_code = ''SO_ORDER'' AND s.doc_no = h.[单据编号]');
PRINT N'③ v_sales_order_detail 已重建(状态列派生 + 面板字段键对齐)';
GO

-- ===== ④ PR_SCRAP 漂移字段:col_name 与实列对齐(标签不动,前端数据键不变) =====
-- 实列名是 物料产品名称(无斜杠,合规);yj_field 里登记成了 物料/产品名称 ⇒ 查询/保存都取不到值
UPDATE yj_field SET col_name = N'物料产品名称'
WHERE RTRIM(panel_code) = 'PR_SCRAP' AND col_name = N'物料/产品名称';
PRINT N'④ PR_SCRAP.物料/产品名称 的 col_name 已对齐实列';
GO

-- ===== 验证 =====
SELECT (SELECT COUNT(*) FROM sys.tables t WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name='MS_Description')) AS 仍无说明的表,
       (SELECT COUNT(*) FROM (SELECT RTRIM(panel_code) pc, col_name, RTRIM(place) pl, seq FROM yj_field
                              GROUP BY RTRIM(panel_code), col_name, RTRIM(place), seq HAVING COUNT(*) > 1) z) AS 仍完全重复的字段组,
       (SELECT COUNT(*) FROM sys.views WHERE name = 'v_sales_order_detail') AS 视图存在,
       (SELECT COUNT(*) FROM yj_field WHERE RTRIM(panel_code)='PR_SCRAP' AND col_name = N'物料/产品名称') AS PR_SCRAP旧字段残留;
GO
