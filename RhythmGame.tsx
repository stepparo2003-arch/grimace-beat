import React, { useEffect, useRef, useState } from 'react';
import { Beat } from '../utils/audioUtils';
import { FaceAction } from '../hooks/useFaceDetection';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Flame, Timer, Play, Pause } from 'lucide-react';

interface RhythmGameProps {
  audioBlob: Blob;
  beats: Beat[];
  duration: number;
  currentAction: FaceAction;
  onFinish: (score: number, maxCombo: number) => void;
}

const TRACKS: FaceAction[] = ['SMILE', 'POUT'];
const NOTE_SPEED = 350; // Moderate speed (pixels per second)
const HIT_WINDOW = 0.12; // Moderate hit window (approx 42px total)
const HIT_ZONE_X = 120;
const TRACK_SPACING = 100;
const TRACK_Y_START = 150;

export const RhythmGame: React.FC<RhythmGameProps> = ({ audioBlob, beats, duration, currentAction, onFinish }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [feedback, setFeedback] = useState<{ text: string; id: number } | null>(null);
  
  const currentActionRef = useRef<FaceAction>(null);
  const drumScales = useRef<Record<string, number>>({ SMILE: 1, POUT: 1 });
  const scoreRef = useRef(0);
  const maxComboRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Sync refs for event listeners
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { maxComboRef.current = maxCombo; }, [maxCombo]);

  useEffect(() => {
    currentActionRef.current = currentAction;
    if (currentAction) {
      drumScales.current[currentAction] = 1.3;
    }
  }, [currentAction]);

  const gameData = useRef({
    startTime: 0,
    notes: beats.map(b => ({ ...b, hit: false, missed: false })),
    lastAction: null as FaceAction,
  });

  useEffect(() => {
    console.log("RhythmGame mounted with beats:", beats.length);
    gameData.current.notes = beats.map(b => ({ ...b, hit: false, missed: false }));
  }, [beats]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const url = URL.createObjectURL(audioBlob);
    audio.src = url;
    
    audio.onended = () => {
      setIsGameOver(true);
      onFinish(scoreRef.current, maxComboRef.current);
    };

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  useEffect(() => {
    let countdownInterval: any;
    if (countdown !== null && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      const audio = audioRef.current;
      if (audio) {
        gameData.current.startTime = performance.now() / 1000;
        audio.play().catch(err => console.error("Audio play failed:", err));
        requestAnimationFrame(gameLoop);
      }
    }

    return () => clearInterval(countdownInterval);
  }, [countdown]);

  const togglePause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPaused) {
      audio.play();
      setIsPaused(false);
      // We need to use the latest state in the next frame
      // The gameLoop will be restarted by the useEffect or we can trigger it here
    } else {
      audio.pause();
      setIsPaused(true);
    }
  };

  useEffect(() => {
    if (!isPaused && !isGameOver && countdown === null) {
      requestAnimationFrame(gameLoop);
    }
  }, [isPaused, isGameOver, countdown]);

  const showFeedback = (text: string) => {
    setFeedback({ text, id: Date.now() });
  };

  const elapsedTimeRef = useRef(0);

  const gameLoop = (time: number) => {
    if (isGameOver || isPaused) {
      lastFrameTimeRef.current = 0;
      return;
    }

    // If we are in countdown, just keep the loop alive but don't draw notes yet
    if (countdown !== null && countdown > 0) {
      lastFrameTimeRef.current = 0; // Keep reset during countdown
      requestAnimationFrame(gameLoop);
      return;
    }

    if (lastFrameTimeRef.current === 0) {
      lastFrameTimeRef.current = time;
      requestAnimationFrame(gameLoop);
      return;
    }
    
    const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (time - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = time;
    
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = audio.currentTime;
    setTimeLeft(Math.max(0, duration - currentTime));

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update drum scales (shrink back)
    TRACKS.forEach(t => {
      if (t) {
        drumScales.current[t] = Math.max(1, drumScales.current[t] - deltaTime * 2);
      }
    });

    // Draw Tracks
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    TRACKS.forEach((_, i) => {
      const y = TRACK_Y_START + i * TRACK_SPACING;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    });

    // Draw Drums (Hit Zone)
    TRACKS.forEach((type, i) => {
      const y = TRACK_Y_START + i * TRACK_SPACING;
      const scale = drumScales.current[type || ''];
      drawDrum(ctx, HIT_ZONE_X, y, type || '', scale);
    });

    // Process Notes
    gameData.current.notes.forEach(note => {
      if (note.hit || note.missed) return;

      const trackIndex = TRACKS.indexOf(note.type);
      if (trackIndex === -1) return; // Skip notes with invalid types
      const y = TRACK_Y_START + trackIndex * TRACK_SPACING;
      const x = HIT_ZONE_X + (note.time - currentTime) * NOTE_SPEED;

      // Draw Note
      if (x > -50 && x < canvas.width + 50) {
        drawPixelNote(ctx, x, y, note.type);
      }

      // Check for Miss
      if (currentTime > note.time + HIT_WINDOW) {
        note.missed = true;
        setCombo(0);
        showFeedback('MISS');
      }

      // Check for Hit
      if (currentActionRef.current === note.type && Math.abs(currentTime - note.time) < HIT_WINDOW) {
        note.hit = true;
        const points = 100 + combo * 10;
        setScore(s => s + points);
        setCombo(c => {
          const next = c + 1;
          setMaxCombo(m => Math.max(m, next));
          return next;
        });
        showFeedback('PERFECT');
      }
    });

    requestAnimationFrame(gameLoop);
  };

  const drawDrum = (ctx: CanvasRenderingContext2D, x: number, y: number, type: string, scale: number) => {
    const colors: Record<string, string> = { SMILE: '#eab308', POUT: '#ec4899' };
    const color = colors[type];
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Drum body
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-25, -20, 50, 40, 5);
    ctx.fill();
    ctx.stroke();
    
    // Drum head
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, -15, 25, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Icon label
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = type === 'SMILE' ? '😊' : '😗';
    ctx.fillText(icon, 0, 0);
    
    ctx.restore();
  };

  const drawPixelNote = (ctx: CanvasRenderingContext2D, x: number, y: number, type: string) => {
    const colors: Record<string, string> = { SMILE: '#eab308', POUT: '#ec4899' };
    const color = colors[type] || '#ffffff';
    ctx.fillStyle = color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    
    // Pixel square
    ctx.fillRect(x - 15, y - 15, 30, 30);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 15, y - 15, 30, 30);
    
    ctx.shadowBlur = 0;
  };

  return (
    <div className="relative w-full h-[400px] bg-zinc-950 rounded-2xl overflow-hidden border border-white/10">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-full"
      />
      
      <audio ref={audioRef} className="hidden" />

      {/* Feedback Animation */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              key={feedback.id}
              initial={{ y: 20, opacity: 0, scale: 0.5 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`text-4xl font-black italic tracking-tighter ${
                feedback.text === 'MISS' ? 'text-zinc-500' : 'text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]'
              }`}
            >
              {feedback.text}
              {combo > 1 && feedback.text !== 'MISS' && (
                <span className="block text-sm text-center not-italic text-white/50">x{combo}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
          >
            <motion.span
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-9xl font-black text-white italic"
            >
              {countdown === 0 ? 'GO!' : countdown}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div className="absolute top-6 left-6 flex gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Score</span>
          <span className="text-3xl font-black text-white font-mono tabular-nums">{score.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Combo</span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black text-indigo-400 font-mono tabular-nums">{combo}</span>
            {combo > 5 && <Flame className="text-orange-500 animate-bounce" size={20} />}
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex items-center gap-4">
        <button
          onClick={togglePause}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
          <Timer size={16} className="text-zinc-400" />
          <span className="text-sm font-mono text-white">{timeLeft.toFixed(1)}s</span>
        </div>
      </div>

      {/* Track Labels */}
      <div className="absolute left-4 top-0 h-full flex flex-col justify-center gap-[75px] pointer-events-none">
        {TRACKS.map(t => (
          <span key={t} className="text-[10px] font-black text-zinc-700 rotate-[-90deg] tracking-[0.2em]">{t}</span>
        ))}
      </div>

      {/* Pause Overlay */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40">
          <button
            onClick={togglePause}
            className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-black text-xl hover:scale-105 transition-all"
          >
            <Play size={24} fill="currentColor" />
            <span>RESUME</span>
          </button>
        </div>
      )}
    </div>
  );
};
