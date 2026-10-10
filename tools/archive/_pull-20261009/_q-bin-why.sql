SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- ① 采购入库单:状态 × 行仓库 × 该仓有没有仓位档案';
SELECT TOP 12 p.单据编号 AS 单号,
       CASE WHEN ISNULL(s.canceled,'N') = 'Y' THEN N'已作废'
            WHEN ISNULL(s.shr,'') = '' AND ISNULL(s.pending,'N') = 'N' THEN N'草稿'
            WHEN ISNULL(s.pending,'N') = 'Y' THEN N'审批中'
            ELSE N'已审核' END AS 单据状态,
       RTRIM(ISNULL(l.仓库, N'')) AS 行仓库,
       ISNULL(l.仓位编码, N'(空)') AS 仓位编码,
       (SELECT COUNT(*) FROM bs_wh_loc w WHERE ISNULL(w.asp_cancel,N'N') <> N'Y'
          AND (RTRIM(w.仓库) = RTRIM(l.仓库) OR RTRIM(w.仓库编码) = RTRIM(l.仓库))) AS 该仓仓位数
  FROM bd_purchase_in p
  JOIN bl_purchase_in l ON l.单据编号 = p.单据编号
  LEFT JOIN yj_doc_status s ON s.panel_code = N'PURCHASE_IN' AND s.doc_no = p.单据编号
 WHERE ISNULL(l.asp_cancel, N'N') <> N'Y' AND ISNULL(p.asp_cancel, N'N') <> N'Y'
 ORDER BY p.id DESC;

PRINT N'-- ② 本库哪些仓有仓位档案';
SELECT RTRIM(仓库编码) AS 仓库编码, RTRIM(仓库) AS 仓库名, COUNT(*) AS 仓位数
  FROM bs_wh_loc WHERE ISNULL(asp_cancel,N'N') <> N'Y' GROUP BY 仓库编码, 仓库 ORDER BY 仓库编码;

PRINT N'-- ③ 本库启用仓位管理的仓';
SELECT RTRIM(仓库编码) AS 仓库编码, RTRIM(仓库名称) AS 仓库名 FROM bs_wh
 WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(启用仓位管理,0) = 1;

PRINT N'-- ④ 各仓在采购入库单里的使用次数(看用户的单落在哪个仓)';
SELECT RTRIM(ISNULL(l.仓库, N'(空)')) AS 行仓库, COUNT(*) AS 行数
  FROM bl_purchase_in l WHERE ISNULL(l.asp_cancel, N'N') <> N'Y'
 GROUP BY RTRIM(ISNULL(l.仓库, N'(空)')) ORDER BY COUNT(*) DESC;
