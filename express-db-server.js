
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

// JWT authentication middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
}

app.use(express.json());

// Login endpoint (POST /login)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Create JWT payload
    const payload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected endpoint example
app.get('/protected', authenticateJWT, (req, res) => {
  res.json({ message: 'You are authenticated!', user: req.user });
});

app.listen(PORT, () => {
  console.log(`Express server with DB listening on port ${PORT}`);
});
