import React, { useEffect, useRef } from 'react';
import { useFaceDetection, FaceAction } from '../hooks/useFaceDetection';
import { Smile, User, Zap } from 'lucide-react';

interface CameraViewProps {
  onAction: (action: FaceAction) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onAction }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isLoaded, currentAction } = useFaceDetection(videoRef);

  useEffect(() => {
    async function setupCamera() {
      if (!videoRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      videoRef.current.srcObject = stream;
    }
    setupCamera();
  }, []);

  useEffect(() => {
    onAction(currentAction);
  }, [currentAction, onAction]);

  return (
    <div className="relative w-full aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
      />
      
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <p className="text-indigo-400 font-mono text-sm animate-pulse">INITIALIZING FACE AI...</p>
        </div>
      )}

      {/* Action Indicators */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <ActionBadge active={currentAction === 'SMILE'} label="SMILE" icon={<Smile size={14} />} color="bg-yellow-500" />
        <ActionBadge active={currentAction === 'POUT'} label="POUT" icon={<User size={14} />} color="bg-pink-500" />
      </div>

      {/* Frame Overlay */}
      <div className="absolute inset-0 border-[20px] border-transparent pointer-events-none">
        <div className="w-full h-full border border-white/10 rounded-lg" />
      </div>
    </div>
  );
};

const ActionBadge: React.FC<{ active: boolean; label: string; icon: React.ReactNode; color: string }> = ({ active, label, icon, color }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 ${
    active ? `${color} border-white text-white scale-110 shadow-lg` : 'bg-black/40 border-white/10 text-white/40'
  }`}>
    {icon}
    <span className="text-[10px] font-black tracking-tighter">{label}</span>
  </div>
);
