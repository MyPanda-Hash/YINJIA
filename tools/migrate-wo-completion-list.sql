/*
  完工明细：生产执行下的独立 flat 列表，不是生产工单弹窗。
  已核实 PanelRegistry 不加载 query_sql/where，QueryService.queryFlat 仅固定过滤
  asp_cancel 并追加请求条件；故使用 scjl 的只读过滤视图，不复制生产事实、不改源码。
  视图 DISTINCT 包含原始唯一 id：保持一行一报工，同时禁止通过该视图 INSERT/UPDATE/DELETE。
  sl 是完成数量（不是直销数量）；产品/产线/人员/时间均取报工事实快照，不联表改写。
  依赖 migrate-scjl-single-table.sql、migrate-scjl-wo-line-20261015.sql 已应用。
  两账套通过 DbSync 执行；不修改 scjl 原有结构与事实数据。
  幂等范围：仅本视图、本面板字段、本面板角色权限；已有全局人工译名不覆盖。
  部署入口：/panelx/list/WO_COMPLETION_LIST；菜单接入由调用方另行处理。
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;
IF OBJECT_ID(N'dbo.scjl', N'U') IS NULL
   OR NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = 'WO_REPORT_LIST')
    THROW 51000, N'缺少 scjl 或 WO_REPORT_LIST，请先应用报工基础迁移。', 1;
IF EXISTS (
    SELECT 1 FROM (VALUES (N'id'),(N'asp_cancel'),(N'wgzt'),(N'报工单号'),(N'gldh'),
      (N'工单行号'),(N'批次号'),(N'gxdm'),(N'sl'),(N'jldw'),(N'wzdm'),(N'mc'),
      (N'gg'),(N'scx'),(N'ywman'),(N'wgsj'),(N'jc_no'),(N'post_no')) c(col)
    WHERE COL_LENGTH(N'dbo.scjl', c.col) IS NULL)
    THROW 51000, N'scjl 缺少必需列，请先完成现有报工迁移；本脚本不修改源表。', 1;
IF OBJECT_ID(N'dbo.v_wo_completion_detail') IS NOT NULL
   AND OBJECT_ID(N'dbo.v_wo_completion_detail', N'V') IS NULL
    THROW 51000, N'目标视图名称已被其他对象占用。', 1;
IF EXISTS (SELECT id FROM dbo.scjl GROUP BY id HAVING COUNT(*) > 1)
    THROW 51000, N'scjl.id 不唯一，不能建立一行一事实的完工列表。', 1;

BEGIN TRY
    BEGIN TRANSACTION;
    EXEC(N'CREATE OR ALTER VIEW dbo.v_wo_completion_detail AS
      SELECT DISTINCT s.id, s.asp_cancel, s.wgzt,
        s.[报工单号], s.gldh, s.[工单行号], s.[批次号], s.gxdm,
        s.sl, s.jldw, s.wzdm, s.mc, s.gg, s.scx, s.ywman, s.wgsj, s.jc_no, s.post_no
      FROM dbo.scjl s
      WHERE RTRIM(s.wgzt) = N''Y'' AND ISNULL(s.asp_cancel, N''N'') <> N''Y'';');

    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class=1 AND major_id=OBJECT_ID(N'dbo.v_wo_completion_detail')
                 AND minor_id=0 AND name=N'MS_Description')
        EXEC sys.sp_updateextendedproperty N'MS_Description',
          N'完工明细只读视图：生产记录已完工且未作废；不复制生产事实，原报工ID唯一。',
          N'SCHEMA', N'dbo', N'VIEW', N'v_wo_completion_detail';
    ELSE
        EXEC sys.sp_addextendedproperty N'MS_Description',
          N'完工明细只读视图：生产记录已完工且未作废；不复制生产事实，原报工ID唯一。',
          N'SCHEMA', N'dbo', N'VIEW', N'v_wo_completion_detail';

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code='WO_COMPLETION_LIST')
        INSERT INTO dbo.yj_panel
          (panel_code,panel_name,category,mode,line_table,pk_col,page_size,detail_key,module_group)
        VALUES ('WO_COMPLETION_LIST',N'完工明细',N'生产执行','flat',
          N'v_wo_completion_detail',N'id',100,N'items',N'生产制造');
    UPDATE dbo.yj_panel SET panel_name=N'完工明细', panel_name_en=N'Completion Details',
      category=N'生产执行', mode='flat', line_table=N'v_wo_completion_detail',
      head_table=NULL, group_col=NULL, pk_col=N'id', code_col=NULL, prefix=NULL,
      date_col=NULL, page_size=100, detail_key=N'items', module_group=N'生产制造',
      config=NULL, config_at=NULL
    WHERE panel_code='WO_COMPLETION_LIST';
    IF @@ROWCOUNT <> 1 THROW 51000, N'目标面板行数异常。', 1;

    DECLARE @fields TABLE (
      col sysname PRIMARY KEY, label nvarchar(60), dtype nvarchar(20),
      seq int, width int, en nvarchar(200), ja nvarchar(200));
    INSERT INTO @fields VALUES
      (N'报工单号',N'报工单号',N'文本',10,160,N'Report Number',N'作業報告番号'),
      (N'gldh',N'工单号',N'文本',20,160,N'Work Order Number',N'製造指図番号'),
      (N'工单行号',N'工单行号',N'整数',30,100,N'Work Order Line',N'製造指図行番号'),
      (N'批次号',N'批次号',N'文本',40,130,N'Batch Number',N'バッチ番号'),
      (N'gxdm',N'工序',N'文本',50,110,N'Process',N'工程'),
      (N'sl',N'完成数量',N'数值',60,120,N'Completed Quantity',N'完了数量'),
      (N'jldw',N'单位',N'文本',70,80,N'Unit',N'単位'),
      (N'wzdm',N'产品编码',N'文本',80,150,N'Product Code',N'製品コード'),
      (N'mc',N'产品名称',N'文本',90,180,N'Product Name',N'製品名'),
      (N'gg',N'规格型号',N'文本',100,180,N'Specification',N'規格・型式'),
      (N'scx',N'生产线',N'文本',110,130,N'Production Line',N'生産ライン'),
      (N'ywman',N'报工人',N'文本',120,110,N'Reported By',N'作業報告者'),
      (N'wgsj',N'完工时间',N'日期时间',130,180,N'Completion Time',N'完了日時'),
      (N'jc_no',N'产成品流水号',N'文本',140,180,N'Finished Goods Serial Number',N'完成品連番'),
      (N'post_no',N'入库单号',N'文本',150,160,N'Receipt Number',N'入庫伝票番号');

    -- 视图关键列中文注明（幂等）；源表结构与扩展属性均不改。
    DECLARE @comments TABLE (col sysname, description nvarchar(200));
    INSERT INTO @comments SELECT col,label FROM @fields;
    INSERT INTO @comments VALUES (N'id',N'原始报工记录主键'),
      (N'asp_cancel',N'源报工记录作废标志'),(N'wgzt',N'源报工记录完工状态，本视图仅保留Y');
    DECLARE @col sysname, @description nvarchar(200);
    DECLARE comment_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT col,description FROM @comments;
    OPEN comment_cursor;
    FETCH NEXT FROM comment_cursor INTO @col,@description;
    WHILE @@FETCH_STATUS=0
    BEGIN
      IF EXISTS (SELECT 1 FROM sys.extended_properties
          WHERE class=1 AND major_id=OBJECT_ID(N'dbo.v_wo_completion_detail')
            AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.v_wo_completion_detail'),@col,'ColumnId')
            AND name=N'MS_Description')
        EXEC sys.sp_updateextendedproperty N'MS_Description',@description,
          N'SCHEMA',N'dbo',N'VIEW',N'v_wo_completion_detail',N'COLUMN',@col;
      ELSE
        EXEC sys.sp_addextendedproperty N'MS_Description',@description,
          N'SCHEMA',N'dbo',N'VIEW',N'v_wo_completion_detail',N'COLUMN',@col;
      FETCH NEXT FROM comment_cursor INTO @col,@description;
    END
    CLOSE comment_cursor;
    DEALLOCATE comment_cursor;

    -- 仅重建本面板字段，不触及 WO_REPORT/WO_REPORT_LIST 及其他字段。
    DELETE FROM dbo.yj_field WHERE panel_code='WO_COMPLETION_LIST';
    INSERT INTO dbo.yj_field
      (panel_code,col_name,label,label_en,data_type,place,seq,width,editable,required,hidden,visible)
    SELECT 'WO_COMPLETION_LIST',col,label,en,dtype,'query,detail',seq,width,0,0,0,1 FROM @fields;
    IF @@ROWCOUNT <> 15 THROW 51000, N'完工明细应登记15个只读查询/明细字段。', 1;

    DECLARE @tr TABLE (scope varchar(20), ref_key nvarchar(200), locale varchar(10), text nvarchar(200));
    INSERT INTO @tr VALUES
      ('panel',N'完工明细','en',N'Completion Details'),
      ('panel',N'完工明细','ja',N'完了明細');
    INSERT INTO @tr SELECT 'field',label,'en',en FROM @fields
      UNION ALL SELECT 'field',label,'ja',ja FROM @fields;
    INSERT INTO dbo.yj_translation (scope,ref_key,locale,text,source)
    SELECT t.scope,t.ref_key,t.locale,t.text,'manual' FROM @tr t
    WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
      WHERE x.scope=t.scope AND x.ref_key=t.ref_key AND x.locale=t.locale);

    -- 等价可见角色补授：精确CSV词匹配，不能用 LIKE '%view%' 误认其他词。
    -- 通用面板 export 同时控制导出/打印；print 是其他页面专用词，这里无需扩授。
    -- 已有目标行也强制收敛到只读动作，杜绝历史/误配置写权限和审批权限。
    INSERT INTO dbo.yj_role_panel (role_id,panel_code,perms,can_approve)
    SELECT r.id,'WO_COMPLETION_LIST',
      CASE WHEN r.is_admin='Y' OR EXISTS (SELECT 1 FROM dbo.yj_role_panel s
        WHERE s.role_id=r.id AND s.panel_code='WO_REPORT_LIST'
          AND ','+REPLACE(ISNULL(s.perms,''),' ','')+',' LIKE '%,export,%')
      THEN 'view,query,export' ELSE 'view,query' END,'N'
    FROM dbo.yj_role r
    WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
      WHERE t.role_id=r.id AND t.panel_code='WO_COMPLETION_LIST')
      AND (r.is_admin='Y' OR EXISTS (SELECT 1 FROM dbo.yj_role_panel s
        WHERE s.role_id=r.id AND s.panel_code='WO_REPORT_LIST'
          AND ','+REPLACE(ISNULL(s.perms,''),' ','')+',' LIKE '%,view,%'));
    UPDATE dbo.yj_role_panel SET perms=
      CASE WHEN ','+REPLACE(ISNULL(perms,''),' ','')+',' LIKE '%,export,%'
        THEN 'view,query,export' ELSE 'view,query' END, can_approve='N'
    WHERE panel_code='WO_COMPLETION_LIST';

    -- 窄范围守卫：字段覆盖/只读、译名完整、授权无写权限、事实范围一致。
    IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code='WO_COMPLETION_LIST') <> 15
       OR EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.panel_code='WO_COMPLETION_LIST'
         AND (f.editable<>0 OR f.place<>'query,detail' OR f.hidden<>0 OR f.visible<>1
           OR NOT EXISTS (SELECT 1 FROM sys.columns c
             WHERE c.object_id=OBJECT_ID(N'dbo.v_wo_completion_detail') AND c.name=f.col_name)))
        THROW 51000, N'完工明细字段配置或视图列覆盖验证失败。', 1;
    IF EXISTS (SELECT 1 FROM @tr t WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
        WHERE x.scope=t.scope AND x.ref_key=t.ref_key AND x.locale=t.locale AND LEN(x.text)>0))
        THROW 51000, N'完工明细 en/ja 译名不完整。', 1;
    IF EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code='WO_COMPLETION_LIST'
        AND (perms NOT IN ('view,query','view,query,export') OR perms IS NULL
          OR ISNULL(can_approve,'N')<>'N'))
        THROW 51000, N'完工明细存在非只读授权。', 1;
    IF EXISTS (SELECT 1 FROM dbo.yj_role r
        WHERE (r.is_admin='Y' OR EXISTS (SELECT 1 FROM dbo.yj_role_panel s
          WHERE s.role_id=r.id AND s.panel_code='WO_REPORT_LIST'
            AND ','+REPLACE(ISNULL(s.perms,''),' ','')+',' LIKE '%,view,%'))
          AND NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel t
            WHERE t.role_id=r.id AND t.panel_code='WO_COMPLETION_LIST'
              AND ','+ISNULL(t.perms,'')+',' LIKE '%,view,%'))
        THROW 51000, N'现有报工记录可见角色未获等价完工明细可见权限。', 1;
    EXEC(N'IF EXISTS (SELECT 1 FROM dbo.v_wo_completion_detail
          WHERE RTRIM(ISNULL(wgzt,N''''))<>N''Y'' OR ISNULL(asp_cancel,N''N'')=N''Y'')
        THROW 51000, N''完工明细混入未完工或作废记录。'', 1;
      IF (SELECT COUNT_BIG(*) FROM dbo.v_wo_completion_detail) <>
         (SELECT COUNT_BIG(*) FROM dbo.scjl WHERE RTRIM(wgzt)=N''Y'' AND ISNULL(asp_cancel,N''N'')<>N''Y'')
        THROW 51000, N''完工明细与源事实数量不一致。'', 1;');
    COMMIT TRANSACTION;
    SELECT panel_code,panel_name,mode,line_table,category FROM dbo.yj_panel
      WHERE panel_code='WO_COMPLETION_LIST';
    SELECT role_id,perms,can_approve FROM dbo.yj_role_panel WHERE panel_code='WO_COMPLETION_LIST';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
