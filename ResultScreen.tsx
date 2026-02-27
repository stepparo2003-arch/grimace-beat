import React from 'react';
import { Trophy, RotateCcw, Share2, Flame, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface ResultScreenProps {
  score: number;
  maxCombo: number;
  onRestart: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ score, maxCombo, onRestart }) => {
  const rank = score > 10000 ? 'S' : score > 5000 ? 'A' : score > 2000 ? 'B' : 'C';
  const rankColor = { S: 'text-yellow-400', A: 'text-indigo-400', B: 'text-emerald-400', C: 'text-zinc-400' }[rank];

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] bg-zinc-900/80 border border-white/10 p-12 rounded-3xl backdrop-blur-2xl">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12 }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className={`text-[120px] font-black ${rankColor} drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]`}>
          {rank}
        </div>
        <div className="absolute -top-4 -right-4 p-3 bg-zinc-800 border border-white/10 rounded-2xl rotate-12">
          <Trophy className="text-yellow-500" size={32} />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-8 w-full max-w-md mb-12">
        <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5">
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-2">Final Score</span>
          <span className="text-3xl font-black text-white font-mono">{score.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5">
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-2">Max Combo</span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black text-indigo-400 font-mono">{maxCombo}</span>
            <Flame className="text-orange-500" size={24} />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-black hover:bg-zinc-200 transition-all transform active:scale-95"
        >
          <RotateCcw size={20} />
          <span>PLAY AGAIN</span>
        </button>
        <button className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
          <Share2 size={24} />
        </button>
      </div>

      <div className="mt-12 flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={16} className={i < (rank === 'S' ? 5 : rank === 'A' ? 4 : 3) ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'} />
        ))}
      </div>
    </div>
  );
};
