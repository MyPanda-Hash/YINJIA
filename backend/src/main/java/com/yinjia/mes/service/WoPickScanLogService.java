package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单扫码领料的**逐笔操作留痕**(2026-10-21)。
 *
 * <p>用户口径:「要监控 App 使用情况,因为这个取数上报的要能看到他们的操作情况」
 * + 「还要记『扫了哪些料、各多少、什么时候』——更细,需要新表」。
 *
 * <p>为什么不复用 {@link UsageLogService}(yj_usage_log):那张表是「谁在哪个面板点了哪个按钮」
 * 的粗粒度事件(panel_name/action_name/doc_no/ip),装不下「哪张工单哪一行、扫了哪个物料、
 * 多少数量、秤读数多少、相机还是扫码枪、App 还是网页」这些作业事实。扫码明细是**可追溯的
 * 作业流水**(要对账、要查谁多领),生命周期与查询口径都不同 ⇒ 独立表 {@code wo_pick_scan_log}。
 *
 * <p><b>只增不改</b>:业务侧不 UPDATE、不 DELETE;撤销走 {@code asp_cancel='Y'}(全库惯例)。
 *
 * <p>写入失败一律吞掉并只打日志 —— 留痕不能拖垮作业(同 {@code UsageLogService.insert} 口径)。
 */
