-- _qc-insp-rec-cleanup.sql — 清理检验数据记录(QC_INSP_REC)的探针测试单据,只留一条示例记录
-- 背景:2026-09-22 实施/验收期间探针反复「新增→填写→保存」,在本地库留下 20+ 张同名测试报告。
-- 处置:清空全部单据与明细/状态行(单号由 FormNoService 按现存最大值取号,删空后自动从 0001 重来),
--       再播一条与参考文档示例一致的记录(HP-2040 / 批次 260807 / 检验项 外观 / 合格),
--       状态=草稿(可编辑),便于人工继续验按钮与保存即归档。
SET NOCOUNT ON;
DELETE FROM qc_insp_rec_detail;
DELETE FROM qc_insp_rec;
DELETE FROM yj_doc_status WHERE panel_code = N'QC_INSP_REC';
PRINT N'  已清空 QC_INSP_REC 单据/明细/状态行';

INSERT INTO qc_insp_rec (单据编号, 单据日期, 物料名称, 物料编码, 物料批次, 检验日期, 来料日期, 来料数量,
                         文件编码, 检验依据, 检验结论, 处理意见, 检验人, 表单审核人, 备注)
VALUES (N'JYSJ-2026-09-0001', N'2026-09-22', N'HP-2040', N'HP-2040', N'260807', N'2026-09-22', N'2026-09-20', N'51Kg',
        N'YJ-QR-96', N'YJ-Q-30', N'外观、尺寸检验合格，符合技术要求', N'同意入库', N'admin', N'冯敏',
        N'示例记录（版式对照《品质资料 2026.09.19.xlsx》检验数据记录模版）');

INSERT INTO qc_insp_rec_detail (单据编号, 检验项, 检测标准, 检测结果, 单项判定) VALUES
 (N'JYSJ-2026-09-0001', N'外观',     N'无脏污、无破损、无变形',           N'目视检查：表面洁净，无破损变形', N'合格'),
 (N'JYSJ-2026-09-0001', N'外径',     N'57±0.5mm',                        N'57.2mm',                        N'合格'),
 (N'JYSJ-2026-09-0001', N'脏污、头发丝', N'表面无脏污、无头发丝等异物',      N'未见异物',                       N'合格');

MERGE yj_doc_status AS t USING (VALUES ('QC_INSP_REC', N'JYSJ-2026-09-0001')) AS s(panel_code, doc_no)
   ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, saved, update_at)
                      VALUES ('QC_INSP_REC', N'JYSJ-2026-09-0001', 'N', 'Y', GETDATE());

SELECT N'单据' AS k, 单据编号, 物料名称, 物料批次, 检验结论, 表单审核人 FROM qc_insp_rec;
SELECT N'明细行数' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM qc_insp_rec_detail;
SELECT N'状态行' AS k, doc_no AS v1, saved AS v2 FROM yj_doc_status WHERE panel_code = N'QC_INSP_REC';
GO
