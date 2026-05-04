const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── MongoDB Connection ────────────────────────────
let conn = null;
const connectDB = async () => {
  if (conn) return conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');
  conn = await mongoose.connect(uri);
  return conn;
};

// ── Schema ────────────────────────────────────────
const sessionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  group: { type: String, required: true },
  buyinUnit: { type: Number, required: true },
  players: [{
    name: { type: String, required: true },
    buyins: { type: Number, required: true },
    finalChips: { type: Number, required: true },
    net: { type: Number, required: true }          // finalChips - buyins (units)
  }],
  settlements: [{
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: Number, required: true }        // in ₹
  }]
});

const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

// ── DB middleware ─────────────────────────────────
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { res.status(500).json({ error: 'Database connection failed' }); }
});

// ── GET /groups — get all unique group names ──────
app.get('/groups', async (req, res) => {
  try {
    const groups = await Session.distinct('group');
    res.json(groups.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /sessions — save a completed session ────
app.post('/sessions', async (req, res) => {
  try {
    const { group, buyinUnit, players, settlements } = req.body;
    if (!group || !buyinUnit || !players || players.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Validate zero-sum
    const totalNet = players.reduce((sum, p) => sum + p.net, 0);
    if (totalNet !== 0) {
      return res.status(400).json({ error: 'Net does not sum to zero' });
    }
    const session = new Session({ group, buyinUnit, players, settlements, date: new Date() });
    await session.save();
    res.json({ success: true, id: session._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /leaderboard?period=all|week|month|quarter&group=xyz
app.get('/leaderboard', async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const groupName = req.query.group;
    
    if (!groupName) {
      return res.json({ players: [], recentSessions: [] });
    }

    let filter = { group: groupName };
    const now = new Date();

    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      filter.date = { $gte: d };
    } else if (period === 'month') {
      const d = new Date(now); d.setMonth(d.getMonth() - 1);
      filter.date = { $gte: d };
    } else if (period === 'quarter') {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      filter.date = { $gte: d };
    }

    const sessions = await Session.find(filter).sort({ date: -1 });

    // Aggregate per player
    const map = {};
    sessions.forEach(s => {
      s.players.forEach(p => {
        if (!map[p.name]) {
          map[p.name] = { name: p.name, totalProfit: 0, sessions: 0, wins: 0, losses: 0 };
        }
        const profit = p.net * s.buyinUnit;
        map[p.name].totalProfit += profit;
        map[p.name].sessions += 1;
        if (p.net > 0) map[p.name].wins += 1;
        else if (p.net < 0) map[p.name].losses += 1;
      });
    });

    const players = Object.values(map)
      .map(p => ({
        ...p,
        winRate: p.sessions ? Math.round((p.wins / p.sessions) * 100) : 0,
        avgProfit: p.sessions ? Math.round(p.totalProfit / p.sessions) : 0
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);

    // Recent sessions (last 10)
    const recent = sessions.slice(0, 10).map(s => ({
      id: s._id,
      date: s.date,
      buyinUnit: s.buyinUnit,
      playerCount: s.players.length,
      potTotal: s.players.reduce((sum, p) => sum + p.buyins, 0) * s.buyinUnit,
      players: s.players.map(p => ({ name: p.name, net: p.net, profit: p.net * s.buyinUnit }))
    }));

    res.json({ players, recentSessions: recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.handler = serverless(app);
