import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CameraView } from './components/CameraView';
import { AudioProcessor } from './components/AudioProcessor';
import { RhythmGame } from './components/RhythmGame';
import { ResultScreen } from './components/ResultScreen';
import { Beat } from './utils/audioUtils';
import { FaceAction } from './hooks/useFaceDetection';
import { Music, Play, Zap, Smile, User, ChevronRight } from 'lucide-react';

type GameState = 'START' | 'SETUP' | 'PLAYING' | 'RESULT';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [audioData, setAudioData] = useState<{ blob: Blob; beats: Beat[]; duration: number } | null>(null);
  const [currentAction, setCurrentAction] = useState<FaceAction>(null);
  const [results, setResults] = useState<{ score: number; maxCombo: number }>({ score: 0, maxCombo: 0 });

  const handleAudioComplete = (blob: Blob, beats: Beat[], duration: number) => {
    setAudioData({ blob, beats, duration });
    setGameState('PLAYING');
  };

  const handleGameFinish = (score: number, maxCombo: number) => {
    setResults({ score, maxCombo });
    setGameState('RESULT');
  };

  const handleAction = useCallback((action: FaceAction) => {
    setCurrentAction(action);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/20 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center rotate-3 shadow-[4px_4px_0_0_rgba(79,70,229,1)]">
              <Zap className="text-indigo-600 fill-indigo-600" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter italic uppercase leading-none">Grimace</h1>
              <span className="text-[10px] font-bold text-indigo-400 tracking-[0.3em] uppercase">Beat</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            <div className="flex items-center gap-2"><Smile size={14} /> Smile</div>
            <div className="flex items-center gap-2"><User size={14} /> Pout</div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto"
            >
              <h2 className="text-7xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9]">
                DANCE WITH <span className="text-indigo-500">YOUR FACE.</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-12 leading-relaxed">
                The world's first hands-free rhythm game. Use your expressions to hit the beats. 
                No controller needed—just your smile.
              </p>
              <button
                onClick={() => setGameState('SETUP')}
                className="group relative flex items-center gap-4 px-10 py-5 bg-white text-black rounded-full font-black text-xl hover:scale-105 transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                <span>GET STARTED</span>
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {gameState === 'SETUP' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="w-full max-w-2xl">
                <AudioProcessor onComplete={handleAudioComplete} />
              </div>
            </motion.div>
          )}

          {gameState === 'PLAYING' && audioData && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
            >
              <div className="lg:col-span-2 space-y-8">
                <RhythmGame
                  audioBlob={audioData.blob}
                  beats={audioData.beats}
                  duration={audioData.duration}
                  currentAction={currentAction}
                  onFinish={handleGameFinish}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2 text-yellow-500 mb-2">
                      <Smile size={16} />
                      <span className="text-[10px] font-black tracking-widest uppercase">Smile</span>
                    </div>
                    <p className="text-xs text-zinc-500">Pull your mouth corners up to hit yellow notes.</p>
                  </div>
                  <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2 text-pink-500 mb-2">
                      <User size={16} />
                      <span className="text-[10px] font-black tracking-widest uppercase">Pout</span>
                    </div>
                    <p className="text-xs text-zinc-500">Pucker your lips forward to hit pink notes.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <CameraView onAction={handleAction} />
                <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                  <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    LIVE FACE TRACKING
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Make sure your face is well-lit and centered in the frame for the best performance.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'RESULT' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <ResultScreen
                score={results.score}
                maxCombo={results.maxCombo}
                onRestart={() => setGameState('START')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-auto pt-12 flex items-center justify-between border-t border-white/5 text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
          <span>&copy; 2026 GRIMACE BEAT STUDIOS</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
