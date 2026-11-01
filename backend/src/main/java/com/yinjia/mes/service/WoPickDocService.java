package com.yinjia.mes.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 「手机扫码 · 生产领料」配对台账服务(2026-10-30)。
 *
 * <p>用户口径(2026-10-30):「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』
 * (和生产计划平级)导航下。工序报工不变。生产领料重写。……先做一个『生成工单领料/退料单』,
 * 先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的组织bom表。
 * 对应生成一条生产领料单和生产退料单的数据。」
 *
 * <h3>本类负责什么 / 不负责什么</h3>
 * 只负责 {@code wo_pick_doc} 这张**配对台账**的读写与状态机(未完成 → 已完成 / 已作废)。
 * <b>不写任何库存</b>:库存只由 {@link StockLedgerService} 在材料出库单 / 其他入库单**审核**时
 * 按 {@code kucun(物料,仓库,批号)} 写入。台账只记单号与进度,不碰数量与批次
 * (所以它不改变 `docs/development/上线前必验-库存批次追溯.md` §五 的任何验收口径)。
 *
 * <h3>为什么这张表必须有(而不是靠单号反查)</h3>
 * <ol>
 *   <li>领料单({@code bd_material_out})与退料单({@code bd_other_in})是两张**不同面板**的单据,
 *       库里没有任何互相指向的列 ⇒ 不记台账就分不清哪张单配哪张;</li>
 *   <li>2026-10-18 起容许多张领料单挂同一工单行 ⇒ 按「加工单号 + 工单行号」反查一次会捞出一堆;</li>
 *   <li>用户要求列表页分「未完成 / 已完成」两组 ⇒ 需要地方记录"这一对领满了没有"。</li>
 * </ol>
 *
 * <h3>唯一约束 = 防连扫两下</h3>
 * {@code UX_wo_pick_doc_wo(工单号,工单行号) WHERE 状态 <> '已作废'} —— 同一工单行只能有**一对**有效单。
 * 作废后允许重新生单(现场"开错了,作废重开"是常规操作),所以过滤条件里排除已作废。
 */
@Service
public class WoPickDocService {

    /** 状态值(库里的中文值 = 业务状态,与旧面板口径一致;**不翻译**,见 ADR-0001) */
    public static final String STATE_OPEN = "未完成";
    public static final String STATE_DONE = "已完成";
    public static final String STATE_VOID = "已作废";

    private final JdbcTemplate jdbc;

    public WoPickDocService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 台账一行(领域对象;给调用方用,避免到处 Map 取值) */
    public record PickDoc(long id, String woNo, int woLine, String productCode, String productName,
                          String outNo, String backNo, String state, int itemCount, int doneCount,
                          int printCount, String creator, Timestamp createAt, String submitter, Timestamp submitAt) { }

    /** 台账表在不在(测试库可能还没跑迁移;不在时调用方要给出可读提示而不是 500) */
    public boolean tableReady() {
        Integer n = jdbc.queryForObject(
                "SELECT CASE WHEN OBJECT_ID('dbo.wo_pick_doc','U') IS NULL THEN 0 ELSE 1 END", Integer.class);
        return n != null && n == 1;
    }

