-- 清理 /px/specByProduct 端到端验证用的 ZZ-FIX 假数据(2026-09-20)
-- 用完即删:这三张表的数据是验证「自动填充规格书」链路时造的,不能留在库里。
SET NOCOUNT ON;

DECLARE @d1 INT, @d2 INT, @a INT;

DELETE FROM rd_spec_doc_detail WHERE 单据编号 IN (N'ZZFIX-SD-001', N'ZZFIX-SD-002');
SET @d1 = @@ROWCOUNT;

DELETE FROM rd_spec_doc_head WHERE 单据编号 IN (N'ZZFIX-SD-001', N'ZZFIX-SD-002');
SET @d2 = @@ROWCOUNT;

DELETE FROM rd_spec_assign WHERE 产品编号 = N'ZZFIX-P001';
SET @a = @@ROWCOUNT;

SELECT N'detail' AS 表, @d1 AS 删除行数
UNION ALL SELECT N'head', @d2
UNION ALL SELECT N'assign', @a;

-- 复核:必须全为 0
SELECT N'残留 head' AS 检查, COUNT(*) AS 行数 FROM rd_spec_doc_head
  WHERE 单据编号 LIKE N'ZZFIX-%'
UNION ALL SELECT N'残留 detail', COUNT(*) FROM rd_spec_doc_detail WHERE 单据编号 LIKE N'ZZFIX-%'
UNION ALL SELECT N'残留 assign', COUNT(*) FROM rd_spec_assign WHERE 产品编号 LIKE N'ZZFIX-%';
