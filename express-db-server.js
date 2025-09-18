// --- Protected Admin APIs ---
// Get all organizations
app.get('/api/organizations', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM organizations');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sites
app.get('/api/sites', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sites');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, last_login FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create organization
app.post('/api/organizations', authenticateJWT, async (req, res) => {
  const { name, slug, subscription_plan } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });
  try {
    const result = await pool.query(
      'INSERT INTO organizations (name, slug, subscription_plan) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, subscription_plan || 'basic']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update organization
app.put('/api/organizations/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { name, slug, subscription_plan, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE organizations SET name=$1, slug=$2, subscription_plan=$3, is_active=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [name, slug, subscription_plan, is_active, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete organization
app.delete('/api/organizations/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM organizations WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Direct route for /admin.html
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

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
