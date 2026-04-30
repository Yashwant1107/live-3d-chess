import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true
  },
  whitePlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  blackPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String, // 'ongoing', 'white_won', 'black_won', 'draw'
    default: 'ongoing'
  },
  fen: {
    type: String, // Current board state
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  },
  pgn: {
    type: String, 
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Match', matchSchema);
