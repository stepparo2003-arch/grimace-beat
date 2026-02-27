import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { Music, Play, Pause, Scissors, Check } from 'lucide-react';
import { detectBeats, Beat } from '../utils/audioUtils';

interface AudioProcessorProps {
  onComplete: (audioBlob: Blob, beats: Beat[], duration: number) => void;
}

export const AudioProcessor: React.FC<AudioProcessorProps> = ({ onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [region, setRegion] = useState<{ start: number; end: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!containerRef.current || wavesurfer.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#71717a', // Zinc-500 (Medium gray)
      progressColor: '#71717a',
      cursorColor: '#ffffff',
      height: 100,
      barWidth: 1.5,
      barGap: 1,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());

    const updateRegionLabels = (reg: any) => {
      const start = Math.round(reg.start * 100) / 100;
      const end = Math.round(reg.end * 100) / 100;
      const startStr = formatTime(start);
      const endStr = formatTime(end);
      
      const content = document.createElement('div');
      content.style.display = 'flex';
      content.style.justifyContent = 'space-between';
      content.style.alignItems = 'center';
      content.style.height = '100%';
      content.style.width = '100%';
      content.style.position = 'relative';
      content.style.pointerEvents = 'none';
      content.innerHTML = `
        <div style="position: absolute; left: 0; top: -25px; transform: translateX(-50%); background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 900; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid #fff; z-index: 20; pointer-events: none;">
          ${startStr}
        </div>
        <div style="position: absolute; right: 0; top: -25px; transform: translateX(50%); background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 900; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid #fff; z-index: 20; pointer-events: none;">
          ${endStr}
        </div>
      `;
      reg.setOptions({ content });
    };

    ws.on('ready', () => {
      console.log('WaveSurfer ready');
      setIsReady(true);
      const duration = ws.getDuration();
      const end = Math.min(30, duration);
      
      regions.clearRegions();
      const reg = regions.addRegion({
        id: 'selection',
        start: 0,
        end: end,
        color: 'transparent', // Handled by CSS ::part(region)
        drag: true,
        resize: true,
        minLength: 10,
        maxLength: 30,
      });
      setRegion({ start: 0, end: end });
      updateRegionLabels(reg);
    });

    regions.on('region-updated', (reg) => {
      const start = Math.round(reg.start * 100) / 100;
      const end = Math.round(reg.end * 100) / 100;
      setRegion({ start, end });
      updateRegionLabels(reg);
      
      // Auto-preview from start of region
      ws.setTime(reg.start);
      if (!ws.isPlaying()) ws.play();
    });

    // Stop playback when reaching end of region
    ws.on('audioprocess', () => {
      if (ws.isPlaying()) {
        const currentTime = ws.getCurrentTime();
        const currentRegion = regions.getRegions()[0];
        if (currentRegion && currentTime >= currentRegion.end) {
          ws.pause();
          ws.setTime(currentRegion.start);
          setIsPlaying(false);
        }
      }
    });

    wavesurfer.current = ws;

    return () => {
      ws.destroy();
      wavesurfer.current = null;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) { // 15MB limit
        alert('File is too large. Please select a file under 15MB.');
        return;
      }
      console.log('File selected:', file.name, file.size);
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      wavesurfer.current?.load(url).catch(err => {
        console.error('WaveSurfer load error:', err);
        alert('Failed to load audio file. Please try another one.');
      });
    }
  };

  const togglePlay = () => {
    wavesurfer.current?.playPause();
    setIsPlaying(!isPlaying);
  };

  const handleConfirm = async () => {
    if (!wavesurfer.current || !region || !audioFile) return;
    setIsProcessing(true);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const arrayBuffer = await audioFile.arrayBuffer();
      const fullBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const startSample = Math.floor(region.start * fullBuffer.sampleRate);
      const endSample = Math.floor(region.end * fullBuffer.sampleRate);
      const length = endSample - startSample;
      
      const croppedBuffer = audioContext.createBuffer(
        fullBuffer.numberOfChannels,
        length,
        fullBuffer.sampleRate
      );

      for (let i = 0; i < fullBuffer.numberOfChannels; i++) {
        const channelData = fullBuffer.getChannelData(i).subarray(startSample, endSample);
        croppedBuffer.copyToChannel(channelData, i);
      }

      const beats = await detectBeats(croppedBuffer);
      console.log('Beats generated:', beats.length, beats.slice(0, 5));
      
      // Convert buffer to blob
      const wavBlob = await bufferToWav(croppedBuffer);
      onComplete(wavBlob, beats, Math.round((region.end - region.start) * 100) / 100);
      
      await audioContext.close();
    } catch (err) {
      console.error('Audio processing error:', err);
      alert('Error processing audio. Please try a different file or segment.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-white/10 p-6 rounded-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Music className="text-indigo-400" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight uppercase italic">Audio Editor</h2>
          <p className="text-zinc-400 text-sm font-medium">Select Range ({ Math.round((region?.end || 0) - (region?.start || 0)) }s)</p>
        </div>
      </div>

      <div className={audioFile ? "block" : "hidden"}>
        <div className="space-y-6">
          <div ref={containerRef} className="waveform-container bg-zinc-950 rounded-lg p-2" />
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={togglePlay}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <div className="flex items-center px-4 bg-zinc-800 rounded-full text-xs text-zinc-400 font-mono">
                {formatTime(region?.start || 0)} - {formatTime(region?.end || 0)} 
                <span className="ml-2 text-white font-bold">
                  ({ Math.round((region?.end || 0) - (region?.start || 0)) }s)
                </span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-full font-bold transition-all transform active:scale-95"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={18} />
                  <span>Start Game</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {!audioFile && (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Music className="w-10 h-10 mb-3 text-zinc-500" />
            <p className="mb-2 text-sm text-zinc-400">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-zinc-500">MP3, WAV, OGG (MAX. 15MB)</p>
          </div>
          <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
};

// Helper to convert AudioBuffer to WAV blob
async function bufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0; // 16-bit
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
