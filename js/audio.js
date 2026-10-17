/**
 * NOVA Space Exploration - Web Audio Synthesizer Engine
 * Generates zero-latency procedural deep-space ambience and telemetry audio cues.
 */
export class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.droneOsc = null;
    this.droneGain = null;
    this.droneFilter = null;
    this.subOsc = null;
    this.subGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
      console.warn('Web Audio API not supported on this platform.', e);
    }
  }

  toggleSound() {
    if (!this.ctx) this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;

    if (!this.isMuted) {
      this.startAmbientDrone();
      this.playBeep(880, 0.08, 'sine', 0.05);
    } else {
      this.stopAmbientDrone();
    }

    return !this.isMuted;
  }

  startAmbientDrone() {
    if (this.droneOsc || !this.ctx) return;

    // Sub-bass root drone (48 Hz)
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.setValueAtTime(48, this.ctx.currentTime);

    // Resonant low-pass filter for smooth cosmic hum
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
    this.droneFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.droneGain.gain.exponentialRampToValueAtTime(0.045, this.ctx.currentTime + 3.0);

    // Deep sub foundation (32 Hz)
    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subOsc.frequency.setValueAtTime(32, this.ctx.currentTime);

    this.subGain = this.ctx.createGain();
    this.subGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.subGain.gain.exponentialRampToValueAtTime(0.04, this.ctx.currentTime + 3.0);

    this.droneOsc.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);

    this.subOsc.connect(this.subGain);
    this.subGain.connect(this.ctx.destination);

    this.droneOsc.start();
    this.subOsc.start();
  }

  stopAmbientDrone() {
    if (!this.droneGain || !this.ctx) return;
    try {
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, this.ctx.currentTime);
      this.droneGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
      if (this.subGain) {
        this.subGain.gain.setValueAtTime(this.subGain.gain.value, this.ctx.currentTime);
        this.subGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
      }
      setTimeout(() => {
        if (this.droneOsc) {
          try { this.droneOsc.stop(); } catch(e){}
          this.droneOsc = null;
        }
        if (this.subOsc) {
          try { this.subOsc.stop(); } catch(e){}
          this.subOsc = null;
        }
      }, 900);
    } catch (e) {
      this.droneOsc = null;
      this.subOsc = null;
    }
  }

  playTelemetryClick() {
    if (this.isMuted || !this.ctx) return;
    this.playBeep(1200, 0.03, 'sine', 0.025);
  }

  playTransitionChime() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      setTimeout(() => {
        this.playBeep(freq, 0.15, 'sine', 0.02);
      }, i * 60);
    });
  }

  playBeep(freq = 440, duration = 0.08, type = 'sine', vol = 0.03) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
}

export const spaceAudio = new SpaceAudioEngine();
