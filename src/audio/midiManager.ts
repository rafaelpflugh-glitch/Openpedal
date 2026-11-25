import { MidiActionTarget, MidiBinding } from '../types/pedalboard';

export interface MidiDeviceSummary {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface IncomingMidiEvent {
  messageType: 'cc' | 'pc' | 'note';
  channel: number;
  number: number;
  value: number;
}

export class MidiManager {
  private access: MIDIAccess | null = null;
  private supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  private onMidiEvent?: (event: IncomingMidiEvent) => void;
  private onDevicesChange?: (devices: MidiDeviceSummary[]) => void;

  isSupported() {
    return this.supported;
  }

  async init(
    onMidiEvent: (event: IncomingMidiEvent) => void,
    onDevicesChange: (devices: MidiDeviceSummary[]) => void
  ): Promise<boolean> {
    this.onMidiEvent = onMidiEvent;
    this.onDevicesChange = onDevicesChange;

    if (!this.supported) return false;

    try {
      this.access = await navigator.requestMIDIAccess();
      this.attachInputs();
      this.access.onstatechange = () => {
        this.attachInputs();
      };
      return true;
    } catch {
      return false;
    }
  }

  private attachInputs() {
    if (!this.access) return;
    const devices: MidiDeviceSummary[] = [];

    this.access.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || 'Controlador MIDI',
        manufacturer: input.manufacturer || '',
        state: input.state
      });
      input.onmidimessage = (msg) => this.handleMessage(msg);
    });

    if (this.onDevicesChange) {
      this.onDevicesChange(devices);
    }
  }

  private handleMessage(msg: MIDIMessageEvent) {
    const data = msg.data;
    if (!data || data.length < 2) return;

    const status = data[0];
    const typeNibble = status & 0xf0;
    const channel = (status & 0x0f) + 1;
    const d1 = data[1];
    const d2 = data.length > 2 ? data[2] : 127;

    if (typeNibble === 0xb0) {
      // Control Change (trigger on press >= 64 or toggle)
      if (d2 >= 64) {
        this.onMidiEvent?.({ messageType: 'cc', channel, number: d1, value: d2 });
      }
    } else if (typeNibble === 0xc0) {
      // Program Change
      this.onMidiEvent?.({ messageType: 'pc', channel, number: d1, value: 127 });
    } else if (typeNibble === 0x90 && d2 > 0) {
      // Note On
      this.onMidiEvent?.({ messageType: 'note', channel, number: d1, value: d2 });
    }
  }

  static formatBinding(binding: MidiBinding): string {
    const kind =
      binding.messageType === 'cc'
        ? `CC #${binding.number}`
        : binding.messageType === 'pc'
        ? `PC #${binding.number}`
        : `Note #${binding.number}`;
    return `Ch ${binding.channel} • ${kind}`;
  }

  static targetKey(target: MidiActionTarget): string {
    if (target.type === 'pedal') return `pedal:${target.pedalId}`;
    if (target.type === 'preset') return `preset:${target.index}`;
    return target.type;
  }
}
