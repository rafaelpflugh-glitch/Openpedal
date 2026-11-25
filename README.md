# OpenPedal 🎸

Pedaleira digital de guitarra em tempo real construída com **React + TypeScript + Web Audio API + AudioWorklet**, pensada para tocar tanto ligada em um **Home Theater / fones de ouvido** quanto em um **amplificador de guitarra**, usando cabo **P10→P2** ou **interface de áudio USB**.

## Recursos

- **Cadeia de 7 pedais editável** (arraste ou use as setas para mudar a ordem do sinal):
  - **Noise Gate (AudioWorklet)** com histerese suave + **Filtro 60Hz/120Hz** para eliminar ruído de rede elétrica em cabos P10→P2
  - **Compressor Óptico** (Threshold, Ratio, Attack, Makeup Gain)
  - **Overdrive / Distortion** 4x oversampled com 3 modos (`Tube OD`, `Crunch`, `Fuzz`)
  - **Equalizador Gráfico de 5 Bandas** (100Hz, 250Hz, 800Hz, 2kHz, 4kHz + Level)
  - **Chorus** com modulação LFO
  - **Analog Delay** com **Tap Tempo** e controle de tonalidade
  - **Reverb Estéreo** (Hall/Plate convolucional gerado em tempo real)
- **Simulador de Amplificador + Gabinete (Cab Sim / IR)**:
  - 4 modelos de Amp (`Clean Twin`, `British Crunch`, `Modern Metal`, `Acoustic / DI`)
  - 4 caixas integradas (`4x12 V30`, `2x12 Open`, `1x12 Tweed`, `4x10 Wide`) + **upload de Impulse Response (.WAV) customizado**
  - **Chave rápida de Modo de Saída (`Tecla B`)**:
    - `Home Theater / Fones`: Cab Sim ativo + limiter de segurança
    - `Amp (FX Return)`: Pré-amp ativo e Cab Sim desligado automaticamente
    - `Frente do Amp`: Amp & Cab em bypass (apenas pedais)
- **Afinador Cromático em Tempo Real** (algoritmo YIN pré-efeitos + opção de mutar saída)
- **Looper Pós-Efeitos (AudioWorklet)** com Gravar → Tocar → Overdub, Undo e até 60 segundos (grave uma base limpa e troque de preset para solar por cima!)
- **Metrônomo** com Tap Tempo, compassos `4/4`, `3/4`, `6/8`, `2/4` e saída limpa fora do Looper
- **Banco de Presets** com 6 timbres de fábrica, salvar/atualizar/excluir (salvo no navegador) e exportar/importar `.json`
- **Guitarra de Teste Interna + Player de DI**: teste todos os timbres mesmo antes de plugar o cabo
- **Modo Teclado Piano / Synth no Teclado do PC**: sintetizador polifônico com 6 timbres (`Grand Piano`, `Rhodes E-Piano`, `Órgão Rock`, `Synth Lead`, `Pad Atmosférico`, `Baixo Synth`), controle de oitava (`Z`/`X`), Sustain (`Shift`) e chave para tocar limpo no Looper ou passar pelos efeitos da pedaleira
- **Modo Bateria Eletrônica + Sequenciador de 16 Passos**: 8 pads sintetizados (`A` a `K`), 2 kits (`Acoustic Rock` e `808 Eletrônica`) e grooves prontos (`Rock`, `Pop/Funk`, `Metal Pedal Duplo`, `808/Lo-Fi`) para acompanhar sua guitarra ou piano
- **Controlador MIDI (Web MIDI Learn)** + **Atalhos de Teclado** completos

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço exibido (geralmente `http://localhost:5173`) no Chrome ou Edge.

## Atalhos de Teclado

| Tecla | Ação |
| --- | --- |
| `1` – `8` | Trocar Presets 1 a 8 |
| `Q` `W` `E` `R` `Y` `U` `I` | Ligar/Desligar pedais (Gate, Comp, Drive, EQ, Chorus, Delay, Reverb) |
| `Espaço` | Looper (Gravar → Tocar → Overdub) |
| `T` | Abrir / Fechar Afinador |
| `M` | Ligar / Parar Metrônomo |
| `B` | Alternar Modo de Saída (Home Theater ↔ Amp FX Return ↔ Frente do Amp) |
