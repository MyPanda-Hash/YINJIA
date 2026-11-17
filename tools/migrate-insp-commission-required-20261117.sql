/* ============================================================================
 * migrate-insp-commission-required-20261117.sql —— 检验委托单「必填项」按用户截图落地
 * ----------------------------------------------------------------------------
 * 用户 2026-11-17 口径(截图:纸样上带红色 * 的即为必填;★ 字样不用,统一用红色 *)。
 * 截图带 * 的 5 格:
 *   联系人 * / 样品名称 * / 样品数量 * / 样品型号/规格 * / 检验类别 *
 * (委托单位、制造商、生产厂、联系方式、E-mail、商标、检验依据、检验项目及要求、
 *  样品处理方式、判定规则、报告类型、有效期、备注、双方确认 —— 都不带 *,保持选填)
 *
 * 落地:yj_field.required 由 0 → 1(**只**这 5 个;单据编号/单据日期 建单时就已是必填,不动)。
 *   · 后端 dataSchema 的 isRequired 取自 yj_field.required ⇒ 前端保存前校验会直接拦下并高亮;
 *   · 纸面(InspCommissionSheet.vue)按 isRequired 渲染红色 *,与纸样一致、且不写死清单。
 *
 * 幂等:重复执行 0 行变更;末尾自检不符即 RAISERROR。两账套(HSDZ_MES / HSDZ_MES_TEST)都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

UPDATE yj_field
   SET required = 1
 WHERE panel_code = N'INSP_COMMISSION'
   AND label IN (N'联系人', N'样品名称', N'样品数量', N'样品型号/规格', N'检验类别')
   AND required = 0;
PRINT N'[改] 检验委托单必填 5 格,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* 自检:5 个全为必填;其余业务字段不得被顺手改成必填(只允许原有的 单据编号/单据日期) */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'INSP_COMMISSION' AND required = 1
       AND label IN (N'联系人', N'样品名称', N'样品数量', N'样品型号/规格', N'检验类别')) <> 5
    RAISERROR(N'检验委托单应有 5 个必填(联系人/样品名称/样品数量/样品型号规格/检验类别)', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND required = 1) <> 7
    RAISERROR(N'检验委托单 required=1 的行数应为 7(上述 5 个 + 单据编号 + 单据日期),请核对是否误改其它字段', 16, 1);
PRINT N'✅ 检验委托单必填项已按截图落地(红色 * 的 5 格)';
GO
