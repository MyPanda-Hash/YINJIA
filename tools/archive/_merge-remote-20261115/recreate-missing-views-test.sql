/* 由 HSDZ_MES 导出、在 HSDZ_MES_TEST 重建缺失视图(2026-11-15 测试库视图修复) */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.v_pu_order_detail', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_pu_order_detail]');
GO
CREATE VIEW dbo.v_pu_order_detail AS
SELECT
    ROW_NUMBER() OVER (ORDER BY h.[单据日期] DESC, h.[单据编号], l.id) AS id,
    h.[单据日期],
    h.[单据编号],
    h.[单据状态],
    h.[供应商],
    h.[供应商编码],
    ISNULL(h.[业务员名称], h.[业务员编码]) AS [业务员],
    h.[币种],
    h.[合同号],
    h.[交货日期],
    l.[预计到货日期],       -- 在**行**上(bl_pu_order),头表只有 交货日期
    h.[到货地址],
    h.[付款方式],
    h.[结算期限],
    h.[数据来源],
    l.[物料编码],
    l.[物料名称],
    l.[规格型号],
    l.[单位],
    l.[数量],
    l.[单价],
    l.[税率%],
    l.[含税单价],
    l.[金额],
    l.[含税金额],
    l.[折扣%],
    l.[折扣金额],
    l.[仓库],
    l.[备注] AS [行备注],
    h.asp_user1,
    h.asp_time1,
    h.asp_cancel,
    l.asp_cancel AS line_cancel
  FROM dbo.bd_pu_order h
  JOIN dbo.bl_pu_order l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(l.asp_cancel, 'N') <> 'Y';
GO
IF OBJECT_ID(N'dbo.v_pu_order_stats', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_pu_order_stats]');
GO
CREATE VIEW dbo.v_pu_order_stats AS
SELECT
    ROW_NUMBER() OVER (ORDER BY h.[供应商], l.[物料编码]) AS id,
    h.[供应商],
    h.[供应商编码],
    l.[物料编码],
    l.[物料名称],
    l.[规格型号],
    l.[单位],
    COUNT(DISTINCT h.[单据编号]) AS [订单数],
    SUM(ISNULL(l.[数量], 0))   AS [数量],
    SUM(ISNULL(l.[金额], 0))   AS [金额],
    SUM(ISNULL(l.[含税金额], 0)) AS [含税金额],
    SUM(ISNULL(l.[折扣金额], 0)) AS [折扣金额],
    CASE WHEN SUM(ISNULL(l.[数量], 0)) = 0 THEN NULL
         ELSE SUM(ISNULL(l.[金额], 0)) / SUM(ISNULL(l.[数量], 0)) END AS [平均单价],
    MIN(h.[交货日期]) AS [最早交货日期],
    MAX(h.[交货日期]) AS [最晚交货日期],
    MAX(h.asp_cancel) AS asp_cancel
  FROM dbo.bd_pu_order h
  JOIN dbo.bl_pu_order l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(l.asp_cancel, 'N') <> 'Y'
 GROUP BY h.[供应商], h.[供应商编码], l.[物料编码], l.[物料名称], l.[规格型号], l.[单位];
GO
IF OBJECT_ID(N'dbo.v_qc_insp_rec_detail', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_qc_insp_rec_detail]');
GO
/* ═════════ B. 检验数据记录明细表视图 ═════════
   ⚠ CREATE / ALTER VIEW 必须是本批次第一条语句 ⇒ 单独一批。 */
