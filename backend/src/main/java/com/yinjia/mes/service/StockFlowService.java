package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 库存流水读写(inh 入库 / outh 出库)。2026-09-30 用户口径:库存改为三表,
 * kucun 退为**结存缓存**、流水为唯一真源。
 *
 * 与 {@link StockLedgerService} 的分工:
 *   · StockLedgerService 负责**结存**(kucun.yl/rkl/ckl)与业务守卫(现存量不足、仓库档案必须存在);
 *   · 本类负责**流水**(inh/outh)的写入与红冲。
 * 两者由 StockLedgerService 在**同一事务**内先后调用(apply 里改完 kucun 之后),
 * 一旦有一边失败,整笔回滚,不会出现"结存动了流水没动"。
 *
 * 幂等:(src, rid) 上有唯一索引 —— 同一单据行重复审核不重复记流水。
 * 弃审 = 软删(asp_cancel='Y')保留痕迹,不物理删除;弃审后**重新审核**是把那条流水"复活"
 * (改回 'N' 并刷新单据侧字段),而不是新插一行 —— 否则结存加回去了、流水还挂着红冲,
 * 「结存 == Σ流水」必然对不上。
 */
@Service
public class StockFlowService {

    private static final Logger log = LoggerFactory.getLogger(StockFlowService.class);

    private final JdbcTemplate jdbc;

    public StockFlowService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 入库面板(src 1..4,与 v_stock_movement 的段号同口径)。 */
    private static int inSrc(String panelCode) {
        return switch (panelCode) {
            case "PURCHASE_IN" -> 1;
            case "FINISH_IN" -> 2;
            case "OTHER_IN" -> 3;
            case "OUTSOURCE_IN" -> 4;
            default -> -1;
        };
    }

    /** 出库面板(src 5..8)。 */
    private static int outSrc(String panelCode) {
        return switch (panelCode) {
            case "SALE_OUT" -> 5;
            case "MATERIAL_OUT" -> 6;
            case "OTHER_OUT" -> 7;
            case "OUTSOURCE_ISSUE" -> 8;
            default -> -1;
        };
    }

    /**
     * 写流水。
     *
     * @param rows 已由 StockLedgerService.loadRows 取好的单据行(键:code/lot/qty/price/金额/
     *             name/spec/uom/rid/单据类型/单据日期/往来单位/经手人/含税金额/税额;后两个键只有
     *             采购入库·销售出库两段有,其余段落 NULL);仓库编码/仓库名称由
     *             StockLedgerService.resolveWh 解析后回填到行上 —— 流水的三键必须与 kucun 完全一致
     * @param forward true=审核(插入流水) / false=弃审(红冲)
     * @return 影响行数
     */
    public int postFlow(String panelCode, String no, List<Map<String, Object>> rows, boolean forward, String user) {
        int inS = inSrc(panelCode), outS = outSrc(panelCode);
        if (inS < 0 && outS < 0) return 0;
        if (rows == null || rows.isEmpty()) return 0;
        boolean inbound = inS > 0;
        int src = inbound ? inS : outS;
        String tbl = inbound ? "inh" : "outh";
        int n = 0;
        for (Map<String, Object> r : rows) {
            Object rid = r.get("rid");
            if (rid == null) continue;                       // 没有来源行 id 就不记流水(唯一键的一半,无法幂等)
            if (str(r.get("仓库编码")) == null) continue;      // 仓库没解析出来 = 该行没动过 kucun(见 apply 的跳过分支)
            double qty = num(r.get("qty"));
            if (qty == 0) continue;                          // 零行不过账,也不记流水
            // 幂等:先查 (src, rid) 是否已记过(唯一索引兜底),再决定 插 / 复活 / 红冲
            List<String> cancelFlag = jdbc.queryForList(
                    "SELECT ISNULL(asp_cancel, 'N') FROM " + tbl + " WHERE src = ? AND rid = ?", String.class, src, rid);
            if (!cancelFlag.isEmpty()) {
                boolean cancelled = "Y".equalsIgnoreCase(cancelFlag.get(0));
                if (forward && cancelled) {
                    n += revive(tbl, inbound, r, no, user, src, rid);
                } else if (!forward && !cancelled) {
                    // 弃审:软删(asp_cancel='Y')保留痕迹;不物理删除
                    n += jdbc.update("UPDATE " + tbl + " SET asp_cancel = 'Y', asp_user4 = ?, asp_time4 = GETDATE()"
                            + " WHERE src = ? AND rid = ? AND ISNULL(asp_cancel,'N') <> 'Y'", user, src, rid);
                }
                continue;                                    // 已记过(未弃审的重复审核)/ 已冲过:不重复写
            }
            if (!forward) continue;                          // 没记过流水,弃审时无流水可冲
            n += insert(tbl, inbound, r, no, user, src, rid);
        }
        if (n > 0) log.info("[库存流水] {} {} {} {} 行(src={})", panelCode, no, forward ? "写入" : "红冲", n, src);
        return n;
    }