    /**
     * 查该工单行**当前有效**的那一对单据。
     *
     * @return 没有则 null(已作废的不算 —— 作废后现场可以重新生单)
     */
    public PickDoc findActive(String woNo, int woLine) {
        if (woNo == null || woNo.isBlank() || !tableReady()) return null;
        List<PickDoc> rows = jdbc.query(
                "SELECT id, 工单号, 工单行号, 产品编号, 产品名称, 领料单号, 退料单号, 状态,"
                        + " 物料项数, 已领项数, 打印次数, 创建人, 创建时间, 提交人, 提交时间"
                        + " FROM dbo.wo_pick_doc WHERE 工单号 = ? AND 工单行号 = ? AND 状态 <> ?",
                (rs, i) -> new PickDoc(rs.getLong("id"), rs.getString("工单号"), rs.getInt("工单行号"),
                        rs.getString("产品编号"), rs.getString("产品名称"),
                        rs.getString("领料单号"), rs.getString("退料单号"), rs.getString("状态"),
                        rs.getInt("物料项数"), rs.getInt("已领项数"), rs.getInt("打印次数"),
                        rs.getString("创建人"), rs.getTimestamp("创建时间"),
                        rs.getString("提交人"), rs.getTimestamp("提交时间")),
                woNo.trim(), woLine, STATE_VOID);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 按主键取(单据详情页用) */
    public PickDoc byId(long id) {
        if (!tableReady()) return null;
        List<PickDoc> rows = jdbc.query(
                "SELECT id, 工单号, 工单行号, 产品编号, 产品名称, 领料单号, 退料单号, 状态,"
                        + " 物料项数, 已领项数, 打印次数, 创建人, 创建时间, 提交人, 提交时间"
                        + " FROM dbo.wo_pick_doc WHERE id = ?",
                (rs, i) -> new PickDoc(rs.getLong("id"), rs.getString("工单号"), rs.getInt("工单行号"),
                        rs.getString("产品编号"), rs.getString("产品名称"),
                        rs.getString("领料单号"), rs.getString("退料单号"), rs.getString("状态"),
                        rs.getInt("物料项数"), rs.getInt("已领项数"), rs.getInt("打印次数"),
                        rs.getString("创建人"), rs.getTimestamp("创建时间"),
                        rs.getString("提交人"), rs.getTimestamp("提交时间")),
                id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 新建一对单据的台账行(生单成功后调用)。
     *
     * <p>⚠ 并发:同一工单行在两个手机同时扫时,唯一约束会让后到的那条抛 {@link DuplicateKeyException}。
     * 调用方必须捕获它并给出「该工单行已经开过单了」—— **不要**吞掉当成成功,
     * 否则会出现"库里一对单、台账一对单、界面却说生成了两对"。
     *
     * @param itemCount 按组装BOM表展开的物料项数
     */
    public long insert(String woNo, int woLine, String productCode, String productName,
                       String outNo, String backNo, int itemCount, String user) {
        KeyHolder kh = new GeneratedKeyHolder();
        LocalDateTime now = LocalDateTime.now();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO dbo.wo_pick_doc"
                            + " (工单号, 工单行号, 产品编号, 产品名称, 领料单号, 退料单号, 状态,"
                            + "  物料项数, 已领项数, 打印次数, 创建人, 创建时间,"
                            + "  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,?,'N')",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, woNo.trim());
            ps.setInt(2, woLine);
            ps.setString(3, blankToNull(productCode));
            ps.setString(4, blankToNull(productName));
            ps.setString(5, blankToNull(outNo));
            ps.setString(6, blankToNull(backNo));
            ps.setString(7, STATE_OPEN);
            ps.setInt(8, Math.max(0, itemCount));
            ps.setString(9, user);
            ps.setTimestamp(10, Timestamp.valueOf(now));
            ps.setString(11, user);
            ps.setTimestamp(12, Timestamp.valueOf(now));
            ps.setString(13, user);
            ps.setTimestamp(14, Timestamp.valueOf(now));
            return ps;
        }, kh);
        Number k = kh.getKey();
        if (k == null) throw new IllegalStateException("台账写入成功但取不到主键(wo_pick_doc)");
        return k.longValue();
    }

