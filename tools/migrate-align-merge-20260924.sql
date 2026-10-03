-- migrate-align-merge-20260924.sql — 合并对齐补缺(2026-09-24 用户质询核查产物)
-- 背景:merge 后 DbSync 重放,部分远程脚本因撞缺列被跳过;本支补齐它们的依赖后逐支强制重放。
-- ①qc_insp 补 4 列(远程 migrate-qc-3docs 建表声明,本地老表缺;本地演化列 检验编号/执行标准/检验类型/批次键 保留不动)
-- ②QC_INSP.暂收单号 字段注册+参照(口径=migrate-query-ref-links:指 SL_RECV 非 QC_RECV)
-- ③暂收单号 en 译名(摘自 migrate-qc-3docs 184 行)
SET NOCOUNT ON;
IF COL_LENGTH('dbo.qc_insp', N'暂收单号') IS NULL ALTER TABLE dbo.qc_insp ADD [暂收单号] nvarchar(60) NULL;
GO
IF COL_LENGTH('dbo.qc_insp', N'检验日期') IS NULL ALTER TABLE dbo.qc_insp ADD [检验日期] nvarchar(20) NULL;
GO
IF COL_LENGTH('dbo.qc_insp', N'检验方案') IS NULL ALTER TABLE dbo.qc_insp ADD [检验方案] nvarchar(100) NULL;
GO
IF COL_LENGTH('dbo.qc_insp', N'总结论') IS NULL ALTER TABLE dbo.qc_insp ADD [总结论] nvarchar(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'暂收单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'暂收单号', N'暂收单号', N'参照', NULL, N'SL_RECV', N'单据编号', N'单据编号', N'query,header', 30, 140, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'暂收单号' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'暂收单号', 'en', N'Temp. Receipt No.', 'manual');
GO
SELECT N'qc_insp 缺列补齐: 暂收单号='+CASE WHEN COL_LENGTH('dbo.qc_insp',N'暂收单号') IS NULL THEN N'❌' ELSE N'✓' END
     + N', 检验日期='+CASE WHEN COL_LENGTH('dbo.qc_insp',N'检验日期') IS NULL THEN N'❌' ELSE N'✓' END
     + N', 检验方案='+CASE WHEN COL_LENGTH('dbo.qc_insp',N'检验方案') IS NULL THEN N'❌' ELSE N'✓' END
     + N', 总结论='+CASE WHEN COL_LENGTH('dbo.qc_insp',N'总结论') IS NULL THEN N'❌' ELSE N'✓' END;
PRINT N'migrate-align-merge-20260924 完成';
GO
