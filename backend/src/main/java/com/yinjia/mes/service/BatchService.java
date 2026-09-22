package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 采购订单分批送料:批次台账 / 送料量统计 / **采购入库单审核时确认批次号并回填**(P0,2026-09-20;
 * 取号时机迁移 2026-09-21;格式与唯一性**二次变更** 2026-09-21 —— 见 tools/migrate-batch-no-date-only.sql)。
 *
 * 口径(用户定稿,**以二次变更为准**):
 * - 批次号 = **纯入库日期 yyyyMMdd**(如 20260921),**不带序号**;
 * - 日期取**采购入库单的「单据日期」**(不是送料当天,也不是审核当天);
 * - 「同一日期算同一批次」:同一天多批**共号**(允许重复)—— 旧的筛选唯一索引
 *   UX_yj_doc_batch_no_active(唯一键 = 采购订单号 + 批次号)已由迁移删除,改非唯一索引;
 * - **预设 + 人工修改**:入库单填单/生单时预设(前端 docDefaults 取「单据日期」),用户可改;
 *   审核时**以入库单表头「批次号」为准**,为空才按「单据日期」补;
 * - 回填时机 = **采购入库单审核**;审核之前暂收/检验单的批次号留空(入库单自身带预设值);
 * - 一单一单(暂收 = 检验 = 入库),批次号挂**单头**(行上另冗余一份,保持现状);
 * - 历史批次号(YJ-…. / 10 位旧号)原样保留,只对新单生效。
 *
 * 台账生命周期:
 *   createPending(分批送料时插一行 **PENDING、batch_no=NULL** 的台账,返回行 id 作「批次键」)
 *     → bind(生成成功:绑定目标单与本次送料量;失败由外层事务整体回滚)
 *     → assignNoAndBackfill(采购入库单审核:确认批次号 → 回填台账/链路/三单头行)。
 * 「批次键」= yj_doc_batch.id,写进 sl_recv/qc_insp/bd_purchase_in 的 [批次键] 列与
 * form_flow_link.batch_id:审核时**顺着键**回填,不按单号字符串匹配(单号复用/改号不会回填错单)。
 */
@Service
public class BatchService {

    /** 系统参数键:收料超送比例 */
    public static final String KEY_OVER_RATIO = "receive_over_ratio";

    /**
     * 作废/弃审是否回收批次号:**否**(2026-09-21 用户口径)。
     * 旧口径序号可回收(释放后序号回到可用池),新口径**不回收** —— 因此会跳号,但绝不重号。
     * 保留开关(而非直接删旧 SQL)是为了口径需要回退时一处可切。
     */
    public static final boolean RECYCLE_ON_RELEASE = false;

    /** 批次号列名(链路三单同名同列) */
    private static final String BATCH_COL = "批次号";

    /** 批次键列名(链路三单同名同列;form_flow_link 用 batch_id) */
    private static final String KEY_COL = "批次键";

    /** 批次键所在的三张单(面板码 → 单头表;行表与分组列由 PanelRegistry 提供) */
    private static final String[] KEY_PANELS = {"QC_RECV", "QC_INSP", "PURCHASE_IN"};

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    /** 超送比例缓存(30 秒,与 PanelRegistry TTL 同量级,避免每次生单查库) */
    private volatile double ratioCache = 0d;
    private volatile long ratioAt = 0L;

    public BatchService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    // ==================== 参数 ====================

