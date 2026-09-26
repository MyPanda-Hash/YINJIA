package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 订单结转·发单工作台(方案《订单结转实现方案-V1.0》2026-09-22)。
 *
 * <p>定位:结转页只是**发单调度台**——判断每行订单"库存/排产够不够"后 转加工单(自制)/转采购单(外购成品),
 * 处理完的行自动消失;生成的加工单/采购申请是标准单据,后续按各自列表页流转。
 *
 * <p>防重复 = 行级占用链 form_flow_link(SO→加工单 / SO→采购申请),剩余数量=需求数量−各通道占用之和;
 * 转满的行退出列表(列表过滤),重复提交被后端剩余量校验拒绝(双保险);**不改销售订单状态**(ERP 同步真源)。
 * 与 BOM 齐套互不替代:材料缺口走 加工单「生成采购申请」(BOM×排产−库存);本页采购的是**订单产品本身**。
 *
 * <p>2026-09-26 数据源单轨(用户拍板「工单数据都在 plang」):转工单不再写 bd/bl_manu_order,
 * 直接落参考库工单表 **plang**(键=公司代码 comm + 工单号 pl_no + 工单行号 pl_xc;生产工单列表页/
 * 打印/结案/调线已挂 plang);占用通道记录为 target_panel_code='PLANG'(与存量 'MANU_ORDER' 占用
 * 并列计入剩余);转单完成**不再跳转生产加工单表单页**(该页随数据源切换不再承载新单,处理完的行自动消失)。
 */
@Service
public class OrderConvertService {

    private final JdbcTemplate jdbc;
    private final FormNoService formNo;
    private final PanelRegistry registry;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;
    private final MessageService message;

    public OrderConvertService(JdbcTemplate jdbc, FormNoService formNo, PanelRegistry registry,
                               ButtonService buttonService, VoucherFlowService voucherFlow, MessageService message) {
        this.jdbc = jdbc;
        this.formNo = formNo;
        this.registry = registry;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
        this.message = message;
    }

    /**
     * 待结转行:已审核(未作废/未中止)订单行,剩余数量 = 数量 − SO→加工单占用 − SO→采购申请占用 > 0。
     * 已排产/已采购为两通道并列占用;转满自动消失,删下游草稿释放占用自动回现(自愈)。
     */
    public List<Map<String, Object>> pending(String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        String like = "%" + kw + "%";
        return jdbc.queryForList(
                "SELECT o.[单据编号] AS 订单号, l.[id] AS 行id,"
                        + " CONVERT(varchar(10), o.[单据日期], 120) AS 下单日期,"
                        + " CONVERT(varchar(10), ISNULL(l.[预计交货日期], o.[预计交货日期]), 120) AS 交货日期,"
                        + " ISNULL(o.[客户], N'') AS 客户原始值, ISNULL(o.[业务员], N'') AS 业务员,"
                        + " COALESCE(pt.往来单位名称, dk.mc, o.[客户]) AS 客户,"
                        + " ISNULL(pt.[客户价格等级], N'') AS 客户等级,"
                        + " l.[存货编码] AS 物料编码, l.[存货名称] AS 品名, ISNULL(l.[规格型号], N'') AS 型号,"
                        + " ISNULL(l.[客户订单号], N'') AS 客户订单号, ISNULL(l.[批次号], N'') AS 批号,"
                        + " ISNULL(备注_管控.重点管控, N'否') AS 重点管控,"
                        + " ISNULL(l.[数量], 0) AS 需求数量,"
                        + " ISNULL(m.linked, 0) AS 已排产数量, ISNULL(p.linked, 0) AS 已采购数量,"
                        + " ISNULL(l.[数量], 0) - ISNULL(m.linked, 0) - ISNULL(p.linked, 0) AS 剩余数量"
                        + " FROM bd_so_order o"
                        + " JOIN bl_so_order l ON l.[单据编号] = o.[单据编号] AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                        + " JOIN yj_doc_status s ON s.panel_code = 'SO_ORDER' AND s.doc_no = o.[单据编号]"
                        + "   AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(s.stopped,'N') <> 'Y'"
                        + " LEFT JOIN bs_partner pt ON pt.[往来单位编码] = o.[客户编码]"
                        + "   OR (ISNULL(o.[客户编码],N'') = N'' AND pt.[往来单位名称] = o.[客户])"
                        + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                        + "            FROM bs_inv iv GROUP BY iv.存货编码) 备注_管控 ON 备注_管控.存货编码 = l.[存货编码]"
                        + " LEFT JOIN dm_kh dk ON dk.dm = o.[客户编码]"
                        + " OUTER APPLY (SELECT SUM(ISNULL(linked_quantity,0)) AS linked FROM form_flow_link f"
                        + "   WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key = o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))"
                        + "     AND f.target_panel_code IN ('MANU_ORDER','PLANG') AND f.link_status='ACTIVE') m"
                        + " OUTER APPLY (SELECT SUM(ISNULL(linked_quantity,0)) AS linked FROM form_flow_link f"
                        + "   WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key = o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))"
                        + "     AND f.target_panel_code='PU_REQ' AND f.link_status='ACTIVE') p"
                        + " WHERE ISNULL(o.asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(l.[数量],0) - ISNULL(m.linked,0) - ISNULL(p.linked,0) > 0.0001"
                        + "   AND (? = '' OR o.[单据编号] LIKE ? OR o.[客户] LIKE ? OR l.[存货编码] LIKE ? OR l.[存货名称] LIKE ?)"
                        + " ORDER BY o.[单据日期], o.[单据编号], l.[id]",
                kw, like, like, like, like);
    }

