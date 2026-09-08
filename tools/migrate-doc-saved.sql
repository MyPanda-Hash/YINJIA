-- 迁移:yj_doc_status 增加 saved 列 — 区分「临时草稿」(N:新增未保存/保存为草稿)与「已保存未审核」(Y)
-- 语义:右边状态标签两种草稿统一显示"草稿";saved 仅作内部流转标志(审核后置 Y)
-- 幂等:COL_LENGTH 判空;已有行默认 'N'(历史草稿按临时草稿处理);可重复执行

IF COL_LENGTH('yj_doc_status', 'saved') IS NULL
    ALTER TABLE yj_doc_status ADD saved char(1) NOT NULL CONSTRAINT DF_yj_doc_status_saved DEFAULT 'N';
