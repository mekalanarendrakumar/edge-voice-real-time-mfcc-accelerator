# EdgeVoice: Real-Time MFCC Accelerator

## Overview
EdgeVoice is a fixed-point MFCC hardware accelerator for real-time speech feature extraction, targeting wake-word detection and edge voice assistants.

## Project Structure
- `rtl/modules/` — Verilog RTL modules for each MFCC stage
- `rtl/testbench/` — Testbenches for each module
- `doc/` — Documentation and design notes

## MFCC Pipeline Stages
1. **Framing & Windowing**: Segments audio and applies Hamming window
2. **FFT**: Computes fixed-point Fast Fourier Transform
3. **Mel Filter Bank**: Applies Mel-scale filters
4. **Logarithm**: Approximates log for filter outputs
5. **DCT**: Computes Discrete Cosine Transform for MFCCs

## Next Steps
- Implement each RTL module
- Develop and run testbenches
- Integrate and verify the full pipeline

## Prerequisites
- DSP basics, FFT/filter concepts, RTL design (Verilog)

---

For detailed design and usage, see additional docs in this folder.
