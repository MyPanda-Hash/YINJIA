package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单扫码领料的取数服务(2026-10-21)。
 *
 * <p>手机端「工单扫码领料」页要两段数据,而这两张表都**不是注册面板**、走不了通用
 * {@code /px/queryFormDataList}:
 * <ul>
 *   <li>工单行 = 参考库表 {@code plang}(工单落 pl_no + 行号 pl_xc,见 {@link WorkOrderPickingService});</li>
 *   <li>BOM 明细 = {@code mate}(WLBOM 面板的底层表;WLBOM 是单据面板,查它拿到的是整单头,不是明细行)。</li>
 * </ul>
 * 故这里给两个只读端点:按工单号(+可选行号)取工单行、按产品编码取 BOM 明细。
 *
 * <p><b>为什么不用 {@code /px/queryFormDataList} 查 WLBOM</b>:WLBOM 是 doc 面板,
 * 返回的是「一张单的表头 + detail.items」的嵌套结构,且列表页默认按单分页;
 * 而扫码页要的是「某产品的全部子件行」这一个扁平集合,直接读表更准也更省。
 *
 * <p>只读服务:不写任何数据,生单仍走 {@code MATERIAL_OUT} 的 {@code callButton}。
 */
@Service
public class WorkOrderPickService {

    private final JdbcTemplate jdbc;

    public WorkOrderPickService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 按工单号(+可选行号)取工单行。
     *
     * @param orderNo 工单号({@code plang.pl_no})
     * @param lineNo  工单行号({@code plang.pl_xc});&lt;=0 表示不限行号(整单)
     * @return 工单行列表(每行含 工单号/工单行号/产品编码/产品名称/生产线/排产数量/领料单号)
     */
    public List<Map<String, Object>> workOrderLines(String orderNo, int lineNo) {
        String no = orderNo == null ? "" : orderNo.trim();
        if (no.isEmpty()) throw new IllegalArgumentException("请提供工单号");
        // 未作废的行才算:plang 用 asp_cancel='Y' 标记作废
        StringBuilder sql = new StringBuilder(
                "SELECT pl_no, pl_xc, dm, mc, scx, pl_sl, ll_no2, lot_no, od_no, pl_date "
                        + " FROM dbo.plang WHERE pl_no = ? AND ISNULL(asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        args.add(no);
        if (lineNo > 0) {
            sql.append(" AND pl_xc = ?");
            args.add(lineNo);
        }
        sql.append(" ORDER BY pl_xc");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("工单号", str(r.get("pl_no")));
            v.put("工单行号", intOf(r.get("pl_xc")));
            v.put("产品编码", str(r.get("dm")));
            v.put("产品名称", str(r.get("mc")));
            v.put("生产线", str(r.get("scx")));
            v.put("排产数量", dbl(r.get("pl_sl")));
            v.put("领料单号", str(r.get("ll_no2")));
            v.put("批号", str(r.get("lot_no")));
            v.put("销售订单号", str(r.get("od_no")));
            out.add(v);
        }
        return out;
    }

    /**
     * 按产品编码取 BOM 明细({@code mate} 表,一行 = 一个子件)。
     *
     * <p>表结构要点(mate 是经典遗留表,列名是拼音缩写):
     * {@code m_no}=产品编码 / {@code wzdm2}=子件代码 / {@code wzmc2}=子件名称 /
     * {@code gg2}=规格 / {@code jldw2}=子件单位 / {@code bzl}=标准用量 / {@code sl2}=损耗量。
     *
     * @param productCode 产品编码({@code mate.m_no})
     * @return 子件行列表;没有 BOM 时返回空列表(由页面提示先去录 BOM)
     */
    public List<Map<String, Object>> bomOf(String productCode) {
        String code = productCode == null ? "" : productCode.trim();
        if (code.isEmpty()) return List.of();
        // 同一产品可能有多张单(历史重复录入),按 m_date 倒序取,子件按行序 xc 排
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT m_no, m_date, xc, wzdm2, wzmc2, gg2, jldw2, bzl, sl2, in_dj, bz"
                        + " FROM dbo.mate WHERE m_no = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY m_date DESC, xc, id", code);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String item = str(r.get("wzdm2"));
            if (item.isEmpty()) continue;
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("子件代码", item);
            v.put("子件名称", str(r.get("wzmc2")));
            v.put("规格型号", str(r.get("gg2")));
            v.put("子件单位", str(r.get("jldw2")));
            v.put("标准用量", dbl(r.get("bzl")));
            v.put("损耗量", dbl(r.get("sl2")));
            v.put("单价", dbl(r.get("in_dj")));
            v.put("备注", str(r.get("bz")));
            out.add(v);
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(str(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static double dbl(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(str(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }
}
