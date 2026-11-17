package com.yinjia.mes.service;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 采购入库单「一行明细分成多个仓库存放」(2026-11-17 用户口径)。
 *
 * <h3>用户原话</h3>
 * 「采购入库单在草稿状态下要可以实现一个明细划分多个仓库来存放」;
 * 追问两种做法时选了「直接把明细拆成多条行」,并补一句
 * 「但是来源采购订单行号和上游的行号不变」;数量口径:「各仓库合计 = 该行实收数量」。
 *
 * <h3>为什么是"拆成多条行"而不是"行内挂一张分配子表"</h3>
 * 台账({@link StockLedgerService})、库存流水(inh/outh)、库存状况视图、转ERP 推金蝶
 * 全部是**按行**取 {@code 仓库 + 数量} 的。拆成多行 ⇒ 这条链一个字都不用改,
 * 也不会出现"行上一个仓库、分配表里另几个仓库"两套口径(那种两套账正是本仓库反复踩的坑)。
 *
 * <h3>不变的东西(用户点名的那两条,也是全链路的前提)</h3>
 * <ul>
 *   <li><b>来源采购订单行号</b>(列 {@code 源单行号})与上游行号:拆出来的每一行**原样复制**,
 *       不重排、不清空 —— 采购订单行 ⇄ 入库行 的对账还按同一把钥匙;</li>
 *   <li><b>批次号 / 批号 / 批次键</b>:同一批货分仓存放,批号必须一致(库存按 物料+仓库+批号 分账);</li>
 *   <li><b>金额合计</b>:按数量占比分摊到各行,尾差落最后一行 ⇒ 各金额列合计与原行一字不差
 *       (含 费用调整/费用金额/送检数量);</li>
 *   <li><b>占用链 form_flow_link</b>:原行那条 ACTIVE 链的 linked_quantity 改成第一行数量,
 *       其余行**各复制一条**(source_line_key 不变、target_line_key 指向新行)—— 来源行总占用不变,
 *       但每一条入库行都能查回它的上游。</li>
 * </ul>
 *
 * <h3>实现要点:复制用 INSERT…SELECT + OUTPUT,不用逐列绑参</h3>
 * 行表近百列(还带 nvarchar/decimal/datetime2 混排),逐列 setObject 很容易踩
 * 「varbinary→datetime2 隐式转换」这类驱动层类型问题(2026-11-17 实测踩到:
 * setNull(Types.NULL) 在 SQL Server 上按二进制 NULL 下发,撞 datetime2 列直接报错)。
 * 故复制走 {@code INSERT INTO t (cols) OUTPUT INSERTED.id SELECT cols FROM t WHERE id=?},
 * 只有**要改的那十几列**才带类型绑定({@code update(sql, args, types)})。
 *
 * <h3>守卫(不符合就整笔拒绝,不留半张单)</h3>
 * <ul>
 *   <li>只有 <b>草稿</b> 且 <b>未转ERP</b> 的采购入库单可以拆(已审核/已推送再改会让账、票、ERP 三头对不上);</li>
 *   <li>至少两个仓库;每个仓库必须在 <b>bs_wh</b> 档案里(名称或编码都认),停用/作废不收;</li>
 *   <li>每个数量必须 &gt; 0;各仓库数量合计 <b>必须等于</b> 该行「实收数量」(差 0.0001 也拒绝);</li>
 *   <li>只拆指定 id 的那一行(按 id + 单据编号双条件取,行已删/不属于该单直接报错)。</li>
 * </ul>
 */
@Service
public class PurInSplitService {

    /** 本服务只服务这一张单(其它面板的拆分语义不同,不在这里开口子) */
    private static final String PANEL = "PURCHASE_IN";
    private static final String HEAD_TABLE = "bd_purchase_in";
    private static final String LINE_TABLE = "bl_purchase_in";
    /** 数量/金额列都是 decimal(18,4) */
    private static final int SCALE = 4;

    /** 行表除 id 外的列(表结构变更自动跟随,不硬编码近百列) */
    private volatile List<String> lineCols;
    /** 占用链除 id 外的列 */
    private volatile List<String> linkCols;

