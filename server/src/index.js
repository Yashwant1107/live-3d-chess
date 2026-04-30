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
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins : true;
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
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

// In-memory game state
// Map of roomId -> { chess: Chess instance, players: { white: userId, black: userId }, matchId: db_id }
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
      games.set(roomId, {
        chess: new Chess(),
        players: { white: null, black: null },
        matchId: null
      });
    }
    
    const gameObj = games.get(roomId);
    
    // 3. Assign players
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
            blackPlayer: gameObj.players.black
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
      fen: gameObj.chess.fen(),
      history: gameObj.chess.history()
    });
  });

  socket.on('move', async ({ roomId, move }) => {
    const gameObj = games.get(roomId);
    if (!gameObj) return;
    const game = gameObj.chess;

    try {
      const result = game.move(move);
      if (result) {
        io.to(roomId).emit('move', {
          move: result,
          fen: game.fen()
        });
        
        let status = 'ongoing';
        if (game.isGameOver()) {
          if (game.isCheckmate()) {
            status = game.turn() === 'w' ? 'black_won' : 'white_won';
          } else {
            status = 'draw';
          }
        }

        // 4. Save Every Move directly to MongoDB
        if (isDbConnected && gameObj.matchId) {
          try {
            await Match.findByIdAndUpdate(gameObj.matchId, {
              fen: game.fen(),
              pgn: game.pgn(),
              status: status,
              updatedAt: Date.now()
            });

            // 5. Update Player stats if game just ended
            if (status !== 'ongoing' && gameObj.players.white && gameObj.players.black) {
              const whiteInc = status === 'white_won' ? { wins: 1 } : status === 'black_won' ? { losses: 1 } : { draws: 1 };
              const blackInc = status === 'black_won' ? { wins: 1 } : status === 'white_won' ? { losses: 1 } : { draws: 1 };
              
              await User.findByIdAndUpdate(gameObj.players.white, { $inc: whiteInc });
              await User.findByIdAndUpdate(gameObj.players.black, { $inc: blackInc });
              console.log(`Game Over in ${roomId}! Winner: ${status}`);
            }
          } catch (dbErr) {
            console.error("Failed to save move to DB:", dbErr.message);
          }
        }

      } else {
        socket.emit('error', 'Invalid move');
      }
    } catch (e) {
      socket.emit('error', 'Invalid move format');
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
});


