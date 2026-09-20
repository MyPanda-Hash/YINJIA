-- _fixture-auto-fill2.sql — 夹具第二份:验证 rd_spec_assign 的**优先级**(权威源压过 head.编号 盖章)
SET NOCOUNT ON;
DELETE FROM rd_spec_doc_detail WHERE 单据编号 = N'ZZFIX-SD-002';
DELETE FROM rd_spec_doc_head   WHERE 单据编号 = N'ZZFIX-SD-002';
DELETE FROM rd_spec_assign     WHERE 产品编号 = N'ZZFIX-P001';

-- 第二张规格书的 编号 故意留空 —— 只有 rd_spec_assign 认得它,
-- 这样"取到它"就等价于"走的是 rd_spec_assign 这条路"。
INSERT INTO rd_spec_doc_head (单据编号, 单据日期, 名称, 编号, 规格书种类,
                              整体规格参数, 客户项目名称, 产品类别, asp_user1, asp_time1)
VALUES (N'ZZFIX-SD-002', N'2026-09-20', N'伊可普炭棒规格书(新版)', N'', N'出货检验',
        N'外径47±0.5mm(新版)', N'伊可普除VOC项目(改版)', N'碱性炭棒', N'夹具', SYSDATETIME());

INSERT INTO rd_spec_doc_detail (单据编号, 表区, 序号, 检验项目, 检验要求, 检验方法, asp_user1, asp_time1)
VALUES (N'ZZFIX-SD-002', N'检验要求', N'1', N'*新版外观', N'新版要求', N'目视', N'夹具', SYSDATETIME());

INSERT INTO rd_spec_assign (产品编号, 单据编号, 规格书种类, 负责人, 责任人, asp_user1, asp_time1, asp_cancel)
VALUES (N'ZZFIX-P001', N'ZZFIX-SD-002', N'出货检验', N'冯加劲', N'夹具', N'夹具', SYSDATETIME(), N'N');
