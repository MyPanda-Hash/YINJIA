/* 验收夹具(测试账套 HSDZ_MES_TEST):两张最小产成品入库草稿,验完由 fixture-cleanup.sql 清掉
 *   FI-GATE-QTY-A ← 物料 C-95-43(是否过程检验 = 否)  ⇒ 提交审批应放行(不再要求两张检验单)
 *   FI-GATE-QTY-B ← 物料 T410   (验收时临时置 是否过程检验 = 是)⇒ 提交审批应仍被门禁拦下
 * ⚠ 只动这两张单 + T410 的开关;跑完必须执行 fixture-cleanup.sql。
 */
SET NOCOUNT ON;

DELETE FROM dbo.bl_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
DELETE FROM dbo.yj_form_approval WHERE panel_code = N'FINISH_IN' AND form_no IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'FINISH_IN' AND doc_no IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
DELETE FROM dbo.bd_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');

INSERT INTO dbo.bd_finish_in (单据编号, 单据日期, 业务类型, 加工单号, 工单行号, 批次号, 仓库, 经手人, 备注)
VALUES (N'FI-GATE-QTY-A', CAST(GETDATE() AS date), N'产成品入库', N'GD-GATE-QTY', 1, N'20261118', N'C仓', N'admin',
        N'门禁/不合格数量验收A(过程检验=否,验完删除)'),
       (N'FI-GATE-QTY-B', CAST(GETDATE() AS date), N'产成品入库', N'GD-GATE-QTY', 2, N'20261118', N'C仓', N'admin',
        N'门禁/不合格数量验收B(过程检验=是,验完删除)');

INSERT INTO dbo.bl_finish_in (单据编号, 产品编码, 产品名称, 仓库, 计量单位, 实收数量, 批号, 序号)
VALUES (N'FI-GATE-QTY-A', N'C-95-43', N'1217项目/后置副龙头芯', N'C仓', N'支', 4, N'20261118', 1),
       (N'FI-GATE-QTY-B', N'T410',    N'A级烧结炭棒/滤芯',     N'C仓', N'支', 4, N'20261118', 1);

UPDATE dbo.bs_inv SET [是否过程检验] = 1 WHERE LTRIM(RTRIM(存货编码)) = N'T410';

SELECT 'setup-heads' AS chk, COUNT(*) AS v FROM dbo.bd_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')
UNION ALL SELECT 'setup-lines', COUNT(*) FROM dbo.bl_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')
UNION ALL SELECT 'setup-t410-on', COUNT(*) FROM dbo.bs_inv WHERE LTRIM(RTRIM(存货编码)) = N'T410' AND ISNULL([是否过程检验], 0) = 1;
