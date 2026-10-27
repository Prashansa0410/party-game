const { io } = require('socket.io-client');
const http = require('http');

console.log("Starting Bluff & Baffle End-to-End Simulation Test...");

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  const client1 = io(SERVER_URL);
  const client2 = io(SERVER_URL);

  await new Promise((resolve) => client1.on('connect', resolve));
  await new Promise((resolve) => client2.on('connect', resolve));
  console.log("✓ Both test clients connected to server");

  let roomCode = null;

  // 1. Client 1 creates room
  await new Promise((resolve) => {
    client1.emit('CREATE_ROOM', {
      playerId: 'test_p1',
      name: 'Rohan',
      avatar: '🦊',
      color: '#8B5CF6',
      language: 'hi',
      settings: { totalRounds: 1, questionsPerRound: 1, promptTimerSec: 5, votingTimerSec: 5 }
    }, (res) => {
      console.log(`✓ Room created with code: ${res.room.code}`);
      roomCode = res.room.code;
      resolve();
    });
  });

  // 2. Client 2 joins room
  await new Promise((resolve) => {
    client2.emit('JOIN_ROOM', {
      code: roomCode,
      playerId: 'test_p2',
      name: 'Priya',
      avatar: '🐼',
      color: '#EC4899'
    }, (res) => {
      console.log(`✓ Player 2 joined room. Total players: ${res.room.players.length}`);
      resolve();
    });
  });

  // 3. Start Game
  const promptPromise = new Promise((resolve) => {
    client1.on('GAME_PHASE_CHANGE', (payload) => {
      if (payload.status === 'PROMPT') {
        console.log(`✓ Game Phase changed to PROMPT. Question: ${payload.room.activeQuestion.prompt}`);
        resolve(payload);
      }
    });
  });

  client1.emit('START_GAME', { code: roomCode });
  const promptData = await promptPromise;

  // 4. Submit bluffs
  const votingPromise = new Promise((resolve) => {
    client1.on('GAME_PHASE_CHANGE', (payload) => {
      if (payload.status === 'VOTING') {
        console.log(`✓ Game Phase changed to VOTING`);
        resolve(payload);
      }
    });
  });

  client1.emit('SUBMIT_BLUFF', {
    code: roomCode,
    playerId: 'test_p1',
    bluffText: 'बिल्कुल बिना जूतों के'
  });

  client2.emit('SUBMIT_BLUFF', {
    code: roomCode,
    playerId: 'test_p2',
    bluffText: 'हाथ बांधकर'
  });

  await votingPromise;

  // 5. Check voting cards delivered to Client 1
  let client1Cards = [];
  await new Promise((resolve) => {
    client1.on('VOTING_OPTIONS', ({ cards }) => {
      client1Cards = cards;
      console.log(`✓ Client 1 received ${cards.length} voting cards:`);
      cards.forEach(c => console.log(`   - "${c.text}" (isOwn: ${c.isOwn})`));
      resolve();
    });
  });

  // 6. Submit votes
  const revealPromise = new Promise((resolve) => {
    client1.on('GAME_PHASE_CHANGE', (payload) => {
      if (payload.status === 'REVEAL') {
        console.log(`✓ Game Phase changed to REVEAL`);
        resolve(payload);
      }
    });
  });

  // Client 1 votes for Client 2's card
  const client2Card = client1Cards.find(c => c.text === 'हाथ बांधकर');
  // Client 2 votes for the Real Truth card
  const realCard = client1Cards.find(c => !c.isOwn && c.text !== 'हाथ बांधकर');

  client1.emit('SUBMIT_VOTE', {
    code: roomCode,
    playerId: 'test_p1',
    cardId: client2Card ? client2Card.id : client1Cards[0].id
  });

  client2.emit('SUBMIT_VOTE', {
    code: roomCode,
    playerId: 'test_p2',
    cardId: realCard ? realCard.id : client1Cards[1].id
  });

  const revealData = await revealPromise;
  console.log(`✓ Reveal Data received. Real Answer: "${revealData.revealData.realAnswer}"`);

  // 7. Proceed to Scoreboard
  const scoreboardPromise = new Promise((resolve) => {
    client1.on('GAME_PHASE_CHANGE', (payload) => {
      if (payload.status === 'SCOREBOARD') {
        console.log(`✓ Game Phase changed to SCOREBOARD`);
        console.log("   Leaderboard:", payload.leaderboard.map(p => `${p.name}: ${p.score} pts`));
        resolve(payload);
      }
    });
  });

  client1.emit('PROCEED_TO_SCOREBOARD', { code: roomCode });
  await scoreboardPromise;

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The real-time party game works end-to-end!");

  client1.disconnect();
  client2.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
