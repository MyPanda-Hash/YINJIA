package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 首件检验单(QC_FIRST_INSP)的**完工回填** —— 用户口径(2026-10-16 第二轮):
 *
 * <blockquote>「让生产日期在当前根据当前的生产工单完成首批次后进行回填到当前的实现,生产的环节是有工单号,
 * 检验单是绑定工单号的,这个工单生产啥样的批号,检验人员是不知道的,追溯的时候,由批号找到工单,
 * 再由工单找到检验单的,批次号是完工时自动生产的就这样实现吧。」</blockquote>
 *
 * <p><b>链路</b>(与用户口径一字不差地照做):
 * <ol>
 *   <li>首件检验单**绑工单号**(+工单行号)——出单时照抄报工单,见
 *       {@code QcInspAutoService}(成型达计划量自动出单,报工审核与手机端吸收共用);</li>
 *   <li>生产批号是**完工那一刻**定下来的 —— 见 {@link ProcessTaskService} 的
 *       {@code assignProductionBatch}(工单行首次进入 {@code 完工状态='生产完工'} 时
 *       写 {@code plang.批次号}(空则取当天 yyyyMMdd),并同步到排产行/工序任务/报工行);</li>
 *   <li>检验人员**不可能知道**本工单会出什么批号(号在完工时才生成)⇒ 批号与「生产日期」
 *       (该行完工当日)都由系统在这一刻**回填**到那张已绑工单号的首件检验单上,不要求品质在纸面上填。</li>
 * </ol>
 *
 * <p><b>触发</b>:工单行**第一次**进入 {@code 生产完工}({@link ProcessTaskService#syncWorkOrderState}
 * 里 {@code 原完工状态 != 生产完工} 那一次)。重算 / 重审 / 再报工不会重复回填;
 * 报工弃审把状态退回在制、再审核回到完工时,会再回填一次(幂等,只补空格)。
 *
 * <p><b>回填口径</b>:只填**空格**(已经填过的生产日期/批次号一律不动,人工填的优先);
 * 「生产日期」= 该行**完工当日**({@code plang.完工时间}),与批号同源。
 *
 * <p><b>追溯</b>:批号 → 工单({@code plang.批次号}) → 首件检验单({@code qc_first_insp_head.工单号
 * + 工单行号});回填之后这条链反过来也走得通(检验单上直接带着批号)。
 *
 * <p>与 {@link FirstInspItems} 同一范式:静态深模块,只吃 {@link JdbcTemplate},不引入 Spring 依赖,
 * 调用方(报工审核链 / 完工链)不需要知道列名与匹配规则。
 */
public final class FirstInspBackfill {
    private FirstInspBackfill() {}

    /** 首件检验单头表(与 ButtonService.FIRST_INSP_HEAD 同值;此处独立一份,免得两个类互引) */
    private static final String HEAD = "dbo.qc_first_insp_head";

    /**
     * 工单行的**完工批次**:已完工即返回 {@code {批次号, 生产日期}}(生产日期 = 完工当日
     * {@code yyyy-MM-dd});未完工 / 行不存在 ⇒ 返回 {@code null}(调用方据此判断"这一格现在填不填")。
     *
     * <p>判据取 {@code 完工时间非空} —— {@link ProcessTaskService} 只在 {@code 生产完工} 时写它,
     * 退回在制时又会清掉,所以"有完工时间"就是"这一行完工了"。批次号可能为空(历史行/尚未取号),
     * 此时只回生产日期,不硬造批号。
     */
    public static Map<String, String> completedBatch(JdbcTemplate jdbc, long plangRowId) {
        if (plangRowId <= 0) return null;
        List<Map<String, Object>> rs = jdbc.queryForList(
                "SELECT ISNULL([批次号],N'') AS 批次号, CONVERT(varchar(10), 完工时间, 120) AS 生产日期"
                        + " FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y' AND 完工时间 IS NOT NULL",
                plangRowId);
        if (rs.isEmpty()) return null;
        Map<String, String> out = new LinkedHashMap<>();
        out.put("批次号", String.valueOf(rs.get(0).get("批次号")));
        out.put("生产日期", String.valueOf(rs.get(0).get("生产日期")));
        return out;
    }

    /**
     * 工单行**第一批完工**时,把批号与生产日期回填到该工单(该行)的首件检验单上。
     *
     * <p>匹配键 = {@code 工单号}(用户口径「检验单是绑定工单号的」)+ {@code 工单行号}
     * (与"工单号+工单行号确定当前唯一工单"的既有口径一致;检验单没带出行号时为 0,按工单号兜底)。
     * 只填空格 —— {@code COALESCE(NULLIF(现值,''), 新值)}:品质若已经手工填过,系统不覆盖。
     *
     * @param plangRowId 工单行 id({@code plang.id}),同时是取批号/完工日的锚
     * @param workOrder  工单号(检验单上的绑定键)
     * @param user       留痕用户({@code asp_user2})
     * @return 真正回填到的首件检验单张数
     */
    public static int backfillOnFirstBatch(JdbcTemplate jdbc, long plangRowId, String workOrder, String user) {
        if (plangRowId <= 0 || workOrder == null || workOrder.isBlank()) return 0;
        return jdbc.update(
                "UPDATE h SET"
                        + "  h.[生产日期] = COALESCE(NULLIF(h.[生产日期], N''),"
                        + "       COALESCE(CONVERT(varchar(10), p.完工时间, 120), CONVERT(varchar(10), GETDATE(), 120))),"
                        + "  h.[批次号] = COALESCE(NULLIF(h.[批次号], N''), NULLIF(p.[批次号], N'')),"
                        + "  h.asp_user2 = ?, h.asp_time2 = GETDATE()"
                        + " FROM " + HEAD + " h JOIN dbo.plang p ON p.id = ?"
                        + " WHERE h.[工单号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                        // 行号:检验单带了行号就必须同号;没带出行号(0/空)的按工单号兜底
                        + "   AND (ISNULL(h.[工单行号],0) = 0 OR ISNULL(h.[工单行号],0) = ISNULL(p.pl_xc,0))"
                        + "   AND (ISNULL(h.[生产日期],N'') = N'' OR ISNULL(h.[批次号],N'') = N'')",
                user, plangRowId, workOrder.trim());
    }
}
