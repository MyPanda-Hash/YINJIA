package com.yinjia.mes.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 按钮服务:对齐 light-mes PxService.callButton 的中文按钮分发与状态机。
 * - 保存/提交(空编号=新建单据,与 light-mes directAdd 语义一致)
 * - 审核/弃审(yj_doc_status 记录,不动旧表)
 * - 删除:单据=yj_doc_status.canceled='Y';档案行=旧行 asp_cancel='Y'(对齐旧系统软删)
 * 留痕约定:asp_user1/asp_time1=创建,asp_user2/asp_time2=最后修改(与旧数据一致)
 */
@Service
public class ButtonService {

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final FormNoService formNoService;
    private final JdbcTemplate jdbc;
    private final DevTaskService devTaskService;
    private final MessageService messageService;
    private final LotSeqService lotSeqService;
    private final StockLedgerService stockLedger;
    private final WoReportService woReport;
    private final QcDisposalService qcDisposal;

    public ButtonService(PanelRegistry registry, QueryService queryService,
                         FormNoService formNoService, JdbcTemplate jdbc,
                         DevTaskService devTaskService, MessageService messageService,
                         LotSeqService lotSeqService, StockLedgerService stockLedger,
                         WoReportService woReport, QcDisposalService qcDisposal) {
        this.registry = registry;
        this.queryService = queryService;
        this.formNoService = formNoService;
        this.jdbc = jdbc;
        this.devTaskService = devTaskService;
        this.messageService = messageService;
        this.lotSeqService = lotSeqService;
        this.stockLedger = stockLedger;
        this.woReport = woReport;
        this.qcDisposal = qcDisposal;
    }