CREATE   VIEW dbo.v_qc_insp_rec_detail AS
WITH insp AS (
    SELECT d.*, ROW_NUMBER() OVER (PARTITION BY d.[单据编号] ORDER BY d.id) AS 行序号
      FROM dbo.qc_insp_detail d
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
), recv AS (
    SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.[单据编号] ORDER BY s.id) AS 行序号
      FROM dbo.sl_recv_detail s
     WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
), pin AS (
    SELECT b.[id], b.[单据编号], b.[存货编码], b.[批号], b.[行号],
           ROW_NUMBER() OVER (PARTITION BY b.[单据编号] ORDER BY b.id) AS 行序号
      FROM dbo.bl_purchase_in b
     WHERE ISNULL(b.asp_cancel, 'N') <> 'Y'
)
SELECT
    ROW_NUMBER() OVER (ORDER BY r.[单据日期] DESC, r.id DESC) AS id,
    r.[单据日期],
    r.[单据编号]                       AS [检验数据记录单号],
    r.[来料检验单号],
    CAST(dd.[行序号] AS nvarchar(20))  AS [来料检验单行号],
    c.[检验状态],
    c.[是否合格],
    COALESCE(NULLIF(c.[检测物料类别], N''), inv.[所属类别]) AS [检测物料类别],
    r.[物料编码],
    r.[物料名称],
    r.[物料批次],
    r.[来料数量],
    i.[供应商],
    r.[检验日期],
    r.[检验人],
    r.[检验结论],
    COALESCE(NULLIF(i.[采购订单号], N''), NULLIF(sv.[采购单号], N''), NULLIF(sv.[订单号], N'')) AS [采购订单号],
    COALESCE(NULLIF(dd.[采购订单行号], N''), NULLIF(sv.[采购订单行号], N'')) AS [采购订单行号],
    i.[暂收单号]                       AS [送料暂收单号],
    CAST(sv.[行序号] AS nvarchar(20))  AS [送料暂收单行号],
    COALESCE(NULLIF(dd.[入库单号], N''), bi.[入库单号]) AS [采购入库单号],
    COALESCE(NULLIF(LTRIM(RTRIM(pl.[行号])), N''), CAST(pl.[行序号] AS nvarchar(20))) AS [采购入库单行号],
    c.[单据编号]                       AS [目录单号],
    c.[id]                             AS [目录行id],
    r.asp_user1, r.asp_time1, r.asp_cancel
  FROM dbo.qc_insp_rec r
  LEFT JOIN dbo.qc_insp i
         ON i.[单据编号] = r.[来料检验单号] AND ISNULL(i.asp_cancel, 'N') <> 'Y'
  /* 检验单行:同单同物料;同批次优先(一单同物料多批次时才能对到正确那行) */
  OUTER APPLY (SELECT TOP 1 x.[行序号], x.[入库单号], x.[采购订单行号]
                 FROM insp x
                WHERE x.[单据编号] = r.[来料检验单号]
                  AND x.[物料编码] = r.[物料编码]
                ORDER BY CASE WHEN ISNULL(x.[批次号], N'') = ISNULL(r.[物料批次], N'') THEN 0 ELSE 1 END, x.id) dd
  /* 暂收单行:同单同物料;同批次优先 */
  OUTER APPLY (SELECT TOP 1 y.[行序号], y.[采购单号], y.[订单号], y.[采购订单行号]
                 FROM recv y
                WHERE y.[单据编号] = i.[暂收单号]
                  AND y.[物料编码] = r.[物料编码]
                ORDER BY CASE WHEN ISNULL(y.[批次号], N'') = ISNULL(r.[物料批次], N'') THEN 0 ELSE 1 END, y.id) sv
  /* 入库单兜底:该检验单作为「来源单号」生成过采购入库单(2026-11-11 的「来源」列) */
  OUTER APPLY (SELECT TOP 1 b.[单据编号] AS [入库单号]
                 FROM dbo.bd_purchase_in b
                WHERE b.[来源单号] = r.[来料检验单号] AND ISNULL(b.asp_cancel, 'N') <> 'Y'
                ORDER BY b.id) bi
  /* 入库单行:同单同物料;同批次优先 */
  OUTER APPLY (SELECT TOP 1 p.[行号], p.[行序号]
                 FROM pin p
                WHERE p.[单据编号] = COALESCE(NULLIF(dd.[入库单号], N''), bi.[入库单号])
                  AND p.[存货编码] = r.[物料编码]
                ORDER BY CASE WHEN ISNULL(p.[批号], N'') = ISNULL(r.[物料批次], N'') THEN 0 ELSE 1 END, p.id) pl
  /* 检验目录行:检验状态/是否合格/检测物料类别(已完成的行只在这里看得到)
     ⚠ 2026-11-11 修:原先同时要求 `z.物料编码 = r.物料编码`,而早期目录行的物料编码是空的
     (migrate-qc-catalog.sql 播的那批只写了物料名称),NULL 一比对不上 ⇒ 那些行在明细表里
     「检验状态」是空的,被默认闸门(只看已完成检验)挡掉,用户看到"已完成 3 条、明细表只有 2 条"。
     现在只按 检验数据记录单号 关联,物料编码只作**优先级**(同批次号优先),不再当硬条件。 */
  OUTER APPLY (SELECT TOP 1 z.[id], z.[单据编号], z.[检验状态], z.[是否合格], z.[检测物料类别]
                 FROM dbo.qc_catalog_detail z
                WHERE z.[检验数据记录单号] = r.[单据编号]
                  AND ISNULL(z.asp_cancel, 'N') <> 'Y'
                ORDER BY CASE WHEN ISNULL(z.[物料编码], N'') = ISNULL(r.[物料编码], N'') THEN 0 ELSE 1 END, z.id DESC) c
  /* 检测物料类别兜底:商品档案所属类别 */
  OUTER APPLY (SELECT TOP 1 v.[所属类别] FROM dbo.bs_inv v WHERE v.[存货编码] = r.[物料编码] ORDER BY v.id) inv
 WHERE ISNULL(r.asp_cancel, 'N') <> 'Y';
