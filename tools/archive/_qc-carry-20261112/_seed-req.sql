SET NOCOUNT ON;
PRINT N'=== 落数据前:3 个折叠棉物料的要求行 ===';
SELECT id, 物料类别, 物料编号, 文件编码, 检验依据, 备用1 AS [大_子目录1], 备用3 AS [小_子目录2]
  FROM qc_insp_req WHERE 物料编号 IN (N'YJ-YCYX-006', N'YJ-YCYX-008', N'YJ-YCYX-009');
GO
UPDATE qc_insp_req
   SET 文件编码 = N'YJ-QR-96', 检验依据 = N'YJ-Q-30',
       备用1 = CASE 物料编号 WHEN N'YJ-YCYX-006' THEN N'260×2.0' WHEN N'YJ-YCYX-008' THEN N'300×2.5' ELSE N'240×1.8' END,
       备用3 = CASE 物料编号 WHEN N'YJ-YCYX-006' THEN N'±0.05'    WHEN N'YJ-YCYX-008' THEN N'±0.08'    ELSE N'±0.03' END,
       asp_user2 = N'test-seed', asp_time2 = SYSDATETIME()
 WHERE 物料编号 IN (N'YJ-YCYX-006', N'YJ-YCYX-008', N'YJ-YCYX-009') AND 物料类别 = N'折叠棉';
PRINT N'[seed] 检验要求更新行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO
SELECT id, 物料类别, 物料编号, 文件编码, 检验依据, 备用1 AS 大, 备用3 AS 小
  FROM qc_insp_req WHERE 物料编号 IN (N'YJ-YCYX-006', N'YJ-YCYX-008', N'YJ-YCYX-009');
