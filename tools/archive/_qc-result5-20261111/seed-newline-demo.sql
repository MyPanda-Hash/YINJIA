SET NOCOUNT ON;
UPDATE qc_insp_rec SET 物料名称=N'富锰(B0-250)', 物料编码=N'YJ-XH-001', 检验人=N'钟芳云',
       来料日期='2026-11-11', 检验日期='2026-11-11', 文件编码=N'YJ-QR-01', 检验依据=N'YJ-Q-03'
 WHERE 单据编号 = 'JYSJ-2026-11-0006';

DELETE FROM qc_insp_rec_detail WHERE 单据编号 = 'JYSJ-2026-11-0006';

INSERT INTO qc_insp_rec_detail (单据编号, 检验项, 检测标准, 结果1, 结果2, 结果3, 结果4, 结果5, asp_user1)
VALUES ('JYSJ-2026-11-0006', N'检验方法1',
  N'称取炭粉试样100g，80-200目用80/150/25三层筛分工。' + CHAR(13)+CHAR(10)
  + N'325目比例超过7%拒收；+80目比例大于15%不超过20。' + CHAR(13)+CHAR(10)
  + N'取样若干份放入密封式制样粉碎机中进行粉碎，压碎约30s。',
  N'合格', N'合格', NULL, NULL, NULL, 'zfy');

INSERT INTO qc_insp_rec_detail (单据编号, 检验项, 检测标准, 结果1, 结果2, 结果3, 结果4, 结果5, asp_user1)
VALUES ('JYSJ-2026-11-0006', N'检验方法2',
  N'按GB/T 12496.8-2015规定的方法测量碘值，取样前须将样品在(150±5)℃烘箱中干燥4h，取出置于干燥器中冷却至室温；'
  + N'按GB/T 12496.8-2015规定的方法测量碘值，取样前须将样品在(150±5)℃烘箱中干燥4h，取出置于干燥器中冷却至室温；'
  + N'按GB/T 12496.8-2015规定的方法测量碘值，取样前须将样品在(150±5)℃烘箱中干燥4h，取出置于干燥器中冷却至室温；'
  + N'按GB/T 12496.8-2015规定的方法测量碘值，取样前须将样品在(150±5)℃烘箱中干燥4h，取出置于干燥器中冷却至室温。',
  N'合格', N'合格', N'合格', N'合格', N'合格', 'zfy');

INSERT INTO qc_insp_rec_detail (单据编号, 检验项, 检测标准, 结果1, 结果2, 结果3, 结果4, 结果5, asp_user1)
VALUES ('JYSJ-2026-11-0006', N'检验方法3', N'称取3g，用快速水分仪测试',
  N'合格', NULL, NULL, NULL, NULL, 'zfy');

SELECT 单据编号, 检验项, LEN(检测标准) AS 字数,
       CHARINDEX(CHAR(10), 检测标准) AS 有LF, CHARINDEX(CHAR(13), 检测标准) AS 有CR
  FROM qc_insp_rec_detail WHERE 单据编号 = 'JYSJ-2026-11-0006' ORDER BY id;