    /** 拆分时要改写的那一组列 + 它们的 JDBC 类型(顺序与 SQL 里一致) */
    private static final String LINE_OVERRIDE_SQL =
            "UPDATE " + LINE_TABLE + " SET [仓库] = ?, [仓库编码] = ?, [仓位编码] = ?, [仓位名称] = ?,"
                    + " [实收数量] = ?, [实收数量2] = ?, [金额] = ?, [含税金额] = ?, [费用金额] = ?,"
                    + " [费用调整] = ?, [送检数量] = ?, [现存量] = ?, [现存量说明] = ?,"
                    + " [源行id] = ?, [asp_user1] = ?, [asp_time1] = ? WHERE id = ?";
    private static final int[] LINE_OVERRIDE_TYPES = {
            Types.NVARCHAR, Types.NVARCHAR, Types.NVARCHAR, Types.NVARCHAR,
            Types.DECIMAL, Types.DECIMAL, Types.DECIMAL, Types.DECIMAL, Types.DECIMAL,
            Types.DECIMAL, Types.DECIMAL, Types.DECIMAL, Types.NVARCHAR,
            // 源行id:拆分组锚点(同组行都记原始行 id,父行 = 原行自己)—— 2026-11-17 用户口径「回退 + 缩进」
            Types.INTEGER,
            Types.NVARCHAR, Types.TIMESTAMP, Types.BIGINT,
    };

    private final JdbcTemplate jdbc;

