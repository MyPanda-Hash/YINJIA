-- seed-verify-bom-20261021.sql
-- 目的:为**验证**工单扫码领料,给已排产工单的产品灌一份 BOM(真实物料,取自库存)。
-- 背景:2026-10-21 实测 12 条已排产工单的产品 BOM 全为 0 行,扫码后领料清单是空的,
--       没法验证「扫码 → 取秤 → 提交」整条链路,所以先灌可用数据。
-- ⚠ 这是**验证用数据**,不是正式 BOM;asp_user1='seed-verify-20261021' 便于识别与一键清理:
--     DELETE FROM dbo.mate WHERE asp_user1='seed-verify-20261021';
-- 幂等:按 (产品, 子件) 判重,重复执行不重复插。
SET NOCOUNT ON;
GO

DECLARE @seed TABLE (
  product nvarchar(50), productName nvarchar(200), line int,
  item nvarchar(50), itemName nvarchar(200), unit nvarchar(20), perQty decimal(18,4)
);
INSERT INTO @seed (product, productName, line, item, itemName, unit, perQty) VALUES
 -- GD-2026-10-0220 行1:S022-4 A+级烧结炭棒/滤芯(排产 160)
 (N'S022-4', N'A+级烧结炭棒/滤芯', 10, N'YJ-HKB-003',  N'黑卡博酸洗炭RWAP4453', N'kg',  0.0500),
 (N'S022-4', N'A+级烧结炭棒/滤芯', 20, N'YJ-XWR-003',  N'白色无纺布130g',        N'张',  2.0000),
 (N'S022-4', N'A+级烧结炭棒/滤芯', 30, N'YJ-JPL-066',  N'55目乳白网',            N'条',  2.0000),
 (N'S022-4', N'A+级烧结炭棒/滤芯', 40, N'YJ-CQF-005',  N'防尘塞',                N'个',  1.0000),
 -- GD-2026-10-0220 行2:S032-3 S阻垢炭棒/滤芯(排产 60)
 (N'S032-3', N'S阻垢炭棒/滤芯',    10, N'YJ-YKRS-007', N'英克瑞斯酸洗炭',        N'kg',  0.0500),
 (N'S032-3', N'S阻垢炭棒/滤芯',    20, N'YJ-XWR-014',  N'白色无纺布100g',        N'张',  2.0000),
 (N'S032-3', N'S阻垢炭棒/滤芯',    30, N'YJ-JPL-067',  N'55目透明网',            N'条',  2.0000),
 -- GD-2026-10-0206 行1:C-84-01 PP复合A级炭棒/滤芯(排产 15000)
 (N'C-84-01', N'PP复合A级炭棒/滤芯', 10, N'YJ-HKB-003', N'黑卡博酸洗炭RWAP4453', N'kg',  0.0300),
 (N'C-84-01', N'PP复合A级炭棒/滤芯', 20, N'YJ-XWR-014', N'白色无纺布100g',        N'张',  2.0000),
 (N'C-84-01', N'PP复合A级炭棒/滤芯', 30, N'YJ-JPL-067', N'55目透明网',            N'条',  2.0000),
 -- GD-2026-10-0206 行2:C-84-02 S阻垢炭棒/滤芯(排产 15000)
 (N'C-84-02', N'S阻垢炭棒/滤芯',    10, N'YJ-YKRS-007', N'英克瑞斯酸洗炭',        N'kg',  0.0300),
 (N'C-84-02', N'S阻垢炭棒/滤芯',    20, N'YJ-XWR-032',  N'白色无纺布100g',        N'张',  2.0000),
 (N'C-84-02', N'S阻垢炭棒/滤芯',    30, N'YJ-JPL-066',  N'55目乳白网',            N'条',  2.0000),
 -- GD-2026-10-0172 行2:A-32-30 PP复合阻垢抑菌炭棒滤芯(排产 2500)
 (N'A-32-30', N'PP复合阻垢抑菌炭棒滤芯', 10, N'YJ-HKB-003', N'黑卡博酸洗炭RWAP4453', N'kg', 0.0300),
 (N'A-32-30', N'PP复合阻垢抑菌炭棒滤芯', 20, N'YJ-XWR-003', N'白色无纺布130g',        N'张', 2.0000),
 (N'A-32-30', N'PP复合阻垢抑菌炭棒滤芯', 30, N'YJ-JPL-066', N'55目乳白网',            N'条', 2.0000),
 -- GD-2026-10-0166 行1:A-55-01 折叠复合炭棒滤芯(排产 1000)
 (N'A-55-01', N'折叠复合炭棒滤芯',   10, N'YJ-YKRS-007', N'英克瑞斯酸洗炭',        N'kg',  0.0400),
 (N'A-55-01', N'折叠复合炭棒滤芯',   20, N'YJ-XWR-014',  N'白色无纺布100g',        N'张',  3.0000),
 (N'A-55-01', N'折叠复合炭棒滤芯',   30, N'YJ-JPL-066',  N'55目乳白网',            N'条',  2.0000);

INSERT INTO dbo.mate
  (m_no, m_date, wzdm1, wzmc1, xc, wzdm2, wzmc2, jldw2, bzl, sl2, in_dj, jine, shl,
   asp_user1, asp_time1, asp_cancel)
SELECT s.product, CAST(GETDATE() AS date), s.product, s.productName, s.line,
       s.item, s.itemName, s.unit, s.perQty, 0, 0, 0, 0,
       N'seed-verify-20261021', SYSDATETIME(), 'N'
FROM @seed s
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.mate m
  WHERE m.m_no = s.product AND m.wzdm2 = s.item AND ISNULL(m.asp_cancel,'N') <> 'Y'
);
GO

-- 自检:每张测试工单的产品都必须有 BOM 行
DECLARE @miss TABLE (product nvarchar(50));
INSERT INTO @miss (product)
SELECT DISTINCT p.dm FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.scx,'') <> ''
  AND p.dm IN (N'S022-4', N'S032-3', N'C-84-01', N'C-84-02', N'A-32-30', N'A-55-01')
  AND NOT EXISTS (SELECT 1 FROM dbo.mate m WHERE m.m_no = p.dm AND ISNULL(m.asp_cancel,'N') <> 'Y');
IF EXISTS (SELECT 1 FROM @miss)
BEGIN
  DECLARE @s nvarchar(400) = N'';
  SELECT @s = @s + product + N',' FROM @miss;
  RAISERROR(N'以下产品仍无 BOM:%s', 16, 1, @s);
END
GO
