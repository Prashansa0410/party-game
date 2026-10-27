# 🎭 Bluff & Baffle (झूठ या सच)
### Real-Time Party Game for 2–8 Players

A multiplayer party game inspired by *Fibbage* and *Balderdash*, playable from any mobile phone or computer browser by joining with a **4-letter room code** or **QR code**.

---

## 🌟 Key Features

1. **Dual Language Support (English & Conversational Hindi)**:
   - **Language Selection**: Room host can choose **आसान हिन्दी (Easy Conversational Hindi)**, **English**, or **Mixed**.
   - **Accessible Hindi**: Questions and UI use natural, modern Hindi with familiar English words (like *race, phone, doctor, train, score, points*) so that kids, teens, and elders can all enjoy without archaic dictionary words!
   - **Independent UI Toggle**: Any player can toggle their individual screen between English and हिन्दी with one tap.

2. **2 to 8 Player Dynamic Balancing**:
   - Works for 2 to 8 players.
   - For 2–3 players, the game automatically injects clever **House Decoy Lies** from the question bank so the voting board always has at least 4 enticing options to choose from!

3. **Room Code & QR Code Quick Join**:
   - The host screen displays a prominent 4-letter room code and a **QR Code**.
   - Friends on the same Wi-Fi network can simply point their iPhone or Android camera at the screen to join in 2 seconds—no app store downloads needed!

4. **Bizarre Real Facts & High Stakes**:
   - Curated bank of 30+ family-friendly, unbelievable true trivia questions across history, weird science, animals, food, and inventions.
   - **Round 1**: Standard stakes (+500 truth, +250 fool).
   - **Round 2**: Double Trouble (+1,000 truth, +500 fool).
   - **Round 3**: Grand Finale (+1,500 truth, +750 fool).

5. **Step-by-Step Reveal & Victory Podium**:
   - Animated reveal showing who fell for which lie, who invented it, and the grand reveal of the actual truth with the fascinating backstory.
   - Confetti victory podium crowning 1st, 2nd, and 3rd place, plus fun superlatives:
     - 🎭 **Master of Deception** (fooled the most friends)
     - 🔍 **Truth Seeker** (sharpest eye for the real truth)
     - 🎣 **Most Gullible** (fell for the most tricks)

6. **Zero-Dependency Sound Synthesizer**:
   - Interactive Web Audio sound effects (pops, submit whooshes, ticking suspense timers, reveal chimes, fanfare victory anthem) with a mute/unmute toggle.

---

## 🚀 How to Run the Game

### Start the Server:
```bash
cd party-game
npm start
```

### Open the Game:
- **On Host Machine (Laptop/PC/TV)**:
  Open [http://localhost:3000](http://localhost:3000)
- **On Mobile Devices (Smartphones/Tablets on the same Wi-Fi)**:
  Scan the QR code on the host screen or open:
  `http://<your-local-ip>:3000` (e.g., `http://192.168.1.7:3000`)

---

## 🎮 How to Play

1. **Join the Lobby**: 
   - Click **Create Room** (to be the host) or **Join Room**.
   - Choose your favorite avatar emoji (🦊, 🦁, 🐼, 🚀, 🍕, etc.) and color.
   - Enter your nickname and the 4-letter room code.
2. **Start Match**: 
   - When at least 2 players have joined, the host clicks **Start Match! 🏁**.
3. **The Bluff Phase (35s)**:
   - Read the bizarre true fact with the blank `_____`.
   - Secretly type a convincing lie on your phone to fool your friends.
   - *Tip:* If you accidentally type the real answer, the game awards you a +250 early genius bonus and asks you to enter a lie instead!
4. **The Voting Phase (25s)**:
   - All bluffs plus the real answer are shuffled onto your screen.
   - Vote for the answer you believe is the real truth (you can't vote for your own bluff!).
5. **The Reveal**:
   - Watch the animated cards reveal who got tricked by whom and who uncovered the truth!
6. **Podium**:
   - Celebrate the winner and hit **Play Again** for another match!
