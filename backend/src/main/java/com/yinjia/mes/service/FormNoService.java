package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 单号服务:沿用旧系统 s_allno 号池(前缀-yyyy-MM-4位序号,如 PG-2026-09-0001)。
 * 号池 ny 列存 yyyy-MM(与历史横杠格式单据的月份段一致,续号按 前缀+月份 连续);
 * 旧紧凑格式历史行(前缀+yyMMdd,ny=yyMMdd)因 ny/dh 形态不同天然隔离,互不串号。
 *
 * <h3>2026-10-19 重号事故与修法(不可回退)</h3>
 * <b>病根</b>:取号原来**只看号池自己** ——
 * {@code seq = MAX(RIGHT(dh,4)) FROM s_allno WHERE lb=前缀 AND ny=当前月},存在性也只查
 * {@code s_allno + inh}。而导库 / 金蝶导入 / 直接写库 / 恢复备份没带 s_allno 的单据,
 * 单号根本不在池里 ⇒ 号池从旧号继续发,**把库里已存在的号再发一次**。
 * <p><b>现场(2026-10-19 用户报障)</b>:送料暂收单 QC_RECV 新增,弹出来的单子是「已审核」。
 * 实际是新增确实建了一张空白草稿,但它拿到的 {@code SL-2026-10-0032} 等号在库里**已有一张
 * 9 月的已审核单**(库里的号没有回登号池,池只到 0006)。同一单号共用一条 yj_doc_status
 * (shr=admin)⇒ 新草稿一出生就显示已审核、不可编辑/不可保存;列表按单号 GROUP BY 又把两行并成
 * 一行,用户看到的就是"新增出来一张已审核单"。来料检验单 QC_INSP 同病(101 张单号全不在池里)。
 * <p><b>修法</b>:①取号基准 = max(号池末号, 各业务表同前缀同月最大号) —— 一次就跳过所有
 * "未回登"的号;②候选号仍逐个比对 号池 + 遗留流水表 inh + **本前缀对应的业务表**
 * (头行式查头表、单表式查行表,来源是 yj_panel 元数据),任一命中就换下一个号。
 * 这样即使号池落后几百个号、或某张表没被回登脚本覆盖,也**物理上不可能**再发出库里已有的号。
 */
@Service
public class FormNoService {

    private static final DateTimeFormatter NY_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    /** 候选号连续被占用的上限。正常情况下 max(号池, 业务表) 已经把序推到位,循环一次就出号;
     *  这里只是兜底(号池落后且某张表读不到时才会逐号扫)。 */
    private static final int MAX_SKIP = 10000;

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    public FormNoService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    /**
     * 生成下一个单号(写入 s_allno 留痕,与旧系统一致)。
     *
     * <p>{@code synchronized}:同一 JVM 内把"算号 + 落池"串起来,两个页签同时点「新增」时
     * 不会双双算出同一个候选号(跨实例并发仍靠落库后的唯一性兜底,本方法至少要保证单实例不自杀)。
     */
    public synchronized String next(String prefix, String user) {
        String ny = LocalDate.now().format(NY_FMT);
        String no = nextFree(prefix, ny);
        jdbc.update("INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,GETDATE(),'N')",
                "0", no, prefix, ny, user == null ? "admin" : user);
        return no;
    }

    /** 预览下一个单号(不消耗号池;新建表单默认值展示用) */
    public String preview(String prefix) {
        return nextFree(prefix, LocalDate.now().format(NY_FMT));
    }

    /**
     * 取第一个既不在号池、也不在业务表里的候选号。
     *
     * <p>起始序号取「号池末号」与「业务表同前缀同月最大号」的较大者 + 1:业务表里已有
     * 0130 而池子停在 0033 时,直接从 0131 起,不必用 97 次空转去试探 0034~0130。
     */
    private String nextFree(String prefix, String ny) {
        int seq = Math.max(maxPoolSeq(prefix, ny), maxDocSeq(prefix, ny)) + 1;
        for (int i = 0; i < MAX_SKIP; i++) {
            String no = prefix + "-" + ny + "-" + String.format("%04d", seq++);
            if (!taken(no, prefix)) return no;
        }
        throw new IllegalStateException("单号生成失败：" + prefix + " 连续 " + MAX_SKIP + " 个候选号都已被占用");
    }

    /** 号池里该前缀该月的最大流水号(原口径,保持) */
    private int maxPoolSeq(String prefix, String ny) {
        Integer maxSeq = jdbc.queryForObject(
                "SELECT MAX(CAST(RIGHT(dh, 4) AS int)) FROM s_allno WHERE lb = ? AND ny = ? AND dh LIKE ?",
                Integer.class, prefix, ny, prefix + "-" + ny + "-%");
        return maxSeq == null ? 0 : maxSeq;
    }