    /**
     * 汇总条:未结转(剩余>0 行:笔数/款数/下单数量) + 今日结转(当日 SO→加工单|采购申请 占用:笔数/款数/数量)
     * + 当前数据笔数。
     */
    public Map<String, Object> stats() {
        List<Map<String, Object>> rows = pending("");
        Map<String, Object> undone = new LinkedHashMap<>();
        undone.put("总订单笔数", rows.size());
        undone.put("总款数", rows.stream().map(r -> String.valueOf(r.get("物料编码"))).distinct().count());
        undone.put("总下单数量", round(rows.stream().mapToDouble(r -> num(r.get("需求数量"))).sum()));

        Map<String, Object> today = jdbc.queryForMap(
                "SELECT COUNT(DISTINCT source_line_key) AS cnt, COUNT(DISTINCT ISNULL(inventory_code,N'')) AS styles,"
                        + " SUM(ISNULL(linked_quantity,0)) AS qty FROM form_flow_link"
                        + " WHERE source_panel_code='SO_ORDER' AND target_panel_code IN ('MANU_ORDER','PU_REQ','PLANG')"
                        + "   AND link_status='ACTIVE' AND CONVERT(varchar(10), create_time, 120) = CONVERT(varchar(10), GETDATE(), 120)");
        Map<String, Object> done = new LinkedHashMap<>();
        done.put("总订单笔数", num(today.get("cnt")));
        done.put("总款数", num(today.get("styles")));
        done.put("总下单数量", round(num(today.get("qty"))));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("未结转", undone);
        out.put("今日结转", done);
        out.put("当前数据笔数", rows.size());
        return out;
    }

