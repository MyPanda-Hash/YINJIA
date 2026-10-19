/* 复现/验收两用:同一个 (src,rid) 再插一行(不同物料)—— 2026-10-20
   迁移前:被 UX_outh_src_rid(src,rid) 拦下(error 2601,即用户截图那条)
   迁移后:成功插入(唯一键已放宽到 src + rid + 物料编码 + 批号)
   全程在事务里,末尾 ROLLBACK,不留任何数据。
   ⚠ SqlRunner 不显示 PRINT ⇒ 结论放最后那条 SELECT 里。 */
SET NOCOUNT ON;
DECLARE @out nvarchar(600) = N'(未执行)';
BEGIN TRAN;
BEGIN TRY
    INSERT INTO dbo.outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 仓库编码, 批号, 数量,
                          asp_user1, asp_time1, asp_cancel)
    VALUES (6, 7, N'PROBE-20261020-01', N'材料出库单', CAST(GETDATE() AS date), N'PROBE-MAT-2',
            N'PROBE-WH', N'PROBE-LOT', 1, N'probe', SYSDATETIME(), 'N');
    SET @out = N'[PASS-UNBLOCKED] 同一 (src=6,rid=7) 的第二行(不同物料)插入成功 —— 已允许「一单多物料」';
END TRY
BEGIN CATCH
    SET @out = N'[BLOCKED] 第二行被拦下:' + ERROR_MESSAGE();
END CATCH
ROLLBACK;
SELECT @out AS 结论;
