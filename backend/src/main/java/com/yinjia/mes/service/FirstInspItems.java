package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 首件检验单(QC_FIRST_INSP)的检验项目与检验要求来源 —— 《成型工艺清单》RD_MOLD_PROC。
 *
 * <p>用户口径(2026-10-15):「检验方式参考成型工艺清单内的检验要求进行编写」。
 * 成型工艺清单的「检验要求」区块(见 {@code recordSheetConfigs.RD_MOLD_PROC} 页 1)按块列字段:</p>
 * <ul>
 *   <li>炭棒尺寸:{@code 外径mm / 外径公差 / 内径mm / 内径公差};</li>
 *   <li>密度管控:{@code 密度管控要求 / 实际密度管控下限 / 实际密度管控上限};</li>
 *   <li>跌落强度:{@code 跌落高度cm / 跌落次数 / 跌落要求};</li>
 *   <li>抗压强度:{@code 测试间距mm / 压头下降速度 / 强度要求kgf};</li>
 *   <li>压降:{@code 压降测试管路 / 压降测试流速 / 压降标准kpa / 压降是否测试}。</li>
 * </ul>
 *
 * <p>本类把这 5 个块折成 5 行首件检验明细:<b>检验项目</b> = 块名,<b>检验要求</b> = 该块各字段
 * 的取值拼接(只拼有值的段,全空就留空 —— <b>不编造</b>要求文案;工艺清单还没维护时,
 * 明细就是一张只有项目名的清单,等工艺清单填好后再点「取成型工艺清单」重新带入)。</p>
 *
 * <p>为什么独立成类:这条取数+拼接要供**两个**调用点共用 ——
 * ① {@code ButtonService.firstInspGenerate}(报工审核自动出单时预铺明细);
 * ② {@code QcFirstInspController.fromMoldProc}(单上「取成型工艺清单」按钮)。
 * 写在任一处都会让另一处复制粘贴(代码规范 D:反复制粘贴)。</p>
 */
public final class FirstInspItems {

    private FirstInspItems() {
    }

    /** 取数结果:docNo = 命中的工艺清单单号(该产品没有工艺清单时为 null),rows = 5 行明细 */
    public record Result(String docNo, List<Map<String, Object>> rows) {
    }

    /** 检验项目(块名),顺序与工艺清单「检验要求」区块自上而下一致 */
    private static final String[] ITEMS = {"炭棒尺寸", "密度管控", "跌落强度", "抗压强度", "压降"};

    /** 明细表区:与三张工序检验单同口径 —— 检验项目区 */
    private static final String SECTION = "检验项目";

    /**
     * 按产品编码取最新的《成型工艺清单》,折成 5 行首件检验明细。
     *
     * @param productCode 产品编号(yj:工单行的 dm / 报工的 wzdm)
     * @return 命中时 docNo 非空、rows 带拼接好的检验要求;查无时 docNo 为空、rows 仍是 5 行(项目名在、要求空)
     */
    public static Result load(JdbcTemplate jdbc, String productCode) {
        String code = productCode == null ? "" : productCode.trim();
        List<Map<String, Object>> found = code.isEmpty() ? List.of() : jdbc.queryForList(
                "SELECT TOP 1 [单据编号] AS docNo,"
                        + " ISNULL([外径mm],N'') AS od, ISNULL([外径公差],N'') AS odt,"
                        + " ISNULL([内径mm],N'') AS idm, ISNULL([内径公差],N'') AS idt,"
                        + " ISNULL([密度管控要求],N'') AS den, ISNULL([实际密度管控下限],N'') AS denLo,"
                        + " ISNULL([实际密度管控上限],N'') AS denHi,"
                        + " ISNULL([跌落高度cm],N'') AS dropH, ISNULL([跌落次数],N'') AS dropN,"
                        + " ISNULL([跌落要求],N'') AS dropReq,"
                        + " ISNULL([测试间距mm],N'') AS span, ISNULL([压头下降速度],N'') AS speed,"
                        + " ISNULL([强度要求kgf],N'') AS kgf,"
                        + " ISNULL([压降测试管路],N'') AS pipe, ISNULL([压降测试流速],N'') AS flow,"
                        + " ISNULL([压降标准kpa],N'') AS kpa, ISNULL([压降是否测试],N'') AS needTest"
                        + " FROM dbo.rd_mold_proc_head"
                        + " WHERE [产品编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id DESC", code);
        Map<String, Object> h = found.isEmpty() ? Map.of() : found.get(0);
        String docNo = h.isEmpty() ? null : str(h.get("docNo"));
        if (docNo != null && docNo.isEmpty()) docNo = null;

        String[] req = new String[ITEMS.length];
        req[0] = join(seg("炭棒外径", str(h.get("od")) + str(h.get("odt"))),
                seg("炭棒内径", str(h.get("idm")) + str(h.get("idt"))));
        req[1] = join(seg("密度范围", str(h.get("den"))),
                seg("实际管控下限", str(h.get("denLo"))), seg("实际管控上限", str(h.get("denHi"))));
        req[2] = join(seg("高度", unit(str(h.get("dropH")), "cm")),
                seg("跌落次数", unit(str(h.get("dropN")), "次")), seg("要求", str(h.get("dropReq"))));
        req[3] = join(seg("测试间距", unit(str(h.get("span")), "mm")),
                seg("压头下降速度", unit(str(h.get("speed")), "mm/min")),
                seg("强度要求", unit(str(h.get("kgf")), "kgf")));
        req[4] = join(seg("测试管路", str(h.get("pipe"))),
                seg("测试流速", unit(str(h.get("flow")), "L/min")),
                seg("压降标准", unit(str(h.get("kpa")), "kpa")),
                seg("是否测试", str(h.get("needTest"))));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < ITEMS.length; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("表区", SECTION);
            m.put("检验项目", ITEMS[i]);
            m.put("检验要求", req[i]);
            rows.add(m);
        }
        return new Result(docNo, rows);
    }

    /** 一段「标签:取值」;取值空 ⇒ 空串(整段不出现) */
    private static String seg(String label, String value) {
        return value == null || value.isBlank() ? "" : label + ":" + value;
    }

    /** 用「;」把有值的段连起来 */
    private static String join(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (sb.length() > 0) sb.append(';');
            sb.append(p);
        }
        return sb.toString();
    }

    /** 数值带单位;空值不补单位,免得拼出「高度:cm」 */
    private static String unit(String value, String u) {
        return value == null || value.isBlank() ? "" : value + u;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
