# EdgeVoice Project

EdgeVoice is a real-time MFCC hardware accelerator and edge voice assistant system. It features:
- Web UI for voice recording
- Backend for audio processing and command detection
- Hardware MFCC extraction (RTL, FPGA-ready)
- Firmware for device control
- Pre-trained models for wake-word/command detection

## Project Structure
- `frontend/` — Website UI for recording and sending audio
- `backend/` — Local server, MFCC software reference, command logic
- `hardware/` — RTL (Verilog), testbenches, FPGA constraints
- `firmware/` — Microcontroller code for relays/devices
- `models/` — Stored MFCC patterns for commands
- `docs/` — Diagrams and explanations

See `docs/explanation.md` for more details.
