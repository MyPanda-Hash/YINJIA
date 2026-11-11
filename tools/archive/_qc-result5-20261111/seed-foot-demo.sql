SET NOCOUNT ON;
UPDATE qc_insp_rec SET 物料名称 = N'富锰(B0-250)', 物料编码 = N'YJ-XH-001', 检验人 = N'冯敏',
       来料日期 = '2026-11-11', 检验日期 = '2026-11-11', 文件编码 = N'YJ-QR-01', 检验依据 = N'YJ-Q-03',
       检验结论 = NULL, 处理意见 = NULL
 WHERE 单据编号 = 'JYSJ-2026-11-0007';

DELETE FROM qc_insp_rec_detail WHERE 单据编号 = 'JYSJ-2026-11-0007';

INSERT INTO qc_insp_rec_detail (单据编号, 检验项, 检测标准, 结果1, 结果2, 结果3, 结果4, 结果5, 单项判定, asp_user1)
VALUES ('JYSJ-2026-11-0007', N'外观', N'无脏污、无破损', N'无异常', N'无异常', N'无异常', N'无异常', N'无异常', NULL, 'fm'),
       ('JYSJ-2026-11-0007', N'尺寸', N'436±0.5/5mm', N'436.2', N'436.1', N'436.3', N'436.0', N'436.4', NULL, 'fm'),
       ('JYSJ-2026-11-0007', N'折高', N'5.5-6.5', N'6.0', N'6.1', N'5.9', N'6.0', N'6.1', NULL, 'fm');

SELECT 单据编号, 检验结论, 处理意见, 检验人 FROM qc_insp_rec WHERE 单据编号 = 'JYSJ-2026-11-0007';
SELECT 检验项, 单项判定 FROM qc_insp_rec_detail WHERE 单据编号 = 'JYSJ-2026-11-0007' ORDER BY id;
