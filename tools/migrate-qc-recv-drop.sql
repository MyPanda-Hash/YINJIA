-- migrate-qc-recv-drop.sql — 暂收入库单 QC_RECV 下线(2026-09-15)
-- 用户口径:暂收入库单去除,相关内容一并删除。其表头角色(采购暂收)已由
-- 「库存核算·送料暂收单 SL_RECV」承接;来料检验单的选单来源已在代码侧切至 SL_RECV。
-- 删除范围:
--   1) 业务表 qc_recv / qc_recv_detail(现库为 3 张草稿测试单 ZS-2026-09-0001..0003,含明细)
--   2) yj_panel / yj_field 注册
--   3) 面板译名「暂收入库单」(en/ja)
--   4) 状态/占用/权限/附件行(防御性清理,当前均为 0)
-- 幂等: 可重复执行(全部 IF EXISTS / WHERE 判存)。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-qc-recv-drop.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-qc-recv-drop.sql"
SET NOCOUNT ON;

-- ══════════ 0. 批号追溯视图去暂收段(2026-09-17 收编入链时补) ══════════
-- v_lot_trace 第一段(暂收)引用 qc_recv/qc_recv_detail,本脚本要删这两张表——
-- 视图依赖会挡住 DROP TABLE(3729),必须先按终态重建视图(去掉暂收段,SL_RECV 明细无批号列,不接替该段)。
IF OBJECT_ID('v_lot_trace') IS NOT NULL DROP VIEW v_lot_trace;
GO
EXEC('CREATE VIEW v_lot_trace AS
SELECT d.[批号] AS 批号, d.[物料编码] AS 物料编码, d.[物料名称] AS 物料名称, N''来料检验'' AS 事件,
       h.[单据编号] AS 单据编号, h.[单据日期] AS 单据日期, d.[送检数量] AS 数量, NULL AS 仓库,
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 状态,
       h.[检验员] AS 相关人, h.[供应商] AS 对象, CAST(NULL AS char(1)) AS asp_cancel
FROM qc_insp_detail d JOIN qc_insp h ON h.[单据编号] = d.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_INSP'' AND st.doc_no = h.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
-- (2026-09-23 仓库正名:migrate-wh-field-rename 把采购入库明细的 仓库名称 改名回了 仓库,照读 l.[仓库])
SELECT l.[批号], l.[存货编码], l.[存货名称], N''采购入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[审核人], h.[供应商], CAST(NULL AS char(1))
FROM bl_purchase_in l JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''PURCHASE_IN'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[材料编码], l.[材料名称], N''领料出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[领用人], h.[加工单号], CAST(NULL AS char(1))
FROM bl_material_out l JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''MATERIAL_OUT'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT NULL, w.[产品编码], w.[产品名称], N''工序质检('' + h.[工序] + N'')'', h.[单据编号], h.[单据日期], NULL, w.[生产车间],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[检验员], h.[工单号], CAST(NULL AS char(1))
FROM qc_op h JOIN wo_order w ON w.[单据编号] = h.[工单号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_OP'' AND st.doc_no = h.[单据编号]
WHERE ISNULL(h.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT d.[批号], d.[物料编码], d.[物料名称], N''不良处置('' + d.[处置方式] + N'')'', d.[单据编号], d.[单据日期], d.[数量], d.[原仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       d.[经手人], d.[处置原因], CAST(NULL AS char(1))
FROM qc_disposal d LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_DISPOSAL'' AND st.doc_no = d.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[产品编码], l.[产品名称], N''成品入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[经手人], h.[加工单号], CAST(NULL AS char(1))
FROM bl_finish_in l JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''FINISH_IN'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[存货编码], l.[存货名称], N''销售出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[经手人], h.[客户], CAST(NULL AS char(1))
FROM bl_sale_out l JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''SALE_OUT'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''');
GO

-- ══════════ 1. 业务表(含数据:草稿测试单) ══════════
IF OBJECT_ID('qc_recv_detail') IS NOT NULL DROP TABLE qc_recv_detail;
IF OBJECT_ID('qc_recv') IS NOT NULL DROP TABLE qc_recv;
GO

-- ══════════ 2. 面板/字段注册 ══════════
DELETE FROM yj_field WHERE panel_code = 'QC_RECV';
DELETE FROM yj_panel WHERE panel_code = 'QC_RECV';
GO

-- ══════════ 3. 面板译名 ══════════
DELETE FROM yj_translation WHERE scope = 'panel' AND ref_key = N'暂收入库单';
GO

-- ══════════ 4. 状态/占用/权限/附件(防御性;当前 0 行) ══════════
DELETE FROM yj_doc_status WHERE panel_code = 'QC_RECV';
DELETE FROM form_flow_link WHERE source_panel_code = 'QC_RECV' OR target_panel_code = 'QC_RECV';
DELETE FROM yj_role_panel WHERE panel_code = 'QC_RECV';
DELETE FROM yj_attachment WHERE panel_code = 'QC_RECV';
DELETE FROM yj_form_approval WHERE panel_code = 'QC_RECV';
GO

-- ══════════ 5. 自检(应全为 0;table 不存在) ══════════
SELECT
  OBJECT_ID('qc_recv') AS qc_recv_table,
  OBJECT_ID('qc_recv_detail') AS qc_recv_detail_table,
  (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'QC_RECV') AS panel_rows,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'QC_RECV') AS field_rows,
  (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'暂收入库单') AS panel_i18n,
  (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_RECV') AS status_rows,
  (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code = 'QC_RECV' OR target_panel_code = 'QC_RECV') AS link_rows;
PRINT N'migrate-qc-recv-drop 完成:暂收入库单下线(表+注册+译名+状态 全清;检验单选单来源已切 SL_RECV)';
GO
