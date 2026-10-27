// Bluff & Baffle Client Application - Clean, Minimal & Elegant UX

const socket = io();

// State
let currentTab = 'join'; // 'join' or 'create'
let selectedLang = 'hi'; // game question language: 'hi', 'en', 'mix'
let currentUiLang = 'hi'; // UI display language: 'hi' or 'en'
let selectedAvatar = '🦊';
let selectedColor = '#27272a';
let playerId = sessionStorage.getItem('bb_player_id') || ('p_' + Math.random().toString(36).substring(2, 9));
sessionStorage.setItem('bb_player_id', playerId);

let myPlayerInfo = null;
let currentRoom = null;
let votingCards = [];
let myVotedCardId = null;

// Curated Minimalist Avatars & Sophisticated Palette
const AVATARS = ['🦊', '🦉', '🐺', '🦁', '🐼', '🦅', '🦌', '⚡', '🌙', '🎯'];
const COLORS = [
  '#27272a', // Zinc
  '#1e293b', // Slate
  '#1e1b4b', // Deep Indigo
  '#14532d', // Deep Forest
  '#3f3f46', // Cool Gray
  '#701a75', // Deep Fuchsia
  '#7c2d12', // Terracotta
  '#0f766e'  // Deep Teal
];

// DOM Elements
const screens = {
  welcome: document.getElementById('screenWelcome'),
  lobby: document.getElementById('screenLobby'),
  prompt: document.getElementById('screenPrompt'),
  voting: document.getElementById('screenVoting'),
  reveal: document.getElementById('screenReveal'),
  scoreboard: document.getElementById('screenScoreboard'),
  gameOver: document.getElementById('screenGameOver')
};

// Lifecycle Initialization
document.addEventListener('DOMContentLoaded', () => {
  renderAvatarPicker();

  // Check URL query parameters (?room=ABCD)
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    document.getElementById('inputRoomCode').value = roomParam.toUpperCase();
    switchTab('join');
  }

  // Restore saved player name if available
  const savedName = localStorage.getItem('bb_player_name');
  if (savedName) {
    document.getElementById('inputNickname').value = savedName;
  }

  // Restore saved UI language preference
  const savedUiLang = localStorage.getItem('bb_ui_lang');
  if (savedUiLang && I18N[savedUiLang]) {
    currentUiLang = savedUiLang;
  }
  updateUiLanguageDisplay();
});

