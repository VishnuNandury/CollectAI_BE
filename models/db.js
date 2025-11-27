const { Pool } = require('pg');

// Create connection pool
// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   max: 20, // Maximum number of clients in the pool
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
//   options: "-c search_path=public",
// });
let connectionConfig;  
  
if (process.env.DATABASE_URL) {  
  // e.g. for cloud / single URL style  
  connectionConfig = {  
    connectionString: process.env.DATABASE_URL,  
    // If using Heroku / SSL:  
    // ssl: { rejectUnauthorized: false },  
  };  
} else {  
  connectionConfig = {  
    host: process.env.DB_HOST || 'localhost',  
    port: parseInt(process.env.DB_PORT || '5432', 10),  
    database: process.env.DB_NAME || 'collectai',  
    user: process.env.DB_USER || 'collectai_user',  
    password: process.env.DB_PASSWORD || '',  
    max: 20,  
    idleTimeoutMillis: 30000,  
    connectionTimeoutMillis: 5000,  
  };  
}  
  
console.log('📦 PG connection config:', {  
  host: connectionConfig.host,  
  port: connectionConfig.port,  
  database: connectionConfig.database,  
  user: connectionConfig.user,  
  connectionString: connectionConfig.connectionString ? '***USED***' : undefined,  
});  
  
const pool = new Pool(connectionConfig);

// Test connection
pool.on('connect', () => {
  console.log('✓ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('✗ Unexpected error on idle client', err);
  process.exit(-1);
});

// User queries
const userQueries = {
  // Create user
  createUser: async (userData) => {
    const {
      phoneNumber,
      name,
      email,
      password,
      subscriptionTier,
      ipAddress,
      userAgent,
    } = userData;

    const query = `
      INSERT INTO users (
        phone_number, name, email, password, subscription_tier,
        last_login, total_sessions, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 1, $6, $7)
      RETURNING id, phone_number, name, email, subscription_tier, created_at
    `;

    const values = [phoneNumber, name, email, password, subscriptionTier, ipAddress, userAgent];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Find user by phone number
  findByPhoneNumber: async (phoneNumber, includePassword = false) => {
    const fields = includePassword
      ? '*'
      : 'id, phone_number, name, email, avatar, company, subscription_tier, subscription_status, subscription_start_date, subscription_end_date, agents_created, episodes_run, interactions_this_month, templates_created, intents_created, last_login, last_logout, session_duration, total_sessions, is_verified, ip_address, user_agent, created_at, updated_at';

    const query = `SELECT ${fields} FROM users WHERE phone_number = $1`;
    const result = await pool.query(query, [phoneNumber]);
    return result.rows[0];
  },

  // Find user by ID
  findById: async (id) => {
    const query = `
      SELECT id, phone_number, name, email, avatar, company,
             subscription_tier, subscription_status, subscription_start_date, subscription_end_date,
             agents_created, episodes_run, interactions_this_month, templates_created, intents_created,
             last_login, last_logout, session_duration, total_sessions,
             is_verified, created_at, updated_at
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  // Update user login
  updateLogin: async (userId, ipAddress, userAgent) => {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP,
          total_sessions = total_sessions + 1,
          ip_address = $2,
          user_agent = $3
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [userId, ipAddress, userAgent]);
    return result.rows[0];
  },

  // Update user logout
  updateLogout: async (userId, sessionDuration) => {
    const query = `
      UPDATE users
      SET last_logout = CURRENT_TIMESTAMP,
          session_duration = session_duration + $2
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [userId, sessionDuration]);
    return result.rows[0];
  },

  // Update user profile
  updateProfile: async (userId, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(userId);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, phone_number, name, email, avatar, company, subscription_tier
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Update usage
  updateUsage: async (userId, action, count = 1) => {
    const fieldMap = {
      agent_created: 'agents_created',
      episode_run: 'episodes_run',
      interaction: 'interactions_this_month',
      template_created: 'templates_created',
      intent_created: 'intents_created',
    };

    const field = fieldMap[action];
    if (!field) {
      throw new Error('Invalid action type');
    }

    const query = `
      UPDATE users
      SET ${field} = ${field} + $1
      WHERE id = $2
      RETURNING agents_created, episodes_run, interactions_this_month, templates_created, intents_created
    `;

    const result = await pool.query(query, [count, userId]);
    return result.rows[0];
  },

  // Update subscription
  updateSubscription: async (userId, tier) => {
    const query = `
      UPDATE users
      SET subscription_tier = $1,
          subscription_status = 'active',
          subscription_start_date = CURRENT_TIMESTAMP,
          subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '30 days'
      WHERE id = $2
      RETURNING subscription_tier, subscription_status, subscription_start_date, subscription_end_date
    `;

    const result = await pool.query(query, [tier, userId]);
    return result.rows[0];
  },

  // Reset monthly usage
  resetMonthlyUsage: async (userId) => {
    const query = `
      UPDATE users
      SET interactions_this_month = 0
      WHERE id = $1
    `;
    await pool.query(query, [userId]);
  },
};

// Session log queries
const sessionQueries = {
  // Create session log
  createSession: async (userId, ipAddress, userAgent) => {
    const query = `
      INSERT INTO session_logs (user_id, login_time, ip_address, user_agent)
      VALUES ($1, CURRENT_TIMESTAMP, $2, $3)
      RETURNING id
    `;
    const result = await pool.query(query, [userId, ipAddress, userAgent]);
    return result.rows[0];
  },

  // Update session logout
  updateSessionLogout: async (sessionId, duration) => {
    const query = `
      UPDATE session_logs
      SET logout_time = CURRENT_TIMESTAMP,
          duration = $2
      WHERE id = $1
    `;
    await pool.query(query, [sessionId, duration]);
  },

  // Get user sessions
  getUserSessions: async (userId, limit = 10) => {
    const query = `
      SELECT * FROM session_logs
      WHERE user_id = $1
      ORDER BY login_time DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  },
};

// Usage log queries
const usageQueries = {
  // Log usage
  logUsage: async (userId, action, count = 1, metadata = null) => {
    const query = `
      INSERT INTO usage_logs (user_id, action, count, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const result = await pool.query(query, [userId, action, count, metadata]);
    return result.rows[0];
  },

  // Get user usage logs
  getUserUsage: async (userId, limit = 50) => {
    const query = `
      SELECT * FROM usage_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  },

  // Get usage statistics
  getUsageStats: async (userId, startDate, endDate) => {
    const query = `
      SELECT action, SUM(count) as total_count
      FROM usage_logs
      WHERE user_id = $1
        AND created_at BETWEEN $2 AND $3
      GROUP BY action
    `;
    const result = await pool.query(query, [userId, startDate, endDate]);
    return result.rows;
  },
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  userQueries,
  sessionQueries,
  usageQueries,
};