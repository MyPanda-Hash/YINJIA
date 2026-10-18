package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 条码标签打印留痕(材料仓 / 半成品仓 / 成品仓 三个条码面板,2026-10-18)。
 *
 * <p><b>为什么后端只记留痕、不出标签</b>:标签内容(码内容/名称/批号/数量/单据)全部来自列表行,
 * 前端本地用 qrcode 出纸即可;后端再查一遍纯属重复。真正只有服务端能给的,是
 * <b>「谁在什么时候打了哪个码」</b> —— 落 {@code yj_barcode_label_log},与采购材料码
 * ({@code bd_pu_label} 的打印次数口径)不同:这里是**只增不改的打印流水**,重打会再记一行,便于对账。
 *
 * <p>面板与数据源:三个面板都是 flat(只读报表),数据在视图里,码粒度=一批一码。
 */
@Service
public class BarcodeLabelService {

    /** 支持打印标签的面板(与 migrate-barcode-panels-20261018.sql 的 yj_panel 一一对应) */
    public static final Set<String> PANELS = Set.of("BARCODE_MAT", "BARCODE_WIP", "BARCODE_FIN");

    /** 一次最多登记多少张:防误点把整张表(材料 849 行)一次性打出去 */
    static final int MAX_ROWS = 500;

    private final JdbcTemplate jdbc;

    public BarcodeLabelService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 登记一次打印(一码一行)。
     *
     * @param panelCode BARCODE_MAT / BARCODE_WIP / BARCODE_FIN
     * @param items     [{code, doc?, qty?}] —— code 必填;doc 是码来源单据号,qty 是数量
     * @param user      打印人(取当前登录用户;取不到记 null)
     */
    public Map<String, Object> log(String panelCode, List<Map<String, Object>> items, String user) {
        if (panelCode == null || !PANELS.contains(panelCode)) {
            throw new IllegalArgumentException("该面板不支持打印标签: " + panelCode);
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("没有要登记打印的条码");
        }
        if (items.size() > MAX_ROWS) {
            throw new IllegalArgumentException("一次最多打印 " + MAX_ROWS + " 张,当前 " + items.size() + " 张");
        }
        List<Object[]> batch = new ArrayList<>();
        for (Map<String, Object> it : items) {
            if (it == null) continue;
            String code = str(it.get("code"));
            if (code.isEmpty()) continue;          // 空码行不登记(与前端禁勾口径一致)
            batch.add(new Object[]{
                    panelCode,
                    code,
                    emptyToNull(str(it.get("doc"))),
                    user,
                    toDecimal(it.get("qty")),
            });
        }
        if (batch.isEmpty()) throw new IllegalArgumentException("没有要登记打印的条码");
        jdbc.batchUpdate(
                "INSERT INTO yj_barcode_label_log (面板编码, 码内容, 单据编号, 打印人, 打印数量) VALUES (?,?,?,?,?)",
                batch);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("panelCode", panelCode);
        out.put("count", batch.size());
        return out;
    }

    private static String str(Object v) { return v == null ? "" : String.valueOf(v).trim(); }

    private static String emptyToNull(String s) { return s == null || s.isEmpty() ? null : s; }

    private static BigDecimal toDecimal(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return null;
        try { return new BigDecimal(s); } catch (NumberFormatException e) { return null; }
    }
}