// Switch visible screen
function showScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    if (screens[key]) {
      screens[key].classList.toggle('hidden', key !== screenKey);
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Language System (UI translation)
function toggleUiLanguage() {
  currentUiLang = (currentUiLang === 'hi') ? 'en' : 'hi';
  localStorage.setItem('bb_ui_lang', currentUiLang);
  updateUiLanguageDisplay();
}

function t(key) {
  const dict = I18N[currentUiLang] || I18N['en'];
  return dict[key] || key;
}

function updateUiLanguageDisplay() {
  const dict = I18N[currentUiLang] || I18N['en'];

  // Button label
  document.getElementById('currentUiLangLabel').textContent = (currentUiLang === 'hi') ? 'English' : 'हिन्दी';

  // Header
  document.getElementById('headerAppTitle').textContent = dict.appTitle;
  document.getElementById('headerSubTitle').textContent = dict.tagline;

  // Welcome Screen
  document.getElementById('welcomeTagline').textContent = (currentUiLang === 'hi') ? 'असली सच पहचानिए।' : 'Spot the real truth.';
  document.getElementById('welcomeSub').textContent = (currentUiLang === 'hi')
    ? 'अजीब और असली तथ्यों पर आधारित समझदार झूठे जवाब बनाएं, दोस्तों को भ्रमित करें और अंक जीतें।'
    : 'Write convincing fake answers to obscure real facts. Deceive your friends, detect the truth, and climb the leaderboard.';
  document.getElementById('tabJoin').textContent = dict.joinRoomTab;
  document.getElementById('tabCreate').textContent = dict.createRoomTab;
  document.getElementById('lblNickname').textContent = dict.enterName;
  document.getElementById('inputNickname').placeholder = dict.namePlaceholder;
  document.getElementById('lblRoomCode').textContent = dict.roomCode;
  document.getElementById('inputRoomCode').placeholder = dict.codePlaceholder;
  document.getElementById('lblGameLang').textContent = dict.gameLangTitle;
  document.getElementById('lblAvatar').textContent = dict.chooseAvatar;
  updateMainActionButtonLabel();

  // Lobby
  document.getElementById('lobbyPlayersHeader').textContent = dict.playersCount;
  document.getElementById('btnStartGame').textContent = dict.startGameBtn;
  document.getElementById('lobbyWaitingMsg').textContent = dict.waitingForHost;

  // In-Game Labels
  document.getElementById('lblWriteBluff').textContent = dict.writeYourBluff;
  document.getElementById('inputBluff').placeholder = dict.bluffPlaceholder;
  document.getElementById('btnSubmitBluff').textContent = dict.submitBluffBtn;
  document.getElementById('bluffLockedTitle').textContent = dict.bluffLocked;
  document.getElementById('bluffLockedSubtitle').textContent = dict.bluffLockedSubtitle;
  document.getElementById('lblWhoSubmitted').textContent = dict.whoSubmitted;
  document.getElementById('votingMainTitle').textContent = dict.voteTitle;
  document.getElementById('revealTitleHeader').textContent = dict.revealTitle;
  document.getElementById('btnProceedScoreboard').textContent = dict.proceedToScoreboard;
  document.getElementById('scoreboardHeader').textContent = dict.leaderboardTitle;
  document.getElementById('btnNextQuestion').textContent = dict.nextQuestionBtn;
  document.getElementById('podiumHeader').textContent = dict.gameOverTitle;
  document.getElementById('btnPlayAgain').textContent = dict.playAgainBtn;
}

function updateMainActionButtonLabel() {
  const btn = document.getElementById('btnMainAction');
  const dict = I18N[currentUiLang] || I18N['en'];
  btn.textContent = (currentTab === 'create') ? dict.createBtn : dict.joinBtn;
}

// Avatar & Color Picker
function renderAvatarPicker() {
  const container = document.getElementById('avatarPickerContainer');
  container.innerHTML = '';

  AVATARS.forEach((emoji, idx) => {
    const color = COLORS[idx % COLORS.length];
    const isSelected = (emoji === selectedAvatar);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-lg transition border ${
      isSelected 
        ? 'border-zinc-300 ring-2 ring-zinc-500/30 scale-105' 
        : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-700'
    }`;
    btn.style.backgroundColor = color;
    btn.textContent = emoji;
    btn.onclick = () => {
      selectedAvatar = emoji;
      selectedColor = color;
      soundFX.playPop();
      renderAvatarPicker();
    };
    container.appendChild(btn);
  });
}

// Welcome Screen Tab Switching
function switchTab(tab) {
  currentTab = tab;
  soundFX.playPop();

  const tabJoin = document.getElementById('tabJoin');
  const tabCreate = document.getElementById('tabCreate');
  const roomCodeGroup = document.getElementById('roomCodeGroup');
  const gameLangGroup = document.getElementById('gameLangGroup');

  if (tab === 'join') {
    tabJoin.className = 'py-2 rounded-lg font-semibold text-xs transition bg-zinc-900 text-zinc-100 shadow-sm border border-zinc-800';
    tabCreate.className = 'py-2 rounded-lg font-semibold text-xs transition text-zinc-400 hover:text-zinc-200';
    roomCodeGroup.classList.remove('hidden');
    gameLangGroup.classList.add('hidden');
  } else {
    tabCreate.className = 'py-2 rounded-lg font-semibold text-xs transition bg-zinc-900 text-zinc-100 shadow-sm border border-zinc-800';
    tabJoin.className = 'py-2 rounded-lg font-semibold text-xs transition text-zinc-400 hover:text-zinc-200';
    roomCodeGroup.classList.add('hidden');
    gameLangGroup.classList.remove('hidden');
  }
  updateMainActionButtonLabel();
}

function selectGameLang(lang) {
  selectedLang = lang;
  soundFX.playPop();
  ['hi', 'en', 'mix'].forEach(l => {
    const btn = document.getElementById(`langBtn${l.charAt(0).toUpperCase() + l.slice(1)}`);
    if (l === lang) {
      btn.className = 'p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition border-zinc-400 bg-zinc-850 text-white';
    } else {
      btn.className = 'p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200';
    }
  });
}

// Sound FX toggle
function toggleSound() {
  const isMuted = soundFX.toggleMute();
  const btn = document.getElementById('soundToggleBtn');
  btn.textContent = isMuted ? '🔇' : '🔊';
  if (!isMuted) soundFX.playPop();
}

// Toast alerts helper - Minimal and refined
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const borderColor = type === 'error' ? 'border-red-500/40 text-red-200' : (type === 'bonus' ? 'border-amber-500/40 text-amber-200' : 'border-zinc-700 text-zinc-200');
  toast.className = `p-3 rounded-xl bg-zinc-900 border ${borderColor} text-xs font-medium shadow-lg backdrop-blur-sm flex items-center justify-between pointer-events-auto transition-all transform duration-200`;
  toast.innerHTML = `<span>${message}</span><span class="ml-3 cursor-pointer text-zinc-500 hover:text-zinc-300" onclick="this.parentElement.remove()">✕</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Copy Room Link to Clipboard
function copyRoomLink() {
  const url = currentRoom ? currentRoom.joinUrl : window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    soundFX.playPop();
    showToast(t('copiedLink'), 'info');
  }).catch(() => {
    showToast(`Code: ${currentRoom ? currentRoom.code : ''}`, 'info');
  });
}

// Form Submission: Create or Join
function submitWelcomeForm() {
  const nameInput = document.getElementById('inputNickname');
  const name = nameInput.value.trim() || `Player ${Math.floor(Math.random() * 90) + 10}`;
  localStorage.setItem('bb_player_name', name);

  if (currentTab === 'create') {
    socket.emit('CREATE_ROOM', {
      playerId,
      name,
      avatar: selectedAvatar,
      color: selectedColor,
      language: selectedLang,
      settings: { totalRounds: 3, questionsPerRound: 2 }
    }, (res) => {
      if (res && res.success) {
        soundFX.playPop();
        myPlayerInfo = res.player;
        currentRoom = res.room;
        renderLobby(res.room);
        showScreen('lobby');
      }
    });
  } else {
    const code = document.getElementById('inputRoomCode').value.trim();
    if (!code) {
      showToast(t('roomCode') + ' required', 'error');
      return;
    }

    socket.emit('JOIN_ROOM', {
      code,
      playerId,
      name,
      avatar: selectedAvatar,
      color: selectedColor
    }, (res) => {
      if (res && res.success) {
        soundFX.playPop();
        myPlayerInfo = res.player;
        currentRoom = res.room;
        renderLobby(res.room);
        showScreen('lobby');
      } else {
        showToast(res.message || t('errRoomNotFound'), 'error');
      }
    });
  }
}

// Render Lobby Screen
function renderLobby(room) {
  document.getElementById('lobbyRoomCode').textContent = room.code;
  document.getElementById('lobbyUrlText').textContent = room.joinUrl;
  if (room.qrCodeDataUrl) {
    document.getElementById('lobbyQrCode').src = room.qrCodeDataUrl;
  }

  // Update Player Count Badge
  document.getElementById('lobbyPlayerCountBadge').textContent = `${room.players.length} / 8`;

  // Render Joined Players
  const grid = document.getElementById('lobbyPlayersGrid');
  grid.innerHTML = '';
  room.players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'minimal-card p-2.5 rounded-xl flex items-center gap-2.5';
    card.innerHTML = `
      <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style="background-color: ${p.color}">
        ${p.avatar}
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-medium text-xs text-zinc-200 truncate flex items-center gap-1">
          ${p.name} ${p.isHost ? '<span class="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">HOST</span>' : ''}
        </div>
        <div class="text-[10px] text-zinc-500">
          ${p.connected ? 'Ready' : 'Away'}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Host Controls Visibility
  const isHost = myPlayerInfo && myPlayerInfo.isHost;
  const hostArea = document.getElementById('lobbyHostArea');
  const waitArea = document.getElementById('lobbyWaitArea');
  const btnStart = document.getElementById('btnStartGame');

  if (isHost) {
    hostArea.classList.remove('hidden');
    waitArea.classList.add('hidden');
    const select = document.getElementById('lobbyLangSelect');
    if (select) select.value = room.language || 'hi';

    const canStart = room.players.length >= 2;
    btnStart.disabled = !canStart;
    btnStart.title = canStart ? '' : t('needMinPlayers');
  } else {
    hostArea.classList.add('hidden');
    waitArea.classList.remove('hidden');
  }
}

function changeLobbySettings() {
  const select = document.getElementById('lobbyLangSelect');
  if (currentRoom && select) {
    socket.emit('UPDATE_SETTINGS', {
      code: currentRoom.code,
      language: select.value
    });
  }
}

function requestStartGame() {
  if (!currentRoom) return;
  soundFX.playPop();
  socket.emit('START_GAME', { code: currentRoom.code });
}

// Render Prompt Phase
function renderPromptScreen(room) {
  showScreen('prompt');
  const q = room.activeQuestion;
  if (!q) return;

  const multiplier = q.scoreMultiplier || 1;
  const multiplierTag = multiplier > 1 ? ` • ${multiplier}x POINTS` : '';

  document.getElementById('promptRoundBadge').textContent = `${t('round')} ${room.currentRound} ${t('of')} ${room.totalRounds}${multiplierTag}`;
  document.getElementById('promptCategoryBadge').textContent = q.category;
  document.getElementById('promptTimerSec').textContent = room.timerRemaining || 35;

  // Format prompt with clean highlight
  const formattedPrompt = q.prompt.replace(/_____/g, `<span class="inline-block border-b-2 border-zinc-300 px-2 font-bold text-zinc-100">_____</span>`);
  document.getElementById('promptQuestionText').innerHTML = formattedPrompt;

  // Reset input area
  document.getElementById('bluffInputArea').classList.remove('hidden');
  document.getElementById('bluffSubmittedArea').classList.add('hidden');
  document.getElementById('inputBluff').value = '';
  document.getElementById('bluffCharCounter').textContent = '0/80';
  document.getElementById('btnSubmitBluff').disabled = false;

  updateBluffSubmissionStatus(room.players);
}

function submitBluff() {
  const input = document.getElementById('inputBluff');
  const text = input.value.trim();
  if (!text) {
    showToast("Please write a fake answer", "error");
    return;
  }

  soundFX.playSubmit();
  document.getElementById('btnSubmitBluff').disabled = true;

  socket.emit('SUBMIT_BLUFF', {
    code: currentRoom.code,
    playerId,
    bluffText: text
  }, (res) => {
    if (res && res.success) {
      document.getElementById('bluffInputArea').classList.add('hidden');
      document.getElementById('bluffSubmittedArea').classList.remove('hidden');
    } else {
      document.getElementById('btnSubmitBluff').disabled = false;
    }
  });
}

function updateBluffSubmissionStatus(players) {
  const container = document.getElementById('bluffPlayersStatus');
  container.innerHTML = '';

  players.forEach(p => {
    const dot = document.createElement('div');
    dot.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
      p.submittedBluff 
        ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300' 
        : 'border-zinc-800 bg-zinc-950 text-zinc-600'
    }`;
    dot.innerHTML = `<span>${p.avatar}</span><span>${p.name}</span><span>${p.submittedBluff ? '✓' : '…'}</span>`;
    container.appendChild(dot);
  });
}

