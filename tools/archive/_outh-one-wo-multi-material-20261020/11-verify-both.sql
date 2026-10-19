/* 验收探针(两例,都在事务里跑完就回滚,不留数据):
   例 1  同一 (src,rid) 再插一行、**物料不同** ⇒ 迁移后必须成功(用户诉求:一个工单多个物料)
   例 2  同一 (src,rid) 再插一行、**物料与批号都相同** ⇒ 必须仍被唯一键拦下(幂等保险还在)
   ⚠ SqlRunner 不显示 PRINT ⇒ 结论放最后那条 SELECT。 */
SET NOCOUNT ON;
DECLARE @case1 nvarchar(600), @case2 nvarchar(600);

-- 用一个真实存在的 (src=6, rid=7) 作锚点(测试账套实测有这行:YJ-SX-031)
DECLARE @mat nvarchar(100), @lot nvarchar(120);
SELECT TOP 1 @mat = 物料编码, @lot = 批号 FROM dbo.outh WHERE src = 6 AND rid = 7 ORDER BY id;

BEGIN TRAN;
BEGIN TRY
    INSERT INTO dbo.outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 仓库编码, 批号, 数量,
                          asp_user1, asp_time1, asp_cancel)
    VALUES (6, 7, N'PROBE-20261020-A', N'材料出库单', CAST(GETDATE() AS date), N'PROBE-MAT-2',
            N'PROBE-WH', N'PROBE-LOT', 1, N'probe', SYSDATETIME(), 'N');
    SET @case1 = N'[PASS] 同工单第二个物料插入成功';
END TRY
BEGIN CATCH
    SET @case1 = N'[FAIL] 仍被拦下:' + ERROR_MESSAGE();
END CATCH
ROLLBACK;

BEGIN TRAN;
BEGIN TRY
    INSERT INTO dbo.outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 仓库编码, 批号, 数量,
                          asp_user1, asp_time1, asp_cancel)
    VALUES (6, 7, N'PROBE-20261020-B', N'材料出库单', CAST(GETDATE() AS date), @mat,
            N'PROBE-WH', @lot, 1, N'probe', SYSDATETIME(), 'N');
    SET @case2 = N'[FAIL] 同物料同批号重复写成功 —— 幂等保险丢了';
END TRY
BEGIN CATCH
    SET @case2 = N'[PASS] 同物料同批号被唯一键拦下(' + ERROR_MESSAGE() + N')';
END CATCH
ROLLBACK;

SELECT N'例1 多物料' AS 场景, @case1 AS 结论
UNION ALL SELECT N'例2 重复物料', @case2;