    /** 插入一条流水(inh/outh 列名不同,列清单由 {@link #flowCols} 统一给)。 */
    private int insert(String tbl, boolean inbound, Map<String, Object> r, String no, String user, int src, Object rid) {
        Map<String, Object> cols = flowCols(inbound, r, no);
        StringBuilder cn = new StringBuilder("src, rid"), qm = new StringBuilder("?, ?");
        List<Object> args = new ArrayList<>(List.of(src, rid));
        for (Map.Entry<String, Object> e : cols.entrySet()) {
            cn.append(", ").append(e.getKey());
            qm.append(", ?");
            args.add(e.getValue());
        }
        cn.append(", asp_user1, asp_time1, asp_cancel");
        qm.append(", ?, GETDATE(), 'N'");
        args.add(user);
        return jdbc.update("INSERT INTO " + tbl + " (" + cn + ") VALUES (" + qm + ")", args.toArray());
    }

    /** 弃审后重新审核:复活那条流水并刷新单据侧字段(弃审到重审之间单据可能被改过)。 */
    private int revive(String tbl, boolean inbound, Map<String, Object> r, String no, String user, int src, Object rid) {
        StringBuilder set = new StringBuilder(
                "asp_cancel = 'N', asp_user4 = NULL, asp_time4 = NULL, asp_user1 = ?, asp_time1 = GETDATE()");
        List<Object> args = new ArrayList<>(List.of(user));
        for (Map.Entry<String, Object> e : flowCols(inbound, r, no).entrySet()) {
            set.append(", ").append(e.getKey()).append(" = ?");
            args.add(e.getValue());
        }
        args.add(src);
        args.add(rid);
        return jdbc.update("UPDATE " + tbl + " SET " + set + " WHERE src = ? AND rid = ?", args.toArray());
    }

    /**
     * 一条流水的「列 → 值」。inh 与 outh 列名不同:inh 落 单价 + 金额,outh 落 单据金额
     * (outh 的成本单价/成本金额由 InvCostService 回填,不在这里写)。
     * INSERT 与「复活 UPDATE」共用这份清单,避免两份字段映射日后各改一半。
     * 金额/单价为空表示"单据上没填",原样落 NULL(与 v_stock_movement 的口径一致)。
     */
    private static Map<String, Object> flowCols(boolean inbound, Map<String, Object> r, String no) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("单据类型", str(r.get("单据类型")));
        m.put("单据日期", r.get("单据日期"));
        m.put("物料编码", str(r.get("code")));
        m.put("物料名称", str(r.get("name")));
        m.put("规格型号", str(r.get("spec")));
        m.put("计量单位", str(r.get("uom")));
        m.put("仓库编码", str(r.get("仓库编码")));
        m.put("仓库名称", str(r.get("仓库名称")));
        m.put("批号", str(r.get("lot")));
        m.put("数量", num(r.get("qty")));
        m.put("往来单位", str(r.get("往来单位")));
        m.put("经手人", str(r.get("经手人")));
        if (inbound) {
            m.put("单价", r.get("price"));
            m.put("金额", r.get("金额"));
        } else {
            m.put("单据金额", r.get("金额"));
        }
        // 含税金额/税额(2026-10-03 任务 7):inh 与 outh 都加了这两列(见 migrate-stock-flow-tax-cols-2026-09-30.sql)。
        // 两表同名同义 ⇒ 不放进上面的 if/else。口径由 loadRows 给:只有 采购入库/销售出库 两段取键,
        // 其余 6 段与期初没有这两个键 ⇒ r.get 返回 null ⇒ 原样落 NULL(与 v_stock_movement 同口径)。
        m.put("含税金额", r.get("含税金额"));
        m.put("税额", r.get("税额"));
        return m;
    }

    /** 与 StockLedgerService.str 同口径(去空白、空串→null):流水与结存的键必须逐字一致。 */
    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }
}
