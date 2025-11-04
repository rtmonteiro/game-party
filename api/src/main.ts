/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express from 'express';
import * as path from 'path';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'assets')));

type Player = { name: string; score: number };

type Buzz = { name: string; time: number };

type Round = {
  id: string;
  item: string;
  answer: string;
  hints: string[];
  maxPhases: number;
  phase: number;
  buzzes: Buzz[];
  finished: boolean;
};

const players = new Map<string, Player>();

let currentRound: Round | null = null;

function ensurePlayer(name: string) {
  if (!players.has(name)) players.set(name, { name, score: 0 });
}

function pointsForPhase(phase: number) {
  // phase 1 -> 10 points, phase 10 ->1. Cap at 10 phases.
  const p = Math.max(1, Math.min(10, phase));
  return 11 - p;
}

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to game-party api!' });
});

// Admin: start a new round
app.post('/api/start-round', (req, res) => {
  const { item, answer, hints, maxPhases } = req.body;
  if (!item || !answer) return res.status(400).send({ error: 'item and answer required' });
  currentRound = {
    id: String(Date.now()),
    item,
    answer: String(answer).trim().toLowerCase(),
    hints: Array.isArray(hints) ? hints : [],
    maxPhases: Math.max(1, Math.min(10, maxPhases || 3)),
    phase: 1,
    buzzes: [],
    finished: false,
  };
  // reset buzzes but keep players scores intact
  res.send({ round: currentRound });
});

// Admin: go to next phase
app.post('/api/next-phase', (req, res) => {
  if (!currentRound) return res.status(400).send({ error: 'no active round' });
  if (currentRound.phase >= currentRound.maxPhases) return res.status(400).send({ error: 'already at last phase' });
  currentRound.phase++;
  currentRound.buzzes = [];
  res.send({ round: currentRound });
});

// Player: join (optional)
app.post('/api/join', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send({ error: 'name required' });
  ensurePlayer(name);
  res.send({ player: players.get(name) });
});

// Player: buzz (press the button). Ranked by arrival (server time)
app.post('/api/buzz', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send({ error: 'name required' });
  if (!currentRound || currentRound.finished) return res.status(400).send({ error: 'no active round' });
  ensurePlayer(name);
  const now = Date.now();
  // Avoid duplicate buzz registration for same name in same phase
  if (currentRound.buzzes.find((b) => b.name === name)) {
    const position = currentRound.buzzes.findIndex((b) => b.name === name) + 1;
    return res.send({ message: 'already buzzed', position, canAnswer: position === 1 });
  }
  currentRound.buzzes.push({ name, time: now });
  // sort by time just in case
  currentRound.buzzes.sort((a, b) => a.time - b.time);
  const position = currentRound.buzzes.findIndex((b) => b.name === name) + 1;
  const canAnswer = position === 1;
  res.send({ position, canAnswer });
});

// Player: answer
app.post('/api/answer', (req, res) => {
  const { name, answer } = req.body;
  if (!name || typeof answer === 'undefined') return res.status(400).send({ error: 'name and answer required' });
  if (!currentRound || currentRound.finished) return res.status(400).send({ error: 'no active round' });
  // only first buzzer may answer
  const first = currentRound.buzzes[0];
  if (!first || first.name !== name) return res.status(403).send({ error: 'not authorized to answer' });
  const normalized = String(answer).trim().toLowerCase();
  const correct = normalized === currentRound.answer;
  if (correct) {
    const pts = pointsForPhase(currentRound.phase);
    ensurePlayer(name);
    const p = players.get(name);
    if (p) {
      p.score += pts;
      currentRound.finished = true;
      return res.send({ correct: true, points: pts, player: p });
    } else {
      // Should never happen after ensurePlayer, but handle gracefully
      return res.status(500).send({ error: 'failed to retrieve player' });
    }
  }
  // incorrect: remove first from buzzes so next can answer
  currentRound.buzzes.shift();
  return res.send({ correct: false });
});

app.get('/api/state', (req, res) => {
  res.send({ round: currentRound });
});

app.get('/api/scoreboard', (req, res) => {
  const list = Array.from(players.values()).sort((a, b) => b.score - a.score);
  res.send({ players: list });
});

const port = process.env.PORT || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
