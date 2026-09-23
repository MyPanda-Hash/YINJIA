// _fix-review-issues.mjs — 审查修正:assign 停用批查(消N+1) + WoPicking catch 收窄(一次性脚本)
import fs from 'node:fs';

// ① ScheduleBoardService.assign:循环外预查停用线集合
const p1 = 'backend/src/main/java/com/yinjia/mes/service/ScheduleBoardService.java';
let s = fs.readFileSync(p1, 'utf8');
const oldLoop = `        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> r : rows) {`;
const newLoop = `        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        List<String> lines = new ArrayList<>();
        // 停用产线集合一次性预查(循环内逐行查库=N+1,2026-09-23 审查修正)
        java.util.Set<String> disabled = new java.util.HashSet<>(jdbc.queryForList(
                "SELECT [生产线] FROM bs_prod_line WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(停用,0) = 1", String.class));
        for (Map<String, Object> r : rows) {`;
const oldGuard = `            // 停用产线不可再被选择(档案停用开关;下拉已过滤,此处后端兜底拦截;档案外产线不拦,兼容历史数据)
            Integer dis;
            try {
                dis = jdbc.queryForObject(
                        "SELECT CASE WHEN ISNULL(停用,0) = 1 THEN 1 ELSE 0 END FROM bs_prod_line"
                                + " WHERE [生产线] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, line);
            } catch (org.springframework.dao.EmptyResultDataAccessException e) {
                dis = null;
            }
            if (dis != null && dis == 1) { failed.add(no + ":生产线「" + line + "」已停用,不可排入(如需启用请在 基础资料→生产线 打开)"); continue; }`;
const newGuard = `            // 停用产线不可再被选择(档案停用开关;下拉已过滤,此处后端兜底拦截;档案外产线不拦,兼容历史数据)
            if (disabled.contains(line)) { failed.add(no + ":生产线「" + line + "」已停用,不可排入(如需启用请在 基础资料→生产线 打开)"); continue; }`;
if (!s.includes(oldLoop) || !s.includes(oldGuard)) { console.log('❌ ScheduleBoardService 未匹配'); process.exit(1); }
s = s.replace(oldLoop, newLoop).replace(oldGuard, newGuard);
fs.writeFileSync(p1, s, 'utf8');
console.log('✅ assign 停用批查');

// ② WoPickingHandler:catch 收窄为 EmptyResultDataAccessException
const p2 = 'backend/src/main/java/com/yinjia/mes/panel/WoPickingHandler.java';
let s2 = fs.readFileSync(p2, 'utf8');
s2 = s2.replace('} catch (Exception ignore) { }', '} catch (org.springframework.dao.EmptyResultDataAccessException ignore) { }');
fs.writeFileSync(p2, s2, 'utf8');
console.log(/EmptyResultDataAccessException ignore/.test(s2) ? '✅ catch 收窄' : '❌ 收窄失败');
