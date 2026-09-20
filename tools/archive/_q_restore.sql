SET NOCOUNT ON;
-- 还原:探针复制单据时按 id 复用行,把 TCGRK-PO-001 的唯一行挪到了探针单;此处按 id 精确移回并清除探针写入
UPDATE bl_purchase_in SET 单据编号 = N'TCGRK-PO-001', 源单行号 = NULL, asp_user2 = NULL, asp_time2 = NULL
WHERE id = 124 AND 单据编号 = N'PI-2026-09-0009';
PRINT '受影响行数:';
SELECT @@ROWCOUNT AS n;
GO
SELECT 单据编号, COUNT(*) AS 行数 FROM bl_purchase_in WHERE 单据编号 IN ('TCGRK-PO-001','PI-2026-09-0009','PI-2026-09-0010') GROUP BY 单据编号;
GO
SELECT id, 单据编号, 存货编码, 实收数量, 计量单位, 单价, 仓库编码, 源单行号, asp_user1 FROM bl_purchase_in WHERE id = 124;
GO
