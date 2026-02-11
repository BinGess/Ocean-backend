-- ============================================
-- MindFlow 数据库初始化脚本
-- PostgreSQL 14+
-- ============================================

-- 创建枚举类型
CREATE TYPE record_type AS ENUM ('quick_note', 'journal', 'weekly');
CREATE TYPE processing_mode AS ENUM ('only_record', 'with_mood', 'with_nvc');
CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete');
CREATE TYPE sync_entity_type AS ENUM ('record', 'weekly_insight', 'setting');
CREATE TYPE ai_api_type AS ENUM ('doubao_asr', 'doubao_llm', 'coze_nvc', 'coze_insight');

-- ============================================
-- 1. 用户与设备管理
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- 安全相关
  last_login_at TIMESTAMPTZ,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,

  CONSTRAINT user_identifier_check CHECK (
    phone IS NOT NULL OR email IS NOT NULL
  )
);

CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.phone IS '手机号（可选）';
COMMENT ON COLUMN users.email IS '邮箱（可选）';
COMMENT ON COLUMN users.password_hash IS 'bcrypt 加密后的密码';

-- 设备管理 (多设备同步)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL, -- 客户端生成的唯一ID
  device_name VARCHAR(100), -- "iPhone 15 Pro"
  platform VARCHAR(50) NOT NULL, -- "ios", "android"
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  fcm_token VARCHAR(500), -- Firebase Cloud Messaging (推送通知)

  last_sync_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_last_sync ON devices(user_id, last_sync_at);

COMMENT ON TABLE devices IS '用户设备表（支持多设备同步）';

-- ============================================
-- 2. 情绪记录核心表
-- ============================================

CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 基础字段
  type record_type NOT NULL DEFAULT 'quick_note',
  transcription TEXT NOT NULL,
  audio_url VARCHAR(500), -- 暂不存储音频,此字段保留
  duration DECIMAL(10, 2), -- 单位:秒
  processing_mode processing_mode,

  -- 情绪与需求 (数组字段)
  moods TEXT[], -- ['焦虑', '兴奋']
  needs TEXT[], -- ['被理解', '自主性']

  -- NVC分析 (JSONB存储复杂嵌套数据)
  nvc_analysis JSONB,
  /*
  nvc_analysis 结构示例:
  {
    "observation": "客观描述",
    "feelings": [
      {"feeling": "焦虑", "intensity": 4}
    ],
    "needs": [
      {"need": "被理解", "reason": "希望对方理解我的处境"}
    ],
    "request": "请求内容",
    "insight": "AI洞察",
    "analyzedAt": "2026-02-11T10:30:00Z"
  }
  */

  -- 日记特定字段
  title VARCHAR(255),
  summary TEXT,
  date DATE, -- 日记日期
  referenced_fragments TEXT[], -- 引用的碎片记录ID数组

  -- 周记特定字段
  week_range VARCHAR(50), -- "2026-02-10 ~ 2026-02-16"
  referenced_records TEXT[], -- 引用的记录ID数组

  -- 用户反馈
  pattern_feedback VARCHAR(20), -- 'like', 'dislike', 'uncertain'

  -- 版本控制与同步
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- 同步元数据
  created_device_id UUID REFERENCES devices(id),
  last_modified_device_id UUID REFERENCES devices(id)
);

