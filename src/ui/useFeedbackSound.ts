import {soundVolume} from './AudioControls';
import { useCallback, useEffect, useRef } from 'react';

export default function useFeedbackSound(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!enabled && context.current) {
      void context.current.close().catch(() => {});
      context.current = null;
    }
    return () => {
      void context.current?.close().catch(() => {});
      context.current = null;
    };
  }, [enabled]);

  const prepare = useCallback(() => {
    if (!enabled) return;
    try {
      context.current ??= new AudioContext();
      if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
    } catch { /* Audio is optional and must never block a transaction. */ }
  }, [enabled]);

  const play = useCallback((kind: 'add' | 'sale' | 'note' | 'coin' | 'powerup' | 'close') => {
    const audio = context.current;
    if (!enabled || !audio || audio.state !== 'running' || soundVolume()===0) return;
    try {
      const tones = kind==='powerup'?[392,494,587,784]:kind==='close'?[440,330,220]:kind === 'sale' ? [587, 880] : kind==='coin'?[1200,1600]:kind==='note'?[180]:[440];
      tones.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.04;
        const length = kind === 'sale' ? 0.08 : 0.025;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime((kind === 'sale' ? 0.045 : 0.018)*soundVolume(), start + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, start + length);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + length + 0.01);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Losing the audio device does not affect the sale. */ }
  }, [enabled]);

  return { prepare, play };
}
