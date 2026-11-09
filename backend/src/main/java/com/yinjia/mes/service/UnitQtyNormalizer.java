package com.yinjia.mes.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 单据/库存的**数量按计量单位精度规整**(2026-11-09 用户口径:
 * 「对其余单据 wms 管理的单据和库存,智能供应链的单据也要用这个计量单位来对症」)。
 *
 * <h3>口径</h3>
 * <ul>
 *   <li>字段判定:字段名含「数量」(数量 / 实收数量 / 合格数量 / 结存数量 / 打印数量…)才算;
 *       金额/单价/税率一律不动;</li>
 *   <li>精度来源 = 该行单位(优先「计量单位」/「单位」;行内没有则用外层传入的 uom,
 *       如库存过账行的 {@code 计量单位} 别名),精度由 {@link BatchService#unitDecimals} 给
 *       (bs_uom.小数位数:个/卷/张=0、kg/米=3;查不到按计件 0 / 计量 3 / 未知 2);</li>
 *   <li>方向 = **向下取整**(与超送同一口径,用户 2026-11-09 选定):
 *       填 4.6 个 → 4;kg 填 304.6123 → 304.612;</li>
 *   <li>双单位行(数量2/计量单位2)按第 2 单位各自的精度;</li>
 *   <li>没有单位可依据的行(生产/检验这类没有单位列的表)**原样不动** —— 宁可不动也不瞎取整。</li>
 * </ul>
 *
 * <p>调用点:
 * <ul>
 *   <li>{@link ButtonService} 保存(明细行 + 表头):所有面板的写入口;</li>
 *   <li>{@link StockLedgerService} 过账/冲回:按行单位把数量落到 inh/outh/kucun。</li>
 * </ul>
 */
@Service
public class UnitQtyNormalizer {

    /** 行内可能出现的单位列名(按优先级) */
    private static final String[] UNIT_KEYS = {"计量单位", "单位", "uom", "单位名称", "计量单位名称", "主单位", "主计量单位"};
    /** 双单位:第 2 单位列 */
    private static final String[] UNIT_KEYS_2 = {"计量单位2", "单位2", "uom2"};

    /**
     * 数量类字段判定(2026-11-09):库存报表的数量列叫「期初结存/本期入库/期末结存」,不带"数量"二字;
     * 反例(单号/金额/单价/日期/单位/仓库…)一律不动。
     */
    private static final java.util.regex.Pattern QTY_LABEL =
            java.util.regex.Pattern.compile("(数量|结存|期初|期末|入库|出库)");
    private static final java.util.regex.Pattern NOT_QTY =
            java.util.regex.Pattern.compile("(单号|编号|金额|单价|税额|日期|时间|次数|状态|类型|方式|人|单位|仓库)");

    private final BatchService batchService;

    public UnitQtyNormalizer(BatchService batchService) {
        this.batchService = batchService;
    }

    /** 该行的单位值(找不到 → 空串) */
    public String unitOf(Map<String, Object> row) {
        if (row == null) return "";
        for (String k : UNIT_KEYS) {
            Object v = row.get(k);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v).trim();
        }
        return "";
    }

    /** 该行单位的小数位数(无单位 → {@link UnitPrecision#DEFAULT_DECIMALS}) */
    public int decimalsOf(Map<String, Object> row) {
        return batchService.unitDecimals(unitOf(row));
    }

    /** 按行单位把数量向下取整(行没单位 → 原样返回) */
    public double floorQty(double qty, Map<String, Object> row) {
        String unit = unitOf(row);
        if (unit.isEmpty()) return qty;
        return UnitPrecision.floorTo(qty, batchService.unitDecimals(unit));
    }

    /**
     * 规整一行里的全部「*数量*」字段(金额/单价/税率不动)。
     *
     * @return 是否有字段被改动
     */
    public boolean normalizeRow(Map<String, Object> row) {
        if (row == null) return false;
        boolean changed = false;
        // 先把行里出现的单位缓存下来(避免每个字段都查一次)
        String unit1 = unitOf(row);
        String unit2 = firstNonBlank(row, UNIT_KEYS_2);
        int nd1 = unit1.isEmpty() ? -1 : batchService.unitDecimals(unit1);
        int nd2 = unit2.isEmpty() ? -1 : batchService.unitDecimals(unit2);
        if (nd1 < 0 && nd2 < 0) return false;          // 没有单位列:整行不动
        for (Map.Entry<String, Object> e : row.entrySet()) {
            String label = e.getKey();
            if (label == null || NOT_QTY.matcher(label).find() || !QTY_LABEL.matcher(label).find()) continue;
            Object v = e.getValue();
            if (v == null || String.valueOf(v).isBlank()) continue;
            double n;
            try { n = Double.parseDouble(String.valueOf(v).trim()); } catch (NumberFormatException ex) { continue; }
            int nd = label.endsWith("2") && nd2 >= 0 ? nd2 : nd1;
            if (nd < 0) continue;
            double f = UnitPrecision.floorTo(n, nd);
            if (Math.abs(f - n) > 1e-9) {
                row.put(label, f);
                changed = true;
            }
        }
        return changed;
    }

    /** 规整一批明细行 */
    public boolean normalizeRows(List<Map<String, Object>> rows) {
        boolean changed = false;
        if (rows == null) return false;
        for (Map<String, Object> r : rows) changed |= normalizeRow(r);
        return changed;
    }

    private static String firstNonBlank(Map<String, Object> row, String[] keys) {
        for (String k : keys) {
            Object v = row.get(k);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v).trim();
        }
        return "";
    }
}
