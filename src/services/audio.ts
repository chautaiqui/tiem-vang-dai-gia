/** Tiny WebAudio synth — no audio files needed. */
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, gain = 0.06) {
  const a = ac();
  if (!a) return;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sfx = {
  chime: () => { tone(1318, 0, 0.6); tone(988, 0.18, 0.8); },
  beep: () => tone(1800, 0, 0.08, 'square', 0.05),
  click: () => tone(600, 0, 0.04, 'triangle', 0.06),
  stable: () => { tone(2200, 0, 0.07, 'square', 0.04); tone(2200, 0.1, 0.07, 'square', 0.04); },
  cash: () => { noise(0, 0.12, 0.08); tone(2637, 0.08, 0.35, 'sine', 0.12); tone(3520, 0.12, 0.4, 'sine', 0.08); },
  print: () => { for (let i = 0; i < 6; i++) noise(i * 0.09, 0.06, 0.05); },
  error: () => tone(160, 0, 0.3, 'sawtooth', 0.08),
  success: () => { tone(784, 0, 0.15); tone(1046, 0.12, 0.3); },
  fizz: () => noise(0, 0.5, 0.04),
  toggleMute: () => (muted = !muted),
  isMuted: () => muted,
};
