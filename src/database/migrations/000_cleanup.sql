-- ============================================
-- 清理脚本：删除所有现有的表、触发器、函数
-- 用于重新初始化数据库
-- ============================================

-- 1. 删除触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_records_updated_at ON records;
DROP TRIGGER IF EXISTS update_weekly_insights_updated_at ON weekly_insights;
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;

-- 2. 删除函数
DROP FUNCTION IF EXISTS update_updated_at_column();

-- 3. 删除表（按依赖关系倒序删除）
DROP TABLE IF EXISTS ai_api_logs CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS insight_reports CASCADE;
DROP TABLE IF EXISTS weekly_insights CASCADE;
DROP TABLE IF EXISTS records CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 4. 删除枚举类型
DROP TYPE IF EXISTS record_type CASCADE;
DROP TYPE IF EXISTS processing_mode CASCADE;
DROP TYPE IF EXISTS ai_api_type CASCADE;
DROP TYPE IF EXISTS sync_operation CASCADE;
DROP TYPE IF EXISTS sync_status CASCADE;

-- 5. 删除 settings 表（如果存在）
DROP TABLE IF EXISTS settings CASCADE;

-- 清理完成提示
SELECT '数据库清理完成，可以重新执行初始化脚本' AS message;
