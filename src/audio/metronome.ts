export class MetronomeEngine {
  private ctx: AudioContext;
  private destination: AudioNode;
  private running = false;
  private bpm = 110;
  private beatsPerBar = 4;
  private currentBeat = 0;
  private nextNoteTime = 0;
  private timerId: number | null = null;
  private volume = 0.5;
  private onBeat?: (beat: number, beatsPerBar: number) => void;

  constructor(ctx: AudioContext, destination: AudioNode, onBeat?: (beat: number, beatsPerBar: number) => void) {
    this.ctx = ctx;
    this.destination = destination;
    this.onBeat = onBeat;
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(40, Math.min(240, Math.round(bpm)));
  }

  setBeatsPerBar(beats: number) {
    this.beatsPerBar = Math.max(2, Math.min(8, beats));
    if (this.currentBeat >= this.beatsPerBar) {
      this.currentBeat = 0;
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.04;
    this.timerId = window.setInterval(() => this.scheduler(), 25);
  }

  stop() {
    this.running = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private scheduler() {
    const scheduleAheadTime = 0.1;
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleClick(this.currentBeat, this.nextNoteTime);
      const secondsPerBeat = 60.0 / this.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
  }

  private scheduleClick(beat: number, time: number) {
    const isDownbeat = beat === 0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isDownbeat ? 1320 : 880, time);
    osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 660 : 440, time + 0.035);

    const peak = (isDownbeat ? 0.55 : 0.34) * this.volume;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.destination);

    osc.start(time);
    osc.stop(time + 0.06);

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    window.setTimeout(() => {
      if (this.running && this.onBeat) {
        this.onBeat(beat, this.beatsPerBar);
      }
    }, delayMs);
  }
}