// Render Voting Screen
function renderVotingScreen(room) {
  showScreen('voting');
  myVotedCardId = null;

  document.getElementById('votingTimerSec').textContent = room.timerRemaining || 25;
  document.getElementById('votedConfirmedArea').classList.add('hidden');

  if (room.activeQuestion) {
    document.getElementById('votingQuestionReminder').textContent = room.activeQuestion.prompt.replace(/_____/g, '_____');
  }

  renderVotingCardsGrid();
}

function renderVotingCardsGrid() {
  const grid = document.getElementById('votingCardsGrid');
  grid.innerHTML = '';

  votingCards.forEach(card => {
    const isOwn = card.isOwn;
    const isSelected = (myVotedCardId === card.id);

    const btn = document.createElement('button');
    btn.type = 'button';

    if (isOwn) {
      btn.className = 'w-full p-3.5 rounded-xl minimal-card border border-zinc-850 text-left opacity-40 cursor-not-allowed flex items-center justify-between';
      btn.disabled = true;
      btn.innerHTML = `
        <span class="text-xs font-medium text-zinc-400 line-through">${card.text}</span>
        <span class="text-[10px] text-zinc-500 font-mono tracking-wider">(${t('yourOwnBluff')})</span>
      `;
    } else {
      btn.className = `w-full p-3.5 rounded-xl minimal-card text-left transition flex items-center justify-between ${
        isSelected 
          ? 'border-zinc-300 bg-zinc-850 shadow-sm' 
          : 'hover:border-zinc-700'
      }`;
      btn.innerHTML = `
        <span class="text-xs md:text-sm font-medium text-zinc-200">${card.text}</span>
        <span class="w-4 h-4 rounded-full border ${isSelected ? 'border-zinc-200 bg-zinc-200' : 'border-zinc-700'} flex items-center justify-center">
          ${isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-zinc-950"></span>' : ''}
        </span>
      `;
      btn.onclick = () => {
        if (!myVotedCardId) {
          submitVote(card.id);
        }
      };
    }
    grid.appendChild(btn);
  });
}

