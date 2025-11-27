const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

//const pool = new Pool({
//  host: process.env.DB_HOST,
//  port: process.env.DB_PORT,
//  database: process.env.DB_NAME,
//  user: process.env.DB_USER,
//  password: process.env.DB_PASSWORD,
//});
if (process.env.DATABASE_URL) {  
  // e.g. for cloud / single URL style  
  connectionConfig = {  connectionString: process.env.DATABASE_URL,};  
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
  
  
const pool = new Pool(connectionConfig);

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    
    const migrationFile = path.join(__dirname, '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    await pool.query(sql);
    
    console.log('✓ Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
