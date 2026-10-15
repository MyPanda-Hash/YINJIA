package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 首件检验纸张模板的深模块：把 RD_MOLD_PROC 的非空检验要求转换成
 * 「动态检验列 + 标准行 + 1#..8#样品行」长表数据。
 *
 * 外部接口只有 load(productCode)，调用方不需要了解成型工艺清单字段映射、列分组、
 * 标准文本拼接或样品行初始化规则。返回的 detail rows 是通用面板引擎可以直接保存的
 * 长表：每个「样品/检验列」一行，纸张组件负责透视成图片中的横向表格。
 */
public final class FirstInspItems {
    private FirstInspItems() {}

    public record Column(String key, String label, String group, String standard, String unit) {}
    public record Result(String docNo, List<Column> columns, List<Map<String, Object>> rows) {}

    private static final int SAMPLE_COUNT = 8;

    public static Result load(JdbcTemplate jdbc, String productCode) {
        String code = productCode == null ? "" : productCode.trim();
        List<Map<String, Object>> found = code.isEmpty() ? List.of() : jdbc.queryForList(
                "SELECT TOP 1 [单据编号] AS docNo," +
                        " ISNULL([外观要求],N'') AS appearance," +
                        " ISNULL([长度要求],N'') AS lengthReq, ISNULL([重量要求],N'') AS weightReq," +
                        " ISNULL([外径mm],N'') AS od, ISNULL([外径公差],N'') AS odt," +
                        " ISNULL([内径mm],N'') AS idm, ISNULL([内径公差],N'') AS idt," +
                        " ISNULL([密度管控要求],N'') AS density, ISNULL([实际密度管控下限],N'') AS densityLo," +
                        " ISNULL([实际密度管控上限],N'') AS densityHi," +
                        " ISNULL([跌落高度cm],N'') AS dropH, ISNULL([跌落次数],N'') AS dropN," +
                        " ISNULL([跌落要求],N'') AS dropReq," +
                        " ISNULL([测试间距mm],N'') AS span, ISNULL([压头下降速度],N'') AS speed," +
                        " ISNULL([强度要求kgf],N'') AS kgf," +
                        " ISNULL([压降标准kpa],N'') AS pressure," +
                        " ISNULL([压降是否测试],N'') AS pressureTest" +
                        " FROM dbo.rd_mold_proc_head WHERE [产品编号]=?" +
                        " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", code);
        Map<String, Object> h = found.isEmpty() ? Map.of() : found.get(0);
        String docNo = blankToNull(str(h.get("docNo")));
        List<Column> columns = columns(h);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Column c : columns) {
            rows.add(row("标准", "标准", 0, c));
            for (int sample = 1; sample <= SAMPLE_COUNT; sample++) {
                rows.add(row("样品", sample + "#", sample, c));
            }
        }
        return new Result(docNo, columns, rows);
    }

    private static List<Column> columns(Map<String, Object> h) {
        List<Column> out = new ArrayList<>();
        // 图纸上表观/脱粉两列固定存在，标准行显示「/」；检验要求表没有这两项的独立数值标准。
        add(out, "appearance", "炭棒表观状态", "表观及脱粉", "/", "");
        add(out, "depowder", "炭棒脱粉情况", "表观及脱粉", "/", "");
        add(out, "outer", "炭棒外径", "尺寸及重量", labeled("外径", str(h.get("od")), str(h.get("odt"))), "mm");
        add(out, "inner", "炭棒内径", "尺寸及重量", labeled("内径", str(h.get("idm")), str(h.get("idt"))), "mm");
        add(out, "length", "炭棒长度", "尺寸及重量", labeled("长度要求", str(h.get("lengthReq"))), "mm");
        add(out, "weight", "炭棒重量", "尺寸及重量", labeled("重量要求", str(h.get("weightReq"))), "g");
        add(out, "drop", "跌落", "强度", labeled("跌落高度", unit(str(h.get("dropH")), "cm"), "跌落次数", unit(str(h.get("dropN")), "次"), "跌落要求", str(h.get("dropReq"))), "");
        add(out, "compress", "挤压强度", "强度", labeled("测试间距", unit(str(h.get("span")), "mm"), "压头下降速度", unit(str(h.get("speed")), "mm/min"), "强度要求", unit(str(h.get("kgf")), "kgf")), "kgf");
        // RD_MOLD_PROC 当前没有独立「浊度」字段；按图片保留这一列，标准用 / 表示需按检验要求/实测填写。
        add(out, "turbidity", "浊度NTU", "浊度及压降", "/", "NTU");
        add(out, "pressure", "压降kPa", "浊度及压降", labeled("压降标准", unit(str(h.get("pressure")), "kPa"), "是否测试", str(h.get("pressureTest"))), "kPa");
        return out;
    }

    private static void add(List<Column> out, String key, String label, String group, String standard, String unit) {
        if (!standard.isBlank()) out.add(new Column(key, label, group, standard, unit));
    }

    private static Map<String, Object> row(String type, String sample, int sampleNo, Column c) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("表区", "首件检验");
        r.put("行类型", type);
        r.put("样品序号", sample);
        r.put("检验列", c.key());
        r.put("检验项目", c.label());
        r.put("项目分组", c.group());
        r.put("标准", "标准".equals(type) ? c.standard() : "");
        r.put("实测数值", "");
        r.put("结果判断", "");
        r.put("行号", sampleNo);
        r.put("备注", "");
        return r;
    }

    private static String labeled(String label, String... values) {
        String value = join(values);
        return value.isBlank() ? "" : label + ":" + value;
    }

    private static String join(String... parts) {
        StringBuilder out = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (out.length() > 0) out.append(';');
            out.append(p);
        }
        return out.toString();
    }

    private static String unit(String value, String unit) { return value.isBlank() ? "" : value + unit; }
    private static String str(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static String blankToNull(String value) { return value.isBlank() ? null : value; }
}