GO
IF OBJECT_ID(N'dbo.v_stocktake_detail', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_stocktake_detail]');
GO
CREATE   VIEW dbo.v_stocktake_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
  h.[部门编码], h.[部门], h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人],
  l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[批号],
  l.[仓库], l.[仓位编码] AS [仓位], l.[账面数量], l.[实盘数量], l.[差异数量],
  l.[单价], l.[金额], l.[明细备注]
FROM bd_stocktake h LEFT JOIN bl_stocktake l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = 'STOCKTAKE' AND s.doc_no = h.[单据编号];
GO
IF OBJECT_ID(N'dbo.v_stocktake_stats', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_stocktake_stats]');
GO
CREATE   VIEW dbo.v_stocktake_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  h.[部门编码], h.[部门], l.[仓库], l.[仓位编码] AS [仓位], l.[存货编码], l.[存货名称] AS [存货],
  l.[规格型号], l.[计量单位],
  SUM(COALESCE(l.[账面数量], 0)) AS [账面数量],
  SUM(COALESCE(l.[实盘数量], 0)) AS [实盘数量],
  SUM(COALESCE(l.[差异数量], 0)) AS [差异数量],
  SUM(COALESCE(l.[金额], 0)) AS [金额]
FROM bd_stocktake h LEFT JOIN bl_stocktake l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'STOCKTAKE' AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')
GROUP BY h.asp_cancel, h.[部门编码], h.[部门], l.[仓库], l.[仓位编码],
         l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位];
GO
IF OBJECT_ID(N'dbo.v_transfer_detail', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_transfer_detail]');
GO
/* ═════════════ ② 视图重建(把仓位列带出去) ═════════════ */
CREATE   VIEW dbo.v_transfer_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
  h.[部门编码], h.[部门], h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人],
  l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[批号],
  l.[调出仓库], l.[调出仓位编码] AS [调出仓位], l.[调入仓库], l.[调入仓位编码] AS [调入仓位],
  l.[数量], l.[单价], l.[金额], l.[明细备注]
FROM bd_transfer h LEFT JOIN bl_transfer l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = 'TRANSFER' AND s.doc_no = h.[单据编号];
GO
IF OBJECT_ID(N'dbo.v_transfer_stats', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_transfer_stats]');
GO
CREATE   VIEW dbo.v_transfer_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  l.[调出仓库], l.[调出仓位编码] AS [调出仓位], l.[调入仓库], l.[调入仓位编码] AS [调入仓位],
  h.[部门编码], h.[部门], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位],
  SUM(COALESCE(l.[数量], 0)) AS [调拨数量],
  SUM(COALESCE(l.[金额], 0)) AS [金额],
  SUM(COALESCE(l.[金额], 0)) / NULLIF(SUM(COALESCE(l.[数量], 0)), 0) AS [单价]
FROM bd_transfer h LEFT JOIN bl_transfer l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'TRANSFER' AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')
GROUP BY h.asp_cancel, l.[调出仓库], l.[调出仓位编码], l.[调入仓库], l.[调入仓位编码],
         h.[部门编码], h.[部门], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位];
GO
IF OBJECT_ID(N'dbo.v_wo_completion_detail', N'V') IS NOT NULL EXEC(N'DROP VIEW [v_wo_completion_detail]');
GO
CREATE   VIEW dbo.v_wo_completion_detail AS
      SELECT DISTINCT s.id, s.asp_cancel, s.wgzt,
        s.[报工单号], s.gldh, s.[工单行号], s.[批次号], s.gxdm,
        s.sl, s.jldw, s.wzdm, s.mc, s.gg, s.scx, s.ywman, s.wgsj, s.jc_no, s.post_no
      FROM dbo.scjl s
      WHERE RTRIM(s.wgzt) = N'Y' AND ISNULL(s.asp_cancel, N'N') <> N'Y';
GO