function submitVote(cardId) {
  myVotedCardId = cardId;
  soundFX.playPop();

  document.getElementById('votedConfirmedArea').classList.remove('hidden');
  renderVotingCardsGrid();

  socket.emit('SUBMIT_VOTE', {
    code: currentRoom.code,
    playerId,
    cardId
  });
}

// Render Step-by-Step Reveal Screen
function renderRevealScreen(room, revealData) {
  showScreen('reveal');
  const container = document.getElementById('revealShowcaseContainer');
  container.innerHTML = '';

  const cards = revealData.cards || [];
  const realAnswer = revealData.realAnswer;
  const funFact = revealData.funFact;
  const multiplier = revealData.multiplier || 1;

  const fakeCards = cards.filter(c => !c.isReal);
  const realCard = cards.find(c => c.isReal);

  let currentStep = 0;
  const totalCards = fakeCards.length + 1;

  function showStep(index) {
    container.innerHTML = '';
    document.getElementById('revealStepCounter').textContent = `${index + 1} / ${totalCards}`;

    if (index < fakeCards.length) {
      // Reveal Bluff Card
      const card = fakeCards[index];
      const cardEl = document.createElement('div');
      cardEl.className = 'minimal-card p-5 md:p-6 rounded-xl border border-zinc-800 space-y-4';

      const voterTags = card.voters.map(v => `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-850 border border-zinc-750 text-zinc-300">
          ${v.avatar} ${v.name}
        </span>
      `).join(' ');

      const authorText = card.author
        ? `<div class="text-xs text-zinc-400 font-medium">${t('writtenBy')} <strong class="text-zinc-200">${card.author.avatar} ${card.author.name}</strong> <span class="text-zinc-500 font-mono text-[11px]">(+${card.pointsAwarded} pts)</span></div>`
        : `<div class="text-xs text-zinc-500 font-mono tracking-wider">${t('houseDecoy')}</div>`;

      cardEl.innerHTML = `
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">${t('revealingCard')} ${index + 1}</div>
        <h4 class="text-xl font-bold text-zinc-100">"${card.text}"</h4>
        ${authorText}
        <div class="pt-3 border-t border-zinc-850">
          <span class="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">${t('fooledByThis')}</span>
          <div class="flex flex-wrap gap-1.5">
            ${card.voters.length > 0 ? voterTags : `<span class="text-xs text-zinc-600 italic">${t('nobodyFooled')}</span>`}
          </div>
        </div>
      `;
      container.appendChild(cardEl);
      soundFX.playBluffReveal();

    } else {
      // The Real Truth Reveal
      const realEl = document.createElement('div');
      realEl.className = 'minimal-panel p-6 rounded-xl border border-zinc-700 space-y-4';

      const truthPoints = 500 * multiplier;
      const voters = realCard ? realCard.voters : [];
      const voterTags = voters.map(v => `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-zinc-850 border border-zinc-700 text-zinc-200">
          ${v.avatar} ${v.name} <span class="text-zinc-400 font-mono text-[10px]">(+${truthPoints})</span>
        </span>
      `).join(' ');

      realEl.innerHTML = `
        <div class="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">${t('theRealTruthIs')}</div>
        <h3 class="text-2xl font-bold text-zinc-100">
          ${realAnswer}
        </h3>
        <div class="py-2.5 border-y border-zinc-850">
          <span class="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">${t('sharpMinds')}</span>
          <div class="flex flex-wrap gap-1.5">
            ${voters.length > 0 ? voterTags : `<span class="text-xs text-zinc-600 italic">${t('nobodyFoundTruth')}</span>`}
          </div>
        </div>
        <div class="p-3 bg-zinc-950 rounded-lg text-left text-xs text-zinc-400 border border-zinc-850">
          <strong class="text-zinc-300 block mb-1 text-[11px] uppercase tracking-wider">${t('funFactTitle')}</strong>
          ${funFact}
        </div>
      `;
      container.appendChild(realEl);
      soundFX.playTruthReveal();

      document.getElementById('btnProceedScoreboard').classList.remove('hidden');
      return;
    }

    // Step navigation button
    const navDiv = document.createElement('div');
    navDiv.className = 'flex justify-end pt-1';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'px-4 py-2 rounded-xl text-xs font-semibold btn-secondary';
    nextBtn.textContent = (index === fakeCards.length - 1) ? 'Reveal The Truth →' : 'Next Card →';
    nextBtn.onclick = () => {
      currentStep++;
      showStep(currentStep);
    };
    navDiv.appendChild(nextBtn);
    container.appendChild(navDiv);
  }

  showStep(0);
}

