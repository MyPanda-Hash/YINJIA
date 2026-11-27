-- 验证前:把测试账套的一张检验单/记录改成「部分不合格」的可跑状态
UPDATE x SET x.送检数量 = 100, x.合格数量 = 60, x.不合格数量 = 40, x.特采 = 0
FROM qc_insp_detail x WHERE x.单据编号 = N'IJ-2026-11-0007' AND x.物料编码 = N'YJ-XH-002';
UPDATE r SET r.检验结论 = N'不合格', r.处理意见 = N'让步接收(验证用)'
FROM qc_insp_rec r WHERE r.单据编号 = N'JYSJ-2026-11-0021';
SELECT x.单据编号, x.物料编码, x.送检数量, x.合格数量, x.不合格数量, x.特采 FROM qc_insp_detail x WHERE x.单据编号 = N'IJ-2026-11-0007';
SELECT r.单据编号, r.检验结论, r.来料检验单号, r.不合格品处理单号 FROM qc_insp_rec r WHERE r.单据编号 = N'JYSJ-2026-11-0021';
