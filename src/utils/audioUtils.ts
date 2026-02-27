export interface Beat {
  time: number;
  type: 'SMILE' | 'POUT';
}

export async function detectBeats(audioBuffer: AudioBuffer): Promise<Beat[]> {
  const rawData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  
  // 1. Low-pass filter to isolate bass/kick (approx 100Hz)
  // More aggressive filtering for rap music to find the "thump"
  const alpha = 0.05; 
  const filteredData = new Float32Array(rawData.length);
  let lastValue = 0;
  for (let i = 0; i < rawData.length; i++) {
    filteredData[i] = lastValue + alpha * (rawData[i] - lastValue);
    lastValue = filteredData[i];
  }

  const windowSize = Math.floor(sampleRate * 0.02); // 20ms window
  const historySize = 60; // 1.2s history for more stable average
  const minInterval = 0.48; // Moderate difficulty: ~125 BPM max for face actions
  
  const energies: number[] = [];
  const flux: number[] = [];
  
  // 2. Calculate local energy and flux
  for (let i = 0; i < filteredData.length; i += windowSize) {
    let energy = 0;
    for (let j = 0; j < windowSize && i + j < filteredData.length; j++) {
      energy += filteredData[i + j] * filteredData[i + j];
    }
    energy /= windowSize;
    
    const lastEnergy = energies.length > 0 ? energies[energies.length - 1] : 0;
    const currentFlux = Math.max(0, energy - lastEnergy);
    
    energies.push(energy);
    flux.push(currentFlux);
  }

  const beats: Beat[] = [];
  let lastBeatTime = -minInterval;

  // 3. Peak Picking & Density Filtering
  // We look for local maxima in the flux signal that are significantly above average
  for (let i = 1; i < flux.length - 1; i++) {
    const time = (i * windowSize) / sampleRate;
    const currentFlux = flux[i];
    
    // Check if it's a local peak
    if (currentFlux > flux[i-1] && currentFlux > flux[i+1]) {
      // Calculate local average flux
      const start = Math.max(0, i - historySize);
      const end = i;
      const history = flux.slice(start, end);
      const avgFlux = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;

      // Thresholding: Must be a clear, strong onset
      // For rap music, we use a slightly higher multiplier to ignore "micro-rhythms"
      const thresholdMultiplier = 2.5; 
      if (currentFlux > avgFlux * thresholdMultiplier && currentFlux > 0.00005) {
        if (time - lastBeatTime > minInterval) {
          // Structured Track Selection: Switch every 2 beats for a "dance" feel
          const type = Math.floor(beats.length / 2) % 2 === 0 ? 'SMILE' : 'POUT';
          beats.push({ time, type });
          lastBeatTime = time;
        } else if (currentFlux > avgFlux * 5.0 && time - lastBeatTime > 0.25) {
          // "Syncopation" / Double Tap: Only for EXTREMELY strong onsets
          // This allows for some complexity in rap without being overwhelming
          const type = beats[beats.length - 1].type === 'SMILE' ? 'POUT' : 'SMILE';
          beats.push({ time, type });
          lastBeatTime = time;
        }
      }
    }
  }

  // 4. Post-processing: Rhythmic Filling for quiet parts
  if (beats.length < duration * 0.6) {
    const existingTimes = beats.map(b => b.time);
    for (let t = 1; t < duration - 1; t += 1.5) { 
      const isTooClose = existingTimes.some(et => Math.abs(et - t) < 0.6);
      if (!isTooClose) {
        beats.push({ time: t, type: Math.floor(beats.length / 2) % 2 === 0 ? 'SMILE' : 'POUT' });
      }
    }
    beats.sort((a, b) => a.time - b.time);
  }

  console.log(`Rhythm parsing complete: ${beats.length} beats matched. Focused on main onsets.`);
  return beats;
}
