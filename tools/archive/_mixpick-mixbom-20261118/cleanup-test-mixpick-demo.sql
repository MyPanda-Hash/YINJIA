/* 清理 2026-11-18 验证「混料领料单改读 bs_mix_bom」时在测试账套造的数据。
   ⚠ 只允许 HSDZ_MES_TEST。删:领料明细/台账、本次预留单号、验证用混料清单。 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'清理脚本只允许在 HSDZ_MES_TEST 执行。', 1;
BEGIN TRANSACTION;

DECLARE @docs TABLE (id bigint PRIMARY KEY);
INSERT INTO @docs (id) SELECT id FROM dbo.wo_pick_doc WHERE 工单号 = N'GD-2026-09-0135';

DELETE FROM dbo.wo_pick_line WHERE 单头id IN (SELECT id FROM @docs);
PRINT N'删 wo_pick_line:' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.wo_pick_doc WHERE id IN (SELECT id FROM @docs);
PRINT N'删 wo_pick_doc:' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.form_flow_link WHERE source_line_key LIKE N'GD-2026-09-0135%'
   OR target_form_no IN (N'LL-2026-11-0010', N'LL-2026-11-0011');
PRINT N'删 form_flow_link:' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.s_allno WHERE dh IN (N'LL-2026-11-0010', N'LL-2026-11-0011');
PRINT N'删 s_allno:' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.bs_mix_bom WHERE 来源单号 = N'TEST-DEMO-A48-41';
PRINT N'删 bs_mix_bom 验证数据:' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT TRANSACTION;

PRINT N'== 复核(应全 0) ==';
SELECT (SELECT COUNT(*) FROM dbo.wo_pick_doc WHERE 工单号=N'GD-2026-09-0135') AS pick_docs,
       (SELECT COUNT(*) FROM dbo.form_flow_link WHERE source_line_key LIKE N'GD-2026-09-0135%') AS links,
       (SELECT COUNT(*) FROM dbo.s_allno WHERE dh IN (N'LL-2026-11-0010',N'LL-2026-11-0011')) AS nos,
       (SELECT COUNT(*) FROM dbo.bs_mix_bom WHERE 来源单号=N'TEST-DEMO-A48-41') AS fixture_rows;