    /**
     * 转工单(自制):逐行按 生单数量(缺省=两通道剩余)生成工单——**直接写参考库 plang**
     * (2026-09-26 数据源单轨:不再写 bd/bl_manu_order,不再跳转生产加工单表单页)。
     * 行内若修改了 交货日期 → 先回写订单行(applyDateEdit),工单 计划完工日期 取修正后交期。
     *
     * <p>⚠ 不加 @Transactional(2026-09-26 修复):行级独立提交——此前外层事务+内层事务方法
     * 的组合,某行守卫失败会把共享事务标 rollback-only,提交即抛
     * "Transaction rolled back because it has been marked as rollback-only"(用户实测报障)。
     * 行级捕获 RuntimeException:失败行自身回滚进 failed,成功行各自提交(created/failed 双清单语义)。
     */
    public Map<String, Object> toManu(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要转工单的订单行");
        List<String> created = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String soNo = str(r.get("订单号"));
            String lineId = str(r.get("行id"));
            if (soNo == null || lineId == null) throw new IllegalArgumentException("转单行缺少 订单号/行id");
            try {
                String due = applyDateEdit(r, user);
                Double qty = num2(str(r.get("生单数量")) == null ? null : r.get("生单数量"));
                created.add(createPlangFromOrderLine(soNo, lineId, qty, due, user));
            } catch (RuntimeException e) {
                failed.add(soNo + "#" + lineId + ":" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }
        if (created.isEmpty()) throw new IllegalStateException("无行可转:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("生成张数", created.size());
        out.put("编号清单", created);
        out.put("失败行", failed);
        return out;
    }

    /**
     * 单条订单行 → 一行 plang 工单(工单号=MO 号池续号,行号=1,需求数量=订单行数量,排产=生单数量)。
     * 口径与 QuickScheduleService.createFromOrderLine 一致(仅已审核/占用守恒/需求数量不缩水),
     * 差异:落 plang;占用通道 target_panel_code='PLANG';交期落 cp_date(计划完工日期)。
     */
    private String createPlangFromOrderLine(String soNo, String lineId, Double qtyOverride, String dueOverride, String user) {
        // ① 来源订单必须已审核(未作废/未中止)——与旧生单同闸门
        Integer audited = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='SO_ORDER' AND doc_no=?"
                        + " AND shr IS NOT NULL AND ISNULL(canceled,'N')<>'Y' AND ISNULL(stopped,'N')<>'Y'",
                Integer.class, soNo);
        if (audited == null || audited == 0) throw new IllegalStateException("销售订单 " + soNo + " 尚未审核,不能转工单");
        // ② 订单行
        Map<String, Object> line = jdbc.queryForMap(
                "SELECT l.[存货编码], ISNULL(l.[存货名称],N'') AS 存货名称, ISNULL(l.[规格型号],N'') AS 规格型号,"
                        + " ISNULL(l.[数量],0) AS 数量, ISNULL(l.[销售单位],N'') AS 销售单位,"
                        + " ISNULL(l.[批次号],N'') AS 批次号,"
                        + " CONVERT(varchar(10), ISNULL(l.[预计交货日期], o.[预计交货日期]), 120) AS 交货日期,"
                        + " ISNULL(o.[客户编码],N'') AS 客户编码"
                        + " FROM bl_so_order l JOIN bd_so_order o ON o.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND l.[id] = ?", soNo, Integer.parseInt(lineId));
        // ③ 两通道剩余(已转工单 MANU_ORDER/PLANG 占用 + 已转采购 PU_REQ 占用)
        Double manu = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                        + " WHERE source_panel_code='SO_ORDER' AND source_line_key=?"
                        + " AND target_panel_code IN ('MANU_ORDER','PLANG') AND link_status='ACTIVE'",
                Double.class, soNo + "#" + lineId);
        Double pu = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                        + " WHERE source_panel_code='SO_ORDER' AND source_line_key=?"
                        + " AND target_panel_code='PU_REQ' AND link_status='ACTIVE'",
                Double.class, soNo + "#" + lineId);
        double demand = num(line.get("数量"));
        double residual = demand - (manu == null ? 0 : manu) - (pu == null ? 0 : pu);
        if (residual <= 0.0001) throw new IllegalStateException("该订单行已全部转出(剩余可转数量 0)");
        double qty = qtyOverride != null && qtyOverride > 0 ? Math.min(qtyOverride, residual) : residual;
        if (qty <= 0) throw new IllegalStateException("生单数量必须大于 0");
        if (qty > residual + 0.0001) throw new IllegalStateException("生单数量 " + qty + " 超过剩余可转数量 " + residual);
        // ④ 落 plang(工单号沿用 MO 号池;公司代码恒 '0' 与全库口径一致;行号=1)
        String plNo = formNo.next("MO", user);
        String due = dueOverride != null ? dueOverride : str(line.get("交货日期"));
        jdbc.update("INSERT INTO plang (comm, pl_no, pl_xc, pl_date, khdm, dm, mc, gg, jldw,"
                        + " xq_sl, pl_sl, yl, cp_date, lot_no, od_no, od_xc, ja, asp_cancel, asp_user1, asp_time1)"
                        + " VALUES (N'0', ?, 1, GETDATE(), ?, ?, ?, ?, ?, ?, ?, ?,"
                        + " CASE WHEN ? IS NULL OR ? = N'' THEN NULL ELSE CONVERT(datetime, ?, 120) END,"
                        + " ?, ?, CONVERT(float, ?), 'N', 'N', ?, GETDATE())",
                plNo, str(line.get("客户编码")), str(line.get("存货编码")), str(line.get("存货名称")),
                str(line.get("规格型号")), str(line.get("销售单位")),
                demand, qty, qty, due, due, due, str(line.get("批次号")), soNo, lineId, user);
        // ⑤ 行级占用(通道=PLANG;目标行键=工单号#1)
        voucherFlow.linkLine("SO_ORDER", soNo, soNo + "#" + lineId, str(line.get("存货编码")), qty,
                "PLANG", plNo, plNo + "#1", "");
        return plNo;
    }

    /**
     * 转采购单(外购成品):逐行生成采购申请 PU_REQ 草稿——行=订单产品本身(存货编码=物料编码,数量=两通道剩余),
     * 需求日期=行级交货日期;SO→PU_REQ 行级占用(linkLine)+站内消息推采购。
     * <p>⚠ 不加 @Transactional,行级独立提交(同 toManu 的 rollback-only 根因,2026-09-26 修复)。
     */
    public Map<String, Object> toPurchase(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("请先勾选要转采购单的订单行");
        List<String> created = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        double total = 0;
        for (Map<String, Object> r : rows) {
            String soNo = str(r.get("订单号"));
            String lineId = str(r.get("行id"));
            if (soNo == null || lineId == null) throw new IllegalArgumentException("转单行缺少 订单号/行id");
            try {
                applyDateEdit(r, user);   // 交期修正先回写订单行 → 下方行级读取 需求日期 即为修正值
                Map<String, Object> line = jdbc.queryForMap(
                        "SELECT l.[存货编码], l.[存货名称], l.[数量], ISNULL(l.[规格型号],N'') AS 规格型号,"
                                + " CONVERT(varchar(10), ISNULL(l.[预计交货日期], o.[预计交货日期]), 120) AS 交货日期"
                                + " FROM bl_so_order l JOIN bd_so_order o ON o.[单据编号] = l.[单据编号]"
                                + " WHERE l.[单据编号] = ? AND l.[id] = ?", soNo, Integer.parseInt(lineId));
                Double manu = jdbc.queryForObject(
                        "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                                + " WHERE source_panel_code='SO_ORDER' AND source_form_no=? AND source_line_key=?"
                                + " AND target_panel_code IN ('MANU_ORDER','PLANG') AND link_status='ACTIVE'",
                        Double.class, soNo, soNo + "#" + lineId);
                Double pu = jdbc.queryForObject(
                        "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                                + " WHERE source_panel_code='SO_ORDER' AND source_form_no=? AND source_line_key=?"
                                + " AND target_panel_code='PU_REQ' AND link_status='ACTIVE'",
                        Double.class, soNo, soNo + "#" + lineId);
                double residual = num(line.get("数量")) - (manu == null ? 0 : manu) - (pu == null ? 0 : pu);
                if (residual <= 0.0001) throw new IllegalStateException("剩余数量 0,已转满");
                Double override = num2(r.get("生单数量"));
                double qty = override != null && override > 0 ? Math.min(override, residual) : residual;

                Map<String, Object> head = new LinkedHashMap<>();
                head.put("单据日期", java.time.LocalDate.now().toString());
                head.put("请购人", user);
                if (line.get("交货日期") != null) head.put("需求日期", String.valueOf(line.get("交货日期")));
                head.put("销售订单号", soNo);
                head.put("来源单据", "销售订单");
                head.put("来源单号", soNo);
                head.put("备注", "订单结转:外购成品 " + line.get("存货编码") + " × " + qty);
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("存货编码", line.get("存货编码"));
                item.put("存货名称", line.get("存货名称"));
                item.put("数量", qty);
                Map<String, Object> formData = new LinkedHashMap<>(head);
                formData.put("detail", Map.of("items", List.of(item)));
                Map<String, Object> saved = buttonService.save(registry.panel("PU_REQ"), formData, false);
                String newNo = String.valueOf(saved.get("编号"));
                voucherFlow.linkLine("SO_ORDER", soNo, soNo + "#" + lineId, str(line.get("存货编码")), qty,
                        "PU_REQ", newNo, newNo + "#0", "");
                created.add(newNo);
                total += qty;
            } catch (RuntimeException e) {
                failed.add(soNo + "#" + lineId + ":" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }
        if (created.isEmpty()) throw new IllegalStateException("无行可转:" + String.join("; ", failed));

        List<String> targets = new ArrayList<>(message.admins());
        try {
            targets.addAll(jdbc.queryForList(
                    "SELECT DISTINCT u.username FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                            + " WHERE rp.panel_code = 'PU_ORDER' AND rp.perms LIKE '%view%'", String.class));
        } catch (Exception ignore) { }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("来源", "订单结转(外购成品)");
        params.put("单据数", created.size());
        params.put("数量合计", round(total));
        params.put("提示", "订单结转采购申请已生成,请查收");
        message.send(targets, "PURCHASE_REQUESTED", "PU_REQ", created.get(0), params, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("生成张数", created.size());
        out.put("编号清单", created);
        out.put("失败行", failed);
        out.put("数量合计", round(total));
        out.put("gotoPanel", "PU_REQ");
        return out;
    }

    /**
     * 保存交期(行内编辑·独立按钮):把修正后的 预计交货日期 回写 bl_so_order 行
     * (同步侧历史数据常与创建日期雷同,在结转处就地修正;留痕 asp_user2/asp_time2)。转单内部亦走 applyDateEdit。
     */
    @Transactional
    public Map<String, Object> saveDates(List<Map<String, Object>> rows, String user) {
        if (rows == null || rows.isEmpty()) throw new IllegalArgumentException("没有需要保存的交期");
        int n = 0;
        for (Map<String, Object> r : rows) {
            String soNo = str(r.get("订单号"));
            String lineId = str(r.get("行id"));
            String d = str(r.get("交货日期"));
            if (soNo == null || lineId == null || d == null) continue;
            requireDate(d);
            n += jdbc.update("UPDATE bl_so_order SET [预计交货日期] = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                            + " WHERE [单据编号] = ? AND [id] = ?",
                    java.time.LocalDate.parse(d), user, soNo, Integer.parseInt(lineId));
        }
        if (n == 0) throw new IllegalStateException("交期未变化或订单行不存在");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("更新行数", n);
        return out;
    }

    /** 转单前应用交期修正(有变化才回写);返回生效日期(yyyy-MM-dd),null=未修改 */
    private String applyDateEdit(Map<String, Object> r, String user) {
        String d = str(r.get("交货日期"));
        if (d == null) return null;
        requireDate(d);
        String soNo = str(r.get("订单号"));
        String lineId = str(r.get("行id"));
        String cur = jdbc.queryForObject(
                "SELECT CONVERT(varchar(10), [预计交货日期], 120) FROM bl_so_order WHERE [单据编号]=? AND [id]=?",
                String.class, soNo, Integer.parseInt(lineId));
        if (d.equals(cur)) return null;
        jdbc.update("UPDATE bl_so_order SET [预计交货日期] = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE [单据编号] = ? AND [id] = ?",
                java.time.LocalDate.parse(d), user, soNo, Integer.parseInt(lineId));
        return d;
    }

    private static void requireDate(String d) {
        try { java.time.LocalDate.parse(d); } catch (Exception e) {
            throw new IllegalStateException("交货日期格式错误(应为 yyyy-MM-dd):" + d);
        }
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return 0; }
    }

    private static Double num2(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return null;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    private static double round(double v) { return Math.round(v * 10000d) / 10000d; }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }
}
