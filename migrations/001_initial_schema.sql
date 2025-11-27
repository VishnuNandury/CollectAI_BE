-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    avatar TEXT,
    company VARCHAR(255),
    
    -- Subscription
    subscription_tier VARCHAR(20) CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
    subscription_status VARCHAR(20) DEFAULT 'trial' CHECK (subscription_status IN ('active', 'inactive', 'trial', 'cancelled')),
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    
    -- Usage tracking
    agents_created INTEGER DEFAULT 0,
    episodes_run INTEGER DEFAULT 0,
    interactions_this_month INTEGER DEFAULT 0,
    templates_created INTEGER DEFAULT 0,
    intents_created INTEGER DEFAULT 0,
    
    -- Session tracking
    last_login TIMESTAMP,
    last_logout TIMESTAMP,
    session_duration INTEGER DEFAULT 0, -- in seconds
    total_sessions INTEGER DEFAULT 0,
    
    -- Security
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10),
    reset_password_token VARCHAR(255),
    reset_password_expire TIMESTAMP,
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on phone_number for faster lookups
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);

-- Create session logs table for detailed tracking
CREATE TABLE IF NOT EXISTS session_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP NOT NULL,
    logout_time TIMESTAMP,
    duration INTEGER, -- in seconds
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX idx_session_logs_login_time ON session_logs(login_time);

-- Create usage logs table for detailed activity tracking
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_action ON usage_logs(action);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.phone_number,
    u.name,
    u.subscription_tier,
    u.agents_created,
    u.episodes_run,
    u.interactions_this_month,
    u.templates_created,
    u.intents_created,
    u.total_sessions,
    u.session_duration,
    COUNT(sl.id) as total_session_records,
    COALESCE(SUM(sl.duration), 0) as total_logged_duration,
    MAX(sl.login_time) as last_session_login
FROM users u
LEFT JOIN session_logs sl ON u.id = sl.user_id
GROUP BY u.id;