    /**
     * 刷新领料进度(每次扫码核销 / 打开单据时调用)。
     *
     * @param done  已领到数量的物料项数
     * @param total 按 BOM 展开的物料项数
     * @return 更新后的状态(仍由 {@link #STATE_OPEN} 保持 —— **领满不等于完成**,
     *         用户口径是「全部领料完成后才可以提交转成材料出库单」,完成态由提交那一刻置)
     */
    public void updateProgress(long id, int done, int total, String user) {
        jdbc.update("UPDATE dbo.wo_pick_doc SET 已领项数 = ?, 物料项数 = ?,"
                        + " asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                Math.max(0, done), Math.max(0, total), user, id);
    }

    /** 提交成功 → 已完成(记提交人/时间)。调用方负责在此之前真正过账。 */
    public void markDone(long id, String user) {
        jdbc.update("UPDATE dbo.wo_pick_doc SET 状态 = ?, 提交人 = ?, 提交时间 = SYSDATETIME(),"
                        + " asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                STATE_DONE, user, user, id);
    }

    /** 作废(空单整单作废:退料没做、领料也放弃时)。作废后该工单行可重新生单。 */
    public void markVoid(long id, String user) {
        jdbc.update("UPDATE dbo.wo_pick_doc SET 状态 = ?, asp_user2 = ?, asp_time2 = SYSDATETIME(),"
                        + " asp_cancel = 'Y' WHERE id = ?",
                STATE_VOID, user, id);
    }

    /**
     * 追加退料单号(2026-10-30 第三轮:退料改为在**已完成**的领料单上按需做,可分多次)。
     *
     * <p>一张领料单可能退好几次 ⇒ 退料单号**累加**(逗号分隔),让人从这张领料单一眼看到
     * "退过料了、退的是哪几张单"。真正的数量明细在 {@code wo_pick_return} 里,
     * 这里只是给人看的索引;重复提交同一单号不重复追加。
     *
     * <p>列宽注意:{@code 退料单号} 是 nvarchar(60);累加后可能超长,
     * 超了就只保留**最近几张**(更早的去退料台账查)。不抛错 —— 索引信息不值得阻断退料。
     */
    public void appendReturnNo(long id, String backNo, String user) {
        if (backNo == null || backNo.isBlank()) return;
        PickDoc d = byId(id);
        if (d == null) return;
        String cur = d.backNo() == null ? "" : d.backNo().trim();
        java.util.List<String> parts = new java.util.ArrayList<>();
        for (String p : cur.split("[,，]")) {
            String s = p.trim();
            if (!s.isEmpty()) parts.add(s);
        }
        if (parts.contains(backNo.trim())) return;
        parts.add(backNo.trim());
        // 超长裁剪:只留最近的几张(单号 60 以内)
        while (String.join(",", parts).length() > 58 && parts.size() > 1) parts.remove(0);
        jdbc.update("UPDATE dbo.wo_pick_doc SET 退料单号 = ?, asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE id = ?", String.join(",", parts), user, id);
    }

    /** 打印留痕:生单时自动打一次、单据里重打,每次 +1(用户口径「生成生产领料单的时候自动打印一次」) */    public void bumpPrint(long id, String user) {
        jdbc.update("UPDATE dbo.wo_pick_doc SET 打印次数 = ISNULL(打印次数,0) + 1,"
                        + " 打印时间 = SYSDATETIME(), asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                user, id);
    }

    /**
     * 列表查询:未完成 / 已完成分组(用户口径「将已完成的单据,在生产领料的界面放到下面的已完成区,
     * 并且已完成和未完成都可以展开和收缩」)。
     *
     * <p>两组**分别来一条 SQL**,而不是一次全捞回来在前端分:一个车间跑久了未完成组会很长,
     * 已完成的更多 —— 一次捞回来前端分组等于把整表搬到手机上。
     *
     * @param state     未完成 / 已完成
     * @param keyword   工单号 / 领料单号 / 退料单号 / 产品名称 的模糊匹配(空=不过滤)
     * @param pageSize  每组最多取多少行
     */
    public List<Map<String, Object>> list(String state, String keyword, int pageSize) {
        if (!tableReady()) return List.of();
        StringBuilder sql = new StringBuilder(
                "SELECT TOP (?) id, 工单号, 工单行号, 产品编号, 产品名称, 领料单号, 退料单号, 状态,"
                        + " 物料项数, 已领项数, 打印次数, 创建人, CONVERT(varchar(19), 创建时间, 120) AS 创建时间,"
                        + " 提交人, CONVERT(varchar(19), 提交时间, 120) AS 提交时间"
                        + " FROM dbo.wo_pick_doc WHERE 状态 = ?");
        List<Object> args = new ArrayList<>();
        args.add(Math.max(1, Math.min(pageSize, 500)));
        args.add(state);
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            sql.append(" AND (工单号 LIKE ? OR 领料单号 LIKE ? OR 退料单号 LIKE ?"
                    + "      OR ISNULL(产品名称,'') LIKE ? OR ISNULL(产品编号,'') LIKE ?)");
            String like = "%" + kw + "%";
            for (int i = 0; i < 5; i++) args.add(like);
        }
        // 🔴 2026-11-01 用户口径:「不管是生成的领料单还是已经完成的领料单,
        //   ……都要按生成单据的最新时间排序」⇒ 一律**最新的在上**。
        //
        // 改造前未完成是 `创建时间 ASC`(最早开单的先处理),结果刚生成的单排在最下面,
        // 现场要翻到底才找得到自己刚扫出来的那张 —— 用户报障的正是这个。
        //
        // 已完成取 `ISNULL(提交时间, 创建时间)`:已完成单的"最新"是它完成的时刻,
        // 用提交时间才能让刚提交的单浮上来;没有提交时间的(异常数据)退回创建时间。
        sql.append(STATE_DONE.equals(state)
                ? " ORDER BY ISNULL(提交时间, 创建时间) DESC, id DESC"
                : " ORDER BY 创建时间 DESC, id DESC");

        List<Map<String, Object>> raw = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>(raw.size());
        for (Map<String, Object> r : raw) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("工单号", r.get("工单号"));
            m.put("工单行号", r.get("工单行号"));
            m.put("产品编号", r.get("产品编号"));
            m.put("产品名称", r.get("产品名称"));
            m.put("领料单号", r.get("领料单号"));
            m.put("退料单号", r.get("退料单号"));
            m.put("状态", r.get("状态"));
            m.put("物料项数", r.get("物料项数"));
            m.put("已领项数", r.get("已领项数"));
            m.put("打印次数", r.get("打印次数"));
            m.put("创建人", r.get("创建人"));
            m.put("创建时间", r.get("创建时间"));
            m.put("提交人", r.get("提交人"));
            m.put("提交时间", r.get("提交时间"));
            out.add(m);
        }
        return out;
    }

    /** 两组各取多少行(给前端显示"还有更多"用) */
    public int countByState(String state) {
        if (!tableReady()) return 0;
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.wo_pick_doc WHERE 状态 = ?",
                Integer.class, state);
        return n == null ? 0 : n;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** 给控制器判断"是不是唯一约束撞了"用(Spring 把两种异常拆开抛) */
    public static boolean isDuplicate(RuntimeException e) {
        return e instanceof DuplicateKeyException;
    }
}
