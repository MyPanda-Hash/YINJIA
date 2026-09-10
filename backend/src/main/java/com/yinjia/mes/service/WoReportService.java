package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 工序报工记账:报工单审核 → wo_progress.完成数量 累计;弃审对称冲回。
 * 与 StockLedgerService 同构(审核即过账,失败整笔回滚)。
 * 守护:工单必须已审核;工单须含该工序行;冲回后完成数量不得为负。
 * 排产视图(完成数=工单报工数求和)由此驱动。
 */
@Service
public class WoReportService {

    private final JdbcTemplate jdbc;

    public WoReportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static boolean posts(String panelCode) {
        return "WO_REPORT".equals(panelCode);
    }

    /** 审核 → 完成数量 += 报工数量。 */
    public void post(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        for (Map<String, Object> r : rows(no)) {
            apply(r, +1, user);
        }
    }

    /** 弃审 → 完成数量 -= 报工数量(负数拒绝)。 */
    public void unpost(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        for (Map<String, Object> r : rows(no)) {
            apply(r, -1, user);
        }
    }

    private List<Map<String, Object>> rows(String no) {
        return jdbc.queryForList(
                "SELECT [工单号], [工序], [报工数量] FROM wo_report WHERE [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'", no);
    }

    private void apply(Map<String, Object> r, int sign, String user) {
        String wo = str(r.get("工单号"));
        String op = str(r.get("工序"));
        double qty = num(r.get("报工数量"));
        if (wo == null || op == null) throw new IllegalStateException("报工单缺少工单号或工序,不能过账");
        // 工单必须已审核(yj_doc_status.shr 非空)
        List<String> shr = jdbc.queryForList(
                "SELECT shr FROM yj_doc_status WHERE panel_code = 'WO_ORDER' AND doc_no = ?", String.class, wo);
        if (shr.isEmpty() || shr.get(0) == null) {
            throw new IllegalStateException("工单 " + wo + " 尚未审核,不能报工");
        }
        int n = jdbc.update("UPDATE wo_progress SET [完成数量] = [完成数量] + ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE [单据编号] = ? AND [工序] = ?",
                sign * qty, user, wo, op);
        if (n == 0) throw new IllegalStateException("工单 " + wo + " 无 [" + op + "] 工序行,不能报工");
        if (sign < 0) {
            Double done = jdbc.queryForObject(
                    "SELECT [完成数量] FROM wo_progress WHERE [单据编号] = ? AND [工序] = ?", Double.class, wo, op);
            if (done != null && done < -0.0001) {
                throw new IllegalStateException("冲回将使 " + wo + " [" + op + "] 完成数量为负,不可弃审");
            }
        }
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
