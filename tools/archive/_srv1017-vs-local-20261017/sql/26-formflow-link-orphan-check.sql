SET NOCOUNT ON;
/* form_flow_link 行键 = 单据编号#行id;行 id 被同步重建就会断链。两库各数一遍。 */
PRINT '=== 服务器快照:form_flow_link 行键悬空统计 ===';
;WITH base AS (
  SELECT source_panel_code AS p,
         CASE WHEN ISNUMERIC(CASE WHEN CHARINDEX('@', source_line_key) > 0
                   THEN SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1,
                                  CHARINDEX('@', source_line_key) - CHARINDEX('#', source_line_key) - 1)
                   ELSE SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1, 20) END) = 1
              THEN CAST(CASE WHEN CHARINDEX('@', source_line_key) > 0
                   THEN SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1,
                                  CHARINDEX('@', source_line_key) - CHARINDEX('#', source_line_key) - 1)
                   ELSE SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1, 20) END AS int)
         END AS rid
  FROM [HSDZ_MES_SRV1017].dbo.form_flow_link
  WHERE CHARINDEX('#', source_line_key) > 0 AND link_status = 'ACTIVE'
), k AS (
  SELECT base.p, base.rid,
         CASE WHEN base.p = 'SO_ORDER' AND b.id IS NULL THEN 1 ELSE 0 END AS so_orphan,
         CASE WHEN base.p = 'PU_ORDER' AND u.id IS NULL THEN 1 ELSE 0 END AS pu_orphan
  FROM base
  LEFT JOIN [HSDZ_MES_SRV1017].dbo.bl_so_order b ON b.id = base.rid
  LEFT JOIN [HSDZ_MES_SRV1017].dbo.bl_pu_order u ON u.id = base.rid
)
SELECT p AS 面板, COUNT(*) AS 链接数,
       SUM(CASE WHEN rid IS NULL THEN 1 ELSE 0 END) AS 解析不出id,
       SUM(so_orphan) AS SO明细键悬空, SUM(pu_orphan) AS PU明细键悬空
FROM k GROUP BY p ORDER BY 链接数 DESC;

PRINT '=== 本地库:form_flow_link 行键悬空统计 ===';
;WITH base AS (
  SELECT source_panel_code AS p,
         CASE WHEN ISNUMERIC(CASE WHEN CHARINDEX('@', source_line_key) > 0
                   THEN SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1,
                                  CHARINDEX('@', source_line_key) - CHARINDEX('#', source_line_key) - 1)
                   ELSE SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1, 20) END) = 1
              THEN CAST(CASE WHEN CHARINDEX('@', source_line_key) > 0
                   THEN SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1,
                                  CHARINDEX('@', source_line_key) - CHARINDEX('#', source_line_key) - 1)
                   ELSE SUBSTRING(source_line_key, CHARINDEX('#', source_line_key) + 1, 20) END AS int)
         END AS rid
  FROM dbo.form_flow_link
  WHERE CHARINDEX('#', source_line_key) > 0 AND link_status = 'ACTIVE'
), k AS (
  SELECT base.p, base.rid,
         CASE WHEN base.p = 'SO_ORDER' AND b.id IS NULL THEN 1 ELSE 0 END AS so_orphan,
         CASE WHEN base.p = 'PU_ORDER' AND u.id IS NULL THEN 1 ELSE 0 END AS pu_orphan
  FROM base
  LEFT JOIN dbo.bl_so_order b ON b.id = base.rid
  LEFT JOIN dbo.bl_pu_order u ON u.id = base.rid
)
SELECT p AS 面板, COUNT(*) AS 链接数,
       SUM(CASE WHEN rid IS NULL THEN 1 ELSE 0 END) AS 解析不出id,
       SUM(so_orphan) AS SO明细键悬空, SUM(pu_orphan) AS PU明细键悬空
FROM k GROUP BY p ORDER BY 链接数 DESC;

PRINT '=== bl_so_order / bl_pu_order 行 id 交集(2 库) ===';
SELECT 'bl_so_order' AS t,
  (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.bl_so_order) AS 服务器行,
  (SELECT COUNT(*) FROM dbo.bl_so_order) AS 本地行,
  (SELECT COUNT(*) FROM dbo.bl_so_order l JOIN [HSDZ_MES_SRV1017].dbo.bl_so_order s ON s.id = l.id) AS 同id行,
  (SELECT COUNT(*) FROM dbo.bl_so_order l JOIN [HSDZ_MES_SRV1017].dbo.bl_so_order s ON s.id = l.id AND s.单据编号 = l.单据编号 AND s.存货编码 = l.存货编码) AS 同id且同业务键
UNION ALL
SELECT 'bl_pu_order',
  (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.bl_pu_order),
  (SELECT COUNT(*) FROM dbo.bl_pu_order),
  (SELECT COUNT(*) FROM dbo.bl_pu_order l JOIN [HSDZ_MES_SRV1017].dbo.bl_pu_order s ON s.id = l.id),
  (SELECT COUNT(*) FROM dbo.bl_pu_order l JOIN [HSDZ_MES_SRV1017].dbo.bl_pu_order s ON s.id = l.id AND s.单据编号 = l.单据编号 AND s.物料编码 = l.物料编码);

