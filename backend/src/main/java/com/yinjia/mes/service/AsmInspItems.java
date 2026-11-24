package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 组装成品检验单(QC_ASM_INSP = 出货检验（表观）)生单预铺的深模块:按**产品编码**从
 * 《出货检验计划表》(RD_INSP_PLAN)取回**检查频率含「1%」**的检验项,转成本单可以直接保存的明细行。
 *
 * <h3>用户口径(2026-11-22 修订,取代 2026-10-17 的「外观/尺寸/出货重量 三类」)</h3>
 * 「表观抓取 1%/一个生产批次,功能是抓取 1PCS 字眼来区分」——
 * 表观单(本类)= 检查频率含 {@code 1%} 的行;功能单(制程检验单 QC_PROC_INSP)的取数不在这里,
 * 走前端 {@code core/qc/shipPlanDefaults.js} 的 isFunctionalRow(含 1PCS)。
 * 两边同一条规则、只是取互补的两半 —— 改这里必须同步改那边的纯函数(附单测)。
 *
 * <h3>为什么不整张计划都带</h3>
 * 计划里还有 1PCS 行(压降/强度/黑水…)与「型式检验」行,它们不属于表观单的默认范围;
 * 要带就由品质在单上点「取出货检验计划」/「检验项目/检验方案」按需补。
 *
 * <h3>类别(检验类型)那一列怎么落</h3>
 * 计划表的「检验内容」是隐藏列、实测全空 ⇒ 先按它判,空再按**项目名关键词**兜
 * (含 外观/尺寸/重量 → 三类之一),仍归不上就**留空**(报表按「检验项目」成组,
 * 见 {@code QcAsmInspReportSupport.groupName})。它只影响打印分组,不影响取哪几行。
 *
 * <h3>落库形状</h3>
 * 行键 = yj_field 的 label(= 物理列名):{@code 检验类型/检验项目/检验要求/检验方法/检查频率/备注}。
 * 检验要求 ← 控制标准及要求、检验方法 ← 控制方法、检查频率 ← 检测频率(与
 * {@code QcInspPlanController.fromShipPlan} 同一套映射);行序 = 计划序号序;行数上限 {@link #MAX_ROWS}。
 */
public final class AsmInspItems {

    private AsmInspItems() {}

    /** 表观口径的检查频率标记(字典原值「1%/一个生产批次」;按包含判,兼容历史「生产量*1%」) */
    private static final String APPEARANCE_FREQ_MARK = "1%";

    /** 一次最多预铺几行(计划维护异常/超长时的兜底;正常 3~10 行) */
    private static final int MAX_ROWS = 40;

    /**
     * 预铺结果。
     *
     * @param planNo 命中的计划单号(没命中为 null —— 生单照常,明细留空由品质自己填)
     * @param rows   明细行(可直接进 {@code detail.items},空 = 计划里没有 1% 的行)
     */
    public record Result(String planNo, List<Map<String, Object>> rows) {}

    /**
     * 按产品编码取最新一张存活计划里「检查频率含 1%」的检验项(表观单默认口径)。
     * 查不到 = 空结果,不算错。
     */
    public static Result load(JdbcTemplate jdbc, String productCode) {
        return load(jdbc, productCode, APPEARANCE_FREQ_MARK);
    }

    /**
     * 按**频率标记**取检验项(2026-11-24 新增:功能单也要自动带入检验项)。
     *
     * <p>用户口径:「自动生成单据后需要能将对应的检验项目也自动带入了。」
     * 表观单 = {@code 1%}、功能单 = {@code 1PCS},同一条规则取互补两半
     * (与前端 {@code shipPlanDefaults.isFunctionalRow} 同一口径)。</p>
     *
     * @param freqMark 频率标记(按包含判;{@code 1%} 不是 LIKE 通配,这里用 CHARINDEX)
     */
    public static Result load(JdbcTemplate jdbc, String productCode, String freqMark) {
        String mark = freqMark == null ? "" : freqMark.trim().toUpperCase();
        if (mark.isEmpty()) return new Result(null, List.of());
        String code = productCode == null ? "" : productCode.trim();
        if (code.isEmpty()) return new Result(null, List.of());
        List<Map<String, Object>> plans = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] AS planNo FROM dbo.rd_insp_plan_head"
                        + " WHERE [产品编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id DESC", code);
        if (plans.isEmpty()) return new Result(null, List.of());
        String planNo = str(plans.get(0).get("planNo"));
        if (planNo.isEmpty()) return new Result(null, List.of());

        List<Map<String, Object>> raw = jdbc.queryForList(
                "SELECT ISNULL([控制项目],N'') AS item, ISNULL([控制标准及要求],N'') AS req,"
                        + " ISNULL([控制方法],N'') AS method, ISNULL([检测频率],N'') AS freq,"
                        + " ISNULL([检验内容],N'') AS category, ISNULL([备注],N'') AS remark"
                        + " FROM dbo.rd_insp_plan_detail"
                        + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL(TRY_CAST([序号] AS int), 999999), id", planNo);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> r : raw) {
            // 频率口径:表观=含「1%」、功能=含「1PCS」(2026-11-22 + 2026-11-24);
            // 「型式检验」/空频率两边都不带。用 contains 而不是 LIKE(1% 里的 % 是通配符)
            if (!str(r.get("freq")).toUpperCase().contains(mark)) continue;
            String item = str(r.get("item"));
            if (item.isEmpty()) continue;                          // 没有项目名的行不是检验项
            if (rows.size() >= MAX_ROWS) break;

            // 分组文字:检验内容优先,空则按项目名兜(脚本从计划带入的行本来也没有这一格)
            String type = typeOf(str(r.get("category")));
            if (type.isEmpty()) type = typeOf(item);

            Map<String, Object> row = new LinkedHashMap<>();
            if (!type.isEmpty()) row.put("检验类型", type);
            row.put("检验项目", item);
            row.put("检验要求", str(r.get("req")));
            row.put("检验方法", str(r.get("method")));
            row.put("检查频率", str(r.get("freq")));
            if (!str(r.get("remark")).isEmpty()) row.put("备注", str(r.get("remark")));
            rows.add(row);
        }
        return new Result(planNo, List.copyOf(rows));
    }

    /**
     * 类别文本 → 外观/尺寸/出货重量;归不上返回空串。
     * ⚠ 与前端 {@code PanelxList.normInspType} 是**同一条规则的两份实现**(一边 Java 一边 JS),
     *   改动必须两处同改 —— 规则本身很短,且两边都只服务「组装成品检验单」这一张单。
     * 注意:它**不参与取数**(取哪些行看 {@link #APPEARANCE_FREQ_MARK}),只决定明细第一列的分组文字。
     */
    static String typeOf(String category) {
        String s = str(category);
        if (s.isEmpty()) return "";
        // 关键词归组(与报表 QcAsmInspReportSupport.groupName 同一套词表):计划表里的同义写法
        // 重要尺寸/主要尺寸 → 尺寸、重量/净重 → 出货重量,都由 contains 一并命中。
        if (s.contains("外观")) return "外观";
        if (s.contains("尺寸")) return "尺寸";
        if (s.contains("重量")) return "出货重量";
        return "";
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
