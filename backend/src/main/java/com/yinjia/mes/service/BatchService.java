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
 * 采购订单分批送料:批次台账 / 送料量统计 / **批次号取号与自洽**(P0,2026-09-20)。
 *
 * 口径(2026-10-04 用户定稿,**取代此前"入库审核取号 + 回填全链"**):
 * - 批次号 = **供应商编码去掉 `YJ-` 前缀 + `-` + 生单当天 yyyyMMdd**
 *   (如 供应商 `YJ-TX`、生单日 2026-09-10 ⇒ `TX-20260910`);不带序号,同一天同供应商共号;
 * - **取号时机 = 生单那一刻**(采购订单 → 送料暂收单,见 PushGenerateHandler.generateBatch):
 *   跳过整条「暂收 → 检验 → 入库/退回」链,各站单据带的是同一个号(下游继承,不重新取号);
 * - **不再有回填机制**:批次号在链路头一跳就写进单头 + 全部明细行,下游照搬,
 *   因此没有"入库审核时逆流回填上游"这一说(旧 assignNoAndBackfill 已删除);
 * - **可编辑窗口**:只有送料暂收单草稿态的**单头**批次号可人工改(元数据 editable=1);
 *   「送料暂收单审核」之后整链一律只读(下游四单的批次号元数据 editable=0,
 *   整单编辑闸门另按单据状态把非草稿单锁死,见 PanelxList.draftEditable / ButtonService.saveDoc);
 * - **头行一致**:任何一次保存/审核都调 {@link #syncBatchNo} 把单头值同步到全部明细行,
 *   并把台账补齐 —— 界面改单头就够了,行上的号永远跟着走;
 * - 历史批次号(YJ-…. / 20260921 / 10 位旧号)原样保留,只对新单生效。
 *
 * 台账生命周期:
 *   createBatch(链路头一跳生单时插一行 **ACTIVE 且已带批次号** 的台账,返回行 id 作「批次键」)
 *     → bind(生成成功:绑定目标单与本次送料量;失败由外层事务整体回滚)
 *   (旧的 PENDING/待编号中间态已取消:号在生单时就有,不存在"待编号"批次。)
 * 「批次键」= yj_doc_batch.id,写进 sl_recv/qc_insp/bd_purchase_in 的 [批次键] 列与
 * form_flow_link.batch_id —— 逐站继承同一个键,按批次反查/链路终点解析都用它,不靠单号字符串匹配。
 */
@Service
public class BatchService {

    /** 系统参数键:收料超送比例 */
    public static final String KEY_OVER_RATIO = "receive_over_ratio";

    /**
     * 作废/弃审是否回收批次号:**否**(2026-09-21 用户口径,2026-10-04 口径下依然成立)。
     * 批次号在**生单**那一刻就定了,回收会让"已编号批次"重号(用户口径:作废不回收,会跳号但绝不重号)。
     * 保留开关(而非直接删旧 SQL)是为了口径需要回退时一处可切。
     */
    public static final boolean RECYCLE_ON_RELEASE = false;

    /** 批次号列名(链路四单同名同列) */
    private static final String BATCH_COL = "批次号";
    /** 链路身份列:有它才算批次号链路成员(见 syncBatchNo 的取号判定与缺列守卫) */
    private static final String BATCH_KEY_COL = "批次键";

    /** 供应商编码字段候选(链路各单异名:暂收/检验/退回叫「供应商代码」,采购入库叫「供应商编码」) */
    private static final String[] SUPPLIER_CODE_LABELS = {"供应商编码", "供应商代码"};

    /** 供应商编码前缀:取号时剥掉它(用户口径「YJ-后面的数据」) */
    private static final String SUPPLIER_PREFIX = "YJ-";

    /** 超送比例上限(2026-09-22 用户口径:**最高 50%**)——弹窗覆盖与系统参数一律钳在 0~0.5 */
    public static final double MAX_OVER_RATIO = 0.5d;

    /**
     * 行的「可送上限」(2026-09-22 口径:**按全部数量算**)—— 订单数量×(1+超送比例) − 已送 + 已退回,负数归 0。
     * 旧口径 剩余×(1+比例) 的问题:每批只给"当批剩余"的比例额,分批越多超送额度越算越少,
     * 累计超送永远到不了订单总量的比例额;正确语义是"整张订单行**累计**最多收 数量×(1+比例)"。
     * 前端同公式:core/selection/batchSendLines.js 的 overAllowance(纯函数,有单测)。
     *
     * <p>2026-10-04 从 PushGenerateHandler 迁入本类:材料码预约(供应商自行打码)也要按同一口径算上限,
     * 而「送料批次口径」的家本来就在 BatchService —— 两处各写一份迟早对不上。
     */
    public static double overAllowance(double orderQty, double sent, double returned, double ratio) {
        double r = Math.max(0d, Math.min(MAX_OVER_RATIO, ratio));
        double v = orderQty * (1 + r) - sent + returned;
        return v > 0 ? v : 0d;
    }

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

    /**
     * 收料超送比例(0~1;参数缺失按 0 处理)。
     * 2026-09-22 用户口径:**最高 50%** —— 库里存得再大也钳到 0.5(旧口径 v>5 视为非法归 0,
     * 现改为夹紧,避免有人存 0.6/1.0 时口径漂移);负数仍按 0。
     */
    public double overRatio() {
        long now = System.currentTimeMillis();
        if (now - ratioAt < 30_000) return ratioCache;
        double v = 0d;
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT setting_value FROM yj_app_setting WHERE setting_key = ?", String.class, KEY_OVER_RATIO);
            if (!rows.isEmpty() && rows.get(0) != null) v = Double.parseDouble(rows.get(0).trim());
        } catch (Exception ignore) { /* 表未建等场景按 0 */ }
        if (v < 0) v = 0;
        if (v > 0.5d) v = 0.5d;   // 超送比例上限 50%(2026-09-22 用户口径)
        ratioCache = v;
        ratioAt = now;
        return v;
    }

    /**
     * 保存收料超送比例(0~0.5;**改完立即生效**)。
     *
     * 用户口径(2026-10-04):「超送应该更改后会自动保存」—— 生单对话框里改的比例要**落库**,
     * 下次打开(以及打印材料码的可打上限)都按这个新比例算,而不是每次都退回系统默认 5%。
     *
     * 落库位置就是 {@link #overRatio()} 的**同一个参数**(`yj_app_setting.receive_over_ratio`),
     * 存字符串小数(如 `0.08`);参数行不在时补插一行(带 remark,便于后来人知道这行是干什么的)。
     * 存完**立刻刷新缓存**:overRatio() 有 30 秒缓存,不刷的话刚改完还按旧值校验(用户体验像"没保存")。
     *
     * @param ratio 比例(0~1 的小数;超出 50% 夹到 0.5,负数归 0 —— 与 overRatio() 同一钳制口径)
     * @return 真正生效的比例
     */
    @Transactional
    public double saveOverRatio(double ratio, String user) {
        double v = ratio;
        if (Double.isNaN(v) || v < 0d) v = 0d;
        if (v > MAX_OVER_RATIO) v = MAX_OVER_RATIO;
        String val = v == Math.rint(v) ? String.valueOf((long) Math.rint(v)) : String.valueOf(v);
        int n = jdbc.update("UPDATE yj_app_setting SET setting_value = ?, asp_user1 = COALESCE(?, asp_user1),"
                + " asp_time2 = SYSDATETIME() WHERE setting_key = ?", val, user, KEY_OVER_RATIO);
        if (n == 0) {
            jdbc.update("INSERT INTO yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,SYSDATETIME())", KEY_OVER_RATIO, val,
                    "收料允许超送比例(0~1;0=不允许)。分批送料/材料码打印校验:本次量 ≤ 剩余量 ×(1+比例)。"
                            + "由生单对话框「超送比例」改动自动保存(2026-10-04)", user);
        }
        ratioCache = v;                          // 立刻生效(不吃 30s 缓存)
        ratioAt = System.currentTimeMillis();
        return v;
    }

    // ==================== 分批送料:登记已编号台账 ====================

    /**
     * 分批送料**头一跳**生单时登记一行台账(status='ACTIVE'、batch_no 已在生单时定稿),
     * 返回该行 id 作为「批次键」写入目标单头。
     * batch_seq = 该**来源单**名下第几批(**内部计数**,不拼进号里)。
     * ⚠ 必须按「来源单」整体取下一个序号,**不能**再按 batch_no 过滤:筛选唯一索引
     * `UX_yj_doc_batch_active` 的键是 (source_panel_code, source_form_no, batch_seq) WHERE status='ACTIVE' ——
     * 按 batch_no 过滤时新号查不到历史行 ⇒ seq 从 1 重来 ⇒ 与同订单已有的 ACTIVE 行撞唯一键
     * (实测报「不能在具有唯一索引 UX_yj_doc_batch_active 的对象中插入重复键的行」)。
     * 生成失败不需要"回收":本方法随调用方事务回滚(@Transactional 由 generateBatch 承担)。
     *
     * @param batchNo 生单时按「供应商编码 + 当天」取好的批次号(非空)
     */
    @Transactional
    public int createBatch(String srcPanel, String srcNo, String targetPanel, String batchNo, String user) {
        String no = str(batchNo);
        if (no.isEmpty()) throw new IllegalStateException("生单批次号为空:" + srcPanel + " " + srcNo);
        Integer seq = jdbc.queryForObject(
                "SELECT ISNULL(MAX(batch_seq), 0) + 1 FROM yj_doc_batch WITH (UPDLOCK, HOLDLOCK)"
                        + " WHERE source_panel_code = ? AND source_form_no = ?", Integer.class, srcPanel, srcNo);
        String sql = "INSERT INTO yj_doc_batch (source_panel_code, source_form_no, batch_seq, batch_no, batch_qty,"
                + " status, target_panel_code, create_by, create_time, remark)"
                + " VALUES (?,?,?,?,0,'ACTIVE',?,?,SYSDATETIME(),N'分批送料 · 生单取号')";
        org.springframework.jdbc.support.GeneratedKeyHolder kh = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            java.sql.PreparedStatement ps = con.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, srcPanel);
            ps.setString(2, srcNo);
            ps.setInt(3, seq == null ? 1 : seq);
            ps.setString(4, no);
            ps.setString(5, targetPanel);
            ps.setString(6, user);
            return ps;
        }, kh);
        for (Map<String, Object> keys : kh.getKeyList()) {
            for (Object v : keys.values()) if (v instanceof Number n) return n.intValue();
        }
        throw new IllegalStateException("批次台账登记失败(未取得行 id):" + srcPanel + " " + srcNo);
    }

    /** 生成成功:绑定目标单据与本次送料数量合计(只更新本次行,历史行不动) */
    public void bind(int batchId, String targetPanel, String targetFormNo, double qty) {
        jdbc.update("UPDATE yj_doc_batch SET target_panel_code=?, target_form_no=?, batch_qty=? WHERE id=?",
                targetPanel, targetFormNo, qty, batchId);
    }

    // ==================== 批次号取号 / 自洽(2026-10-04 口径) ====================

    /**
     * 取号:批次号 = **供应商编码去掉 {@value #SUPPLIER_PREFIX} 前缀 + `-` + 当天 yyyyMMdd**。
     * 例:供应商 `YJ-TX`、2026-09-10 ⇒ `TX-20260910`。
     *
     * 用户口径(2026-10-04):
     * - 编码**没有** `YJ-` 前缀时**整串照用**(不截断、不猜测),如 `KH005` ⇒ `KH005-20260910`;
     * - 编码为空(历史脏单/未选供应商)时退回**纯日期**(`20260910`)—— 永不空号、不阻断生单,
     *   异常在数据上看得见,人工可改(暂收单草稿态单头可编辑);
     * - 不带序号:同一天同一供应商的多批**共号**。
     *
     * @param supplierCode 供应商编码(可带 `YJ-` 前缀)
     * @param date         取号日期(生单当天)
     */
    public static String buildBatchNo(String supplierCode, java.time.LocalDate date) {
        String code = str(supplierCode);
        if (code.regionMatches(true, 0, SUPPLIER_PREFIX, 0, SUPPLIER_PREFIX.length())) code = code.substring(SUPPLIER_PREFIX.length());
        code = code.trim();
        String ymd = (date == null ? java.time.LocalDate.now() : date)
                .format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        return code.isEmpty() ? ymd : code + "-" + ymd;
    }

    /**
     * 该面板是否属「批次号链路」(= 表头注册了「批次号」字段,与 PanelConfigService.batchFlow /
     * PushGenerateHandler.isBatchTarget 同一判据;送料暂收单/来料检验单/暂收退回单/采购入库单四张)。
     */
    public boolean isBatchPanel(String panelCode) {
        if (panelCode == null || panelCode.isBlank()) return false;
        try {
            return registry.panel(panelCode).fieldsAt("header").stream()
                    .anyMatch(f -> BATCH_COL.equals(f.label()));
        } catch (Exception ignore) { /* 面板不存在等场景不阻断 */ return false; }
    }

    /**
     * 批次号自洽(保存/审核收尾,**取代旧的入库审核回填**):
     * <ol>
     *   <li><b>空则取号</b>:单头批次号为空(手工新建的链路单、口径上线前的老单)时,
     *       按该单「供应商编码/供应商代码 + 当天」取号写回 —— 与生单同一条公式;</li>
     *   <li><b>头行一致</b>:把单头批次号**覆盖写进全部明细行** —— 用户口径
     *       「一旦审批,包括下面的明细项目也需要做到批次号一致」。明细列元数据为只读
     *       (migrate-batch-no-on-generate.sql),行上的值只由这一处维护;</li>
     *   <li><b>台账补齐</b>:该单挂的批次键(yj_doc_batch.id)若还没号(口径上线前的 PENDING 行),
     *       补上同一个号并置 ACTIVE —— 老单顺链自愈,不必跑历史数据订正。</li>
     * </ol>
     * 非批次链路面板 / 无单头表 / 单头无「批次号」列的,直接返回,不做任何写入。
     *
     * @return 该单最终生效的批次号(未接管时返回空串)
     */
    @Transactional
    public String syncBatchNo(PanelRegistry.PanelDef def, String docNo, String user) {
        if (def == null || docNo == null || docNo.isBlank() || !def.hasHeadTable()) return "";
        if (!isBatchPanel(def.code())) return "";
        String head = def.headTable(), gc = def.groupCol();
        if (head == null || gc == null || colMissing(head, BATCH_COL)) return "";
        // 「批次键」= 链路身份列(form_flow_link / yj_doc_batch 都按它挂台账),**有它才算链路成员**。
        // ⚠ 只注册了「批次号」而没有它的面板必须整段跳过取号(2026-10-04 修):
        //   · QC_JJF 紧急放行申请单的「批次号」是业务值(来料批次),被自动盖成 '20261003' 是写坏数据;
        //   · QC_JJF / QC_RETURN 也没有该物理列 —— 本方法下面那句台账查询此前**未加 colMissing 守卫**,
        //     于是这两张单一保存就 500(列名 '批次键' 无效。实测:JJF-2026-10-0003 / TH-2026-10-0001)。
        //   本方法自述的契约是"缺列跳过、不抛错不阻断保存",这两处以它为准。
        boolean chainMember = !colMissing(head, BATCH_KEY_COL);
        String no = str(firstValue("SELECT TOP 1 [" + BATCH_COL + "] FROM " + head + " WHERE [" + gc + "] = ?", docNo));
        if (no.isEmpty() && chainMember) {
            no = buildBatchNo(supplierCodeOf(def, docNo), java.time.LocalDate.now());
            jdbc.update("UPDATE " + head + " SET [" + BATCH_COL + "] = ? WHERE [" + gc + "] = ?", no, docNo);
        }
        // ② 头行一致:明细行一律随单头
        String line = def.lineTable();
        if (line != null && !line.isBlank() && !colMissing(line, BATCH_COL) && !colMissing(line, gc)) {
            jdbc.update("UPDATE " + line + " SET [" + BATCH_COL + "] = ? WHERE [" + gc + "] = ?", no, docNo);
        }
        // ③ 台账补齐(顺批次键;只补没号的行,不动已有号)
        Integer key = chainMember
                ? intValue(firstValue("SELECT TOP 1 [" + BATCH_KEY_COL + "] FROM " + head + " WHERE [" + gc + "] = ?", docNo))
                : null;
        if (key != null && key > 0) {
            jdbc.update("UPDATE yj_doc_batch SET batch_no = ?, status = 'ACTIVE', release_time = NULL,"
                            + " remark = N'分批送料 · 批次号自洽(' + ISNULL(?, N'system') + N')'"
                            + " WHERE id = ? AND ISNULL(batch_no, N'') = N''",
                    no, user, key);
        }
        return no;
    }

    /** 该单的供应商编码(链路各单异名:先「供应商编码」后「供应商代码」;都没有 → 空串) */
    private String supplierCodeOf(PanelRegistry.PanelDef def, String docNo) {
        String head = def.headTable(), gc = def.groupCol();
        for (String label : SUPPLIER_CODE_LABELS) {
            PanelRegistry.FieldDef f = def.byLabel(label);
            String col = f == null ? label : f.col();
            if (colMissing(head, col)) continue;
            String v = str(firstValue("SELECT TOP 1 [" + col + "] FROM " + head + " WHERE [" + gc + "] = ?", docNo));
            if (!v.isEmpty()) return v;
        }
        return "";
    }

    /** 表/列存在性(缺失返回 true = 当"没有该列"处理,调用方跳过;不抛错不阻断保存) */
    private boolean colMissing(String table, String col) {
        if (table == null || table.isBlank() || col == null || col.isBlank()) return true;
        try {
            Integer n = jdbc.queryForObject("SELECT COL_LENGTH(?, ?)", Integer.class, "dbo." + table, col);
            return n == null || n == 0;
        } catch (Exception ignore) { return true; }
    }

    private Object firstValue(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0).values().iterator().next();
    }

    private static Integer intValue(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o == null || String.valueOf(o).isBlank()) return null;
        try { return Integer.valueOf(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    // ==================== 释放(口径:不回收) ====================

    /**
     * 下游单作废/删除时的台账释放。**口径:不回收** —— 批次号与台账 status 一律保留,
     * 因为批次号在**生单那一刻**就定了,回收会让"已编号批次"重号(用户口径:弃审/作废不回收批次号,
     * 因此会跳号,但绝不重号)。
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

    /** 某来源单的批次清单(默认只列有效批次:ACTIVE 已编号 + 历史 PENDING 待编号;含历史释放行见 includeReleased) */
    public List<Map<String, Object>> batches(String srcPanel, String srcNo) {
        return batches(srcPanel, srcNo, false);
    }

    /**
     * 批次清单:只列 ACTIVE/PENDING;includeReleased=true 连历史释放行一起列(反查/审计用)。
     * PENDING 是**口径上线前**的遗留态(那时号在入库审核才取),新单一律生单即 ACTIVE;
     * 这些历史行由 {@link #syncBatchNo} 在该单再次保存/审核时顺键补号并转 ACTIVE。
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
     * 链路前进站优先级(同一站数有多条 ACTIVE 下游时取前者):主链 采购入库 → 退货 → 特采单 → 检验 → 暂收。
     * 特采单(QC_TC_IN)排在入库/退回之后:它只是中转站(2026-10-04 起挂在暂收退料单 QC_RETURN 之下:
     * 退料单审批通过 →「特采」按钮 → 特采单),特采审批后生成的入库单站数更深,终点仍是采购入库单。
     * 只影响「同一站数」的分支取舍,不改变"站数多者优先"的终点口径。
     */
    private static final List<String> CHAIN_PRIORITY = List.of("PURCHASE_IN", "QC_RETURN", "QC_TC_IN", "QC_INSP", "QC_RECV");

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
