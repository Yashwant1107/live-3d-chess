import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Chess } from 'chess.js';
import User from './models/User.js';
import Match from './models/Match.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const normalizeOrigin = (origin = '') => origin.trim().replace(/\/+$/, '');
const allowedOrigins = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const isAllowedOrigin = (origin) => {
  if (!origin || allowedOrigins.length === 0) {
    return true;
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizeOrigin(origin))) {
    return true;
  }

  return allowedOrigins.includes(normalizeOrigin(origin));
};
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ["GET", "POST"],
  credentials: true
};
const io = new Server(httpServer, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json());

let isDbConnected = false;

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB successfully!');
      isDbConnected = true;
    })
    .catch(err => console.error('MongoDB connection error. Is your server running?', err));
}

const STARTING_TIME_SECONDS = 60 * 60;

const getMoveColor = (move) => move.color === 'w' ? 'white' : 'black';
const getOpponent = (color) => color === 'white' ? 'black' : 'white';
const isSamePlayer = (a, b) => a && b && a.toString() === b.toString();

const pieceNames = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King'
};

const buildCapturedPieces = (history) => {
  const captured = { white: [], black: [] };

  history.forEach((move) => {
    if (move.captured) {
      captured[move.color === 'w' ? 'white' : 'black'].push({
        type: move.captured,
        color: move.color === 'w' ? 'black' : 'white',
        name: pieceNames[move.captured] || move.captured
      });
    }
  });

  return captured;
};

const updateClock = (gameObj) => {
  if (gameObj.gameStatus !== 'playing') return;

  const now = Date.now();
  const elapsed = Math.max(0, Math.floor((now - gameObj.lastClockUpdate) / 1000));
  if (elapsed === 0) return;

  const activeColor = gameObj.chess.turn() === 'w' ? 'white' : 'black';
  gameObj.timers[activeColor] = Math.max(0, gameObj.timers[activeColor] - elapsed);
  gameObj.lastClockUpdate = now;

  if (gameObj.timers[activeColor] <= 0) {
    gameObj.gameStatus = 'ended';
    gameObj.winner = getOpponent(activeColor);
    gameObj.winReason = 'Time Out';
  }
};

const applyGameOver = (gameObj) => {
  const game = gameObj.chess;

  if (game.isCheckmate()) {
    gameObj.gameStatus = 'ended';
    gameObj.winner = game.turn() === 'w' ? 'black' : 'white';
    gameObj.winReason = 'Checkmate';
  } else if (game.isDraw()) {
    gameObj.gameStatus = 'draw';
    gameObj.winner = null;
    gameObj.winReason = game.isStalemate() ? 'Stalemate' : 'Draw';
  }
};

const getPublicState = (gameObj) => {
  updateClock(gameObj);

  const verboseHistory = gameObj.chess.history({ verbose: true });
  const lastMove = verboseHistory.at(-1);

  return {
    fen: gameObj.chess.fen(),
    history: verboseHistory,
    lastMove: lastMove ? {
      piece: pieceNames[lastMove.piece] || lastMove.piece,
      pieceType: lastMove.piece,
      from: lastMove.from,
      to: lastMove.to,
      color: getMoveColor(lastMove),
      captured: lastMove.captured ? {
        type: lastMove.captured,
        name: pieceNames[lastMove.captured] || lastMove.captured
      } : null,
      flags: lastMove.flags,
      san: lastMove.san
    } : null,
    capturedPieces: buildCapturedPieces(verboseHistory),
    currentTurn: gameObj.chess.turn() === 'w' ? 'white' : 'black',
    timers: gameObj.timers,
    gameStatus: gameObj.gameStatus,
    winner: gameObj.winner,
    winReason: gameObj.winReason,
    drawOffer: gameObj.drawOffer
  };
};

const emitGameState = (roomId, gameObj, eventName = 'gameState', extra = {}) => {
  io.to(roomId).emit(eventName, {
    ...getPublicState(gameObj),
    ...extra
  });
};

const createGame = () => ({
  chess: new Chess(),
  players: { white: null, black: null },
  playerNames: { white: null, black: null },
  matchId: null,
  timers: { white: STARTING_TIME_SECONDS, black: STARTING_TIME_SECONDS },
  lastClockUpdate: Date.now(),
  gameStatus: 'playing',
  winner: null,
  winReason: null,
  drawOffer: null
});

