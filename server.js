const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Load questions bank
const questionsDataPath = path.join(__dirname, 'data', 'questions.json');
let allQuestions = [];
try {
  allQuestions = JSON.parse(fs.readFileSync(questionsDataPath, 'utf8'));
  console.log(`Loaded ${allQuestions.length} bilingual party game questions.`);
} catch (err) {
  console.error('Failed to load questions.json', err);
  allQuestions = [];
}

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Detect Local Wi-Fi IP
function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// API endpoint for server info
app.get('/api/server-info', (req, res) => {
  res.json({
    localIp: LOCAL_IP,
    port: PORT,
    baseUrl: `http://${LOCAL_IP}:${PORT}`
  });
});

// Rooms State
const rooms = new Map();

// Helper: Generate clean 4-letter room code (avoid confusing chars like 0, O, 1, I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Helper: Shuffle array
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Fuzzy normalization for answer checking
function normalizeAnswer(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMatchingTruth(input, question, lang) {
  const normInput = normalizeAnswer(input);
  if (!normInput || normInput.length < 2) return false;

  const targetEn = normalizeAnswer(question.answer_en);
  const targetHi = normalizeAnswer(question.answer_hi);
  if (normInput === targetEn || normInput === targetHi) return true;

  // Check aliases
  const aliases = [
    ...(question.aliases_en || []),
    ...(question.aliases_hi || [])
  ];
  for (const alias of aliases) {
    const normAlias = normalizeAnswer(alias);
    if (normInput === normAlias || (normAlias.length > 3 && normInput.includes(normAlias))) {
      return true;
    }
  }
  return false;
}

// Room Management Class
class GameRoom {
  constructor(code, hostSocketId, hostPlayerId, initialSettings = {}, baseUrl = null) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.hostPlayerId = hostPlayerId;
    this.baseUrl = baseUrl || process.env.PUBLIC_URL || `http://${LOCAL_IP}:${PORT}`;
    this.status = 'LOBBY'; // LOBBY, PROMPT, VOTING, REVEAL, SCOREBOARD, GAME_OVER
    this.language = initialSettings.language || 'hi'; // 'en', 'hi', 'mix'
    this.settings = {
      totalRounds: 3,
      questionsPerRound: 2,
      promptTimerSec: 35,
      votingTimerSec: 25,
      ...initialSettings
    };
    this.currentRound = 1;
    this.currentQuestionIdx = 0;
    this.questionsList = [];
    this.activeQuestion = null;
    this.players = new Map(); // playerId -> Player Object
    this.bluffs = []; // Array of submission cards for voting
    this.timer = null;
    this.timerRemaining = 0;
    this.qrCodeDataUrl = null;
    this.revealStep = 0;

    this.generateQrCode();
  }

  async generateQrCode() {
    try {
      const url = `${this.baseUrl}/?room=${this.code}`;
      this.qrCodeDataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 256,
        color: { dark: '#09090b', light: '#ffffff' }
      });
    } catch (e) {
      console.error('QR code error:', e);
    }
  }

  addPlayer(playerId, socketId, name, avatar, color) {
    let player = this.players.get(playerId);
    if (!player) {
      player = {
        id: playerId,
        socketId,
        name: name || `Player ${this.players.size + 1}`,
        avatar: avatar || '🦁',
        color: color || '#8B5CF6',
        score: 0,
        roundScore: 0,
        connected: true,
        isHost: (playerId === this.hostPlayerId),
        submittedBluff: false,
        votedForId: null,
        fooledCount: 0,
        truthFoundCount: 0,
        gullibleCount: 0
      };
      this.players.set(playerId, player);
    } else {
      player.socketId = socketId;
      player.connected = true;
      if (name) player.name = name;
      if (avatar) player.avatar = avatar;
      if (color) player.color = color;
    }
    return player;
  }

  getPlayerList() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      score: p.score,
      roundScore: p.roundScore,
      connected: p.connected,
      isHost: p.isHost,
      submittedBluff: p.submittedBluff,
      hasVoted: p.votedForId !== null,
      fooledCount: p.fooledCount,
      truthFoundCount: p.truthFoundCount,
      gullibleCount: p.gullibleCount
    }));
  }

  getPublicState() {
    return {
      code: this.code,
      status: this.status,
      language: this.language,
      currentRound: this.currentRound,
      totalRounds: this.settings.totalRounds,
      currentQuestionIdx: this.currentQuestionIdx,
      questionsPerRound: this.settings.questionsPerRound,
      timerRemaining: this.timerRemaining,
      players: this.getPlayerList(),
      qrCodeDataUrl: this.qrCodeDataUrl,
      joinUrl: `${this.baseUrl}/?room=${this.code}`,
      activeQuestion: this.activeQuestion ? this.getQuestionDisplay(this.activeQuestion) : null,
      bluffsCount: this.bluffs.length,
      revealStep: this.revealStep
    };
  }

  getQuestionDisplay(q) {
    if (!q) return null;
    const isHindi = this.language === 'hi' || (this.language === 'mix' && this.currentQuestionIdx % 2 === 1);
    return {
      id: q.id,
      category: isHindi ? (q.category_hi || q.category) : q.category,
      prompt: isHindi ? q.prompt_hi : q.prompt_en,
      isHindi,
      round: this.currentRound,
      scoreMultiplier: this.getMultiplier()
    };
  }

  getMultiplier() {
    if (this.currentRound === 1) return 1;
    if (this.currentRound === 2) return 2;
    return 3; // Grand Finale
  }

  startTimer(seconds, onTick, onComplete) {
    this.stopTimer();
    this.timerRemaining = seconds;
    if (onTick) onTick(this.timerRemaining);

    this.timer = setInterval(() => {
      this.timerRemaining--;
      if (onTick) onTick(this.timerRemaining);
      if (this.timerRemaining <= 0) {
        this.stopTimer();
        if (onComplete) onComplete();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  startMatch() {
    this.currentRound = 1;
    this.currentQuestionIdx = 0;
    // Reset scores & stats
    this.players.forEach(p => {
      p.score = 0;
      p.roundScore = 0;
      p.fooledCount = 0;
      p.truthFoundCount = 0;
      p.gullibleCount = 0;
    });

    const totalQuestionsNeeded = this.settings.totalRounds * this.settings.questionsPerRound;
    this.questionsList = shuffleArray(allQuestions).slice(0, totalQuestionsNeeded);
    this.nextQuestion();
  }

  nextQuestion() {
    this.currentQuestionIdx++;
    // Check if we need to advance round
    const maxPerRound = this.settings.questionsPerRound;
    const questionIndexInRound = ((this.currentQuestionIdx - 1) % maxPerRound) + 1;
    this.currentRound = Math.ceil(this.currentQuestionIdx / maxPerRound);

    if (this.currentQuestionIdx > this.questionsList.length) {
      this.finishGame();
      return;
    }

    this.activeQuestion = this.questionsList[this.currentQuestionIdx - 1];
    this.status = 'PROMPT';
    this.revealStep = 0;

    // Reset player round status
    this.players.forEach(p => {
      p.submittedBluff = false;
      p.votedForId = null;
      p.roundScore = 0;
      p.currentBluffText = null;
    });
    this.bluffs = [];

    // Broadcast prompt phase
    io.to(this.code).emit('GAME_PHASE_CHANGE', {
      status: 'PROMPT',
      room: this.getPublicState()
    });

    // Start 35s bluff submission timer
    this.startTimer(
      this.settings.promptTimerSec,
      (sec) => {
        io.to(this.code).emit('TIMER_TICK', { timerRemaining: sec });
      },
      () => {
        // Time expired: auto-fill decoys for missing players and proceed
        this.autoFillMissingBluffs();
        this.startVotingPhase();
      }
    );
  }

  recordBluff(playerId, text) {
    const player = this.players.get(playerId);
    if (!player || player.submittedBluff) return false;

    // Check if user entered the real truth!
    const isHindi = this.language === 'hi' || (this.language === 'mix' && this.currentQuestionIdx % 2 === 1);
    if (isMatchingTruth(text, this.activeQuestion, isHindi ? 'hi' : 'en')) {
      // Award early discovery bonus (+250) and ask them to submit a fake answer instead!
      player.score += 250;
      io.to(player.socketId).emit('TRUTH_MATCH_BONUS', {
        bonusPoints: 250,
        message_en: "You figured out the actual truth! Earned +250 pts! Now submit a believable fake answer to trick your friends!",
        message_hi: "वाह! आपने तो असली सच ढूंढ लिया! आपको +250 बोनस मिले! अब दोस्तों को उल्लू बनाने के लिए कोई झूठा जवाब (Bluff) लिखें!"
      });
      return false; // do not accept as their lie
    }

    player.submittedBluff = true;
    player.currentBluffText = text.trim();

    // Broadcast update that player submitted
    io.to(this.code).emit('PLAYER_SUBMITTED_BLUFF', {
      playerId,
      players: this.getPlayerList()
    });

    // Check if all connected players have submitted
    const connectedPlayers = Array.from(this.players.values()).filter(p => p.connected);
    const allSubmitted = connectedPlayers.every(p => p.submittedBluff);
    if (allSubmitted && connectedPlayers.length >= 2) {
      this.stopTimer();
      setTimeout(() => this.startVotingPhase(), 800);
    }

    return true;
  }

  autoFillMissingBluffs() {
    const isHindi = this.language === 'hi' || (this.language === 'mix' && this.currentQuestionIdx % 2 === 1);
    const availableDecoys = shuffleArray(isHindi ? this.activeQuestion.decoys_hi : this.activeQuestion.decoys_en);
    let decoyIdx = 0;

    this.players.forEach(p => {
      if (p.connected && !p.submittedBluff) {
        p.submittedBluff = true;
        p.currentBluffText = availableDecoys[decoyIdx % availableDecoys.length];
        decoyIdx++;
      }
    });
  }

  startVotingPhase() {
    this.status = 'VOTING';
    this.stopTimer();

    const isHindi = this.language === 'hi' || (this.language === 'mix' && this.currentQuestionIdx % 2 === 1);
    const realAnswerText = isHindi ? this.activeQuestion.answer_hi : this.activeQuestion.answer_en;

    const cards = [];

    // 1. Add player submitted bluffs
    this.players.forEach(p => {
      if (p.submittedBluff && p.currentBluffText) {
        cards.push({
          id: `bluff_${p.id}`,
          text: p.currentBluffText,
          authorPlayerId: p.id,
          isReal: false,
          isDecoy: false,
          votes: []
        });
      }
    });

    // 2. Add The Real Truth
    cards.push({
      id: 'real_truth',
      text: realAnswerText,
      authorPlayerId: null,
      isReal: true,
      isDecoy: false,
      votes: []
    });

    // 3. For 2-3 players, inject House Decoys so voting cards >= 4
    const availableDecoys = shuffleArray(isHindi ? this.activeQuestion.decoys_hi : this.activeQuestion.decoys_en);
    let decoyCount = 0;
    while (cards.length < 4 && decoyCount < availableDecoys.length) {
      const decoyText = availableDecoys[decoyCount];
      // ensure no exact duplicate
      if (!cards.some(c => c.text.toLowerCase() === decoyText.toLowerCase())) {
        cards.push({
          id: `decoy_${decoyCount}`,
          text: decoyText,
          authorPlayerId: null,
          isReal: false,
          isDecoy: true,
          votes: []
        });
      }
      decoyCount++;
    }

    // Shuffle cards so truth isn't always at a fixed position
    this.bluffs = shuffleArray(cards);

    // Broadcast voting phase
    io.to(this.code).emit('GAME_PHASE_CHANGE', {
      status: 'VOTING',
      room: this.getPublicState()
    });

    // Send voting options to each player (marking their own lie so they cannot vote for it)
    this.players.forEach(p => {
      const sanitizedCards = this.bluffs.map(card => ({
        id: card.id,
        text: card.text,
        isOwn: card.authorPlayerId === p.id
      }));
      io.to(p.socketId).emit('VOTING_OPTIONS', { cards: sanitizedCards });
    });

    // Start 25s voting timer
    this.startTimer(
      this.settings.votingTimerSec,
      (sec) => {
        io.to(this.code).emit('TIMER_TICK', { timerRemaining: sec });
      },
      () => {
        this.processVotingAndReveal();
      }
    );
  }

  recordVote(playerId, cardId) {
    const player = this.players.get(playerId);
    if (!player || player.votedForId !== null) return false;

    const targetCard = this.bluffs.find(c => c.id === cardId);
    if (!targetCard) return false;

    // Disallow voting for own bluff
    if (targetCard.authorPlayerId === playerId) {
      io.to(player.socketId).emit('VOTE_ERROR', { message: "You cannot vote for your own bluff!" });
      return false;
    }

    player.votedForId = cardId;
    targetCard.votes.push(playerId);

    // Broadcast update that player has voted
    io.to(this.code).emit('PLAYER_VOTED', {
      playerId,
      players: this.getPlayerList()
    });

    // Check if all connected players have voted
    const connectedPlayers = Array.from(this.players.values()).filter(p => p.connected);
    const allVoted = connectedPlayers.every(p => p.votedForId !== null);
    if (allVoted && connectedPlayers.length >= 2) {
      this.stopTimer();
      setTimeout(() => this.processVotingAndReveal(), 600);
    }

    return true;
  }

  processVotingAndReveal() {
    this.status = 'REVEAL';
    this.stopTimer();

    const multiplier = this.getMultiplier();
    const truthPoints = 500 * multiplier;
    const foolPoints = 250 * multiplier;

    // Tally points
    this.bluffs.forEach(card => {
      const voters = card.votes.map(vId => this.players.get(vId)).filter(Boolean);

      if (card.isReal) {
        // Voters get truth points
        voters.forEach(v => {
          v.score += truthPoints;
          v.roundScore += truthPoints;
          v.truthFoundCount += 1;
        });
      } else if (card.authorPlayerId) {
        // Author gets fool points
        const author = this.players.get(card.authorPlayerId);
        if (author) {
          const earned = voters.length * foolPoints;
          author.score += earned;
          author.roundScore += earned;
          author.fooledCount += voters.length;
        }
        // Voters fell for a bluff
        voters.forEach(v => {
          v.gullibleCount += 1;
        });
      } else if (card.isDecoy) {
        // House decoy fooled voters
        voters.forEach(v => {
          v.gullibleCount += 1;
        });
      }
    });

    // Build reveal sequence data
    const isHindi = this.language === 'hi' || (this.language === 'mix' && this.currentQuestionIdx % 2 === 1);
    const revealCards = this.bluffs.map(card => {
      const author = card.authorPlayerId ? this.players.get(card.authorPlayerId) : null;
      const voters = card.votes.map(id => {
        const p = this.players.get(id);
        return { id: p.id, name: p.name, avatar: p.avatar, color: p.color };
      });

      return {
        id: card.id,
        text: card.text,
        isReal: card.isReal,
        isDecoy: card.isDecoy,
        author: author ? { id: author.id, name: author.name, avatar: author.avatar } : null,
        voters,
        pointsAwarded: card.isReal ? truthPoints : (author ? voters.length * foolPoints : 0)
      };
    });

    // Send complete reveal payload to all clients
    io.to(this.code).emit('GAME_PHASE_CHANGE', {
      status: 'REVEAL',
      room: this.getPublicState(),
      revealData: {
        cards: revealCards,
        realAnswer: isHindi ? this.activeQuestion.answer_hi : this.activeQuestion.answer_en,
        funFact: isHindi ? this.activeQuestion.fun_fact_hi : this.activeQuestion.fun_fact_en,
        multiplier
      }
    });
  }

  showScoreboard() {
    this.status = 'SCOREBOARD';
    io.to(this.code).emit('GAME_PHASE_CHANGE', {
      status: 'SCOREBOARD',
      room: this.getPublicState(),
      leaderboard: this.getLeaderboard()
    });
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        score: p.score,
        roundScore: p.roundScore,
        fooledCount: p.fooledCount,
        truthFoundCount: p.truthFoundCount,
        gullibleCount: p.gullibleCount
      }))
      .sort((a, b) => b.score - a.score);
  }

  finishGame() {
    this.status = 'GAME_OVER';
    this.stopTimer();

    const leaderboard = this.getLeaderboard();

    // Calculate fun superlatives
    let mostDeceptive = null;
    let sharpestEye = null;
    let mostGullible = null;

    if (leaderboard.length > 0) {
      mostDeceptive = [...leaderboard].sort((a, b) => b.fooledCount - a.fooledCount)[0];
      sharpestEye = [...leaderboard].sort((a, b) => b.truthFoundCount - a.truthFoundCount)[0];
      mostGullible = [...leaderboard].sort((a, b) => b.gullibleCount - a.gullibleCount)[0];
    }

    io.to(this.code).emit('GAME_PHASE_CHANGE', {
      status: 'GAME_OVER',
      room: this.getPublicState(),
      podium: {
        first: leaderboard[0] || null,
        second: leaderboard[1] || null,
        third: leaderboard[2] || null,
        all: leaderboard,
        superlatives: {
          mostDeceptive: mostDeceptive && mostDeceptive.fooledCount > 0 ? mostDeceptive : null,
          sharpestEye: sharpestEye && sharpestEye.truthFoundCount > 0 ? sharpestEye : null,
          mostGullible: mostGullible && mostGullible.gullibleCount > 0 ? mostGullible : null
        }
      }
    });
  }

  resetToLobby() {
    this.status = 'LOBBY';
    this.stopTimer();
    this.currentRound = 1;
    this.currentQuestionIdx = 0;
    this.questionsList = [];
    this.activeQuestion = null;
    this.bluffs = [];

    this.players.forEach(p => {
      p.score = 0;
      p.roundScore = 0;
      p.fooledCount = 0;
      p.truthFoundCount = 0;
      p.gullibleCount = 0;
      p.submittedBluff = false;
      p.votedForId = null;
    });

    io.to(this.code).emit('GAME_PHASE_CHANGE', {
      status: 'LOBBY',
      room: this.getPublicState()
    });
  }
}