    /** 发送业务事件消息(失败不影响业务操作) */
    private void notify(java.util.function.Supplier<Integer> action) {
        try {
            action.get();
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                    .warn("business message send failed: {}", e.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> callButton(String panelCode, String buttonName,
                                          Map<String, Object> formData, Map<String, Object> buttonParam) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        return switch (buttonName == null ? "" : buttonName) {
            case "刷新" -> new HashMap<>();
            case "保存", "提交", "保存新增" -> save(def, formData == null ? new HashMap<>() : formData, true);
            case "保存为草稿" -> save(def, formData == null ? new HashMap<>() : formData, false);
            case "新增流程", "新增" -> save(def, formData == null ? new HashMap<>() : formData, false);
            case "审核" -> audit(def, formData);
            case "弃审" -> unaudit(def, formData);
            // 审批流(照搬 light-mes:草稿→提交审批→审批中→通过/驳回;弃审全留痕)
            case "提交审批" -> submitApproval(def, formData);
            case "审批通过" -> approveApproval(def, formData);
            case "审批驳回" -> rejectApproval(def, formData);
            case "审批情况" -> approvalHistory(def, formData);
            // 整单中止/中止执行(前端 engine.callButton 已归一为「中止」)、草稿(归一为「取消中止」)
            case "中止" -> stop(def, formData);
            case "取消中止" -> unstop(def, formData);
            case "删除", "删除单据" -> DOC_ARCHIVE_PANELS.contains(def.code()) ? deleteDocFile(def, formData) : delete(def, formData);
            // 文件类面板:归档单据删除申请的管理员审批
            case "删除审批通过" -> approveDelete(def, formData);
            case "删除审批驳回" -> rejectDelete(def, formData);
            // 文件类面板:归档后申请修改(管理员审批进入修改态,再审批归档+修改记录滚动3条)
            case "申请修改" -> modifyRequest(def, formData);
            // 产品信息表:归档后下发产品开发到 5 个下游文件面板(2026-09-09)
            case "产品开发" -> dispatchDev(def, formData);
            case "修改审批通过" -> modifyApprove(def, formData);
            case "修改审批驳回" -> modifyReject(def, formData);
            case "修改记录" -> modifyHistory(def, formData);
            // 库存状况:新增库存(存货/仓库按编码校验基础档案,期初现存量+预警数量)
            case "新增库存" -> addStock(def, formData);
            // 库存状况:修改预警数量(行内编辑,空值回退全局阈值100)
            case "更新预警数量" -> updateStockWarn(def, formData);
            // 工序报工:切炭双出口(合格品分直销入成品仓+继续组装)
            case "切炭报工" -> cutCarbonReport(def, formData);
            default -> throw new IllegalStateException("未定义按钮规则：" + buttonName + "（可在 ButtonService 扩展）");
        };
    }

    // ============ 保存 ============

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> save(PanelRegistry.PanelDef def, Map<String, Object> formData, boolean markSaved) {
        String user = currentUserName();
        Map<String, Object> body = new LinkedHashMap<>(formData == null ? Map.of() : formData);
        Object detailObj = body.remove("detail");
        Object noObj = body.remove("编号");
        body.remove("单据状态");
        body.remove("创建时间");
        body.remove("更新时间");
        body.remove("审核人");
        body.remove("审核时间");
        Map<String, Object> detail = detailObj instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : new HashMap<>();
        // 明细键 = 面板 detail.tabs[].key(基础档案为业务键,单据为 items);兜底取首个数组值
        List<Map<String, Object>> items = detail.get(def.tabKey()) instanceof List<?> tabRows
                ? new ArrayList<>((List<Map<String, Object>>) tabRows)
                : detail.get("items") instanceof List<?> l
                ? new ArrayList<>((List<Map<String, Object>>) l) : new ArrayList<>();
        if (items.isEmpty() && detail.values().stream().findFirst().map(v -> v instanceof List).orElse(false)) {
            items = new ArrayList<>((List<Map<String, Object>>) detail.values().iterator().next());
        }

        // 品检分流链:暂收行缺批号时自动取号(批号=入库日期+3位流水;二维码=物料编码+批号)
        if ("QC_RECV".equals(def.code())) {
            for (Map<String, Object> it : items) {
                Object lot = it.get("批号");
                if (lot == null || String.valueOf(lot).isBlank()) it.put("批号", lotSeqService.next());
            }
        }
        // 计划层:生产工单无工序行时预填全部启用工序(bs_op 顺序),计划数量=订单数量
        // (五道工序共用一张工单;成型计划数量可在头上按"1切几"折算另填)
        if ("WO_ORDER".equals(def.code()) && !items.isEmpty()) {
            boolean hasOp = items.stream().anyMatch(it -> it.get("工序") != null && !String.valueOf(it.get("工序")).isBlank());
            if (!hasOp) {
                Object orderQty = body.get("订单数量");
                double plan = orderQty == null ? 0 : Double.parseDouble(String.valueOf(orderQty));
                List<String> ops = jdbc.queryForList(
                        "SELECT 工序名称 FROM bs_op WHERE ISNULL([状态], N'启用') = N'启用' AND ISNULL(是否停用, 0) = 0 ORDER BY id", String.class);
                items.clear();
                for (String op : ops) {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("工序", op);
                    row.put("计划数量", plan);
                    row.put("完成数量", 0);
                    items.add(row);
                }
            }
        }

        String no = noObj == null || String.valueOf(noObj).isBlank() ? null : String.valueOf(noObj);
        if (def.isDoc()) {
            return saveDoc(def, body, items, no, user, markSaved);
        }
        return saveArchive(def, items, user);
    }

    /** 单据保存:头字段并入每行(单表式)或分别写头表/行表(头行式);无编号=新建 */
    private Map<String, Object> saveDoc(PanelRegistry.PanelDef def, Map<String, Object> head,
                                        List<Map<String, Object>> items, String no, String user, boolean markSaved) {
        boolean split = def.hasHeadTable();
        if (no == null) {
            if (items.isEmpty()) {
                // directAdd 语义:空表单 -> 建一张空白草稿单(头行式写头表,单表式写一行占位行)
                no = formNoService.next(def.prefix(), user);
                String table = split ? def.headTable() : def.lineTable();
                Map<String, Object> cols = new LinkedHashMap<>();
                cols.put(def.groupCol(), no);
                if (def.dateCol() != null && tableCols(table).contains(def.dateCol())) cols.put(def.dateCol(), LocalDate.now());
                if (!split && def.codeCol() != null) cols.put(def.codeCol(), no);
                // 空草稿也写入随表单提交的头字段(如 规格书种类):
                // 规格书按类型页签过滤列表,不带分类的新单会从当前页签列表消失,导致"新增后无法填写"
                for (Map.Entry<String, Object> e : labelsToCols(def.fieldsAt("header"), head).entrySet()) {
                    if (!e.getKey().equals(def.groupCol())) cols.put(e.getKey(), e.getValue());
                }
                insertRow(table, cols, user);
                markDocSaved(def.code(), no, false);
                return result(no, "草稿");
            }
            no = formNoService.next(def.prefix(), user);
        }
        // 已审核/审批中/已中止单据不允许保存(照搬 light-mes:仅草稿可改)
        Map<String, Object> st = docStatusOf(def.code(), no);
        if ("已审核".equals(st.get("status"))) throw new IllegalStateException("已审核单据不可保存，请先弃审");
        if ("审批中".equals(st.get("status"))) throw new IllegalStateException("审批中单据不可保存，请等待审批完成或驳回");
        if ("已中止".equals(st.get("status"))) throw new IllegalStateException("已中止单据不可保存，请先恢复");

        Map<String, String> l2c = def.labelToCol();
        if (split) {
            upsertHeadRow(def, head, no, user);
            upsertLineRows(def, items, no, l2c, user);
        } else {
            // 单表式:头字段并入每行
            for (Map<String, Object> item : items) {
                Map<String, Object> merged = new LinkedHashMap<>(head);
                merged.putAll(item);
                item.putAll(merged);
            }
            upsertLineRows(def, items, no, l2c, user);
        }
        // 文件类面板:管理员保存即归档;普通用户保存即提交审批(管理员审批通过后归档);修改态保存不归档走再审批
        if (DOC_ARCHIVE_PANELS.contains(def.code()) && !"Y".equals(modifyStateOf(def.code(), no))) {
            if (isAdminUser(user)) {
                markArchived(def.code(), no);
            } else {
                // 普通用户:保存→自动提交审批(pending='Y'),管理员审批通过后再归档
                jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                                + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                                + "WHEN MATCHED THEN UPDATE SET pending = 'Y', pending_by = ?, pending_at = GETDATE(), update_at = GETDATE() "
                                + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, pending, pending_by, pending_at, update_at) "
                                + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                        def.code(), no, user, user);
                recordApproval(def.code(), no, "SUBMIT", "PENDING", "");
            }
        }
        // 修改态保存:实时刷新修改记录 diff(快照 vs 当前),修改记录随时可见已改内容
        if (DOC_ARCHIVE_PANELS.contains(def.code()) && "Y".equals(modifyStateOf(def.code(), no))) refreshModifyDiff(def, no);
        // 文档编号唯一性(实施计划单号等):不允许与其他单据重复
        if (DOC_NO_PANELS.contains(def.code())) ensureDocNoUnique(def, head, no);
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    /** 文档编号不允许重复:同面板其它单据占用即拒绝(空值跳过) */
    private void ensureDocNoUnique(PanelRegistry.PanelDef def, Map<String, Object> head, String no) {
        Object v = head.get("文档编号");
        if (v == null || String.valueOf(v).isBlank()) return;
        String docNo = String.valueOf(v);
        Integer dup;
        if (no == null || no.isBlank()) {
            dup = jdbc.queryForObject("SELECT COUNT(*) FROM " + def.headTable() + " WHERE [文档编号] = ?",
                    Integer.class, docNo);
        } else {
            dup = jdbc.queryForObject("SELECT COUNT(*) FROM " + def.headTable()
                    + " WHERE [文档编号] = ? AND [" + def.groupCol() + "] <> ?", Integer.class, docNo, no);
        }
        if (dup != null && dup > 0) throw new IllegalArgumentException("文档编号不允许重复：" + docNo);
    }

    /** 归档标记:yj_doc_status.archived='Y'(已归档优先级:已作废>已中止>已审核>审批中>已归档>草稿);
     *  archived_at 仅首次归档写入(CASE 保首次),修改后再归档不覆盖——查询单据的时间区间口径 */
    private void markArchived(String panelCode, String no) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                + "WHEN MATCHED THEN UPDATE SET archived = 'Y', pending = 'N', canceled = 'N', "
                + "archived_at = CASE WHEN t.archived_at IS NULL THEN GETDATE() ELSE t.archived_at END, update_at = GETDATE() "
                + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, archived, pending, canceled, archived_at, update_at) "
                + "VALUES (s.panel_code, s.doc_no, 'Y', 'N', 'N', GETDATE(), GETDATE());", panelCode, no);
    }

    /** 行表 upsert:有 id 更新,无 id 插入(回填自增 id),缺席行软删(asp_cancel='Y') */
    private void upsertLineRows(PanelRegistry.PanelDef def, List<Map<String, Object>> items,
                                String no, Map<String, String> l2c, String user) {
        Set<Object> liveIds = new HashSet<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            Map<String, Object> cols = labelsToCols(def.fields(), item);
            cols.put(def.groupCol(), no);
            if (id != null && !String.valueOf(id).isBlank()) {
                liveIds.add(id);
                updateRow(def.lineTable(), def.pkCol(), id, cols, user);
            } else {
                Object newId = insertRow(def.lineTable(), cols, user);
                if (newId != null) liveIds.add(newId);
            }
        }
        // 缺席行软删:本单中不在 liveIds 的存活行 -> asp_cancel='Y'
        softDeleteMissing(def.lineTable(), def.groupCol(), no, def.pkCol(), liveIds, user);
    }

    /** 把 group 下不在 keepIds 的存活行软删 */
    private void softDeleteMissing(String table, String groupCol, String groupVal, String pk,
                                   Set<Object> keepIds, String user) {
        StringBuilder sql = new StringBuilder("UPDATE " + table + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                + " WHERE " + groupCol + " = ? AND ISNULL(asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>(List.of(user, groupVal));
        if (!keepIds.isEmpty()) {
            sql.append(" AND ").append(pk).append(" NOT IN (")
                    .append(String.join(",", keepIds.stream().map(x -> "?").toList())).append(")");
            args.addAll(keepIds);
        }
        jdbc.update(sql.toString(), args.toArray());
    }

    /** 头表 upsert(头行式):按 group_col 定位 */
    private void upsertHeadRow(PanelRegistry.PanelDef def, Map<String, Object> head, String no, String user) {
        List<PanelRegistry.FieldDef> fields = def.fieldsAt("header");
        Map<String, Object> cols = labelsToCols(fields, head);
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.headTable() + " WHERE " + def.groupCol() + " = ?",
                Integer.class, no);
        if (existing != null && existing > 0) {
            updateRow(def.headTable(), "id", null, cols, user, def.groupCol(), no);
        } else {
            cols.put(def.groupCol(), no);
            insertRow(def.headTable(), cols, user);
        }
    }

    /** 档案保存:整份明细 upsert(插入回填自增 id),缺席行软删 */
    private Map<String, Object> saveArchive(PanelRegistry.PanelDef def, List<Map<String, Object>> items, String user) {
        Set<Object> liveIds = new HashSet<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            Map<String, Object> cols = labelsToCols(def.fields(), item);
            if (id != null && !String.valueOf(id).isBlank()) {
                liveIds.add(id);
                updateRow(def.lineTable(), def.pkCol(), id, cols, user);
            } else {
                Object newId = insertRow(def.lineTable(), cols, user);
                if (newId != null) liveIds.add(newId);
            }
        }
        // 档案缺席行 = 已删除 -> 全表软删不在 keepIds 的存活行(全部缺席时不清理,防止误清整档)
        if (!liveIds.isEmpty()) {
            StringBuilder sql = new StringBuilder("UPDATE " + def.lineTable()
                    + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE ISNULL(asp_cancel,'N')<>'Y'");
            List<Object> args = new ArrayList<>(List.of(user));
            sql.append(" AND ").append(def.pkCol()).append(" NOT IN (")
                    .append(String.join(",", liveIds.stream().map(x -> "?").toList())).append(")");
            args.addAll(liveIds);
            jdbc.update(sql.toString(), args.toArray());
        }
        return result(def.name(), "启用");
    }

    /** 标签键 -> 列名键(仅取字段定义内的列,忽略 id/__no 等保留键)。
     *  归一化后为 null(空串)的值同样跳过——否则 NOT NULL 列(如 币种)会被显式插 NULL 报错,
     *  交由 fillRequiredDefaults 补默认值。 */
    private Map<String, Object> labelsToCols(List<PanelRegistry.FieldDef> fields, Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (PanelRegistry.FieldDef f : fields) {
            Object v = row.get(f.label());
            if (v != null) {
                Object normalized = normalizeByType(f, v);
                if (normalized != null) out.put(f.col(), normalized);
            }
        }
        return out;
    }

    private static final java.util.regex.Pattern ISO_DATETIME =
            java.util.regex.Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})(?:[T ](\\d{2}:\\d{2})(?::(\\d{2}))?)?");

    /**
     * 写入值规范化:
     * - 空串 -> null
     * - 日期/日期时间字段:界面回传的 Jackson ISO-8601(2026-08-26T00:00:00.000+08:00)
     *   转为 SQL Server 可解析的 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    private Object normalizeByType(PanelRegistry.FieldDef f, Object v) {
        if (!(v instanceof String s)) return v;
        if (s.isBlank()) return null;
        String type = f.dataType() == null ? "" : f.dataType();
        if (type.contains("日期")) {
            java.util.regex.Matcher m = ISO_DATETIME.matcher(s);
            if (m.find()) {
                if (type.contains("时间") && m.group(2) != null) {
                    return m.group(1) + " " + m.group(2) + (m.group(3) != null ? ":" + m.group(3) : ":00");
                }
                return m.group(1);
            }
        }
        return s;
    }

    /** 插入并返回自增主键(无主键时返回 null) */
    private Object insertRow(String table, Map<String, Object> cols, String user) {
        if (cols.isEmpty()) return null;
        fillRequiredDefaults(table, cols);
        cols.put("asp_user1", user);
        cols.put("asp_time1", LocalDateTime.now());
        // 列名含特殊字符(%、.等)必须方括号包裹
        String names = String.join(",", cols.keySet().stream().map(c -> "[" + c + "]").toList());
        String marks = String.join(",", cols.values().stream().map(x -> "?").toList());
        String sql = "INSERT INTO " + table + " (" + names + ") VALUES (" + marks + ")";
        Object[] args = cols.values().toArray();
        org.springframework.jdbc.support.GeneratedKeyHolder kh = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            java.sql.PreparedStatement ps = con.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps;
        }, kh);
        if (!kh.getKeyList().isEmpty() && kh.getKeyList().get(0) != null) {
            for (Object v : kh.getKeyList().get(0).values()) {
                if (v instanceof Number) return v;
            }
        }
        return null;
    }

    private final Map<String, List<String[]>> requiredColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    private final Map<String, Set<String>> tableColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** 表物理列集合(缺表/异常返回空集):元数据引用了物理表没有的列时跳过该列,避免 INSERT/UPDATE 报 207 */
    private Set<String> tableCols(String table) {
        return tableColsCache.computeIfAbsent(table, t -> {
            try {
                Set<String> s = new HashSet<>();
                jdbc.query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(?)",
                        rs -> { s.add(rs.getString(1)); }, t);
                return s;
            } catch (Exception e) {
                return Set.of();
            }
        });
    }

    /** 补齐无默认值的 NOT NULL 列(排除 IDENTITY):comm->'0',字符->'',数值->0 —— 与旧系统写入习惯一致 */
    private void fillRequiredDefaults(String table, Map<String, Object> cols) {
        List<String[]> required = requiredColsCache.computeIfAbsent(table, t -> {
            try {
                return jdbc.query(
                        "SELECT c.name, ty.name FROM sys.columns c JOIN sys.types ty ON c.user_type_id = ty.user_type_id"
                                + " WHERE c.object_id = OBJECT_ID(?) AND c.is_nullable = 0 AND c.is_identity = 0"
                                + " AND NOT EXISTS (SELECT 1 FROM sys.default_constraints dc"
                                + " WHERE dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id)",
                        (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, table);
            } catch (Exception e) {
                return List.of();
            }
        });
        for (String[] col : required) {
            if (cols.containsKey(col[0])) continue;
            String type = col[1] == null ? "" : col[1];
            Object dv = "comm".equals(col[0]) ? "0"
                    : type.contains("char") ? ""
                    : (type.contains("int") || type.contains("decimal") || type.contains("numeric")
                    || type.contains("float") || type.contains("money") || type.contains("bit")) ? 0
                    : null;
            if (dv != null) cols.put(col[0], dv);
        }
    }

    private void updateRow(String table, String pk, Object id, Map<String, Object> cols, String user) {
        updateRow(table, pk, id, cols, user, null, null);
    }

    private void updateRow(String table, String pk, Object id, Map<String, Object> cols, String user,
                           String groupCol, String groupVal) {
        if (cols.isEmpty()) return;
        dropNullsOnNotNull(table, cols);
        if (cols.isEmpty()) return;
        cols.put("asp_user2", user);
        cols.put("asp_time2", LocalDateTime.now());
        StringBuilder set = new StringBuilder();
        List<Object> args = new ArrayList<>();
        for (Map.Entry<String, Object> e : cols.entrySet()) {
            if (set.length() > 0) set.append(", ");
            set.append("[").append(e.getKey()).append("] = ?");
            args.add(e.getValue());
        }
        StringBuilder where = new StringBuilder();
        if (id != null) {
            where.append("[").append(pk).append("] = ?");
            args.add(id);
        } else if (groupCol != null) {
            where.append("[").append(groupCol).append("] = ?");
            args.add(groupVal);
        }
        jdbc.update("UPDATE " + table + " SET " + set + " WHERE " + where, args.toArray());
    }

    private final Map<String, java.util.Set<String>> notNullColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** UPDATE 清洗:NOT NULL 列收到 null 值时剔除该列(保留库中原值),避免"列不允许有 Null 值"更新失败。
     *  可空列的 null 是合法的"清空"语义,不受影响。对全部单据/档案面板的更新路径统一生效。 */
    private void dropNullsOnNotNull(String table, Map<String, Object> cols) {
        java.util.Set<String> notNull = notNullColsCache.computeIfAbsent(table, t -> {
            try {
                java.util.Set<String> s = new java.util.HashSet<>();
                jdbc.query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(?) AND is_nullable = 0",
                        rs -> { s.add(rs.getString(1)); }, t);
                return s;
            } catch (Exception e) {
                return java.util.Set.of();
            }
        });
        if (notNull.isEmpty()) return;
        cols.keySet().removeIf(k -> cols.get(k) == null && notNull.contains(k));
    }

    /** 标记草稿的保存阶段:saved='Y' 已保存(未审核) / 'N' 临时草稿(新增未保存/保存为草稿) */
    private void markDocSaved(String panelCode, String no, boolean saved) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET saved = ?, update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, saved, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, ?, GETDATE());",
                panelCode, no, saved ? "Y" : "N", saved ? "Y" : "N");
    }

    // ============ 状态机(照搬 light-mes:草稿⇄已审核 + 审批流) ============

    private Map<String, Object> audit(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!def.isDoc()) throw new IllegalStateException("档案面板无审核动作");
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if ("已作废".equals(st.get("status"))) throw new IllegalStateException("已作废单据不可审核");
        if ("已中止".equals(st.get("status"))) throw new IllegalStateException("已中止单据不可审核，请先恢复");
        if ("已审核".equals(st.get("status"))) throw new IllegalStateException("单据已是已审核状态");
        if ("审批中".equals(st.get("status"))) throw new IllegalStateException("审批中单据不可直接审核，请走审批流");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET shr = ?, shsj = GETDATE(), canceled = 'N', pending = 'N', saved = 'Y', update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, saved, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, ?, GETDATE(), 'N', 'N', 'Y', GETDATE());",
                def.code(), no, currentUserName(), currentUserName());
        // 库存记账(材料入库链):采购入库单审核 → kucun 入账(失败抛错整笔回滚)
        stockLedger.postIn(def.code(), no, currentUserName());
        // 工序报工记账(生产过程层):报工单审核 → wo_progress.完成数量 累计
        woReport.post(def.code(), no, currentUserName());
        // 不良品处理记账(品质层):处理单审核 → 原仓扣减+目标仓(隔离/不良品)移仓或报废
        qcDisposal.post(def.code(), no, currentUserName());
        // 文件类面板:修改态经审核收尾 → 计算修改记录并再归档
        if (DOC_ARCHIVE_PANELS.contains(def.code()) && finalizeModify(def, no, currentUserName())) {
            return result(no, "已归档");
        }
        return result(no, "已审核");
    }

    private Map<String, Object> unaudit(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status) && !"已归档".equals(status)) throw new IllegalStateException("仅已审核或已归档状态可弃审");
        // 库存冲回(材料入库链):先冲账再弃审,余额不足或台账缺失则拒绝,整笔回滚
        stockLedger.unpostIn(def.code(), no, currentUserName());
        // 报工冲回(生产过程层):完成数量对称扣减,为负则拒绝
        woReport.unpost(def.code(), no, currentUserName());
        // 不良品处理冲回(品质层):移仓/报废对称冲回,目标仓被消耗则拒绝
        qcDisposal.unpost(def.code(), no, currentUserName());
        // 弃审同时清归档标记(文件面板审批后=已归档,弃审应回到草稿)
        jdbc.update("UPDATE yj_doc_status SET shr = NULL, shsj = NULL, archived = NULL, update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        recordApproval(def.code(), no, "UNAUDIT", "PENDING", opinionOf(formData));
        return result(no, "草稿");
    }

    // ---- 中止(对齐 PANDA/T+ 整单中止、生产加工单中止执行):仅已审核可中止,恢复保留原审核留痕 ----

    /** 中止:已审核 → 已中止(留痕 stop_by/stop_at;shr 保留,取消中止后回到已审核) */
    private Map<String, Object> stop(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        String status = String.valueOf(st.get("status"));
        if ("已作废".equals(status)) throw new IllegalStateException("已作废单据不可中止");
        if ("已中止".equals(status)) throw new IllegalStateException("单据已是已中止状态");
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核状态可中止");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET stopped = 'Y', stop_by = ?, stop_at = GETDATE(), update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, stopped, stop_by, stop_at, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                def.code(), no, currentUserName(), currentUserName());
        recordApproval(def.code(), no, "STOP", "STOPPED", opinionOf(formData));
        return result(no, "已中止");
    }

    /** 取消中止(生产加工单「草稿」按钮):已中止 → 恢复(shr 保留则已审核,否则草稿) */
    private Map<String, Object> unstop(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"已中止".equals(st.get("status"))) throw new IllegalStateException("仅已中止状态可恢复");
        jdbc.update("UPDATE yj_doc_status SET stopped = 'N', stop_by = NULL, stop_at = NULL, update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        recordApproval(def.code(), no, "UNSTOP", "UNSTOPPED", opinionOf(formData));
        Map<String, Object> after = docStatusOf(def.code(), no);
        return result(no, String.valueOf(after.get("status")));
    }

    // ---- 审批流(照搬 light-mes PxService):提交/通过/驳回全留痕,防伪校验 ----

    /** 提交审批:仅草稿 → 审批中 */
    private Map<String, Object> submitApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        // 修改态(文件类:申请修改经管理员审批通过)同样可提交审批,通过后 finalizeModify 再归档
        if (!"草稿".equals(st.get("status")) && !"修改中".equals(st.get("status")))
            throw new IllegalStateException("仅草稿或修改中状态可提交审批");
        String operator = currentUserName();
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET pending = 'Y', pending_by = ?, pending_at = GETDATE(), shr = NULL, shsj = NULL, canceled = 'N', update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, pending, pending_by, pending_at, canceled, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), 'N', GETDATE());",
                def.code(), no, operator, operator);
        recordApproval(def.code(), no, "SUBMIT", "PENDING", opinionOf(formData));
        // 消息:提交审批 → 该面板审批人
        notify(() -> messageService.sendToApprovers(def.code(), MessageService.APPROVAL_SUBMITTED, no,
                Map.of("docNo", no, "actor", operator), operator));
        return result(no, "审批中");
    }

    /** 审批通过:仅审批中 → 已审核(需管理员/审批权限;审核人=当前登录人) */
    private Map<String, Object> approveApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"审批中".equals(st.get("status"))) throw new IllegalStateException("仅审批中状态可审批通过");
        requirePendingSubmission(def.code(), no);
        requireApprover(def.code());
        String operator = currentUserName();
        String opinion = opinionOf(formData);
        jdbc.update("UPDATE yj_doc_status SET pending = 'N', shr = ?, shsj = GETDATE(), update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", operator, def.code(), no);
        recordApproval(def.code(), no, "APPROVE", "APPROVED", opinion);
        // 消息:审批通过 → 制单人
        notify(() -> messageService.sendToAuthor(def.hasHeadTable() ? def.headTable() : def.lineTable(),
                def.code(), no, MessageService.APPROVAL_APPROVED,
                Map.of("docNo", no, "actor", operator, "opinion", opinion == null ? "" : opinion), operator));
        // 文件类面板:审批通过后归档(修改态走 finalizeModify 含修改记录;普通用户保存提交的走 markArchived)
        if (DOC_ARCHIVE_PANELS.contains(def.code())) {
            finalizeModify(def, no, operator);
            markArchived(def.code(), no);
            return result(no, "已归档");
        }
        return result(no, "已审核");
    }

    /** 审批驳回:仅审批中 → 草稿(意见必填,驳回后修改可重新提交) */
    private Map<String, Object> rejectApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"审批中".equals(st.get("status"))) throw new IllegalStateException("仅审批中状态可审批驳回");
        requirePendingSubmission(def.code(), no);
        requireApprover(def.code());
        String opinion = opinionOf(formData);
        if (opinion.isEmpty()) throw new IllegalStateException("审批驳回必须填写审批意见");
        jdbc.update("UPDATE yj_doc_status SET pending = 'N', update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        recordApproval(def.code(), no, "REJECT", "REJECTED", opinion);
        // 消息:审批驳回 → 制单人(驳回意见随消息带上)
        String rejectBy = currentUserName();
        notify(() -> messageService.sendToAuthor(def.hasHeadTable() ? def.headTable() : def.lineTable(),
                def.code(), no, MessageService.APPROVAL_REJECTED,
                Map.of("docNo", no, "actor", rejectBy, "opinion", opinion), rejectBy));
        return result(no, "草稿");
    }

    /** 审批情况:返回该单据全部审批记录(时间升序) */
    private Map<String, Object> approvalHistory(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("list", queryApprovalHistory(def.code(), no));
        return out;
    }

    /** 审批通过/驳回必须紧跟一次有效提交,防止仅改状态后伪造审批结果(light-mes requirePendingSubmission) */
    private void requirePendingSubmission(String panelCode, String formNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 action, result FROM yj_form_approval WHERE panel_code = ? AND form_no = ? ORDER BY id DESC",
                panelCode, formNo);
        if (rows.isEmpty() || !"SUBMIT".equals(rows.get(0).get("action"))
                || !"PENDING".equals(rows.get(0).get("result"))) {
            throw new IllegalStateException("单据尚未提交审批，不能审批通过或驳回");
        }
    }

    /** 审批权限:管理员,或角色对该面板勾了审批(yj_role_panel.can_approve='Y') */
    private void requireApprover(String panelCode) {
        if (!canApprove(currentUserName(), panelCode))
            throw new org.springframework.security.access.AccessDeniedException("当前用户无审批权限");
    }

    /** 审批判定:管理员恒可;普通用户按角色面板审批权(can_approve) */
    private boolean canApprove(String user, String panelCode) {
        if (isAdminUser(user)) return true;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE u.username = ? AND rp.panel_code = ? AND rp.can_approve = 'Y'",
                Integer.class, user, panelCode);
        return n != null && n > 0;
    }

    private void recordApproval(String panelCode, String formNo, String action, String result, String opinion) {
        jdbc.update("INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time) "
                        + "VALUES (?,?,?,?,1,?,?,SYSDATETIME())",
                panelCode, formNo, action, result, currentUserName(),
                opinion == null || opinion.isEmpty() ? null : opinion);
    }

    private String opinionOf(Map<String, Object> formData) {
        Object v = formData == null ? null : formData.get("审批意见");
        return v == null ? "" : String.valueOf(v).trim();
    }

    public List<Map<String, Object>> queryApprovalHistory(String panelCode, String formNo) {
        return jdbc.query("SELECT action, result, node_no, operator, opinion, create_time FROM yj_form_approval"
                        + " WHERE panel_code = ? AND form_no = ? ORDER BY id ASC",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("action", rs.getString("action"));
                    m.put("result", rs.getString("result"));
                    m.put("operator", rs.getString("operator"));
                    m.put("opinion", rs.getString("opinion"));
                    m.put("nodeNo", rs.getInt("node_no"));
                    m.put("createTime", rs.getTimestamp("create_time") == null ? ""
                            : rs.getTimestamp("create_time").toLocalDateTime()
                            .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                    return m;
                }, panelCode, formNo);
    }

    /** 删除:单据=作废(仅草稿可删,对齐 light-mes);档案=当前行软删 */
    private Map<String, Object> delete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (def.isDoc()) {
            String no = requireNo(formData);
            Map<String, Object> st = docStatusOf(def.code(), no);
            if (!"草稿".equals(st.get("status"))) throw new IllegalStateException("仅草稿状态可删除（已审核请先弃审）");
            return voidDoc(def, no, user);
        }
        Object no = formData.get("编号");
        if (no != null && !String.valueOf(no).isBlank()) {
            jdbc.update("UPDATE " + def.lineTable() + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                    + " WHERE " + def.codeCol() + " = ?", user, no);
        }
        return result(String.valueOf(no), "已作废");
    }

    /** 单据作废(软删):yj_doc_status.canceled='Y' + 选单占用释放(文件类面板无流转,语义一致) */
    private Map<String, Object> voidDoc(PanelRegistry.PanelDef def, String no, String user) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                + "WHEN MATCHED THEN UPDATE SET canceled = 'Y', cancel_by = ?, cancel_at = GETDATE(), update_at = GETDATE() "
                + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, cancel_by, cancel_at, update_at) "
                + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                def.code(), no, user, user);
        jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()"
                + " WHERE target_panel_code = ? AND target_form_no = ? AND link_status = 'ACTIVE'", def.code(), no);
        return result(no, "已作废");
    }

    public void deleteForms(String panelCode, List<String> rowCodes) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        for (String code : rowCodes) {
            Map<String, Object> fd = new HashMap<>();
            fd.put("编号", code);
            delete(def, fd);
        }
    }

    /** 文件类面板删除:草稿直接作废;已归档单据需删除申请(待管理员审批),管理员可直接作废 */
    private Map<String, Object> deleteDocFile(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!def.isDoc()) return delete(def, formData);
        String no = requireNo(formData);
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if ("删除申请中".equals(st)) throw new IllegalStateException("删除申请已提交，待管理员审核");
        if ("草稿".equals(st)) return delete(def, formData);
        if (isAdminUser(user)) return voidDoc(def, no, user);
        int n = jdbc.update("UPDATE yj_doc_status SET deleting='Y', delete_req_by=?, delete_req_at=GETDATE(), update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=?", user, def.code(), no);
        if (n == 0) throw new IllegalStateException("单据不存在或状态已变更");
        // 消息:申请删除 → 管理员
        notify(() -> messageService.sendToAdmins(def.code(), no, MessageService.DELETE_REQUESTED,
                Map.of("docNo", no, "actor", user), user));
        return result(no, "删除申请中");
    }

    /** 删除申请审批通过(仅管理员):单据作废 */
    private Map<String, Object> approveDelete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的删除审批权限");
        String no = requireNo(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET canceled='Y', cancel_by=?, cancel_at=GETDATE(), deleting='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND deleting='Y'", user, def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的删除申请");
        return result(no, "已作废");
    }

    /** 删除申请驳回(仅管理员):恢复归档状态 */
    private Map<String, Object> rejectDelete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的删除审批权限");
        String no = requireNo(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET deleting='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND deleting='Y'", def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的删除申请");
        return result(no, "已归档");
    }

    // ============ 文件类面板:归档后申请修改 + 修改记录(滚动3条) ============

    /** 新增库存(库存状况):向 kucun 插一行记录;存货编码/仓库编码按基础档案校验(绑定编码,改名不影响) */
    private Map<String, Object> addStock(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"STOCK_STATUS".equals(def.code())) throw new IllegalStateException("仅库存状况面板支持新增库存");
        String user = currentUserName();
        String wzdm = requiredText(formData, "存货编码");
        String ckdm = requiredText(formData, "仓库");
        String ylRaw = requiredText(formData, "现存量");
        double yl;
        try {
            yl = Double.parseDouble(ylRaw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("现存量必须是数字");
        }
        String lot = optionalText(formData, "批号");
        String inDate = optionalText(formData, "入库日期");
        String warnRaw = optionalText(formData, "预警数量");
        Double warn = null;
        if (!warnRaw.isBlank()) {
            try {
                warn = Double.parseDouble(warnRaw);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("预警数量必须是数字");
            }
        }
        Integer inv = jdbc.queryForObject(
                "SELECT COUNT(*) FROM bs_inv WHERE [存货编码] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, wzdm);
        if (inv == null || inv == 0) throw new IllegalArgumentException("存货档案中不存在：" + wzdm);
        Integer wh = jdbc.queryForObject(
                "SELECT COUNT(*) FROM bs_wh WHERE [仓库编码] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, ckdm);
        if (wh == null || wh == 0) throw new IllegalArgumentException("仓库档案中不存在：" + ckdm);
        jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, [预警数量], asp_user1, asp_time1, asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,0,?,?,GETDATE(),'N')",
                wzdm, ckdm, lot.isBlank() ? null : lot, inDate.isBlank() ? LocalDate.now().toString() : inDate,
                yl, yl, warn, user);
        return result(wzdm + "@" + ckdm, "已新增");
    }

    /** 切炭报工(双出口):合格品按 dual_out_qty 拆分——直销部分自动入成品仓,其余转线边库存(组装) */
    private Map<String, Object> cutCarbonReport(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String orderNo = requiredText(formData, "工单号");
        double actualQty = Double.parseDouble(requiredText(formData, "完成数量"));
        String dualOutRaw = optionalText(formData, "直销数量");
        double dualOut = dualOutRaw.isBlank() ? 0 : Double.parseDouble(dualOutRaw);
        String batchNo = optionalText(formData, "批号");
        String productCode = optionalText(formData, "产品编码");
        if (dualOut > actualQty) throw new IllegalArgumentException("直销数量不能大于完成数量");
        double assemblyQty = actualQty - dualOut;

        // 1. 记录报工
        jdbc.update("INSERT INTO wo_stage_report (manu_order_no, stage, report_date, shift, worker, actual_qty, defect_qty, dual_out_qty, batch_no, asp_user1) VALUES (?,?,GETDATE(),?,?,?,?,?,?,?)",
                orderNo, "切炭", optionalText(formData, "班次"), optionalText(formData, "操作工"),
                actualQty, Double.parseDouble(optionalText(formData, "不良数量").isBlank() ? "0" : optionalText(formData, "不良数量")),
                dualOut, batchNo.isBlank() ? null : batchNo, user);

        // 2. 直销部分 → 自动入成品仓(FINISH_IN 骨架行)
        if (dualOut > 0 && !productCode.isBlank()) {
            jdbc.update("INSERT INTO wo_line_stock (manu_order_no, stage, item_code, batch_no, qty, warehouse, asp_user1) VALUES (?,?,?,?,?,?,?)",
                    orderNo, "直销入库", productCode, batchNo, dualOut, "CK03", user);
        }

        // 3. 组装部分 → 线边库存(stage=组装)
        if (assemblyQty > 0 && !productCode.isBlank()) {
            jdbc.update("INSERT INTO wo_line_stock (manu_order_no, stage, item_code, batch_no, qty, warehouse, asp_user1) VALUES (?,?,?,?,?,?,?)",
                    orderNo, "组装", productCode, batchNo, assemblyQty, "LINE", user);
        }

        String msg = "切炭报工:完成" + actualQty + ",直销" + dualOut + "(→成品仓),组装" + assemblyQty + "(→线边)";
        return result(orderNo, msg);
    }

    /** 修改预警数量(库存状况行内编辑):空值=清空行级阈值,回退全局阈值100 */
    private Map<String, Object> updateStockWarn(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"STOCK_STATUS".equals(def.code())) throw new IllegalStateException("仅库存状况面板支持修改预警数量");
        String idRaw = requiredText(formData, "id");
        int id;
        try {
            id = Integer.parseInt(idRaw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("库存行标识无效");
        }
        String v = optionalText(formData, "预警数量");
        Double warn = null;
        if (!v.isBlank()) {
            try {
                warn = Double.parseDouble(v);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("预警数量必须是数字");
            }
        }
        int n = jdbc.update("UPDATE kucun SET [预警数量] = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                warn, currentUserName(), id);
        if (n == 0) throw new IllegalStateException("库存行不存在");
        return result(String.valueOf(id), "已更新");
    }

    private String requiredText(Map<String, Object> formData, String key) {        Object v = formData == null ? null : formData.get(key);
        if (v == null || String.valueOf(v).isBlank()) throw new IllegalArgumentException("请填写" + key);
        return String.valueOf(v).trim();
    }

    private String optionalText(Map<String, Object> formData, String key) {
        Object v = formData == null ? null : formData.get(key);
        return v == null ? "" : String.valueOf(v).trim();
    }

    /** 产品开发下发(2026-09-09):仅产品信息表、仅已归档、按产品编号幂等 → 写 rd_dev_task 5 行 */
    private Map<String, Object> dispatchDev(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"RD_PROD_INFO".equals(def.code())) throw new IllegalStateException("仅产品信息表可下发产品开发");
        String user = currentUserName();
        if (!canEdit(user, def.code()))
            throw new org.springframework.security.access.AccessDeniedException("当前角色无该面板编辑权限");
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if (!"已归档".equals(st)) throw new IllegalStateException("仅已归档的产品信息表可下发产品开发");
        Map<String, Object> head = jdbc.queryForMap(
                "SELECT TOP 1 产品编号, 产品名称 FROM rd_prod_info_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        String productCode = head.get("产品编号") == null ? "" : String.valueOf(head.get("产品编号")).trim();
        String productName = head.get("产品名称") == null ? "" : String.valueOf(head.get("产品名称")).trim();
        if (productCode.isEmpty()) throw new IllegalStateException("产品信息表的「产品编号」为空,无法下发");
        Map<String, Object> out = devTaskService.dispatch(productCode, productName, no, user);
        Map<String, Object> r = result(no, Boolean.TRUE.equals(out.get("already")) ? "已下发" : "已下发");
        r.put("already", out.get("already"));
        r.put("productCode", productCode);
        r.put("panels", out.get("panels"));
        return r;
    }

    /** 编辑权:管理员恒可;普通用户角色对该面板勾了 add 或 modify */
    private boolean canEdit(String user, String panelCode) {
        if (isAdminUser(user)) return true;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT rp.perms FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE u.username = ? AND rp.panel_code = ?", user, panelCode);
        for (Map<String, Object> row : rows) {
            String perms = row.get("perms") == null ? "" : String.valueOf(row.get("perms"));
            for (String p : perms.split(",")) {
                String t = p.trim();
                if ("add".equals(t) || "modify".equals(t)) return true;
            }
        }
        return false;
    }

    /** 申请修改:已归档/已审核 → 修改申请中(待管理员审批) */
    private Map<String, Object> modifyRequest(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if (!"已归档".equals(st) && !"已审核".equals(st)) throw new IllegalStateException("仅已归档单据可申请修改");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET modify_state = 'R', modify_req_by = ?, modify_req_at = GETDATE(), update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, modify_state, modify_req_by, modify_req_at, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'R', ?, GETDATE(), GETDATE());",
                def.code(), no, user, user);
        recordApproval(def.code(), no, "MODIFY_REQ", "PENDING", opinionOf(formData));
        // 消息:申请修改 → 管理员
        notify(() -> messageService.sendToAdmins(def.code(), no, MessageService.MODIFY_REQUESTED,
                Map.of("docNo", no, "actor", user, "opinion", opinionOf(formData)), user));
        return result(no, "修改申请中");
    }

    /** 修改审批通过(仅管理员):快照入库 → 修改态(可编辑,保存不再自动归档) */
    private Map<String, Object> modifyApprove(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的修改审批权限");
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"修改申请中".equals(st.get("status"))) throw new IllegalStateException("无待审批的修改申请");
        Map<String, Object> row = st.get("row") instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
        String applyBy = row == null || row.get("modify_req_by") == null ? user : String.valueOf(row.get("modify_req_by"));
        Object applyAt = row == null ? null : row.get("modify_req_at");
        jdbc.update("INSERT INTO yj_doc_modify_log (panel_code, doc_no, apply_by, apply_at, approve_by, approve_at, snapshot_head, snapshot_rows) "
                        + "VALUES (?,?,?,?,?,?,?,?)",
                def.code(), no, applyBy, applyAt, user, LocalDateTime.now(),
                toJson(headLabelSnapshot(def, no)), toJson(rowSnapshots(def, no)));
        int n = jdbc.update("UPDATE yj_doc_status SET modify_state='Y', modify_appr_by=?, modify_appr_at=GETDATE(), archived='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND modify_state='R'", user, def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的修改申请");
        recordApproval(def.code(), no, "MODIFY_APPROVE", "MODIFYING", opinionOf(formData));
        return result(no, "修改中");
    }

    /** 修改审批驳回(仅管理员):恢复已归档 */
    private Map<String, Object> modifyReject(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的修改审批权限");
        String no = requireNo(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET modify_state=NULL, update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND modify_state='R'", def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的修改申请");
        recordApproval(def.code(), no, "MODIFY_REJECT", "ARCHIVED", opinionOf(formData));
        return result(no, "已归档");
    }

    /** 修改记录:最近3条(超出滚动覆盖最早的),供前端弹窗展示;打开即刷新未收尾记录的 diff */
    private Map<String, Object> modifyHistory(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        // 修改中/审批中随时打开可见当前已改内容(快照 vs 当前实时 diff)
        refreshModifyDiff(def, no);
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT TOP 3 apply_by, apply_at, approve_by, approve_at, rearchive_by, rearchive_at, changes, change_meta"
                        + " FROM yj_doc_modify_log WHERE panel_code=? AND doc_no=? ORDER BY id DESC", def.code(), no);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : records) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("applyBy", r.get("apply_by"));
            m.put("applyAt", fmtTime(r.get("apply_at")));
            m.put("approveBy", r.get("approve_by"));
            m.put("approveAt", fmtTime(r.get("approve_at")));
            m.put("rearchiveBy", r.get("rearchive_by"));
            m.put("rearchiveAt", fmtTime(r.get("rearchive_at")));
            m.put("changes", r.get("changes"));
            m.put("changeMeta", r.get("change_meta"));
            list.add(m);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("records", list);
        return out;
    }

    /** 刷新修改记录 diff:未收尾记录的快照 vs 当前(头字段 变化/补充/清空 + 明细行摘要);返回是否存在未收尾记录 */
    private boolean refreshModifyDiff(PanelRegistry.PanelDef def, String no) {
        List<Map<String, Object>> open = jdbc.queryForList(
                "SELECT TOP 1 id, snapshot_head, snapshot_rows FROM yj_doc_modify_log"
                        + " WHERE panel_code=? AND doc_no=? AND rearchive_by IS NULL ORDER BY id DESC", def.code(), no);
        if (open.isEmpty()) return false;
        Map<String, String> oldHead = fromJsonMap(open.get(0).get("snapshot_head"));
        Map<String, String> curHead = headLabelSnapshot(def, no);
        List<Map<String, Object>> changes = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            String oldV = oldHead.getOrDefault(f.label(), "");
            String newV = curHead.getOrDefault(f.label(), "");
            if (oldV.equals(newV)) continue;
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("label", f.label());
            c.put("kind", oldV.isEmpty() ? "补充" : (newV.isEmpty() ? "清空" : "变化"));
            c.put("old", oldV);
            c.put("new", newV);
            changes.add(c);
        }
        Map<String, Object> meta = rowDiffMeta(fromJsonList(open.get(0).get("snapshot_rows")), rowSnapshots(def, no));
        jdbc.update("UPDATE yj_doc_modify_log SET changes=?, change_meta=? WHERE id=?",
                toJson(changes), toJson(meta), open.get(0).get("id"));
        return true;
    }

    /** 再归档收尾:刷新 diff 后盖章再归档留痕,滚动保留3条;返回是否实际处于修改态并完成收尾 */
    private boolean finalizeModify(PanelRegistry.PanelDef def, String no, String user) {
        List<Map<String, Object>> stRows = jdbc.queryForList(
                "SELECT modify_state FROM yj_doc_status WHERE panel_code=? AND doc_no=?", def.code(), no);
        if (stRows.isEmpty() || !"Y".equals(stRows.get(0).get("modify_state"))) return false;
        if (refreshModifyDiff(def, no)) {
            jdbc.update("UPDATE yj_doc_modify_log SET rearchive_by=?, rearchive_at=GETDATE()"
                            + " WHERE panel_code=? AND doc_no=? AND rearchive_by IS NULL",
                    user, def.code(), no);
            // 滚动3条:删除最早的超出部分(后续修改覆盖最早记录)
            jdbc.update("DELETE FROM yj_doc_modify_log WHERE panel_code=? AND doc_no=? AND id NOT IN"
                            + " (SELECT TOP 3 id FROM yj_doc_modify_log WHERE panel_code=? AND doc_no=? ORDER BY id DESC)",
                    def.code(), no, def.code(), no);
        }
        jdbc.update("UPDATE yj_doc_status SET modify_state=NULL, archived='Y', pending='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=?", def.code(), no);
        return true;
    }

    /** 明细行变化摘要:新增/删除/修改行数 + 各取至多5个行标签样例 */
    private Map<String, Object> rowDiffMeta(List<Map<String, Object>> oldRows, List<Map<String, Object>> curRows) {
        Map<String, Map<String, Object>> oldById = new LinkedHashMap<>();
        for (Map<String, Object> r : oldRows) oldById.put(String.valueOf(r.get("id")), r);
        Map<String, Map<String, Object>> curById = new LinkedHashMap<>();
        for (Map<String, Object> r : curRows) curById.put(String.valueOf(r.get("id")), r);
        List<String> added = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        int changed = 0;
        for (Map.Entry<String, Map<String, Object>> e : curById.entrySet()) {
            Map<String, Object> old = oldById.get(e.getKey());
            if (old == null) added.add(String.valueOf(e.getValue().getOrDefault("label", e.getKey())));
            else if (!String.valueOf(old.get("hash")).equals(String.valueOf(e.getValue().get("hash")))) changed++;
        }
        for (Map.Entry<String, Map<String, Object>> e : oldById.entrySet()) {
            if (!curById.containsKey(e.getKey())) removed.add(String.valueOf(e.getValue().getOrDefault("label", e.getKey())));
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("addedRows", added.size());
        meta.put("removedRows", removed.size());
        meta.put("changedRows", changed);
        meta.put("addedSamples", added.subList(0, Math.min(5, added.size())));
        meta.put("removedSamples", removed.subList(0, Math.min(5, removed.size())));
        return meta;
    }

    private String modifyStateOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT modify_state FROM yj_doc_status WHERE panel_code=? AND doc_no=?", panelCode, no);
        return rows.isEmpty() || rows.get(0).get("modify_state") == null ? "" : String.valueOf(rows.get(0).get("modify_state"));
    }

    /** 头字段快照:头表当前行 → 标签→字符串值(去空白) */
    private Map<String, String> headLabelSnapshot(PanelRegistry.PanelDef def, String no) {
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM " + table + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y'", no);
        Map<String, String> out = new LinkedHashMap<>();
        if (rows.isEmpty()) return out;
        Map<String, Object> row = rows.get(0);
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            Object v = row.get(f.col());
            out.put(f.label(), v == null ? "" : String.valueOf(v).trim());
        }
        return out;
    }

    /** 明细行快照:行主键/指纹(全部字段值拼接)/业务标签(首个非空文本字段值) */
    private List<Map<String, Object>> rowSnapshots(PanelRegistry.PanelDef def, String no) {
        if (!def.hasHeadTable() || def.lineTable() == null || def.lineTable().equals(def.headTable())) return List.of();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM " + def.lineTable() + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY " + def.pkCol(), no);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            StringBuilder hash = new StringBuilder();
            String label = "";
            for (PanelRegistry.FieldDef f : def.fields()) {
                Object v = row.get(f.col());
                String s = v == null ? "" : String.valueOf(v);
                hash.append(f.col()).append('=').append(s).append(';');
                String colName = String.valueOf(f.col()).toLowerCase();
                if (label.isEmpty() && !s.isEmpty() && !colName.equals("id") && !colName.equals(String.valueOf(def.pkCol()).toLowerCase())) label = s;
            }
            Object id = row.get(def.pkCol()) != null ? row.get(def.pkCol()) : row.get("id");
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("hash", hash.toString());
            m.put("label", label);
            out.add(m);
        }
        return out;
    }

    private static final ObjectMapper MODIFY_JSON = new ObjectMapper();

    private String toJson(Object o) {
        try {
            return MODIFY_JSON.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException("修改记录序列化失败", e);
        }
    }

    private Map<String, String> fromJsonMap(Object json) {
        try {
            return json == null ? Map.of() : MODIFY_JSON.readValue(String.valueOf(json),
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<Map<String, Object>> fromJsonList(Object json) {
        try {
            return json == null ? List.of() : MODIFY_JSON.readValue(String.valueOf(json),
                    new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String fmtTime(Object t) {
        if (t == null) return "";
        if (t instanceof java.sql.Timestamp ts) return ts.toLocalDateTime()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        return String.valueOf(t);
    }

    private boolean isAdminUser(String user) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_admin FROM yj_user WHERE username=?", user);
        return !rows.isEmpty() && "Y".equals(String.valueOf(rows.get(0).get("is_admin")));
    }

    // ============ 工具 ============

    private String requireNo(Map<String, Object> formData) {
        Object no = formData == null ? null : formData.get("编号");
        if (no == null || String.valueOf(no).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        return String.valueOf(no);
    }

    private void ensureDocExists(PanelRegistry.PanelDef def, String no) {
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, no);
        if (c == null || c == 0) throw new IllegalArgumentException("表单数据不存在：" + no);
    }

    /** 文件类面板(文书式):保存即归档,退出草稿状态机;后续新增文件类面板在此登记(SysAdminController 权限动作集引用) */
    public static final java.util.Set<String> DOC_ARCHIVE_PANELS = java.util.Set.of(
            "RD_APPROVAL", "RD_PLAN", "RD_FILTER_EFF",
            "RD_ALKALINE", "RD_MINERAL", "RD_ANTIBACT", "RD_SCALE", "RD_RO_PROTECT", "RD_SOAK", "RD_DROP_PREC",
            "RD_SPIKE_WATER", "RD_DOM_TEST", "RD_EQUIP_USE", "RD_INSTR_USE",
            "RD_MOLD_PROC", "RD_MOLD_FORMULA", "RD_ASM_BOM", "RD_ASM_PROC", "RD_SPEC_DOC", "RD_INSP_PLAN", "RD_PROD_INFO");
    /** 文件类面板(有文档编号列):保存校验文档编号唯一(不允许重复) */
    private static final java.util.Set<String> DOC_NO_PANELS = java.util.Set.of(
            "RD_APPROVAL", "RD_PLAN", "RD_PROGRESS", "RD_FILTER_EFF",
            "RD_ALKALINE", "RD_MINERAL", "RD_ANTIBACT", "RD_SCALE", "RD_RO_PROTECT", "RD_SOAK", "RD_DROP_PREC",
            "RD_DOM_TEST", "RD_INSP_PLAN");

    /** 单据状态查询(供生单等领域动作校验来源单状态) */
    public Map<String, Object> docStatus(String panelCode, String no) {
        return docStatusOf(panelCode, no);
    }

    /** 状态推导:已作废 > 已中止 > 删除申请中 > 修改申请中 > 审批中 > 修改中 > 已归档 > 已审核 > 草稿 */
    private Map<String, Object> docStatusOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT shr, canceled, stopped, pending, pending_by, pending_at, archived, deleting, modify_state, modify_req_by, modify_req_at, modify_appr_by, modify_appr_at FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                panelCode, no);
        Map<String, Object> out = new HashMap<>();
        Map<String, Object> r = rows.isEmpty() ? null : rows.get(0);
        if (r == null) {
            out.put("status", "草稿");
        } else if ("Y".equals(r.get("canceled"))) {
            out.put("status", "已作废");
        } else if ("Y".equals(r.get("stopped"))) {
            out.put("status", "已中止");
        } else if ("Y".equals(r.get("deleting"))) {
            out.put("status", "删除申请中");
        } else if ("R".equals(r.get("modify_state"))) {
            out.put("status", "修改申请中");
        } else if ("Y".equals(r.get("pending"))) {
            out.put("status", "审批中");
        } else if ("Y".equals(r.get("modify_state"))) {
            out.put("status", "修改中");
        } else if ("Y".equals(r.get("archived"))) {
            out.put("status", "已归档");
        } else if (r.get("shr") != null) {
            out.put("status", "已审核");
        } else {
            out.put("status", "草稿");
        }
        if (r != null) out.put("row", r);
        return out;
    }

    private Map<String, Object> result(String no, String status) {
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("单据状态", status);
        return out;
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
