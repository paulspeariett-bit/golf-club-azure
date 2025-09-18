const express = require('express');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// Use DATABASE_URL from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.get('/health', async (req, res) => {
  try {
    // Simple DB query to check connectivity
    const result = await pool.query('SELECT NOW() as now');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbTime: result.rows[0].now,
      env: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('<h1>Express Server with PostgreSQL Connectivity</h1>');
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Express server with DB listening on port ${PORT}`);
});