// Socket.IO Events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Create a new room
  socket.on('CREATE_ROOM', ({ playerId, name, avatar, color, language, settings }, callback) => {
    // Detect public base URL from socket headers or environment
    const rawHost = socket.handshake.headers['x-forwarded-host'] || socket.handshake.headers.host;
    const proto = socket.handshake.headers['x-forwarded-proto'] || (rawHost && rawHost.includes('localhost') ? 'http' : 'https');
    const baseUrl = rawHost ? `${proto}://${rawHost}` : (process.env.PUBLIC_URL || `http://${LOCAL_IP}:${PORT}`);

    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id, playerId, { language, ...settings }, baseUrl);
    rooms.set(code, room);

    socket.join(code);
    const player = room.addPlayer(playerId, socket.id, name, avatar, color);

    console.log(`Room created: ${code} by ${player.name} (${playerId}) [URL: ${baseUrl}]`);
    if (callback) callback({ success: true, room: room.getPublicState(), player });

    io.to(code).emit('ROOM_UPDATE', room.getPublicState());
  });

  // Join existing room
  socket.on('JOIN_ROOM', ({ code, playerId, name, avatar, color }, callback) => {
    const upperCode = (code || '').toUpperCase().trim();
    const room = rooms.get(upperCode);

    if (!room) {
      if (callback) callback({ success: false, message: 'Room not found! Check code.' });
      return;
    }

    if (room.status !== 'LOBBY' && !room.players.has(playerId)) {
      if (callback) callback({ success: false, message: 'Game already in progress!' });
      return;
    }

    if (room.players.size >= 8 && !room.players.has(playerId)) {
      if (callback) callback({ success: false, message: 'Room is full (max 8 players)!' });
      return;
    }

    socket.join(upperCode);
    const player = room.addPlayer(playerId, socket.id, name, avatar, color);

    console.log(`Player ${player.name} joined room ${upperCode}`);
    if (callback) callback({ success: true, room: room.getPublicState(), player });

    io.to(upperCode).emit('ROOM_UPDATE', room.getPublicState());
    io.to(upperCode).emit('PLAYER_JOINED', { player, room: room.getPublicState() });
  });

  // Host updates language or settings
  socket.on('UPDATE_SETTINGS', ({ code, language, settings }) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'LOBBY') return;

    if (language) room.language = language;
    if (settings) room.settings = { ...room.settings, ...settings };

    io.to(code).emit('ROOM_UPDATE', room.getPublicState());
  });

  // Host starts the game
  socket.on('START_GAME', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'LOBBY') return;

    const connectedCount = Array.from(room.players.values()).filter(p => p.connected).length;
    if (connectedCount < 2) {
      socket.emit('ERROR', { message: 'Need at least 2 players to start!' });
      return;
    }

    console.log(`Starting game in room ${code} with ${connectedCount} players`);
    room.startMatch();
  });

  // Player submits a bluff
  socket.on('SUBMIT_BLUFF', ({ code, playerId, bluffText }, callback) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'PROMPT') return;

    const accepted = room.recordBluff(playerId, bluffText);
    if (callback) callback({ success: accepted });
  });

  // Player votes for a card
  socket.on('SUBMIT_VOTE', ({ code, playerId, cardId }, callback) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'VOTING') return;

    const accepted = room.recordVote(playerId, cardId);
    if (callback) callback({ success: accepted });
  });

  // Advance to scoreboard after reveal
  socket.on('PROCEED_TO_SCOREBOARD', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'REVEAL') return;
    room.showScoreboard();
  });

  // Advance to next question from scoreboard
  socket.on('PROCEED_TO_NEXT_QUESTION', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'SCOREBOARD') return;
    room.nextQuestion();
  });

  // Play again (restart from lobby)
  socket.on('PLAY_AGAIN', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'GAME_OVER') return;
    room.resetToLobby();
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    rooms.forEach((room) => {
      let changed = false;
      room.players.forEach((player) => {
        if (player.socketId === socket.id) {
          player.connected = false;
          changed = true;
          console.log(`Player ${player.name} disconnected from room ${room.code}`);
        }
      });
      if (changed) {
        io.to(room.code).emit('ROOM_UPDATE', room.getPublicState());
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`🎉 BLUFF & BAFFLE Party Game Server Running!`);
  console.log(`📡 Local Network URL: http://${LOCAL_IP}:${PORT}`);
  console.log(`💻 Local Machine URL: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