@Service
public class WoPickScanLogService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(WoPickScanLogService.class);

    private final JdbcTemplate jdbc;

    public WoPickScanLogService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 记一笔扫码。
     *
     * @param p 扫码事实(字段可空;必填 wo_no / material_code / qty)
     * @param user 登录账号
     * @param ip 来源 IP
     */
    public void record(Map<String, Object> p, String user, String ip) {
        try {
            jdbc.update(
                    "INSERT INTO wo_pick_scan_log ("
                            + "wo_no, wo_line, product_code, material_code, material_name, qty, unit,"
                            + "scale_value, scale_device, scale_at, scan_type, scan_source, client_type, client_info,"
                            + "doc_no, asp_user1, asp_time1, asp_cancel, remark) "
                            + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),'N',?)",
                    str(p.get("woNo")), intOf(p.get("woLine")), str(p.get("productCode")),
                    str(p.get("materialCode")), str(p.get("materialName")),
                    dec(p.get("qty")), str(p.get("unit")),
                    p.get("scaleValue") == null ? null : dec(p.get("scaleValue")),
                    str(p.get("scaleDevice")), timeOf(p.get("scaleAt")),
                    blankTo(str(p.get("scanType")), "物料"), str(p.get("scanSource")),
                    str(p.get("clientType")), str(p.get("clientInfo")),
                    str(p.get("docNo")), user, str(p.get("remark")));
        } catch (Exception e) {
            // 留痕失败不影响作业:作业本身已成功,不能因为日志写不进去就报错给现场
            log.warn("扫码留痕写入失败(不影响作业):{}", e.getMessage());
        }
    }

    /**
     * 整单提交后,把本次作业扫过的行补上领料单号(便于按单据回查)。
     *
     * <p>只补 {@code doc_no} 为空的行,且限定「同一工单+行号+同一操作人+尚未关联单据」——
     * 避免把别人或上一次作业的记录误挂到这张单上。
     *
     * @param docNo 生成的领料单号
     * @param woNo 工单号
     * @param woLine 工单行号
     * @param user 操作人
     * @return 更新行数(0 表示没有待关联的记录,不是错误)
     */
    public int attachDocNo(String docNo, String woNo, int woLine, String user) {
        if (docNo == null || docNo.isBlank() || woNo == null || woNo.isBlank()) return 0;
        try {
            return jdbc.update(
                    "UPDATE wo_pick_scan_log SET doc_no = ?, asp_user2 = ?, asp_time2 = SYSDATETIME()"
                            + " WHERE wo_no = ? AND wo_line = ? AND asp_user1 = ?"
                            + " AND (doc_no IS NULL OR doc_no = '') AND ISNULL(asp_cancel,'N') <> 'Y'",
                    docNo, user, woNo, woLine, user);
        } catch (Exception e) {
            log.warn("扫码留痕关联单号失败(不影响作业):{}", e.getMessage());
            return 0;
        }
    }

    /**
     * 查询扫码流水(时间倒序)。
     *
     * @param woNo 工单号(模糊)
     * @param user 操作人(模糊)
     * @param materialCode 子件代码(模糊)
     * @param start 起始日期 yyyy-MM-dd
     * @param end 结束日期 yyyy-MM-dd
     * @param page 页码(从 1 开始)
     * @param size 每页条数
     */
    public Map<String, Object> query(String woNo, String user, String materialCode,
                                     String start, String end, int page, int size) {
        StringBuilder cond = new StringBuilder(" WHERE ISNULL(asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        if (notBlank(woNo)) { cond.append(" AND wo_no LIKE ?"); args.add("%" + woNo.trim() + "%"); }
        if (notBlank(user)) { cond.append(" AND (asp_user1 LIKE ? OR asp_user2 LIKE ?)"); args.add("%" + user.trim() + "%"); args.add("%" + user.trim() + "%"); }
        if (notBlank(materialCode)) { cond.append(" AND (material_code LIKE ? OR material_name LIKE ?)"); args.add("%" + materialCode.trim() + "%"); args.add("%" + materialCode.trim() + "%"); }
        if (notBlank(start)) { cond.append(" AND asp_time1 >= ?"); args.add(start.trim()); }
        if (notBlank(end)) { cond.append(" AND asp_time1 <= ?"); args.add(end.trim() + " 23:59:59"); }

        int total = jdbc.queryForObject("SELECT COUNT(*) FROM wo_pick_scan_log" + cond, Integer.class, args.toArray());
        int p = Math.max(1, page);
        int s = Math.max(1, Math.min(500, size));
        int offset = (p - 1) * s;

        List<Object> qargs = new ArrayList<>(args);
        qargs.add(offset);
        qargs.add(s);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, wo_no, wo_line, product_code, material_code, material_name, qty, unit,"
                        + " scale_value, scale_device, scale_at, scan_type, scan_source, client_type,"
                        + " client_info, ip, doc_no, asp_user1, asp_time1, remark"
                        + " FROM wo_pick_scan_log" + cond
                        + " ORDER BY asp_time1 DESC, id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY", qargs.toArray());

        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("id", r.get("id"));
            v.put("工单号", str(r.get("wo_no")));
            v.put("工单行号", intOf(r.get("wo_line")));
            v.put("产品编码", str(r.get("product_code")));
            v.put("物料编码", str(r.get("material_code")));
            v.put("物料名称", str(r.get("material_name")));
            v.put("数量", r.get("qty"));
            v.put("单位", str(r.get("unit")));
            v.put("秤读数", r.get("scale_value"));
            v.put("秤设备", str(r.get("scale_device")));
            v.put("秤采样时间", r.get("scale_at"));
            v.put("扫码类型", str(r.get("scan_type")));
            v.put("扫码方式", str(r.get("scan_source")));
            v.put("客户端", str(r.get("client_type")));
            v.put("设备标识", str(r.get("client_info")));
            v.put("来源IP", str(r.get("ip")));
            v.put("领料单号", str(r.get("doc_no")));
            v.put("操作人", str(r.get("asp_user1")));
            v.put("操作时间", r.get("asp_time1"));
            v.put("备注", str(r.get("remark")));
            list.add(v);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", list);
        out.put("total", total);
        out.put("page", p);
        out.put("pageSize", s);
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static String blankTo(String v, String dft) {
        return v == null || v.isBlank() ? dft : v;
    }

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(str(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static java.math.BigDecimal dec(Object o) {
        if (o == null) return java.math.BigDecimal.ZERO;
        if (o instanceof java.math.BigDecimal b) return b;
        if (o instanceof Number n) return java.math.BigDecimal.valueOf(n.doubleValue());
        try {
            return new java.math.BigDecimal(str(o));
        } catch (RuntimeException e) {
            return java.math.BigDecimal.ZERO;
        }
    }

    /** 秤采样时刻:接受 ISO 串或毫秒时间戳;解析不了就落空(不阻断)。 */
    private static java.sql.Timestamp timeOf(Object o) {
        if (o == null) return null;
        String s = str(o);
        if (s.isEmpty()) return null;
        try {
            if (s.matches("\\d{10,}")) return new java.sql.Timestamp(Long.parseLong(s));
            String t = s.replace('T', ' ').replace('Z', ' ').trim();
            if (t.length() == 16) t = t + ":00";
            return java.sql.Timestamp.valueOf(t);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
