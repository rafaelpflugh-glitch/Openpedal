# OpenPedal 🎸🎹🥁

Estúdio e pedaleira digital de guitarra em tempo real construída com **React + TypeScript + Web Audio API + AudioWorklet**, pensada para tocar ligada em um **Home Theater / fones de ouvido** ou em um **amplificador de guitarra**, usando cabo **P10→P2** ou **interface de áudio USB**.

## Recursos

- **15 Pedais Lendários em Cadeia Reordenável (Pré-Amp + FX Loop Estéreo Pós-Amp)**:
  - **Noise Gate (AudioWorklet)** com histerese + **Filtro 60Hz/120Hz**
  - **Compressor Óptico**
  - **Cry Baby / Auto-Wah (AudioWorklet SVF)** nos modos `Auto`, `Pedal` e `LFO`
  - **Whammy / Pitch Shifter (AudioWorklet)** (`+1 Oct`, `-1 Oct`, `+5ª`, `Detune` + bend `Pedal`)
  - **Octaver Analógico (AudioWorklet)** (`Sub -1` estilo OC-2 + `Oct +1` Octavia)
  - **Drive 4x Oversampled (AudioWorklet c/ Sag & Slew)**: **Klon Centaur**, **Tube Screamer TS9**, **Boss DS-1** e **ProCo RAT**
  - **Fuzz 4x Oversampled (AudioWorklet)**: **Big Muff Pi** (2 estágios + Tone Stack Tilt), **Fuzz Face** (germânio) e **Super Fuzz**
  - **5-Band Graphic EQ**
  - **Phase 90 Phaser** (4 estágios All-Pass)
  - **Jet Flanger** (Electric Mistress / Boss BF-2)
  - **Uni-Vibe / Rotary (Leslie)** estéreo
  - **Opto-Tremolo** (`Sine`, `Tri`, `Chop`)
  - **Chorus 3D Estéreo** (Dual-Voice 180°)
  - **Ping-Pong Delay Estéreo** + **Tap Tempo**
  - **Reverb 3 Modos**: **Hall**, **Spring (Mola Fender)** e **Shimmer (+1 Oitava Catedral)**
  - **Botão Zerar Knobs** global e individual (`↺`) em cada pedal!
- **Simulador de Amplificador (2 estágios) + Gabinete (Cab Sim / IR .WAV)** com chave rápida **Home Theater / Fones ↔ Amp FX Return ↔ Frente do Amp (`Tecla B`)**
- **Biblioteca de Timbres Lendários**: 15 presets inspirados em **David Gilmour, Jimi Hendrix, Stevie Ray Vaughan, Kurt Cobain, Slash, Eddie Van Halen, John Frusciante, The Edge (U2), Metallica, Jack White / Tom Morello, B.B. King, Dick Dale** e mais!
- **Estúdio Multipista Integrado**: grave camadas isoladas sem vazamento (bateria, baixo, guitarra base, solo, sax), visualize waveforms, edite Volume, Pan, Mute/Solo, corte início/fim (Trim), alinhe sincronia (ms), importe faixas e **exporte tudo junto em 1 arquivo `.WAV` estéreo 16-bit**!
- **Workstation de 19 Instrumentos no Teclado do PC** (Teclas & Synths, Sopros & Metais com Sax/Trompete/Trombone/Tuba/Flauta, Baixos Reais, Cordas & Guitarra Elétrica) + **Bateria Eletrônica com Sequenciador de 16 Passos**
- **Afinador Cromático (YIN)**, **Looper Pós-Efeitos (60s + Undo)**, **Metrônomo**, **Guitarra Demo de Modelagem Física** e **Web MIDI Learn**

## Como rodar

```bash
npm install
npm run dev
```

Ou no Windows dê dois cliques em `start-openpedal.cmd` (ou no atalho da Área de Trabalho).