const createGameFromMatch = (match) => {
  const gameObj = createGame();
  gameObj.matchId = match._id;

  if (match.fen) {
    gameObj.chess.load(match.fen);
  } else if (match.pgn) {
    gameObj.chess.loadPgn(match.pgn);
  }

  gameObj.players.white = match.whitePlayer;
  gameObj.players.black = match.blackPlayer;
  gameObj.timers = match.timers || gameObj.timers;
  gameObj.gameStatus = match.gameStatus || (match.status === 'ongoing' ? 'playing' : match.status);
  gameObj.winner = match.winner || null;
  gameObj.winReason = match.winReason || null;
  gameObj.drawOffer = match.drawOffer || null;
  gameObj.lastClockUpdate = Date.now();

  return gameObj;
};

const getPersistedStatus = (gameObj) => {
  if (gameObj.gameStatus === 'draw') return 'draw';
  if (gameObj.winner === 'white') return 'white_won';
  if (gameObj.winner === 'black') return 'black_won';
  return 'ongoing';
};

const saveGameState = async (roomId, gameObj) => {
  if (!isDbConnected || !gameObj.matchId) return;

  try {
    await Match.findByIdAndUpdate(gameObj.matchId, {
      roomId,
      fen: gameObj.chess.fen(),
      pgn: gameObj.chess.pgn(),
      timers: gameObj.timers,
      gameStatus: gameObj.gameStatus,
      winner: gameObj.winner,
      winReason: gameObj.winReason,
      drawOffer: gameObj.drawOffer,
      status: getPersistedStatus(gameObj),
      updatedAt: Date.now()
    });
  } catch (dbErr) {
    console.error("Failed to save game state:", dbErr.message);
  }
};

