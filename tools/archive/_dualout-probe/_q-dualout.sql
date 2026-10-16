SET NOCOUNT ON;
PRINT '== A. WO_REPORT 面板字段登记(place/seq/可见性) ==';
SELECT label, col_name, place, seq, visible, hidden, required
FROM yj_field WHERE panel_code = N'WO_REPORT' ORDER BY seq, id;

PRINT '== B. 成品入库单头:自动生成的那张(非金蝶导入) ==';
SELECT 单据编号, 单据日期, 业务类型, 生产车间, 加工单号, 仓库, 工单行号, 批次号, 经手人, 单据状态, 备注
FROM bd_finish_in WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据编号 LIKE N'FI-%' ORDER BY 单据编号;

PRINT '== C. 成品入库单行:FI 单(含红字负数量) ==';
SELECT 单据编号, 产品编码, 产品名称, 实收数量, 计量单位, 批号, 仓库
FROM bl_finish_in WHERE ISNULL(asp_cancel,'N') <> 'Y' AND (单据编号 LIKE N'FI-%' OR 实收数量 < 0) ORDER BY 单据编号;

PRINT '== D. 报工行:切炭直销证据(全部未作废报工行) ==';
SELECT 报工单号, gldh AS 工单号, gxdm AS 工序, sl AS 报工数量, 直销数量, 批次号, wgzt AS 完工标志, post_no AS 入库单号
FROM scjl WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id;