    /** 收料超送比例(0~1;参数缺失或非法按 0 处理) */
    public double overRatio() {
        long now = System.currentTimeMillis();
        if (now - ratioAt < 30_000) return ratioCache;
        double v = 0d;
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT setting_value FROM yj_app_setting WHERE setting_key = ?", String.class, KEY_OVER_RATIO);
            if (!rows.isEmpty() && rows.get(0) != null) v = Double.parseDouble(rows.get(0).trim());
        } catch (Exception ignore) { /* 表未建等场景按 0 */ }
        if (v < 0 || v > 5) v = 0; // 兜底:负数/离谱值视为不允许超送
        ratioCache = v;
        ratioAt = now;
        return v;
    }

    // ==================== 分批送料:登记待编号台账 ====================

    /**
     * 分批送料生成下游单时登记一行**未编号**台账(status='PENDING'、batch_no=NULL),
     * 返回该行 id 作为「批次键」写入目标单头。
     * create_time = 送料当天 —— 取号时日期部分取它(不是审核当天,用户口径②)。
     * 生成失败不需要"回收":本方法随调用方事务回滚(@Transactional 由 generateBatch 承担)。
     */
    @Transactional
    public int createPending(String srcPanel, String srcNo, String targetPanel, String user) {
        String sql = "INSERT INTO yj_doc_batch (source_panel_code, source_form_no, batch_seq, batch_no, batch_qty,"
                + " status, target_panel_code, create_by, create_time, remark)"
                + " VALUES (?,?,0,NULL,0,'PENDING',?,?,SYSDATETIME(),N'分批送料待编号')";
        org.springframework.jdbc.support.GeneratedKeyHolder kh = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            java.sql.PreparedStatement ps = con.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, srcPanel);
            ps.setString(2, srcNo);
            ps.setString(3, targetPanel);
            ps.setString(4, user);
            return ps;
        }, kh);
        for (Map<String, Object> keys : kh.getKeyList()) {
            for (Object v : keys.values()) if (v instanceof Number n) return n.intValue();
        }
        throw new IllegalStateException("批次台账登记失败(未取得行 id):" + srcPanel + " " + srcNo);
    }

    /** 生成成功:绑定目标单据与本次送料数量合计(只更新本次 PENDING 行,历史行不动) */
    public void bind(int batchId, String targetPanel, String targetFormNo, double qty) {
        jdbc.update("UPDATE yj_doc_batch SET target_panel_code=?, target_form_no=?, batch_qty=? WHERE id=? AND status='PENDING'",
                targetPanel, targetFormNo, qty, batchId);
    }

    // ==================== 采购入库单审核:确认批次号并回填全链 ====================

    /**
     * 采购入库单审核时**确认批次号并回填全链**(2026-09-21 二次口径,取代原先的"算序号取号")。
     *
     * 取值优先级:
     *   ① 入库单表头「批次号」—— 填单/生单时的预设值,或用户**人工修改**的值(最高优先);
     *   ② 台账已有的批次号 —— 弃审后重新审核沿用,幂等不换号;
     *   ③ 入库单「单据日期」的 yyyyMMdd —— 表头与台账都空时兜底;
     *   ④ 系统当天 —— 连单据日期都没有(历史脏数据)时的最后兜底。
     * **不再计算序号**:「同一日期算同一批次」,同一天多批共号,唯一性已由迁移取消。
     *
     * @param batchId 批次键(台账行 id)
     * @param user    操作人(写入台账 remark 留痕)
     * @return 最终批次号
     */
    @Transactional
    public String assignNoAndBackfill(int batchId, String user) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT source_form_no AS srcNo, batch_no AS batchNo FROM yj_doc_batch WHERE id = ?", batchId);
        if (rows.isEmpty()) throw new IllegalStateException("批次台账行不存在:" + batchId);
        Map<String, Object> row = rows.get(0);
        String ledgerNo = row.get("batchNo") == null ? "" : String.valueOf(row.get("batchNo")).trim();
        String srcNo = row.get("srcNo") == null ? "" : String.valueOf(row.get("srcNo"));

        // ① 入库单表头(带该批次键的那张):预设值/人工修改值优先;顺带取「单据日期」作兜底
        String headNo = "";
        String docDate = "";
        try {
            List<Map<String, Object>> pi = jdbc.queryForList(
                    "SELECT ISNULL([" + BATCH_COL + "], N'') AS b,"
                            + " CONVERT(varchar(10), [单据日期], 120) AS d"
                            + " FROM bd_purchase_in WHERE [" + KEY_COL + "] = ?", batchId);
            if (!pi.isEmpty()) {
                headNo = str(pi.get(0).get("b"));
                docDate = str(pi.get(0).get("d"));
            }
        } catch (Exception ignore) { /* 列/表缺失:退回台账与当天 */ }

        String no = headNo;
        String from = "入库单表头";
        if (no.isEmpty()) { no = ledgerNo; from = "台账沿用"; }
        if (no.isEmpty()) { no = ymd8(docDate); from = "入库单单据日期"; }
        if (no.isEmpty()) { no = ymd8(java.time.LocalDate.now().toString()); from = "系统当天"; }

        // ② 台账:确认批次号 + PENDING → ACTIVE。batch_seq 退化为**内部计数**(同订单同号第几批,
        //    不再拼进号里):同一天共号时它只是"当天第几批"的痕迹,便于排查。
        Integer seq = jdbc.queryForObject(
                "SELECT ISNULL(MAX(batch_seq), 0) + 1 FROM yj_doc_batch WITH (UPDLOCK, HOLDLOCK)"
                        + " WHERE source_form_no = ? AND batch_no = ?", Integer.class, srcNo, no);
        jdbc.update("UPDATE yj_doc_batch SET batch_no=?, batch_seq=?, status='ACTIVE', release_time=NULL,"
                        + " remark = N'分批送料 · 入库审核确认批次号(' + ISNULL(?, N'system') + N',取自' + ? + N')'"
                        + " WHERE id=?",
                no, seq == null ? 1 : seq, user, from, batchId);
        // ③ 表头为空(既没预设也没人工填)时,把确认下来的号写回入库单,保证单据自洽、转ERP有号可推
        if (headNo.isEmpty()) {
            jdbc.update("UPDATE bd_purchase_in SET [" + BATCH_COL + "] = ? WHERE [" + KEY_COL + "] = ?", no, batchId);
        }
        // ④ 链路台账:该批次 id 关联的所有跳(含 QC_INSP→QC_RETURN 等旁支)
        jdbc.update("UPDATE form_flow_link SET batch_no=? WHERE batch_id=?", no, batchId);
        // ⑤ 三单头 + 行(按「批次键」定位,不按单号字符串)
        for (String panel : KEY_PANELS) backfill(panel, batchId, no);
        // 留痕说明:未写 yj_doc_modify_log —— 该表是「申请修改/弃审留痕」闭环(snapshot_head/snapshot_rows
        // + apply_by/approve_by,create_at NOT NULL),塞一条确认批次号事件会污染「修改记录」界面语义;
        // 留痕落在 yj_doc_batch(create_by/create_time/remark/release_time)+ form_flow_link.batch_no。
        return no;
    }

    /** 'yyyy-MM-dd' / '2026/09/21' / '2026092101' → 'yyyyMMdd'(取前 8 位数字;不足 8 位返回空串) */
    private static String ymd8(String s) {
        String digits = str(s).replaceAll("\\D", "");
        return digits.length() >= 8 ? digits.substring(0, 8) : "";
    }

    /** 按「批次键」把批次号回填到某单的头与行(头列/行表/分组列都取自面板元数据) */
    private void backfill(String panelCode, int batchId, String batchNo) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        String head = def.headTable();
        String line = def.lineTable();
        String g = def.groupCol();
        // 行:按其所属单头(批次键命中)定位,写**批次号**列;头:按批次键命中写批次号
        jdbc.update("UPDATE " + line + " SET [" + BATCH_COL + "] = ? WHERE [" + g + "] IN"
                + " (SELECT [" + g + "] FROM " + head + " WHERE [" + KEY_COL + "] = ?)", batchNo, batchId);
        jdbc.update("UPDATE " + head + " SET [" + BATCH_COL + "] = ? WHERE [" + KEY_COL + "] = ?", batchNo, batchId);
    }

    /**
     * 按入库单号找「批次键」:① 入库单头自带的 [批次键];
     * ② 退回 form_flow_link(batch_id)→ 该入库单的链路键;
     * ③ 再退回「该入库单的来源单(检验单/暂收单)头上的批次键」。
     * 返回 0 = 未找到(该入库单不走分批送料,如历史单/免检直达且无链路)。
     */
    public int findPendingBatchId(String panelCode, String docNo) {
        if (!"PURCHASE_IN".equals(panelCode) || docNo == null || docNo.isBlank()) return 0;
        Integer id = jdbc.queryForObject("SELECT TOP 1 [" + KEY_COL + "] FROM bd_purchase_in WHERE 单据编号 = ?",
                Integer.class, docNo);
        if (id != null && id > 0) return id;
        id = jdbc.queryForObject("SELECT TOP 1 batch_id FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
                + " AND target_form_no=? AND batch_id IS NOT NULL ORDER BY id", Integer.class, docNo);
        if (id != null && id > 0) return id;
        // 来源单头上的批次键(检验单 QC_INSP / 送料暂收单 QC_RECV;采购订单免检直达时无此列,跳过)
        List<Map<String, Object>> srces = jdbc.queryForList(
                "SELECT DISTINCT source_panel_code AS pc, source_form_no AS no FROM form_flow_link"
                        + " WHERE target_panel_code='PURCHASE_IN' AND target_form_no=?", docNo);
        for (Map<String, Object> s : srces) {
            String pc = String.valueOf(s.get("pc"));
            String table = switch (pc) {
                case "QC_INSP" -> "qc_insp";
                case "QC_RECV" -> "sl_recv";
                default -> null;
            };
            if (table == null) continue;
            try {
                List<Map<String, Object>> r = jdbc.queryForList(
                        "SELECT TOP 1 [" + KEY_COL + "] AS k FROM " + table + " WHERE 单据编号 = ?", s.get("no"));
                if (!r.isEmpty() && r.get(0).get("k") instanceof Number n && n.intValue() > 0) return n.intValue();
            } catch (Exception ignore) { /* 列未加(未跑迁移)等场景不阻断审核 */ }
        }
        return 0;
    }

    // ==================== 释放(新口径:不回收) ====================

    /**
     * 下游单作废/删除时的台账释放。**新口径(2026-09-21):不回收** —— 批次号与台账 status 一律保留,
     * 因为批次号在采购入库单审核时已经确定,回收会让"已编号批次"重号(用户口径④:
     * 弃审/作废不回收批次号,因此会跳号,但绝不重号)。
     * 保留本方法(而非删掉调用点)是为了让"作废不回收"这一口径集中在一处可查、可回退(见 RECYCLE_ON_RELEASE)。
     */
    public void releaseByTarget(String targetPanel, String targetFormNo) {
        if (!RECYCLE_ON_RELEASE) return;
        try {
            jdbc.update("UPDATE yj_doc_batch SET status='RELEASED', release_time=SYSDATETIME()"
                    + " WHERE target_panel_code=? AND target_form_no=? AND status='ACTIVE'", targetPanel, targetFormNo);
        } catch (Exception ignore) { /* 表未建等场景不阻断删除 */ }
    }

    // ==================== 查询 ====================

    /** 某来源单的批次清单(默认只列有效批次:已编号 ACTIVE + 待编号 PENDING;含历史释放行见 includeReleased) */
    public List<Map<String, Object>> batches(String srcPanel, String srcNo) {
        return batches(srcPanel, srcNo, false);
    }

    /**
     * 批次清单:activeOnly=true 只列 ACTIVE/PENDING;false 连历史释放行一起列(反查/审计用)。
     * 每行的 targetPanel/targetFormNo = **链路终点单据**(由 resolveEndTarget 解析,见其注释);
     * 台账登记时的原始目标单另存在 firstTargetPanel/firstTargetFormNo,不丢信息。
     */
    public List<Map<String, Object>> batches(String srcPanel, String srcNo, boolean includeReleased) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            out = jdbc.queryForList("SELECT id AS batchId, batch_no AS batchNo, batch_seq AS batchSeq, batch_qty AS batchQty,"
                    + " status, target_panel_code AS targetPanel, target_form_no AS targetFormNo,"
                    + " CONVERT(varchar(19), create_time, 120) AS createTime"
                    + " FROM yj_doc_batch WHERE source_panel_code=? AND source_form_no=?"
                    + (includeReleased ? "" : " AND status IN ('ACTIVE','PENDING')")
                    + " ORDER BY batch_seq, id", srcPanel, srcNo);
        } catch (Exception ignore) { /* 表未建 */ }
        for (Map<String, Object> row : out) resolveEndTarget(row);
        return out;
    }

    // ==================== 台账去向单号 = 链路终点(2026-09-21) ====================

    /**
     * 链路前进站优先级(同一站数有多条 ACTIVE 下游时取前者):主链 采购入库 → 退货 → 检验 → 暂收。
     * 只影响「同一站数」的分支取舍,不改变"站数多者优先"的终点口径。
     */
    private static final List<String> CHAIN_PRIORITY = List.of("PURCHASE_IN", "QC_RETURN", "QC_INSP", "QC_RECV");

    /** 链路最大前进站数(正常 暂收→检验→入库 共 2 跳;限制站数防脏数据成环/超长链) */
    private static final int MAX_CHAIN_HOPS = 8;

    /**
     * 解析该台账行的**终点单据**(用户口径 2026-09-21:去向单号要随链路前进,不能停在生成时那张单):
     * - 起点 = 台账行登记的 target_panel_code/target_form_no(通常是送料暂收单,也可能是免检直达的采购入库单);
     * - 沿 form_flow_link(**link_status='ACTIVE'**)广搜前进:QC_RECV → QC_INSP → PURCHASE_IN / QC_RETURN
     *   (优先同批次 batch_id 的链路;该批次无链路时放宽为按单号匹配,兼容未写 batch_id 的历史链路);
     * - **终止条件**:没有 ACTIVE 下游了(或已到 MAX_CHAIN_HOPS/已成环)—— 取**站数最多**的那一站;
     * - **作废回退**:yj_doc_status.canceled='Y' / deleting='Y',或单据表 asp_cancel='Y',或单头表里
     *   根本没有这张单(不存在)的单据**不能当终点**,在可达链上取「站数最多的有效单据」
     *   (例:入库单已作废 → 终点回到检验单;退料单已作废 → 终点回到检验单);
     * - **整链皆无效**(含起点在内全部作废/已删除/不存在):**不把作废单号当去向** ——
     *   targetPanel/targetFormNo 置空 + 新增 `targetInvalid=true`(前端「查看」禁用、去向列显示「已作废」),
     *   起点仍在 firstTarget* 里保留供排查。
     *   2026-09-21 修复:此前"整链皆作废时兜底回起点"会把**已作废的暂收单**当去向单号,
     *   而列表面板按单据状态过滤(QueryService 排除 yj_doc_status.canceled='Y'),`?docNo=` 定位不到 → 面板空白;
     * - 结果写回 targetPanel/targetFormNo(前端「查看」据此跳转),起点另存 firstTarget* 并附 targetHops(跳数)。
     *
     * 只在展示/反查路径(batches)调用,**不参与**按量占用、剩余量、linksOfBatch、/batchFlow/generate。
     */
    private void resolveEndTarget(Map<String, Object> row) {
        String startPanel = str(row.get("targetPanel"));
        String startNo = str(row.get("targetFormNo"));
        row.put("firstTargetPanel", startPanel);
        row.put("firstTargetFormNo", startNo);
        row.put("targetInvalid", false);
        if (startPanel.isEmpty() || startNo.isEmpty()) return;   // 未绑定目标单:保持原值
        int batchId = row.get("batchId") instanceof Number n ? n.intValue() : 0;

        // ① 广搜:站点键 "panel|no" → 单号对;站数 0 = 起点
        Map<String, String[]> docs = new LinkedHashMap<>();
        Map<String, Integer> depth = new HashMap<>();
        ArrayDeque<String[]> queue = new ArrayDeque<>();
        String startKey = startPanel + "|" + startNo;
        docs.put(startKey, new String[]{startPanel, startNo});
        depth.put(startKey, 0);
        queue.add(new String[]{startPanel, startNo});
        while (!queue.isEmpty()) {
            String[] cur = queue.poll();
            int d = depth.getOrDefault(cur[0] + "|" + cur[1], 0);
            if (d >= MAX_CHAIN_HOPS) continue;
            for (String[] nxt : downstream(cur[0], cur[1], batchId)) {
                String k = nxt[0] + "|" + nxt[1];
                if (docs.containsKey(k)) continue;               // 已成环/重复站:不再入队
                docs.put(k, nxt);
                depth.put(k, d + 1);
                queue.add(nxt);
            }
        }

        // ② 终点 = 可达链上「站数最多的有效单据」(同站数按 CHAIN_PRIORITY,插入序即优先级序)
        String[] end = null;
        int endDepth = -1;
        for (Map.Entry<String, String[]> e : docs.entrySet()) {
            String[] doc = e.getValue();
            if (!docAlive(doc[0], doc[1])) continue;
            int d = depth.getOrDefault(e.getKey(), 0);
            if (d > endDepth) { endDepth = d; end = doc; }
        }
        if (end == null) {
            // ③ 整条可达链(含起点)全部作废/已删除/不存在 —— 不给作废单号:
            //    置空 + targetInvalid=true,行照旧出现在浮层里,前端据此禁用「查看」并显示「已作废」
            row.put("targetPanel", "");
            row.put("targetFormNo", "");
            row.put("targetHops", -1);
            row.put("targetInvalid", true);
            return;
        }
        row.put("targetPanel", end[0]);
        row.put("targetFormNo", end[1]);
        row.put("targetHops", endDepth);
    }

    /**
     * 下一站:该单的 ACTIVE 下游(排除已访问站点),按 CHAIN_PRIORITY 排序。
     * 优先取**同批次**(batch_id=该台账行 id)的链路;该批次一条都没有时放宽为不限批次。
     */
    private List<String[]> downstream(String panel, String no, int batchId) {
        List<Map<String, Object>> rows = linkTargets(panel, no, batchId);
        if (rows.isEmpty() && batchId > 0) rows = linkTargets(panel, no, 0);
        List<String[]> out = new ArrayList<>();
        for (String p : CHAIN_PRIORITY) {
            for (Map<String, Object> r : rows) {
                String tp = str(r.get("panel"));
                String tn = str(r.get("no"));
                if (tp.equals(p) && !tn.isEmpty() && !outContains(out, tp, tn)) out.add(new String[]{tp, tn});
            }
        }
        for (Map<String, Object> r : rows) {                      // 优先级表外的面板(兜底,保持可前进)
            String tp = str(r.get("panel"));
            String tn = str(r.get("no"));
            if (!tp.isEmpty() && !tn.isEmpty() && !outContains(out, tp, tn)) out.add(new String[]{tp, tn});
        }
        return out;
    }

    private static boolean outContains(List<String[]> list, String panel, String no) {
        for (String[] a : list) if (a[0].equals(panel) && a[1].equals(no)) return true;
        return false;
    }

    /** 某单的 ACTIVE 下游单号(batchId>0 时只取该批次的链路) */
    private List<Map<String, Object>> linkTargets(String panel, String no, int batchId) {
        String sql = "SELECT DISTINCT target_panel_code AS panel, target_form_no AS no FROM form_flow_link"
                + " WHERE source_panel_code=? AND source_form_no=? AND link_status='ACTIVE'"
                + " AND target_panel_code IS NOT NULL AND target_form_no IS NOT NULL"
                + " AND LTRIM(RTRIM(target_form_no))<>''"
                + (batchId > 0 ? " AND batch_id=?" : "");
        try {
            return batchId > 0 ? jdbc.queryForList(sql, panel, no, batchId) : jdbc.queryForList(sql, panel, no);
        } catch (Exception ignore) { /* 表未建 */ return new ArrayList<>(); }
    }

    /** 单据有效性三态:有效=可当终点;已作废/已删除=软删或表内删除标记;不存在=单头表里查不到这张单 */
    private static final int DOC_VALID = 0;
    private static final int DOC_VOID = 1;
    private static final int DOC_MISSING = 2;

    /**
     * 单据是否**有效**(可当终点):yj_doc_status.canceled/deleting='Y' 或单据表 asp_cancel='Y'
     * 或单头表里没有这张单 → 无效。
     * 单头表/列缺失等**查询失败**的情况按「有效」处理(不阻断,保持加这道校验之前的行为)。
     */
    private boolean docAlive(String panel, String no) {
        return docState(panel, no) == DOC_VALID;
    }

    private int docState(String panel, String no) {
        try {
            List<Map<String, Object>> st = jdbc.queryForList(
                    "SELECT ISNULL(canceled,'N') AS c, ISNULL(deleting,'N') AS d"
                            + " FROM yj_doc_status WHERE panel_code=? AND doc_no=?", panel, no);
            for (Map<String, Object> r : st) {
                if ("Y".equalsIgnoreCase(str(r.get("c"))) || "Y".equalsIgnoreCase(str(r.get("d")))) return DOC_VOID;
            }
        } catch (Exception ignore) { /* 表未建 */ }
        String table = headTable(panel);
        if (table != null) {
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT TOP 1 ISNULL(asp_cancel,'N') AS a FROM " + table + " WHERE 单据编号=?", no);
                if (rows.isEmpty()) return DOC_MISSING;      // 单头表里没有这张单 = 不存在(如链路指向已物理删除的单号)
                if ("Y".equalsIgnoreCase(str(rows.get(0).get("a")))) return DOC_VOID;
            } catch (Exception ignore) { /* 列/表缺失:不阻断(视为有效,保持旧口径) */ }
        }
        return DOC_VALID;
    }

    /** 面板单头表(取自面板元数据;面板不存在/未配单头表 → null,则跳过期表内作废标记) */
    private String headTable(String panelCode) {
        try {
            String t = registry.panel(panelCode).headTable();
            return t == null || t.isBlank() ? null : t;
        } catch (Exception ignore) { return null; }
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    /** 反查:某批次号的台账行(历史格式号与同号留痕取最近一次使用) */
    public Map<String, Object> batchOf(String batchNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 source_panel_code AS sourcePanel, source_form_no AS sourceFormNo, batch_seq AS batchSeq,"
                        + " batch_qty AS batchQty, status, target_panel_code AS targetPanel, target_form_no AS targetFormNo"
                        + " FROM yj_doc_batch WHERE batch_no=? ORDER BY id DESC", batchNo);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ==================== 行级数量统计 ====================

    /** 该来源单各来源行的**已送量**:form_flow_link.source_line_key → Σlinked_quantity(仅 ACTIVE) */
    public Map<String, Double> sentByLineKey(String srcPanel, String srcNo) {
        Map<String, Double> out = new LinkedHashMap<>();
        try {
            jdbc.query("SELECT source_line_key, SUM(COALESCE(linked_quantity,0)) FROM form_flow_link"
                            + " WHERE source_panel_code=? AND source_form_no=? AND link_status='ACTIVE'"
                            + " GROUP BY source_line_key",
                    rs -> { out.put(rs.getString(1), rs.getDouble(2)); }, srcPanel, srcNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }

    /**
     * 退货回冲:采购订单行号 → 退货数量合计。
     * 只认**已审核且未作废**的暂收退回单(QC_RETURN):草稿退回还没定论,不应提前把额度放回去。
     * 兜底:退货行没写「采购订单行号」时按订单行号为空分组(不参与任何行,避免错回冲)。
     */
    public Map<String, Double> returnedByOrderLine(String srcNo) {
        Map<String, Double> out = new LinkedHashMap<>();
        try {
            jdbc.query("SELECT LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))) ln,"
                            + " SUM(COALESCE(TRY_CAST(d.退货数量 AS decimal(18,4)),0))"
                            + " FROM qc_return_detail d JOIN qc_return r ON r.单据编号 = d.单据编号"
                            + " WHERE r.采购订单号 = ? AND ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(d.asp_cancel,'N')<>'Y'"
                            + "   AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_RETURN'"
                            + "               AND s.doc_no = r.单据编号 AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y')"
                            + " GROUP BY LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50))))",
                    rs -> {
                        String k = rs.getString(1);
                        if (k != null && !k.isBlank()) out.put(k, rs.getDouble(2));
                    }, srcNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }

    /** 该批次号涉及的下游单据(form_flow_link,含已释放) —— 按批次反查用 */
    public List<Map<String, Object>> linksOfBatch(String batchNo) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            out = jdbc.queryForList("SELECT DISTINCT source_panel_code AS sourcePanel, source_form_no AS sourceFormNo,"
                    + " target_panel_code AS targetPanel, target_form_no AS targetFormNo, link_status AS linkStatus"
                    + " FROM form_flow_link WHERE batch_no=?", batchNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }
}
