SET NOCOUNT ON;
SELECT N'kucun.id 属性' AS k,
       COLUMNPROPERTY(OBJECT_ID('kucun'), 'id', 'IsIdentity') AS is_identity,
       COLUMNPROPERTY(OBJECT_ID('kucun'), 'id', 'AllowsNull') AS allows_null,
       (SELECT c.is_nullable FROM sys.columns c WHERE c.object_id=OBJECT_ID('kucun') AND c.name='id') AS is_nullable;
GO
SELECT N'id 默认值/约束' AS k, d.definition
  FROM sys.default_constraints d JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id
 WHERE d.parent_object_id=OBJECT_ID('kucun') AND c.name='id';
GO
-- 试插一行不带 id,看是否自动取值(插入后立即回滚,不留痕)
BEGIN TRAN;
INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)
VALUES (N'__PROBE__', N'__PROBE__', N'__PROBE__', GETDATE(), 0, 0, 0, N'probe', GETDATE(), N'N');
SELECT N'不带 id 插入后取到的 id' AS k, id, wzdm FROM kucun WHERE wzdm=N'__PROBE__';
ROLLBACK;
GO
