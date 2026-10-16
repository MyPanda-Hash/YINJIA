package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 组装成品检验单(QC_ASM_INSP)生单预铺的深模块:按**产品编码**从《出货检验计划表》(RD_INSP_PLAN)
 * 取回「外观 / 尺寸 / 出货重量」三类的检验项,转成本单可以直接保存的明细行。
 *
 * <h3>用户口径(2026-10-17)</h3>
 * 「需要实现当前默认带入外观,尺寸,出货重量的出货检验计划的检验项」+「将当前的表区修改为检验类型……
 * 将检验类型放在明细行第一列,进行区分」。
 * 前一句:组装成品检验单一建出来就带着计划里那三类检验项(不再靠人点按钮);后一句:明细第一列
 * 是「检验类型」,值就是这三类,一眼看得出哪行属于哪一类(替代原来的 A.外观/B.尺寸/C.出货重量 分区)。
 *
 * <h3>为什么不整张计划都带</h3>
 * 计划里还有「性能/功能性测试」这些类别(如 余氯去除率),它们**不是**本单每次必检的固定三类
 * (见 {@code yj_panel.config.fixedItems} 的声明);要带就由品质在单上点「取出货检验计划」按需补
 * —— 那条链路是**全量**带入,与本类的"默认三类"分工不同。
 *
 * <h3>类别归一(与前端 PanelxList.normInspType 同规则,改一处必须改两处)</h3>
 * 计划表的类别写法是「检验内容」原值:外观 / 重要尺寸 / 重量 / 性能 …;本单的检验类型词汇表 =
 * 固定组名 外观 / 尺寸 / 出货重量。
 * <ul>
 *   <li>{@code 含「外观」→ 外观}、{@code 含「尺寸」→ 尺寸}(重要尺寸/主要尺寸都算)、
 *       {@code 含「重量」→ 出货重量}(重量/净重都算);</li>
 *   <li>归不到这三类的 ⇒ **不带入**(默认只带三类);</li>
 *   <li>归一还有个必须的理由:前端带入链路的**判重键 = 类别 + 检验项目**,生单预铺写「尺寸」而
 *       计划带回「重要尺寸」就会被当成两条不同的行重复带进来。</li>
 * </ul>
 *
 * <h3>落库形状</h3>
 * 行键 = yj_field 的 label(= 物理列名):{@code 检验类型/检验项目/检验要求/检验方法/检查频率/备注}。
 * 检验要求 ← 控制标准及要求、检验方法 ← 控制方法、检查频率 ← 检测频率(与
 * {@code QcInspPlanController.fromShipPlan} 同一套映射);行数上限 {@link #MAX_ROWS} 兜底。
 */
public final class AsmInspItems {

    private AsmInspItems() {}

    /** 默认带入的三类 = yj_panel.config.fixedItems 的组名(顺序即明细里的行序) */
    private static final List<String> DEFAULT_TYPES = List.of("外观", "尺寸", "出货重量");

    /** 一次最多预铺几行(计划维护异常/超长时的兜底;正常 3~10 行) */
    private static final int MAX_ROWS = 40;

    /**
     * 预铺结果。
     *
     * @param planNo 命中的计划单号(没命中为 null —— 生单照常,明细留空由品质自己填)
     * @param rows   明细行(可直接进 {@code detail.items},空 = 计划里没有这三类)
     */
    public record Result(String planNo, List<Map<String, Object>> rows) {}

    /** 按产品编码取最新一张存活计划的默认检验项(查不到 = 空结果,不算错) */
    public static Result load(JdbcTemplate jdbc, String productCode) {
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

        // 先按三类各自收集,再按 外观 → 尺寸 → 出货重量 落序(与固定组声明同序,与会话里的读法一致)
        Map<String, List<Map<String, Object>>> byType = new LinkedHashMap<>();
        for (String t : DEFAULT_TYPES) byType.put(t, new ArrayList<>());
        for (Map<String, Object> r : raw) {
            String type = typeOf(str(r.get("category")));
            if (type.isEmpty()) continue;                          // 性能/功能性测试…:不默认带入
            String item = str(r.get("item"));
            if (item.isEmpty()) continue;                          // 没有项目名的行不是检验项
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("检验类型", type);
            row.put("检验项目", item);
            row.put("检验要求", str(r.get("req")));
            row.put("检验方法", str(r.get("method")));
            row.put("检查频率", str(r.get("freq")));
            if (!str(r.get("remark")).isEmpty()) row.put("备注", str(r.get("remark")));
            byType.get(type).add(row);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String t : DEFAULT_TYPES) {
            for (Map<String, Object> row : byType.get(t)) {
                if (rows.size() >= MAX_ROWS) return new Result(planNo, List.copyOf(rows));
                rows.add(row);
            }
        }
        return new Result(planNo, List.copyOf(rows));
    }

    /**
     * 计划表的「检验内容」(类别) → 本单的「检验类型」;归不到三类返回空串(调用方据此跳过该行)。
     * ⚠ 与前端 {@code PanelxList.normInspType} 是**同一条规则的两份实现**(一边 Java 一边 JS),
     *   改动必须两处同改 —— 规则本身很短,且两边都只服务「组装成品检验单」这一张单。
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
