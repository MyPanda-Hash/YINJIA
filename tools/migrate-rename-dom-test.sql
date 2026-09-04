-- migrate-rename-dom-test.sql — 「国内部委托测试申请单」更名「内部委托测试申请单」
-- 覆盖:yj_panel 面板名 + yj_translation 词条键与各语言译值(幂等)
SET NOCOUNT ON;
UPDATE yj_panel SET panel_name = N'内部委托测试申请单' WHERE panel_code = 'RD_DOM_TEST' AND panel_name <> N'内部委托测试申请单';
GO
-- 词条键改名(panel/ui 两类 scope 全部迁移)
UPDATE yj_translation SET ref_key = N'内部委托测试申请单' WHERE ref_key IN (N'委托测试申请单', N'国内部委托测试申请单');
GO
-- 译值修正(原名含"国内部"的直译偏差;统一人工校对版本)
UPDATE yj_translation SET text = N'Internal Test Request', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'en';
UPDATE yj_translation SET text = N'內部委託測試申請單', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'zh-TW';
UPDATE yj_translation SET text = N'内部委託テスト申請', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'ja';
UPDATE yj_translation SET text = N'내부 의뢰 시험 신청서', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'ko';
UPDATE yj_translation SET text = N'Interner Prüfantrag', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'de';
UPDATE yj_translation SET text = N'Solicitud de Prueba Interna', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'es';
UPDATE yj_translation SET text = N'Demande de Test Interne', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'fr';
UPDATE yj_translation SET text = N'Заявка на внутреннее испытание', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'ru';
UPDATE yj_translation SET text = N'คำขอทดสอบภายใน', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'th';
UPDATE yj_translation SET text = N'Đơn yêu cầu kiểm tra nội bộ', source = 'manual' WHERE scope IN ('panel','ui') AND ref_key = N'内部委托测试申请单' AND locale = 'vi';
GO
PRINT N'更名完成: RD_DOM_TEST = 内部委托测试申请单';
GO