function requestProceedScoreboard() {
  if (!currentRoom) return;
  soundFX.playPop();
  socket.emit('PROCEED_TO_SCOREBOARD', { code: currentRoom.code });
}

// Render Scoreboard Screen
function renderScoreboardScreen(room, leaderboard) {
  showScreen('scoreboard');
  document.getElementById('scoreboardRoundBadge').textContent = `ROUND ${room.currentRound} OF ${room.totalRounds}`;

  const list = document.getElementById('leaderboardList');
  list.innerHTML = '';

  leaderboard.forEach((p, idx) => {
    const row = document.createElement('div');
    const isMe = (p.id === playerId);
    const rankStr = String(idx + 1).padStart(2, '0');

    row.className = `p-3 rounded-xl minimal-card flex items-center justify-between border ${isMe ? 'border-zinc-500 bg-zinc-850' : 'border-zinc-850'}`;
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="font-mono text-xs font-bold text-zinc-500 w-6">${rankStr}</span>
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style="background-color: ${p.color}">
          ${p.avatar}
        </div>
        <div>
          <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
            ${p.name} ${isMe ? '<span class="text-[9px] px-1 py-0.2 rounded bg-zinc-700 text-zinc-300 font-mono">YOU</span>' : ''}
          </div>
          <div class="text-[10px] text-zinc-500 font-mono">
            ${p.fooledCount} fooled • ${p.truthFoundCount} correct
          </div>
        </div>
      </div>
      <div class="text-right">
        <div class="font-mono font-bold text-sm text-zinc-100">${p.score} pts</div>
        <div class="text-[10px] text-zinc-400 font-mono">+${p.roundScore} ${t('pointsThisRound')}</div>
      </div>
    `;
    list.appendChild(row);
  });

  const isHost = myPlayerInfo && myPlayerInfo.isHost;
  const hostArea = document.getElementById('scoreboardHostControls');
  if (isHost) {
    hostArea.classList.remove('hidden');
  } else {
    hostArea.classList.add('hidden');
  }
}

function requestNextQuestion() {
  if (!currentRoom) return;
  soundFX.playPop();
  socket.emit('PROCEED_TO_NEXT_QUESTION', { code: currentRoom.code });
}

// Render Game Over & Podium
function renderGameOverScreen(room, podium) {
  showScreen('gameOver');
  soundFX.playVictory();

  // Subtle confetti
  if (typeof confetti === 'function') {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  }

  // Render Top 3
  const top3Container = document.getElementById('podiumTop3');
  top3Container.innerHTML = '';

  const first = podium.first;
  const second = podium.second;
  const third = podium.third;

  const renderPodiumCard = (player, placeLabel, heightClass) => {
    if (!player) return `<div class="flex-1"></div>`;
    return `
      <div class="flex flex-col items-center">
        <div class="text-xl mb-1">${player.avatar}</div>
        <div class="font-semibold text-xs text-zinc-300 truncate max-w-[80px]">${player.name}</div>
        <div class="font-mono text-[11px] text-zinc-400">${player.score} pts</div>
        <div class="w-full ${heightClass} bg-zinc-900 border border-zinc-800 rounded-t-xl flex items-center justify-center font-mono font-bold text-xs text-zinc-400 mt-2">
          ${placeLabel}
        </div>
      </div>
    `;
  };

  top3Container.innerHTML = `
    ${renderPodiumCard(second, '2ND', 'h-16')}
    ${renderPodiumCard(first, '1ST', 'h-24')}
    ${renderPodiumCard(third, '3RD', 'h-12')}
  `;

  // Superlatives
  const superlatives = podium.superlatives || {};
  const badgesContainer = document.getElementById('podiumSuperlatives');
  badgesContainer.innerHTML = '';

  if (superlatives.mostDeceptive) {
    badgesContainer.innerHTML += `
      <div class="minimal-card p-2.5 rounded-xl border border-zinc-850 text-left">
        <div class="text-[10px] font-mono text-zinc-500 uppercase">${t('masterOfDeception')}</div>
        <div class="text-xs font-semibold text-zinc-200 mt-0.5">${superlatives.mostDeceptive.name} (${superlatives.mostDeceptive.fooledCount} fooled)</div>
      </div>
    `;
  }
  if (superlatives.sharpestEye) {
    badgesContainer.innerHTML += `
      <div class="minimal-card p-2.5 rounded-xl border border-zinc-850 text-left">
        <div class="text-[10px] font-mono text-zinc-500 uppercase">${t('truthSeeker')}</div>
        <div class="text-xs font-semibold text-zinc-200 mt-0.5">${superlatives.sharpestEye.name} (${superlatives.sharpestEye.truthFoundCount} truths)</div>
      </div>
    `;
  }
  if (superlatives.mostGullible) {
    badgesContainer.innerHTML += `
      <div class="minimal-card p-2.5 rounded-xl border border-zinc-850 text-left">
        <div class="text-[10px] font-mono text-zinc-500 uppercase">${t('mostGullible')}</div>
        <div class="text-xs font-semibold text-zinc-200 mt-0.5">${superlatives.mostGullible.name} (${superlatives.mostGullible.gullibleCount} bluffs)</div>
      </div>
    `;
  }
}

function requestPlayAgain() {
  if (!currentRoom) return;
  soundFX.playPop();
  socket.emit('PLAY_AGAIN', { code: currentRoom.code });
}

// Socket Events Listeners
socket.on('ROOM_UPDATE', (room) => {
  currentRoom = room;
  if (room.status === 'LOBBY') {
    renderLobby(room);
  }
});

socket.on('PLAYER_JOINED', ({ player, room }) => {
  soundFX.playPop();
  showToast(`${player.avatar} ${player.name} joined`, 'info');
  currentRoom = room;
  renderLobby(room);
});

socket.on('GAME_PHASE_CHANGE', (payload) => {
  currentRoom = payload.room;

  if (payload.status === 'LOBBY') {
    renderLobby(payload.room);
    showScreen('lobby');
  } else if (payload.status === 'PROMPT') {
    renderPromptScreen(payload.room);
  } else if (payload.status === 'VOTING') {
    renderVotingScreen(payload.room);
  } else if (payload.status === 'REVEAL') {
    renderRevealScreen(payload.room, payload.revealData);
  } else if (payload.status === 'SCOREBOARD') {
    renderScoreboardScreen(payload.room, payload.leaderboard);
  } else if (payload.status === 'GAME_OVER') {
    renderGameOverScreen(payload.room, payload.podium);
  }
});

socket.on('TIMER_TICK', ({ timerRemaining }) => {
  const promptTimer = document.getElementById('promptTimerSec');
  const votingTimer = document.getElementById('votingTimerSec');
  const promptBar = document.getElementById('promptTimerBar');
  const votingBar = document.getElementById('votingTimerBar');

  if (promptTimer) promptTimer.textContent = timerRemaining;
  if (votingTimer) votingTimer.textContent = timerRemaining;

  // Linear bar progress update
  if (promptBar) {
    const total = 35;
    const pct = Math.max(0, Math.min(100, (timerRemaining / total) * 100));
    promptBar.style.width = `${pct}%`;
  }
  if (votingBar) {
    const total = 25;
    const pct = Math.max(0, Math.min(100, (timerRemaining / total) * 100));
    votingBar.style.width = `${pct}%`;
  }

  if (timerRemaining <= 5 && timerRemaining > 0) {
    soundFX.playTick();
  }
});

socket.on('TRUTH_MATCH_BONUS', (data) => {
  soundFX.playVictory();
  const msg = (currentUiLang === 'hi') ? data.message_hi : data.message_en;
  showToast(msg, 'bonus');
  const input = document.getElementById('inputBluff');
  input.value = '';
  document.getElementById('btnSubmitBluff').disabled = false;
});

socket.on('PLAYER_SUBMITTED_BLUFF', ({ playerId, players }) => {
  updateBluffSubmissionStatus(players);
});

socket.on('VOTING_OPTIONS', ({ cards }) => {
  votingCards = cards;
  renderVotingCardsGrid();
});

socket.on('ERROR', ({ message }) => {
  showToast(message, 'error');
});
