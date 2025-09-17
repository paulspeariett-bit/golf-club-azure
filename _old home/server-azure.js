// server-azure.js - Modified for Azure deployment
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DATABASE_URL = process.env.DATABASE_URL;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Initialize Azure Blob Storage
let blobServiceClient;
if (AZURE_STORAGE_CONNECTION_STRING) {
  blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cms.html'));
});

app.get('/screen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'screen.html'));
});

// Database connection
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database
async function initializeDatabase() {
  try {
    await client.connect();
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        scheduled_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author VARCHAR(50)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        path VARCHAR(500) NOT NULL,
        type VARCHAR(100) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS handicaps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        handicap DECIMAL(4,1) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(100) NOT NULL,
        score INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS screens (
        id SERIAL PRIMARY KEY,
        pairing_code VARCHAR(20) NOT NULL,
        paired BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        options JSON NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default users
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedContentPassword = await bcrypt.hash('content123', 10);
    
    await client.query(`
      INSERT INTO users (username, password, role) 
      VALUES ($1, $2, $3), ($4, $5, $6)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', hashedAdminPassword, 'admin', 'content', hashedContentPassword, 'content_manager']);

    // Insert default settings
    await client.query(`
      INSERT INTO settings (key, value) 
      VALUES 
        ('rotationDuration', '5000'),
        ('activeContent', 'handicaps'),
        ('currentRotation', '[]')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// File upload configuration for Azure Blob Storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API Routes

// Authentication
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// News Management
app.get('/api/news', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM news ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/news', authenticateToken, async (req, res) => {
  const { title, content, scheduled_date } = req.body;
  
  try {
    const result = await client.query(
      'INSERT INTO news (title, content, scheduled_date, author) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, scheduled_date || null, req.user.username]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Media Management with Azure Blob Storage
app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const containerClient = blobServiceClient.getContainerClient('uploads');
    const blobName = Date.now() + '-' + req.file.originalname;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.upload(req.file.buffer, req.file.buffer.length);
    
    const blobUrl = blockBlobClient.url;
    
    const result = await client.query(
      'INSERT INTO media (filename, original_name, path, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [blobName, req.file.originalname, blobUrl, req.file.mimetype]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/media', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM media ORDER BY uploaded_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Screen content endpoint
app.get('/api/screen/content', async (req, res) => {
  try {
    const [newsResult, mediaResult, handicapsResult, leaderboardResult, pollsResult, settingsResult] = await Promise.all([
      client.query('SELECT * FROM news WHERE scheduled_date IS NULL OR scheduled_date <= NOW() ORDER BY created_at DESC'),
      client.query('SELECT * FROM media ORDER BY uploaded_at DESC'),
      client.query('SELECT * FROM handicaps ORDER BY name'),
      client.query('SELECT * FROM leaderboard ORDER BY score ASC'),
      client.query('SELECT * FROM polls WHERE active = true'),
      client.query('SELECT * FROM settings')
    ]);

    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.key === 'currentRotation' ? JSON.parse(row.value) : row.value;
    });

    const content = {
      news: newsResult.rows,
      rotation_images: mediaResult.rows.filter(m => m.type.startsWith('image/')),
      rotation_duration: parseInt(settings.rotationDuration) || 5000,
      handicaps: settings.activeContent === 'handicaps' ? handicapsResult.rows : [],
      leaderboard: settings.activeContent === 'leaderboard' ? leaderboardResult.rows : [],
      current_time: new Date().toISOString(),
      polls: pollsResult.rows
    };

    res.json(content);
  } catch (error) {
    console.error('Error fetching screen content:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize database and start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeDatabase();
});