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
        // ⚠ 2026-10-27:成型工艺清单的 产品编号 现在带 -tb 后缀(用户口径「选产品编号后自动加 -tb」),
        //   而**调用方传进来的是原始产品编号**(工单/产品信息表侧),两边不相等就一条也查不到。
        //   这里同时认两种形态:原值 和 原值+'-tb';入参本身已带后缀时另加原值候选。
        //   历史单据(无后缀)与新建单据(有后缀)都能命中,老单不报错。
        String base = code.replaceAll("(?i)-tb$", "").trim();
        List<String> codes = new ArrayList<>();
        if (!base.isEmpty()) {
            codes.add(base);
            codes.add(base + "-tb");
        }
        List<Map<String, Object>> found = codes.isEmpty() ? List.of() : jdbc.queryForList(
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
                        " FROM dbo.rd_mold_proc_head WHERE [产品编号] IN (" +
                        String.join(",", java.util.Collections.nCopies(codes.size(), "?")) + ")" +
                        " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", codes.toArray());
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

    /**
     * 图纸上固定 10 个测试项目(分组 · 列名 · 数据键 · 单位),**恒铺**。
     * 用户口径(2026-10-15 第三轮):「当前测试项目把这些先填充进去就可以了,不需要空着什么都没有」
     * ⇒ 首件检验单一建出来就带着这 10 列(表观/脱粉/外径/内径/长度/重量/跌落/挤压强度/浊度/压降),
     *   标准能取到就填、取不到就留空等品质填,但**列本身不能消失**。
     * ⚠ 2026-10-15 修:原实现是 `add()` 里"标准为空就不加这一列",于是产品还没有《成型工艺清单》时
     *   整张纸一列都没有(实测就是这个报障),与图片版式也不符。
     */
    private record Def(String key, String label, String group, String unit) {}

    private static final List<Def> DEFS = List.of(
            new Def("appearance", "炭棒表观状态", "表观及脱粉", ""),
            new Def("depowder", "炭棒脱粉情况", "表观及脱粉", ""),
            new Def("outer", "炭棒外径", "尺寸及重量", "mm"),
            new Def("inner", "炭棒内径", "尺寸及重量", "mm"),
            new Def("length", "炭棒长度", "尺寸及重量", "mm"),
            new Def("weight", "炭棒重量", "尺寸及重量", "g"),
            new Def("drop", "跌落", "强度", ""),
            new Def("compress", "挤压强度", "强度", "kgf"),
            new Def("turbidity", "浊度NTU", "浊度及压降", "NTU"),
            new Def("pressure", "压降kPa", "浊度及压降", "kPa"));

    private static List<Column> columns(Map<String, Object> h) {
        // 标准取值:按数据键给;取不到给空串(列照铺,标准格留白由品质填/后补工艺清单再带入)
        Map<String, String> std = new LinkedHashMap<>();
        // 表观/脱粉/浊度在 RD_MOLD_PROC 里没有独立数值标准(图纸标准行也是"/"),固定给"/"
        std.put("appearance", "/");
        std.put("depowder", "/");
        std.put("turbidity", "/");
        // 「标签：取值」逐段拼,只拼有值的段;一段都没有 ⇒ 空串(整格留白,列照铺)
        std.put("outer", segs("外径", str(h.get("od")), "公差", str(h.get("odt"))));
        std.put("inner", segs("内径", str(h.get("idm")), "公差", str(h.get("idt"))));
        std.put("length", segs("长度要求", str(h.get("lengthReq"))));
        std.put("weight", segs("重量要求", str(h.get("weightReq"))));
        std.put("drop", segs("跌落高度", unit(str(h.get("dropH")), "cm"),
                "跌落次数", unit(str(h.get("dropN")), "次"),
                "跌落要求", str(h.get("dropReq"))));
        std.put("compress", segs("测试间距", unit(str(h.get("span")), "mm"),
                "压头下降速度", unit(str(h.get("speed")), "mm/min"),
                "强度要求", unit(str(h.get("kgf")), "kgf")));
        std.put("pressure", segs("压降标准", unit(str(h.get("pressure")), "kPa"),
                "是否测试", str(h.get("pressureTest"))));

        List<Column> out = new ArrayList<>();
        for (Def d : DEFS) {
            out.add(new Column(d.key(), d.label(), d.group(), std.getOrDefault(d.key(), ""), d.unit()));
        }
        return out;
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

    /**
     * 逐段拼「标签：取值」,用「;」连接;**一段都没有值就返回空串**。
     * ⚠ 2026-10-15 修:原实现先 join 再看空,于是工艺清单没维护时标准行出现
     *   `跌落高度:跌落次数;跌落要求` 这种"只有标签没有值"的怪文案 —— 那种情况应当整格留白。
     * 标签与取值之间用**中文冒号「：」**(与工艺清单纸面、图片上的写法一致)。
     * @param kv 成对参数:标签1, 取值1, 标签2, 取值2, …
     */
    private static String segs(String... kv) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            String label = kv[i], value = kv[i + 1];
            if (value == null || value.isBlank()) continue;
            if (sb.length() > 0) sb.append(';');
            sb.append(label).append('：').append(value);
        }
        return sb.toString();
    }

    private static String unit(String value, String unit) { return value.isBlank() ? "" : value + unit; }
    private static String str(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static String blankToNull(String value) { return value.isBlank() ? null : value; }
}