    public PurInSplitService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 多行一起拆(工具栏「多仓库入库」弹窗一次提交多行)。
     *
     * <p>为什么不前端逐行调:一次提交若第 3 行失败,前两行已经落库 —— 用户看到"一半成功"
     * 却不知道为什么。这里用**一个事务**包住,任一行不合法整批回滚:要么全成,要么一行都不动。
     *
     * @param lines [{lineId, allocs:[{仓库, 仓位编码, 数量}]}]
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> splitMulti(String docNo, List<Map<String, Object>> lines, String user) {
        String no = docNo == null ? "" : docNo.trim();
        if (no.isEmpty()) throw new IllegalStateException("缺少单据编号");
        if (lines == null || lines.isEmpty()) throw new IllegalStateException("没有要拆分的明细行");
        requireDraftDoc(no);
        int rowCount = 0;
        List<Object> done = new ArrayList<>();
        for (Map<String, Object> l : lines) {
            long lineId = l.get("lineId") instanceof Number n ? n.longValue() : 0L;
            List<Map<String, Object>> allocs = new ArrayList<>();
            if (l.get("allocs") instanceof List<?> list) {
                for (Object o : list) {
                    if (o instanceof Map<?, ?> m) allocs.add(new LinkedHashMap<>((Map<String, Object>) m));
                }
            }
            // 只给了一个仓库:先合并(有子行时 = 回退),再把这一行的仓库/仓位设成它(不拆行)。
            // (2026-11-17 用户口径「上下都可以改…」之后又反馈「为什么确定不了」——只填一个仓库也是有效操作,
            //  语义等于"把这一行放到这个仓库",不该拦)
            if (allocs.isEmpty()) continue;
            if (allocs.size() == 1) {
                applySingle(no, lineId, allocs.get(0), user);
                rowCount += 1;
                Map<String, Object> one = new LinkedHashMap<>();
                one.put("docNo", no);
                one.put("lineId", lineId);
                one.put("rows", 1);
                one.put("merged", true);
                done.add(one);
                continue;
            }
            // self-invocation:同处一个事务(外层 @Transactional 已开启,inner 不再新建)
            Map<String, Object> one = split(no, lineId, allocs, user);
            rowCount += ((Number) one.get("rows")).intValue();
            done.add(one);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("docNo", docNo);
        out.put("lines", lines.size());
        out.put("rows", rowCount);
        out.put("detail", done);
        return out;
    }

    /**
     * 把一行拆成多行(每行一个仓库)。
     *
     * @param docNo  采购入库单号
     * @param lineId 要拆的明细行 id({@code bl_purchase_in.id})
     * @param allocs 分配清单:[{仓库(名称或编码), 仓位编码?, 数量}],至少 2 条
     * @param user   操作人(落 asp_user1 留痕)
     * @return {docNo, lineId, rows, lineIds, total}
     */
    @Transactional
    public Map<String, Object> split(String docNo, long lineId, List<Map<String, Object>> allocs, String user) {
        String no = docNo == null ? "" : docNo.trim();
        if (no.isEmpty()) throw new IllegalStateException("缺少单据编号");
        if (lineId <= 0) throw new IllegalStateException("缺少要拆分的明细行");

        // ① 单头守卫(草稿 / 未转ERP / 未作废 / 未在删除申请中)
        requireDraftDoc(no);

        // ③ 先把这一组"合回一行"(有子行时):再拆一次 = 合并 + 重新分配,
        //    这样"回退"(减到只剩一个仓库)和"改分配"都是同一条路 —— 幂等,不产生孤儿行。
        mergeChildren(no, lineId, user);

        // ③ 先把这一组"合回一行"(有子行时):再拆一次 = 合并 + 重新分配,
        //    这样"回退"(减到只剩一个仓库)和"改分配"都是同一条路 —— 幂等,不产生孤儿行。
        mergeChildren(no, lineId, user);

        // ④ 原始行(双条件:行必须属于这张单;已作废的不算)—— 合并后数量已是整组合计
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap("SELECT * FROM " + LINE_TABLE
                    + " WHERE id = ? AND 单据编号 = ? AND ISNULL(asp_cancel, 'N') <> 'Y'", lineId, no);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("明细行不存在或已作废(可能已被别人删掉),请刷新后重试");
        }
        // 拆分组锚点:已经拆过的沿用原锚点,没拆过的以本行 id 为锚点
        long groupId = row.get("源行id") instanceof Number g ? g.longValue() : lineId;

        // ⑤ 校验分配清单,并把仓库/仓位解析成档案里的编码与名称
        List<Map<String, Object>> parts = normalizeAllocs(allocs, row);
        BigDecimal totalQty = num(row.get("实收数量"));

        // ⑥ 金额族按数量占比分摊(尾差落最后一行,保证合计不变)
        Map<String, List<BigDecimal>> split = new LinkedHashMap<>();
        for (String col : new String[]{"金额", "含税金额", "费用金额", "费用调整", "送检数量"}) {
            split.put(col, allocate(row.get(col), parts, totalQty));
        }

        // ⑦ 落库:第一行就地改,其余行先「原样复制」再改要变的列
        List<Long> lineIds = new ArrayList<>();
        for (int i = 0; i < parts.size(); i++) {
            Map<String, Object> target = new LinkedHashMap<>(row);
            applyPart(target, row, parts.get(i), split, i, groupId);
            target.put("asp_user1", user);
            target.put("asp_time1", new java.sql.Timestamp(System.currentTimeMillis()));
            long targetId = i == 0 ? lineId : duplicateRow(lineId);
            updateOverrides(targetId, target);
            lineIds.add(targetId);
        }

        // ⑧ 占用链跟着拆:原链改数量,其余各复制一条(来源行号/来源件号原样)
        replicateLinks(no, lineId, lineIds, parts, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("docNo", no);
        out.put("lineId", lineId);
        out.put("rows", lineIds.size());
        out.put("lineIds", lineIds);
        out.put("total", totalQty);
        return out;
    }

    /**
     * 单头守卫:必须是**草稿**、**未转ERP**、**未作废**、**不在删除申请中**的单。
     *
     * <p>注意「作废」不在单头字段里:bd_purchase_in.单据状态 对已作废的单**仍写着草稿**,
     * 真正的状态在 yj_doc_status(2026-11-17 实测踩到:一张已作废的单照样能被拆)。
     */
    private void requireDraftDoc(String no) {
        Map<String, Object> head;
        try {
            head = jdbc.queryForMap("SELECT 单据状态, 是否已转ERP FROM " + HEAD_TABLE + " WHERE 单据编号 = ?", no);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("单据不存在:" + no);
        }
        String status = str(head.get("单据状态"));
        if (!"草稿".equals(status)) {
            throw new IllegalStateException("只有草稿状态的采购入库单可以拆分(当前:" + (status.isEmpty() ? "未知" : status)
                    + ");已审核的请先弃审");
        }
        if ("是".equals(str(head.get("是否已转ERP")))) {
            throw new IllegalStateException("该单据已转ERP,拆分会让 MES 与金蝶两侧不一致,不能拆;"
                    + "确需调整请先在金蝶侧处理,或作废后重开");
        }
        Map<String, Object> st = Map.of();
        try {
            st = jdbc.queryForMap("SELECT ISNULL(canceled, 'N') AS canceled, ISNULL(deleting, 'N') AS deleting"
                    + " FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?", PANEL, no);
        } catch (EmptyResultDataAccessException ignored) {
            // 没有状态行 = 从没审核/作废过,按草稿处理(与状态推导同口径)
        }
        if ("Y".equalsIgnoreCase(str(st.get("canceled")))) {
            throw new IllegalStateException("该单据已作废,不能拆分");
        }
        if ("Y".equalsIgnoreCase(str(st.get("deleting")))) {
            throw new IllegalStateException("该单据已提交删除申请,不能拆分");
        }
    }

    /**
     * 这张单每行的「拆分组锚点」({id, 源行id})。
     *
     * <p>为什么单独给一个小接口:拆分组标记 {@code 源行id} **不是面板字段**(不进 yj_field),
     * 通用取数只回注册过的标签列 ⇒ 弹窗拿不到它,就没法把"从同一行分出来的几行"缩进到一起。
     * 与其为一个内部标记去登记 yj_field(会牵动采购链四单字段基线),不如给一条 3 列的只读查询。
     */
    public List<Map<String, Object>> groups(String docNo) {
        String no = docNo == null ? "" : docNo.trim();
        if (no.isEmpty()) throw new IllegalStateException("缺少单据编号");
        return jdbc.queryForList("SELECT id, ISNULL([源行id], 0) AS [源行id] FROM " + LINE_TABLE
                + " WHERE [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y' ORDER BY id", no);
    }

    /**
     * 把一组子行合回父行 —— 「回退」与「重新分配」的第一步(2026-11-17 用户口径
     * 「这个操作是要可以回退的,而且从那一行分出来的,进去的时候缩进还在」)。
     *
     * <p>没有子行时 = 空操作(第一次拆那一行的正常路径)。
     * <ul>
     *   <li>数量/金额族求和写回父行(子行原来是按占比分摊出去的,合回来合计一分不差);</li>
     *   <li>子行**软删**(asp_cancel='Y' + asp_user2/time2 留痕),不做物理删 —— 出过纸/对过账的单还查得到;</li>
     *   <li>占用链:子行的 ACTIVE 链置 RELEASED,父行的链数量改成合计数(来源行总占用不变)。</li>
     * </ul>
     */
    private void mergeChildren(String docNo, long parentId, String user) {
        List<Map<String, Object>> children = jdbc.queryForList(
                "SELECT id, [实收数量], [金额], [含税金额], [费用金额], [费用调整], [送检数量] FROM " + LINE_TABLE
                        + " WHERE [单据编号] = ? AND [源行id] = ? AND id <> ? AND ISNULL(asp_cancel, 'N') <> 'Y'",
                docNo, parentId, parentId);
        if (children.isEmpty()) return;
        // ⚠ 父行自己的量/金额必须算进来:只加子行会把父行那份吞掉
        // (2026-11-17 实测踩到:6 + 4 合并后父行变成 4,数量凭空少了一半)
        Map<String, Object> parent;
        try {
            parent = jdbc.queryForMap("SELECT [实收数量], [金额], [含税金额], [费用金额], [费用调整], [送检数量]"
                    + " FROM " + LINE_TABLE + " WHERE id = ? AND [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'",
                    parentId, docNo);
        } catch (EmptyResultDataAccessException e) {
            return; // 父行没了(别人删了)就什么都不动
        }
        List<Map<String, Object>> all = new ArrayList<>();
        all.add(parent);
        all.addAll(children);
        BigDecimal qty = BigDecimal.ZERO;
        for (Map<String, Object> r : all) qty = qty.add(num(r.get("实收数量")));
        jdbc.update("UPDATE " + LINE_TABLE + " SET [实收数量] = ?, [金额] = ?, [含税金额] = ?, [费用金额] = ?,"
                        + " [费用调整] = ?, [送检数量] = ?, [现存量] = NULL, [现存量说明] = NULL,"
                        + " [asp_user1] = ?, [asp_time1] = ? WHERE id = ? AND [单据编号] = ?",
                new Object[]{
                        qty, sumOrNull(all, "金额"), sumOrNull(all, "含税金额"),
                        sumOrNull(all, "费用金额"), sumOrNull(all, "费用调整"),
                        sumOrNull(all, "送检数量"), user, new java.sql.Timestamp(System.currentTimeMillis()),
                        parentId, docNo,
                },
                new int[]{Types.DECIMAL, Types.DECIMAL, Types.DECIMAL, Types.DECIMAL, Types.DECIMAL,
                        Types.DECIMAL, Types.NVARCHAR, Types.TIMESTAMP, Types.BIGINT, Types.NVARCHAR});
        for (Map<String, Object> c : children) {
            long childId = ((Number) c.get("id")).longValue();
            jdbc.update("UPDATE " + LINE_TABLE + " SET [asp_cancel] = 'Y', [asp_user2] = ?, [asp_time2] = SYSDATETIME()"
                    + " WHERE id = ? AND [单据编号] = ?", user, childId, docNo);
            jdbc.update("UPDATE form_flow_link SET [link_status] = 'RELEASED', [release_time] = SYSDATETIME()"
                    + " WHERE target_panel_code = ? AND target_form_no = ? AND target_line_key = ?"
                    + " AND link_status = 'ACTIVE'", PANEL, docNo, docNo + "#" + childId);
        }
        // 父行的链恢复成整组数量(下面 split 的 replicateLinks 会再按新分配重写)
        jdbc.update("UPDATE form_flow_link SET [linked_quantity] = ? WHERE target_panel_code = ?"
                        + " AND target_form_no = ? AND target_line_key = ? AND link_status = 'ACTIVE'",
                new Object[]{qty, PANEL, docNo, docNo + "#" + parentId},
                new int[]{Types.DECIMAL, Types.NVARCHAR, Types.NVARCHAR, Types.NVARCHAR});
    }

    /** 一组行里某一列的合计;全为 NULL 时返回 NULL(不把"没有成本"变成 0) */
    private static BigDecimal sumOrNull(List<Map<String, Object>> rows, String col) {
        BigDecimal sum = null;
        for (Map<String, Object> r : rows) {
            Object v = r.get(col);
            if (v == null) continue;
            sum = (sum == null ? BigDecimal.ZERO : sum).add(num(v));
        }
        return sum == null ? null : sum.setScale(SCALE, RoundingMode.HALF_UP);
    }

    /**
     * 校验 + 解析:{仓库} 在 bs_wh 里按「仓库名称」或「仓库编码」都能命中,统一回填编码/名称;
     * 仓位可选,传了就校验它属于该仓库(bs_wh_loc)。数量合计必须等于该行实收数量。
     */
    /**
     * 只给了一个仓库:先合并子行(回退),再把这一行的仓库/仓位设成它 —— 不拆行。
     * 语义 = "把这行放到这个仓库"(用户在弹窗里只填一行就是想干这个)。
     */
    private void applySingle(String docNo, long lineId, Map<String, Object> alloc, String user) {
        mergeChildren(docNo, lineId, user);
        Map<String, Object> wh = resolveWhBin(str(alloc.get("仓库")), str(alloc.get("仓位编码")), 1);
        jdbc.update("UPDATE " + LINE_TABLE + " SET [仓库] = ?, [仓库编码] = ?, [仓位编码] = ?, [仓位名称] = ?,"
                        + " [现存量] = NULL, [现存量说明] = NULL, [asp_user1] = ?, [asp_time1] = ?"
                        + " WHERE id = ? AND [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'",
                new Object[]{
                        wh.get("仓库"), wh.get("仓库编码"), wh.get("仓位编码"), wh.get("仓位名称"),
                        user, new java.sql.Timestamp(System.currentTimeMillis()), lineId, docNo,
                },
                new int[]{Types.NVARCHAR, Types.NVARCHAR, Types.NVARCHAR, Types.NVARCHAR,
                        Types.NVARCHAR, Types.TIMESTAMP, Types.BIGINT, Types.NVARCHAR});
    }

    /** 解析仓库/仓位(名称或编码都认;仓位要属于该仓库且未停用);解析不到直接报错并点名第几行 */
    private Map<String, Object> resolveWhBin(String rawWh, String rawBin, int idx) {
        if (rawWh.isEmpty()) throw new IllegalStateException("第 " + idx + " 行没有选仓库");
        Map<String, Object> wh;
        try {
            wh = jdbc.queryForMap("SELECT 仓库编码, 仓库名称 FROM bs_wh"
                    + " WHERE (仓库名称 = ? OR 仓库编码 = ?) AND ISNULL(asp_cancel, 'N') <> 'Y'"
                    + " AND ISNULL(停用, 0) = 0", rawWh, rawWh);
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("仓库「" + rawWh + "」在仓库档案里不存在或已停用");
        }
        String whName = str(wh.get("仓库名称"));
        String whCode = str(wh.get("仓库编码"));
        String binCode = rawBin;
        if (!binCode.isEmpty()) {
            try {
                // ⚠ bs_wh_loc **没有「仓位名称」列**(2026-11-17 实测:SQL 207 列名 '仓位名称' 无效 ⇒
                //   弹窗一选仓位就报"服务异常")。这里只校验仓位归属并取编码,名称就用编码——
                //   bl_purchase_in.仓位名称 是可空展示列,各页面本来也都按 仓位编码 显示。
                Map<String, Object> bin = jdbc.queryForMap("SELECT 仓位编码 FROM bs_wh_loc"
                        + " WHERE 仓位编码 = ? AND (仓库 = ? OR 仓库编码 = ?) AND ISNULL(停用, 0) = 0",
                        binCode, whName, whCode);
                binCode = str(bin.get("仓位编码"));
            } catch (EmptyResultDataAccessException e) {
                throw new IllegalStateException("仓位「" + binCode + "」不属于仓库「" + whName + "」或已停用");
            }
        }
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("仓库", whName);
        p.put("仓库编码", whCode);
        p.put("仓位编码", binCode);
        p.put("仓位名称", "");
        return p;
    }

    /**
     * 校验 + 解析:{仓库} 在 bs_wh 里按「仓库名称」或「仓库编码」都能命中,统一回填编码/名称;
     * 仓位可选,传了就校验它属于该仓库(bs_wh_loc)。数量合计必须等于该行实收数量。
     */
    private List<Map<String, Object>> normalizeAllocs(List<Map<String, Object>> allocs, Map<String, Object> row) {
        if (allocs == null || allocs.size() < 2) {
            throw new IllegalStateException("至少要分到两个仓库:只分一个仓库不用拆");
        }
        BigDecimal total = num(row.get("实收数量"));
        BigDecimal sum = BigDecimal.ZERO;
        List<Map<String, Object>> out = new ArrayList<>();
        int idx = 0;
        for (Map<String, Object> a : allocs) {
            idx++;
            BigDecimal qty = dec(a.get("数量"));
            if (qty == null || qty.signum() <= 0) {
                throw new IllegalStateException("第 " + idx + " 行数量必须大于 0");
            }
            Map<String, Object> p = resolveWhBin(str(a.get("仓库")), str(a.get("仓位编码")), idx);
            p.put("数量", qty.setScale(SCALE, RoundingMode.HALF_UP));
            out.add(p);
            sum = sum.add(qty.setScale(SCALE, RoundingMode.HALF_UP));
        }
        if (sum.compareTo(total.setScale(SCALE, RoundingMode.HALF_UP)) != 0) {
            throw new IllegalStateException("各仓库数量合计(" + plain(sum) + ")必须等于本行实收数量("
                    + plain(total) + ");差 " + plain(sum.subtract(total)));
        }
        return out;
    }

    /**
     * 一个金额列按各分配数量占比分摊;**最后一行吃尾差**(原值 − 前面已分),保证合计与原行一字不差。
     * 原值为 null ⇒ 整列都返回 null(不把"没有成本"变成 0)。
     */
    private List<BigDecimal> allocate(Object rawValue, List<Map<String, Object>> parts, BigDecimal totalQty) {
        List<BigDecimal> out = new ArrayList<>();
        if (rawValue == null) {
            for (int i = 0; i < parts.size(); i++) out.add(null);
            return out;
        }
        BigDecimal amount = num(rawValue).setScale(SCALE, RoundingMode.HALF_UP);
        BigDecimal allocated = BigDecimal.ZERO;
        for (int i = 0; i < parts.size(); i++) {
            BigDecimal qty = (BigDecimal) parts.get(i).get("数量");
            boolean last = i == parts.size() - 1;
            if (last) {
                out.add(amount.subtract(allocated));
            } else if (totalQty.signum() <= 0) {
                out.add(BigDecimal.ZERO);
            } else {
                BigDecimal share = amount.multiply(qty).divide(totalQty, SCALE, RoundingMode.HALF_UP);
                out.add(share);
                allocated = allocated.add(share);
            }
        }
        return out;
    }

    /** 把一条分配落到目标行上(数量、仓库、仓位、分摊后的金额族;现存量清空由界面重刷) */
    private void applyPart(Map<String, Object> target, Map<String, Object> row, Map<String, Object> p,
                           Map<String, List<BigDecimal>> split, int index, long groupId) {
        BigDecimal qty = (BigDecimal) p.get("数量");
        target.put("仓库", p.get("仓库"));
        target.put("仓库编码", p.get("仓库编码"));
        target.put("仓位编码", blankToNull((String) p.get("仓位编码")));
        target.put("仓位名称", blankToNull((String) p.get("仓位名称")));
        target.put("实收数量", qty);
        // 双单位:按换算率重算辅助数量(换算率空/0 时留空,不臆造)
        BigDecimal rate = num(row.get("换算率"));
        target.put("实收数量2", rate.signum() > 0 ? qty.multiply(rate).setScale(SCALE, RoundingMode.HALF_UP) : null);
        target.put("金额", split.get("金额").get(index));
        target.put("含税金额", split.get("含税金额").get(index));
        target.put("费用金额", split.get("费用金额").get(index));
        target.put("费用调整", split.get("费用调整").get(index));
        target.put("送检数量", split.get("送检数量").get(index));
        // 拆分组锚点:组内所有行(含原行)都记原始行 id ⇒ 弹窗再打开时按它缩进、按它合并回一行(回退)
        target.put("源行id", groupId);
        // 现存量是"打开单子时按库存状况表刷出来"的展示列,拆完不猜:清空,由界面重新刷
        target.put("现存量", null);
        target.put("现存量说明", null);
    }

    /** 写这一行要变的那些列(类型全部显式给:见类注释里的 varbinary→datetime2 事故) */
    private void updateOverrides(long lineId, Map<String, Object> target) {
        Object[] args = {
                target.get("仓库"), target.get("仓库编码"), target.get("仓位编码"), target.get("仓位名称"),
                target.get("实收数量"), target.get("实收数量2"), target.get("金额"), target.get("含税金额"),
                target.get("费用金额"), target.get("费用调整"), target.get("送检数量"), null, null,
                target.get("源行id"),
                target.get("asp_user1"), target.get("asp_time1"), lineId,
        };
        jdbc.update(LINE_OVERRIDE_SQL, args, LINE_OVERRIDE_TYPES);
    }

    /**
     * 原样复制一行(除 id 外全部列,含 源单行号/批次号/批号 —— 用户口径「来源采购订单行号和上游的行号不变」),
     * 返回新行 id。用 OUTPUT INSERTED.id:同一条语句拿到自增主键,不依赖 SCOPE_IDENTITY 的作用域。
     */
    private long duplicateRow(long sourceId) {
        String cols = lineCols().stream().map(c -> "[" + c + "]").collect(Collectors.joining(","));
        String sql = "INSERT INTO " + LINE_TABLE + " (" + cols + ") OUTPUT INSERTED.id SELECT " + cols
                + " FROM " + LINE_TABLE + " WHERE id = ?";
        Long newId = jdbc.queryForObject(sql, Long.class, sourceId);
        if (newId == null) throw new IllegalStateException("拆分入库行失败:没拿到新行 id");
        return newId;
    }

    /**
     * 占用链跟着拆:原行那条 ACTIVE 链数量改成第一行数量,其余各行复制一条
     * (source_* 原样、target_line_key 指向新行、linked_quantity 各自数量)。
     * 手工新建的单据没有占用链 ⇒ 静默跳过(不是错误)。
     */
    private void replicateLinks(String docNo, long lineId, List<Long> lineIds, List<Map<String, Object>> parts,
                                String user) {
        String lineKey = docNo + "#" + lineId;
        List<Map<String, Object>> links = jdbc.queryForList(
                "SELECT id FROM form_flow_link WHERE target_panel_code = ? AND target_form_no = ?"
                        + " AND target_line_key = ? AND link_status = 'ACTIVE'", PANEL, docNo, lineKey);
        if (links.isEmpty()) return;
        for (int i = 1; i < lineIds.size(); i++) {
            BigDecimal qty = (BigDecimal) parts.get(i).get("数量");
            for (Map<String, Object> link : links) {
                long srcLinkId = ((Number) link.get("id")).longValue();
                long newLinkId = duplicateLink(srcLinkId);
                jdbc.update("UPDATE form_flow_link SET [target_line_key] = ?, [linked_quantity] = ?,"
                                + " [create_by] = ?, [create_time] = ? WHERE id = ?",
                        new Object[]{docNo + "#" + lineIds.get(i), qty, user,
                                new java.sql.Timestamp(System.currentTimeMillis()), newLinkId},
                        new int[]{Types.NVARCHAR, Types.DECIMAL, Types.NVARCHAR, Types.TIMESTAMP, Types.BIGINT});
            }
        }
        BigDecimal firstQty = (BigDecimal) parts.get(0).get("数量");
        jdbc.update("UPDATE form_flow_link SET [linked_quantity] = ? WHERE target_panel_code = ?"
                        + " AND target_form_no = ? AND target_line_key = ? AND link_status = 'ACTIVE'",
                new Object[]{firstQty, PANEL, docNo, lineKey},
                new int[]{Types.DECIMAL, Types.NVARCHAR, Types.NVARCHAR, Types.NVARCHAR});
    }

    /** 原样复制一条占用链(除 id),返回新链 id;列清单取自表结构,不硬编码 */
    private long duplicateLink(long sourceLinkId) {
        String cols = linkCols().stream().map(c -> "[" + c + "]").collect(Collectors.joining(","));
        String sql = "INSERT INTO form_flow_link (" + cols + ") OUTPUT INSERTED.id SELECT " + cols
                + " FROM form_flow_link WHERE id = ?";
        Long newId = jdbc.queryForObject(sql, Long.class, sourceLinkId);
        if (newId == null) throw new IllegalStateException("复制占用链失败:没拿到新链 id");
        return newId;
    }

    private List<String> lineCols() {
        if (lineCols == null) {
            lineCols = jdbc.queryForList("SELECT c.name FROM sys.columns c"
                    + " WHERE c.object_id = OBJECT_ID('" + LINE_TABLE + "')"
                    + " AND c.is_identity = 0 AND c.is_computed = 0 ORDER BY c.column_id", String.class);
        }
        return lineCols;
    }

    private List<String> linkCols() {
        if (linkCols == null) {
            linkCols = jdbc.queryForList("SELECT c.name FROM sys.columns c"
                    + " WHERE c.object_id = OBJECT_ID('form_flow_link')"
                    + " AND c.is_identity = 0 AND c.is_computed = 0 ORDER BY c.column_id", String.class);
        }
        return linkCols;
    }

    // ==================== 小工具 ====================

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    /** 数值列统一成 BigDecimal(空/NULL 当 0;数值列本身就是 decimal,取 toString 转最稳) */
    private static BigDecimal num(Object v) {
        if (v == null) return BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP);
        if (v instanceof BigDecimal b) return b;
        try {
            return new BigDecimal(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP);
        }
    }

    /** 可空的数值(分配清单里的数量:没填就是没填,不能当 0 混过去) */
    private static BigDecimal dec(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 去掉多余的 0(报错文案用:8.0000 → 8) */
    private static String plain(BigDecimal v) {
        if (v == null) return "0";
        BigDecimal t = v.stripTrailingZeros();
        return t.signum() == 0 ? "0" : t.toPlainString();
    }
}
