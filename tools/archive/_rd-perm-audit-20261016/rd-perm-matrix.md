# 研发管理域 角色×面板×权限词 现状(PROBE 输出,勿手改)

- 来源:http://127.0.0.1:8090/api
- 生成:2026-10-16T09:33:38.151Z

## 角色(4)

- id=1 code=admin name=管理员 isAdmin=1
- id=2 code=user name=普通用户 isAdmin=0
- id=4 code=rd_review name=研发审核 isAdmin=0
- id=5 code=rd_file_owner name=文件负责人 isAdmin=0

## 研发管理域面板(25)× 角色(4) —— 矩阵可勾词 / 库内已勾词

| 面板 | 面板名 | 矩阵词集 | 管理员 | 普通用户 | 研发审核 | 文件负责人 |
|---|---|---|---|---|---|---|
| RD_INSTR_USE | 仪器使用记录表 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_PROD_INFO | 产品信息表 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_SHARE_FILE | 共享文件库 | 通用13 | view,query | view,query | view,query | view,query |
| RD_DOM_TEST | 测试申请单 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_MINERAL | 矿化 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_PLAN | 项目实施计划 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_RO_PROTECT | RO保护 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_MOLD_FORMULA | 成型配方 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_ANTIBACT | 抑菌 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_SOAK | 浸泡安全 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_ASM_BOM | 组装BOM表 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_PROD_DOCLIST | 产品文件列表 | 通用13 | view,query,export,print | view,query,export,print | view,query,export,print | view,query,export,print |
| RD_DROP_PREC | 压降、精度 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_ASM_PROC | 组装工艺清单 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_MOLD_PROC | 成型工艺清单 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_INSP_PLAN | 出货检验计划表 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_SPEC_DOC | 规格书 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_PROGRESS | 项目进度查询 | 通用13 | —(无行) | view,query,add,export,edit,delete,print,price,review,adjust | view,query,add,export,edit,delete,print,price,review,adjust | view,query,add,export,edit,delete,print,price,review,adjust |
| RD_SPIKE_WATER | 加标水配置记录表 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_ALKALINE | 碱性 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_APPROVAL | 立项申请 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export,audit | view,query,add,modify,modlog,del,export |
| RD_EQUIP_USE | 设备使用登记表 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_CHANGE | 产品变更申请单 | 通用13 | —(无行) | view,query,add,modify,modlog,del,export,print | view,query,add,modify,modlog,del,export,print | view,query,add,modify,modlog,del,export,print |
| RD_SCALE | 阻垢性能 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |
| RD_FILTER_EFF | 功能性滤效 | 文件类9 | —(无行) | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export | view,query,add,modify,modlog,del,export |

## 面板真实按钮 → 引擎所需词(来自 getPanelConfig;未映射=放行)

### RD_INSTR_USE
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_PROD_INFO
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_SHARE_FILE
- 新增 → add|modify
- 修改 → view
- 保存 → add|modify
- 保存新增 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 删除单据 → add|modify|del
- 查找 → view
- 刷新 → view
- 打印 → (未映射=放行)
- 预览 → (未映射=放行)
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify
- 放弃 → (未映射=放行)

### RD_DOM_TEST
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_MINERAL
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_PLAN
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_RO_PROTECT
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_MOLD_FORMULA
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_ANTIBACT
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_SOAK
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_ASM_BOM
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_PROD_DOCLIST
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_DROP_PREC
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_ASM_PROC
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → add|modify|audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_MOLD_PROC
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → add|modify|audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_INSP_PLAN
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → add|modify|audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_SPEC_DOC
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → add|modify|audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_PROGRESS
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_SPIKE_WATER
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_ALKALINE
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_APPROVAL
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_EQUIP_USE
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_CHANGE
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → add|modify
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_SCALE
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

### RD_FILTER_EFF
- 新增 → add|modify
- 选单 → (未映射=放行)
- 保存 → add|modify
- 保存为草稿 → add|modify
- 删除 → add|modify|del
- 审核 → audit
- 提交审批 → audit
- 审批通过 → audit
- 审批驳回 → audit
- 审批情况 → view
- 弃审 → audit
- 生单 → (未映射=放行)
- 刷新 → view
- 复制 → add|modify
- 表格调整 → (未映射=放行)
- 表头调整 → (未映射=放行)
- 字段管理 → (未映射=放行)
- 导出 → (未映射=放行)
- 退出 → (未映射=放行)
- 新增流程 → add|modify

## 自动判定

- **矩阵通用 13 项里引擎不认的词**:edit, delete, price, review, adjust —— 勾了等于没勾(引擎只读 view/query/add/modify/modlog/del/export/print/audit/field/warn)
- **引擎需要但通用矩阵勾不到的词**:modify, del, modlog
  ⇒ 非文件类面板(通用 13 项)永远授不出「申请修改/修改记录/删除申请」,普通角色点「修改/删除」必 403。

- **库里没授权(无行/空词)**:23 处
  RD_INSTR_USE@admin/管理员 , RD_PROD_INFO@admin/管理员 , RD_DOM_TEST@admin/管理员 , RD_MINERAL@admin/管理员 , RD_PLAN@admin/管理员 , RD_RO_PROTECT@admin/管理员 , RD_MOLD_FORMULA@admin/管理员 , RD_ANTIBACT@admin/管理员 , RD_SOAK@admin/管理员 , RD_ASM_BOM@admin/管理员 , RD_DROP_PREC@admin/管理员 , RD_ASM_PROC@admin/管理员 , RD_MOLD_PROC@admin/管理员 , RD_INSP_PLAN@admin/管理员 , RD_SPEC_DOC@admin/管理员 , RD_PROGRESS@admin/管理员 , RD_SPIKE_WATER@admin/管理员 , RD_ALKALINE@admin/管理员 , RD_APPROVAL@admin/管理员 , RD_EQUIP_USE@admin/管理员 , RD_CHANGE@admin/管理员 , RD_SCALE@admin/管理员 , RD_FILTER_EFF@admin/管理员

- **库里已勾、但组织架构矩阵根本没有这一列(看不见/点不掉)**:3 处
  - RD_CHANGE@普通用户 有 [modify,modlog,del] 但矩阵勾不到
  - RD_CHANGE@研发审核 有 [modify,modlog,del] 但矩阵勾不到
  - RD_CHANGE@文件负责人 有 [modify,modlog,del] 但矩阵勾不到
