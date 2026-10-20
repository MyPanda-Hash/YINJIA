/*
 * _cleanup-empty-dup-qcinsp-20261020.sql —— 清理「同号多行、且全为空壳」的来料检验单头
 *
 * 背景:合并 origin/main 后 DbSync 跑到 migrate-formno-pool-sync-20261019.sql 时自检报「重号 5 个」,
 *   挡住其后所有迁移。实测重号来自 qc_insp:
 *     IJ-2026-10-0022 × 3(id 177/178/179)、IJ-2026-10-0027 × 2(id 185/186),
 *     全部 asp_user1=admin、2026-10-19 17:49 同一秒批量写入(并行会话造数残留),
 *     供应商/采购订单号/批次号/备注全空、明细 0 行、检验目录 0 行、无审批/流转链。
 *
 * 处置:只删这几行**全空**的头(带窄条件 + 行数守卫),并在末尾自检「这两个单号不再有重号」。
 *   不删任何一个非空单据;不碰明细/目录/状态表(它们本来就没有这些单号的记录)。
 *
 * 幂等:删过之后再跑 = 0 行。两账套均执行。
 */
SET NOCOUNT ON;
GO
DECLARE @before int = (SELECT COUNT(*) FROM qc_insp
                        WHERE 单据编号 IN (N'IJ-2026-10-0022', N'IJ-2026-10-0027')
                          AND ISNULL(供应商,N'') = N'' AND ISNULL(采购订单号,N'') = N''
                          AND ISNULL(批次号,N'') = N'' AND ISNULL(备注,N'') = N''
                          AND ISNULL(asp_cancel,'N') <> 'Y');
IF @before <> 5
BEGIN
    RAISERROR(N'待清理的空壳行数与实测不符(期望 5 行,实际 %d 行)—— 已中止,请人工核对', 16, 1, @before);
END
ELSE
BEGIN
    DELETE FROM qc_insp
     WHERE 单据编号 IN (N'IJ-2026-10-0022', N'IJ-2026-10-0027')
       AND ISNULL(供应商,N'') = N'' AND ISNULL(采购订单号,N'') = N''
       AND ISNULL(批次号,N'') = N'' AND ISNULL(备注,N'') = N''
       AND ISNULL(asp_cancel,'N') <> 'Y';
    PRINT N'[清理] 空壳重号头 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
END
GO
IF EXISTS (SELECT 1 FROM qc_insp WHERE 单据编号 IN (N'IJ-2026-10-0022', N'IJ-2026-10-0027')
            GROUP BY 单据编号 HAVING COUNT(*) > 1)
    RAISERROR(N'清理后仍有重号:自查', 16, 1);
PRINT N'✅ 空壳重号已清理,两个单号不再重号';
GO