-- 索引设计 (基于查询场景)
CREATE INDEX idx_records_user_id ON records(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_records_user_type ON records(user_id, type) WHERE deleted_at IS NULL;
CREATE INDEX idx_records_created_at ON records(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_records_updated_at ON records(user_id, updated_at DESC); -- 同步查询

-- JSONB 字段索引 (支持高效查询)
CREATE INDEX idx_records_nvc_feelings ON records USING GIN ((nvc_analysis->'feelings'));
CREATE INDEX idx_records_nvc_needs ON records USING GIN ((nvc_analysis->'needs'));

-- 全文搜索索引
CREATE INDEX idx_records_transcription_fts ON records USING GIN (to_tsvector('simple', transcription));

COMMENT ON TABLE records IS '情绪记录表（支持 quick_note, journal, weekly 三种类型）';
COMMENT ON COLUMN records.version IS '乐观锁版本号';

-- ============================================
-- 3. 周洞察报告
-- ============================================

CREATE TABLE weekly_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  week_range VARCHAR(50) NOT NULL, -- "2026-02-10 ~ 2026-02-16"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- 复杂数据使用 JSONB
  emotional_patterns JSONB NOT NULL DEFAULT '[]',
  /*
  [
    {
      "pattern": "工作压力模式",
      "description": "描述",
      "relatedRecords": ["uuid1", "uuid2"],
      "userFeedback": "like"
    }
  ]
  */

  micro_experiments JSONB NOT NULL DEFAULT '[]',
  /*
  [
    {
      "id": "uuid",
      "suggestion": "建议内容",
      "rationale": "原因",
      "relatedNeeds": ["被理解"],
      "createdAt": "2026-02-11T10:00:00Z",
      "status": "pending",
      "feedback": null
    }
  ]
  */

  need_statistics JSONB,
  /*
  [
    {"need": "被理解", "count": 5, "percentage": 35.7}
  ]
  */

  ai_summary TEXT,
  referenced_records TEXT[], -- 引用的记录ID

  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(user_id, start_date) -- 每周只有一个洞察
);

CREATE INDEX idx_weekly_insights_user_id ON weekly_insights(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_weekly_insights_date_range ON weekly_insights(user_id, start_date DESC);

COMMENT ON TABLE weekly_insights IS '周洞察报告表';

-- ============================================
-- 4. 洞察报告缓存
-- ============================================

CREATE TABLE insight_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  report_type VARCHAR(100) NOT NULL DEFAULT '每周洞察报告',
  week_range VARCHAR(50) NOT NULL,
  record_count INT NOT NULL DEFAULT 0,

  -- 完整报告数据 (JSONB)
  report_data JSONB NOT NULL,
  /*
  {
    "emotionOverview": {"summary": "..."},
    "highFrequencyEmotions": [...],
    "patternHypothesis": {...},
    "actionSuggestions": [...]
  }
  */

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, week_range)
);

CREATE INDEX idx_insight_reports_user_id ON insight_reports(user_id);

COMMENT ON TABLE insight_reports IS '洞察报告缓存表（由 Coze AI 生成的完整报告）';

-- ============================================
-- 5. 同步日志 (增量同步核心)
-- ============================================

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  entity_type sync_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  operation sync_operation NOT NULL,

  -- 变更前后的数据 (用于冲突解决)
  old_data JSONB,
  new_data JSONB,

  version_before INT,
  version_after INT,

  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 冲突标记
  has_conflict BOOLEAN DEFAULT FALSE,
  conflict_resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_logs_user_device ON sync_logs(user_id, device_id, synced_at DESC);
CREATE INDEX idx_sync_logs_entity ON sync_logs(entity_type, entity_id);

COMMENT ON TABLE sync_logs IS '同步日志表（记录所有数据变更，支持增量同步）';

-- ============================================
-- 6. 用户设置
-- ============================================

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 设置项以 JSONB 存储 (灵活扩展)
  preferences JSONB NOT NULL DEFAULT '{}',
  /*
  {
    "theme": "dark",
    "notifications": {"enabled": true, "weeklyReport": true},
    "privacy": {"biometricLock": true}
  }
  */

  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

COMMENT ON TABLE settings IS '用户设置表';

-- ============================================
-- 7. Refresh Token
-- ============================================

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,

  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  -- IP与UA记录 (安全审计)
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS 'Refresh Token 表（支持撤销）';

-- ============================================
-- 8. AI API调用日志 (成本监控)
-- ============================================

CREATE TABLE ai_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  api_type ai_api_type NOT NULL,
  request_id VARCHAR(255), -- 外部API的请求ID

  -- 请求信息
  input_tokens INT,
  output_tokens INT,
  audio_duration DECIMAL(10, 2), -- ASR音频时长(秒)

  -- 响应信息
  status_code INT,
  response_time_ms INT,
  error_message TEXT,

  -- 成本计算 (单位: 分)
  estimated_cost DECIMAL(10, 4),

  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_api_logs_user_id ON ai_api_logs(user_id, called_at DESC);
CREATE INDEX idx_ai_api_logs_type ON ai_api_logs(api_type, called_at DESC);

COMMENT ON TABLE ai_api_logs IS 'AI API 调用日志（成本监控与审计）';

-- ============================================
-- 触发器: 自动更新 updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_records_updated_at BEFORE UPDATE ON records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_insights_updated_at BEFORE UPDATE ON weekly_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始化完成
-- ============================================

COMMENT ON SCHEMA public IS 'MindFlow Backend Schema v1.0';
