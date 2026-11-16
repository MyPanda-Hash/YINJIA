package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产工单删除(2026-11-13 用户口径第二条)。
 *
 * <p>用户原话:「当前工单应该可以删除,从订单结转处转来的工单删除应该回到订单结转中,
 * 而已经排产的不能删除。其他存在报工的自然也不能删除了。」
 *
 * <p><b>删除口径</b>:
 * <ol>
 *   <li><b>手工新增工单</b>:直接删除(软删),不留业务回流;</li>
 *   <li><b>订单结转转来的工单</b>:除了软删本工单行,还要**释放 SO→PLANG 占用链**
 *       ({@code form_flow_link} 按 工单号+工单行号 精确释放) ⇒ 该销售订单行的「剩余可转量」回涨,
 *       订单结转页重新出现该订单行(可以重新转单);</li>
 *   <li><b>已排产 / 有报工 / 已入库 / 已领料 / 已结案 / 切单子单 / 已有下游单据</b>:一律拒绝并点名原因
 *       —— 删除只适用于"刚建出来、还没进入任何生产环节"的工单行。</li>
 * </ol>
 *
 * <p><b>为什么用软删不物理删</b>:{@code plang} 是外部单据表(手机端小程序/参考库直连写),
 * 物理删会让外部系统的行消失、且无法审计;全库口径一直是 {@code asp_cancel='Y'} 软删
 * (生产工单列表/待排产池等查询都带 {@code ISNULL(asp_cancel,'N')<>'Y'} 过滤)。
 *
 * <p><b>为什么拒绝"已排产"</b>不是技术洁癖:排产会把行写进 {@code plang_pc}/{@code wo_process_line}
 * 并出现在产线负荷/看板里,删掉会让排产台账悬空。要撤排产请先走「快速排产 → 撤销排产」,
 * 要撤切单请走「撤回切单」。
 */
@Service
public class WorkOrderDeleteService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderDeleteService.class);

    private final JdbcTemplate jdbc;
    private final VoucherFlowService voucherFlow;

    public WorkOrderDeleteService(JdbcTemplate jdbc, VoucherFlowService voucherFlow) {
        this.jdbc = jdbc;
        this.voucherFlow = voucherFlow;
    }

    /**
     * 删除一张工单行。
     *
     * @param rowId 工单行id(= plang.id)
     * @param user  当前登录账号(留痕)
     * @return {工单号, 工单行号, 来源订单号, 是否释放订单占用, 提示}
     */
    @Transactional
    public Map<String, Object> delete(Object rowId, String user) {
        long id = rowId instanceof Number n ? n.longValue() : 0;
        if (id <= 0) throw new IllegalArgumentException("缺少工单行id");
        Map<String, Object> row = rowOf(id);
        String plNo = str(row.get("pl_no"));
        Integer xc = row.get("pl_xc") instanceof Number n ? n.intValue() : null;
        String lineKey = plNo + "#" + xc;
        String odNo = str(row.get("od_no"));

        // ── 删除守卫(用户口径:已排产/有报工的自然不能删)──
        String origin = str(row.get("源工单号"));
        if (!origin.isEmpty()) {
            throw new IllegalStateException("工单 " + lineKey + " 是切单子工单,不能用删除;请用「撤回切单」还原父单数量");
        }
        if ("Y".equalsIgnoreCase(str(row.get("ja")))) {
            throw new IllegalStateException("工单 " + lineKey + " 已结案,不能删除");
        }
        if (!str(row.get("scx")).isEmpty() || exists("SELECT COUNT(*) FROM dbo.plang_pc"
                + " WHERE plang_id=? AND ISNULL(asp_cancel,'N')<>'Y'", id)) {
            throw new IllegalStateException("工单 " + lineKey + " 已排产,不能删除;如需调整请先「撤销排产」");
        }
        String batch = str(row.get("批次号"));
        if (exists("SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + " AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=?)"
                        + "      OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=ISNULL(?,N'')))",
                plNo, id, batch)) {
            throw new IllegalStateException("工单 " + lineKey + " 已有报工记录,不能删除");
        }
        double rk = num(row.get("rk_sl"));
        if (rk > 0.0001) throw new IllegalStateException("工单 " + lineKey + " 已有入库数量(" + rk + "),不能删除");
        if (!str(row.get("ll_no2")).isEmpty()) {
            throw new IllegalStateException("工单 " + lineKey + " 已生成领料单,不能删除;请先处理领料单");
        }
        if (exists("SELECT COUNT(*) FROM dbo.form_flow_link f WHERE f.source_panel_code='PLANG'"
                        + " AND f.source_form_no=? AND f.source_line_key=? AND f.link_status='ACTIVE'",
                plNo, lineKey)) {
            throw new IllegalStateException("工单 " + lineKey + " 已有下游单据(领料/检验/入库等占用),不能删除");
        }

        // ── 删(软删) ──
        // ① 释放 SO→PLANG 占用链(订单结转转来的单:释放后订单行重新出现在订单结转,可再转单)
        int released = 0;
        if (!odNo.isEmpty()) {
            released = voucherFlow.releaseLine("PLANG", plNo, lineKey);
        }
        // ② 工单行软删
        jdbc.update("UPDATE dbo.plang SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE id=?", user, id);
        // ③ 未投产行上可能已生成的辅助数据一并软删(避免台账悬空)
        jdbc.update("UPDATE dbo.wo_process_line SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                + " WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'", user, id);
        jdbc.update("UPDATE dbo.wo_bom SET asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'", user, id);
        jdbc.update("UPDATE dbo.wo_day_plan SET asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'", user, id);

        log.info("[删除工单] {} 删除工单行 {} (来源订单={}, 释放占用链={} 条) by {}",
                plNo, lineKey, odNo.isEmpty() ? "手工新增" : odNo, released, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工单号", plNo);
        out.put("工单行号", xc);
        out.put("来源订单号", odNo);
        out.put("是否释放订单占用", released > 0);
        out.put("提示", odNo.isEmpty()
                ? "手工新增工单已删除"
                : "已删除,订单 " + odNo + " 的该订单行已释放回「订单结转」,可以重新转单");
        return out;
    }

    /** 按 id 读未删除的 plang 行;不存在 → 业务错误 */
    private Map<String, Object> rowOf(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.scx,N'') AS scx,"
                        + " ISNULL(p.rk_sl,0) AS rk_sl, ISNULL(p.ll_no2,N'') AS ll_no2, ISNULL(p.ja,N'N') AS ja,"
                        + " ISNULL(p.[源工单号],N'') AS 源工单号, ISNULL(p.od_no,N'') AS od_no"
                        + " FROM dbo.plang p WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("该工单行不存在或已删除,请刷新列表");
        return rows.get(0);
    }

    /** 计数查询(>0 即命中);参数透传 */
    private boolean exists(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n != null && n > 0;
    }

    private static double num(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        String s = str(v);
        if (s.isEmpty()) return 0;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