    /**
     * 业务表里该前缀该月的最大流水号 —— **2026-10-19 新增的基准**。
     *
     * <p>只认「前缀-yyyy-MM-四位数字」这个精确形态(LIKE 末尾没有通配符,多一位少一位都不算),
     * 避免把 金蝶单号(YJ-20260902-05)、旧紧凑格式(SL20261019001)算进流水。
     * 表/列读不到(元数据漂移、视图权限)时跳过该表,不阻断开单 —— 由 {@link #taken} 逐号兜底。
     */
    private int maxDocSeq(String prefix, String ny) {
        int max = 0;
        for (String[] tc : docTables(prefix)) {
            try {
                Integer v = jdbc.queryForObject(
                        "SELECT MAX(TRY_CAST(RIGHT(RTRIM([" + tc[1] + "]), 4) AS int)) FROM [" + tc[0] + "]"
                                + " WHERE RTRIM([" + tc[1] + "]) LIKE ?",
                        Integer.class, prefix + "-" + ny + "-[0-9][0-9][0-9][0-9]");
                if (v != null && v > max) max = v;
            } catch (Exception ignored) {
                // 元数据漂移不该挡住开单:跳过,交给 taken() 逐个候选号比对
            }
        }
        return max;
    }

    /** 该号是否已被占用:号池 + 遗留流水表 inh(原口径) + 本前缀对应的业务表(2026-10-19 新增) */
    private boolean taken(String no, String prefix) {
        if (exists(no)) return true;
        for (String[] tc : docTables(prefix)) {
            try {
                List<Integer> hit = jdbc.query("SELECT TOP 1 1 FROM [" + tc[0] + "] WHERE RTRIM([" + tc[1] + "]) = ?",
                        (rs, i) -> 1, no);
                if (!hit.isEmpty()) return true;
            } catch (Exception ignored) {
                // 同上:读不到就跳过
            }
        }
        return false;
    }

    private boolean exists(String no) {
        // 2026-09-30:原为 `... UNION SELECT TOP 1 inh_no FROM inh WHERE inh_no = ?` —— inh 已由遗留纺织表
        // 重建为 MES 入库流水表,inh_no 列不存在,该 UNION 使**每次生成单号**都抛
        // 「列名 'inh_no' 无效」(error 207)⇒ 新增/保存任何单据都 500(实测复现见
        // tools/archive/_probe-formno-inh-no.cjs)。此处改读重建后的 单据编号,保持"单号不与流水冲突"的原意;
        // 纺织老数据已导出 tools/archive/_stock-flow-backup-20260930.csv,其单号不再进号池,
        // 而 s_allno.dh 分支仍是号池内的唯一性判据。
        List<String> rows = jdbc.query(
                "SELECT TOP 1 dh FROM s_allno WHERE dh = ? UNION SELECT TOP 1 单据编号 FROM inh WHERE 单据编号 = ?",
                (rs, i) -> rs.getString(1), no, no);
        return !rows.isEmpty();
    }

    /**
     * 前缀 → 单号所在的(表, 列)。来源是面板元数据 yj_panel(前缀的唯一权威):
     * 头行式单据的单号在**头表**,单表式在**行表**;同一前缀可能挂多个面板(如 PI 采购入库/产线入库),
     * 全部纳入。元数据有 30s 缓存(PanelRegistry),这里不额外缓存 —— 新加面板能立刻生效。
     */
    private List<String[]> docTables(String prefix) {
        List<String[]> out = new ArrayList<>();
        // 没有前缀的面板(理论上不存在:yj_panel.mode='doc' 都有前缀)不该把取号打断 ——
        // 退回"只查号池+inh"的老口径,而不是 NPE。
        if (prefix == null || prefix.isBlank()) return out;
        for (PanelRegistry.PanelDef def : registry.all()) {
            if (def.prefix() == null || !prefix.equals(def.prefix())) continue;
            String col = def.groupCol();
            String table = def.headTable() != null && !def.headTable().isBlank() ? def.headTable() : def.lineTable();
            if (col == null || col.isBlank() || table == null || table.isBlank()) continue;
            boolean dup = false;
            for (String[] tc : out) {
                if (tc[0].equalsIgnoreCase(table) && tc[1].equalsIgnoreCase(col)) { dup = true; break; }
            }
            if (!dup) out.add(new String[]{table, col});
        }
        return out;
    }
}
