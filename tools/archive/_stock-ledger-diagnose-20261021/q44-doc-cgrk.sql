SET NOCOUNT ON;
-- ① 这张单在不在、有没有流水、有没有结存
SELECT 单头 = COUNT(*) FROM bd_purchase_in WHERE 单据编号 = 'CGRK-20261011-03389';
SELECT 行数 = COUNT(*) FROM bl_purchase_in WHERE 单据编号 = 'CGRK-20261011-03389';
SELECT 头状态 = 单据状态, 单据日期, 供应商, 批次号, 写入者 = asp_user1, 写入时间 = asp_time1
FROM bd_purchase_in WHERE 单据编号 = 'CGRK-20261011-03389';

SELECT 行id = l.id, 存货 = l.存货编码, 批次号 = l.批次号, 批号 = l.批号, 实收数量 = l.实收数量,
       仓库 = l.仓库, 仓库编码 = l.仓库编码, 行作废 = l.asp_cancel,
       有流水 = CASE WHEN EXISTS (SELECT 1 FROM inh f WHERE f.src = 1 AND f.rid = l.id) THEN '有' ELSE '没有' END
FROM bl_purchase_in l WHERE l.单据编号 = 'CGRK-20261011-03389';

-- ② 该物料在结存/流水里有没有
SELECT 物料 = 'YJ-YCYX-055', kucun行 = COUNT(*) FROM kucun WHERE wzdm = 'YJ-YCYX-055';
SELECT 仓库编码 = ckdm, 批号 = ISNULL(lot_no,'<NULL>'), 累计入 = rkl, 累计出 = ckl, 余量 = yl, 来源 = asp_user1
FROM kucun WHERE wzdm = 'YJ-YCYX-055';
SELECT 方向 = '入', 单号 = 单据编号, 仓库 = 仓库编码, 批号 = ISNULL(批号,'<NULL>'), 数量, 写入者 = asp_user1, 时间 = asp_time1
FROM inh WHERE 物料编码 = 'YJ-YCYX-055'
UNION ALL
SELECT '出', 单据编号, 仓库编码, ISNULL(批号,'<NULL>'), 数量, asp_user1, asp_time1
FROM outh WHERE 物料编码 = 'YJ-YCYX-055';
