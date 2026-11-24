package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 「这个产品要不要做过程检验」的**唯一判据**(2026-11-24 用户口径,取代商品档案
 * {@code bs_inv.是否过程检验} 开关)。
 *
 * <h3>用户口径(2026-11-24 原话)</h3>
 * <blockquote>
 * ① 「需要自动出单,但是实现方式不一样,需要实现当前产品编码存在对应的出货检验计划就出什么单:
 *    存在 1PCS 就出功能,存在 1% 出表观,而不是在商品中选择对这个商品选择是或否。」<br>
 * ② 「首件检验单获取的和出货检验的不同,选取的是成型工艺清单,也是当前存在对应的产品编码就产生。」<br>
 * ③ 「产成品的门禁需要修改,就是存在对应的检验需要完成情况下才需要阻拦……都没有就可以直接入库了。」
 * </blockquote>
 *
 * <h3>判据(全部按**产品编码**,取最新一张存活单据)</h3>
 * <ul>
 *   <li><b>首件检验单 QC_FIRST_INSP</b> ← 《成型工艺清单》{@code rd_mold_proc_head} 里存在该
 *       {@code 产品编号} 的存活单据;</li>
 *   <li><b>出货检验(功能)QC_PROC_INSP</b> ← 《出货检验计划》{@code rd_insp_plan_head} 最新一张存活
 *       计划的明细里,{@code 检测频率} 含 {@code 1PCS};</li>
 *   <li><b>出货检验(表观)QC_ASM_INSP</b> ← 同一张计划的明细里,{@code 检测频率} 含 {@code 1%}
 *       (实测库里写作「生产量*1%」,故按包含判)。</li>
 * </ul>
 *
 * <p>⚠ 频率判定用 {@code CHARINDEX} 而不是 {@code LIKE}:标记 {@code 1%} 里的 % 是 LIKE 通配符,
 * 写成 {@code LIKE '%1%%'} 会恒真。{@code 1PCS} 用 {@code UPPER(...)} 兜大小写。</p>
 *
 * <p>⚠ 三处调用方(自动出单 {@link QcInspAutoService}、产成品入库门禁 {@code ButtonService})必须
 * 共用本类,**禁止各写一份 SQL** —— 否则「出不出单」和「入库拦不拦」会漂移。</p>
 *
 * <p>本类只读,不写任何数据。查不到/参数为空 = 该单不需要(false);SQL 异常**向上抛**,
 * 由调用方决定兜底方向(自动出单选择「不出单并写原因」,门禁选择 fail-closed)。</p>
 */
public final class ProcessInspPlanGate {

    private ProcessInspPlanGate() { }

    /** 功能单标记(出货检验计划明细 检测频率 含它就出功能单) */
    public static final String FUNC_FREQ_MARK = "1PCS";
    /** 表观单标记(检测频率 含它就出表观单;库里实测「生产量*1%」) */
    public static final String LOOK_FREQ_MARK = "1%";

    /**
     * 一个产品需要哪几张过程检验单。
     *
     * @param first 首件检验单(成型工艺清单里有该产品)
     * @param func  出货检验(功能)(计划明细有 1PCS)
     * @param look  出货检验(表观)(计划明细有 1%)
     */
    public record Needs(boolean first, boolean func, boolean look) {
        /** 一张都不要 ⇒ 这个产品不走过程检验(不出单、入库也不拦) */
        public boolean none() { return !first && !func && !look; }

        /** 给回执/日志用的一句话 */
        public String text() {
            StringBuilder sb = new StringBuilder();
            if (first) sb.append("首件");
            if (func) sb.append(sb.length() > 0 ? "+功能" : "功能");
            if (look) sb.append(sb.length() > 0 ? "+表观" : "表观");
            return sb.length() == 0 ? "无" : sb.toString();
        }
    }

    /** 按产品编码一次算齐三张单要不要(空编码 = 都不要) */
    public static Needs of(JdbcTemplate jdbc, String productCode) {
        String code = productCode == null ? "" : productCode.trim();
        if (code.isEmpty()) return new Needs(false, false, false);
        return new Needs(hasMoldProc(jdbc, code),
                planHasFreq(jdbc, code, FUNC_FREQ_MARK),
                planHasFreq(jdbc, code, LOOK_FREQ_MARK));
    }

    /**
     * 首件判据:《成型工艺清单》里有没有该产品编码的存活单据。
     *
     * <p>⚠ 2026-10-27 起清单的产品编号带 {@code -tb} 后缀(选产品编号后自动加),而调用方拿到的是
     * 工单/产品侧**原始编码** ⇒ 这里两种形态都认(与 {@code FirstInspItems.load} 同一套匹配规则):
     * 原值、原值+{@code -tb};入参本身带后缀时另加去后缀的原值。</p>
     */
    public static boolean hasMoldProc(JdbcTemplate jdbc, String productCode) {
        String raw = productCode == null ? "" : productCode.trim();
        if (raw.isEmpty()) return false;
        String base = raw.replaceAll("(?i)-tb$", "").trim();
        java.util.LinkedHashSet<String> codes = new java.util.LinkedHashSet<>();
        if (!base.isEmpty()) {
            codes.add(base);
            codes.add(base + "-tb");
        }
        codes.add(raw);
        String in = String.join(",", java.util.Collections.nCopies(codes.size(), "?"));
        Integer yes = jdbc.queryForObject(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.rd_mold_proc_head h"
                        + "   WHERE LTRIM(RTRIM(ISNULL(h.[产品编号],N''))) IN (" + in + ")"
                        + "   AND ISNULL(h.asp_cancel,'N')<>'Y') THEN 1 ELSE 0 END",
                Integer.class, codes.toArray());
        return yes != null && yes == 1;
    }

    /**
     * 出货检验计划里(最新一张存活计划的明细)**是否含指定频率标记**。
     * 只认最新一张计划:品质改版后旧计划的频率不该再决定今天出不出单。
     */
    public static boolean planHasFreq(JdbcTemplate jdbc, String productCode, String marker) {
        String code = productCode == null ? "" : productCode.trim();
        String mark = marker == null ? "" : marker.trim();
        if (code.isEmpty() || mark.isEmpty()) return false;
        java.util.List<String> planNo = jdbc.queryForList(
                "SELECT TOP 1 h.[单据编号] FROM dbo.rd_insp_plan_head h"
                        + " WHERE LTRIM(RTRIM(ISNULL(h.[产品编号],N'')))=? AND ISNULL(h.asp_cancel,'N')<>'Y'"
                        + " ORDER BY h.id DESC", String.class, code);
        if (planNo.isEmpty()) return false;
        Integer yes = jdbc.queryForObject(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.rd_insp_plan_detail d"
                        + "   WHERE d.[单据编号]=? AND ISNULL(d.asp_cancel,'N')<>'Y'"
                        + "     AND CHARINDEX(?, UPPER(ISNULL(d.[检测频率],N'')))>0)"
                        + " THEN 1 ELSE 0 END", Integer.class, planNo.get(0), mark.toUpperCase());
        return yes != null && yes == 1;
    }
}