// In-memory game state
// Map of roomId -> room state
const games = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', async ({ roomId, username }) => {
    socket.join(roomId);
    
    let userId = null;
    
    // 1. Fetch/Create user
    if (isDbConnected && username) {
      try {
        let user = await User.findOne({ username });
        if (!user) {
          user = new User({ username });
          await user.save();
        }
        userId = user._id;
      } catch (err) {
        console.error("DB error on join:", err.message);
      }
    }
    
    // 2. Initialize room if not exists
    if (!games.has(roomId)) {
      let restoredGame = null;

      if (isDbConnected) {
        try {
          const existingMatch = await Match.findOne({
            roomId,
            status: 'ongoing'
          }).sort({ updatedAt: -1 });

          if (existingMatch) {
            restoredGame = createGameFromMatch(existingMatch);
          }
        } catch (err) {
          console.error("Failed to restore match:", err.message);
        }
      }

      games.set(roomId, restoredGame || createGame());
    }
    
    const gameObj = games.get(roomId);
    
    // 3. Assign players
    let playerColor = 'spectator';
    const playerKey = userId || socket.id;
    if (!gameObj.players.white || isSamePlayer(gameObj.players.white, playerKey) || gameObj.playerNames.white === username) {
      gameObj.players.white = playerKey;
      gameObj.playerNames.white = username;
      playerColor = 'white';
    } else if (!gameObj.players.black || isSamePlayer(gameObj.players.black, playerKey) || gameObj.playerNames.black === username) {
      gameObj.players.black = playerKey;
      gameObj.playerNames.black = username;
      playerColor = 'black';
    }

    if (userId) {
      if (!gameObj.players.white) {
        gameObj.players.white = userId;
      } else if (!gameObj.players.black && gameObj.players.white.toString() !== userId.toString()) {
        gameObj.players.black = userId;
      }

      // If we have at least one player and no match document yet, create one
      if (isDbConnected && !gameObj.matchId) {
        try {
          const newMatch = new Match({
            roomId: roomId,
            whitePlayer: gameObj.players.white,
            blackPlayer: gameObj.players.black,
            fen: gameObj.chess.fen(),
            pgn: gameObj.chess.pgn(),
            timers: gameObj.timers,
            gameStatus: gameObj.gameStatus
          });
          await newMatch.save();
          gameObj.matchId = newMatch._id;
        } catch (err) {
          console.error("Failed to create match:", err.message);
        }
      } else if (isDbConnected && gameObj.matchId) {
        // Update the match document to ensure both players are registered if someone joined late
        try {
          await Match.findByIdAndUpdate(gameObj.matchId, {
            whitePlayer: gameObj.players.white,
            blackPlayer: gameObj.players.black
          });
        } catch(e) {}
      }
    }
    
    socket.emit('gameState', {
      ...getPublicState(gameObj),
      playerColor
    });
  });

  socket.on('move', async ({ roomId, move }) => {
    const gameObj = games.get(roomId);
    if (!gameObj) return;
    const game = gameObj.chess;
    updateClock(gameObj);
    if (gameObj.gameStatus !== 'playing') {
      socket.emit('error', 'Game is over');
      emitGameState(roomId, gameObj);
      return;
    }

    try {
      const result = game.move(move);
      if (result) {
        gameObj.drawOffer = null;
        gameObj.lastClockUpdate = Date.now();
        applyGameOver(gameObj);
        emitGameState(roomId, gameObj, 'move', { move: result });
        
        let status = 'ongoing';
        if (game.isGameOver()) {
          if (game.isCheckmate()) {
            status = game.turn() === 'w' ? 'black_won' : 'white_won';
          } else {
            status = 'draw';
          }
        }

        await saveGameState(roomId, gameObj);

        // 4. Update player stats if game just ended
        if (isDbConnected && gameObj.matchId) {
          try {
            if (status !== 'ongoing' && gameObj.players.white && gameObj.players.black) {
              const whiteInc = status === 'white_won' ? { wins: 1 } : status === 'black_won' ? { losses: 1 } : { draws: 1 };
              const blackInc = status === 'black_won' ? { wins: 1 } : status === 'white_won' ? { losses: 1 } : { draws: 1 };
              
              await User.findByIdAndUpdate(gameObj.players.white, { $inc: whiteInc });
              await User.findByIdAndUpdate(gameObj.players.black, { $inc: blackInc });
              console.log(`Game Over in ${roomId}! Winner: ${status}`);
            }
          } catch (dbErr) {
            console.error("Failed to update game result:", dbErr.message);
          }
        }

      } else {
        socket.emit('error', 'Invalid move');
      }
    } catch (e) {
      socket.emit('error', 'Invalid move format');
    }
  });

  socket.on('undoMove', ({ roomId }) => {
    const gameObj = games.get(roomId);
    if (!gameObj || gameObj.gameStatus !== 'playing') return;

    updateClock(gameObj);
    const undone = gameObj.chess.undo();
    if (!undone) return;

    gameObj.drawOffer = null;
    gameObj.lastClockUpdate = Date.now();
    saveGameState(roomId, gameObj);
    emitGameState(roomId, gameObj, 'gameState');
  });

  socket.on('offerDraw', ({ roomId, color }) => {
    const gameObj = games.get(roomId);
    if (!gameObj || gameObj.gameStatus !== 'playing') return;

    gameObj.drawOffer = color || (gameObj.chess.turn() === 'w' ? 'white' : 'black');
    saveGameState(roomId, gameObj);
    emitGameState(roomId, gameObj, 'gameState');
  });

  socket.on('respondDraw', ({ roomId, accepted }) => {
    const gameObj = games.get(roomId);
    if (!gameObj || gameObj.gameStatus !== 'playing' || !gameObj.drawOffer) return;

    if (accepted) {
      gameObj.gameStatus = 'draw';
      gameObj.winner = null;
      gameObj.winReason = 'Agreement';
    }
    gameObj.drawOffer = null;
    saveGameState(roomId, gameObj);
    emitGameState(roomId, gameObj, 'gameState');
  });

  socket.on('resign', ({ roomId, color }) => {
    const gameObj = games.get(roomId);
    if (!gameObj || gameObj.gameStatus !== 'playing') return;

    const resigningColor = color === 'black' ? 'black' : 'white';
    gameObj.gameStatus = 'ended';
    gameObj.winner = getOpponent(resigningColor);
    gameObj.winReason = 'Resignation';
    gameObj.drawOffer = null;
    saveGameState(roomId, gameObj);
    emitGameState(roomId, gameObj, 'gameState');
  });

  socket.on('restartGame', async ({ roomId }) => {
    const oldGame = games.get(roomId);
    const nextGame = createGame();
    if (oldGame) {
      nextGame.players = oldGame.players;
      nextGame.playerNames = oldGame.playerNames;
      nextGame.matchId = oldGame.matchId;
    }
    games.set(roomId, nextGame);
    await saveGameState(roomId, nextGame);
    emitGameState(roomId, nextGame, 'gameState');
  });

  socket.on('keepAlive', ({ roomId }, callback) => {
    const gameObj = games.get(roomId);
    if (gameObj) {
      updateClock(gameObj);
    }

    if (typeof callback === 'function') {
      callback({ ok: true, time: Date.now() });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('3D Chess Server Running');
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Allowed client origins:', allowedOrigins.length > 0 ? allowedOrigins : 'all');
});


