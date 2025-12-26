# EdgeVoice Project Explanation

This document explains the architecture, data flow, and design choices for the EdgeVoice real-time MFCC accelerator and system.

## Overview
- Real-time voice command recognition on edge devices
- Hardware MFCC extraction for low-latency wake-word detection
- Web UI and backend for testing and reference


## Block Diagram
See block_diagram.png

## Flow Chart
See flow_chart.png

## Dataflow
1. **Audio Input**: 16-bit PCM samples are streamed into the pipeline.
2. **Framing & Windowing**: Samples are grouped into frames (e.g., 8/256 samples) and multiplied by a Hamming window (Q1.15 fixed-point).
3. **FFT**: Each frame is transformed to the frequency domain using a fixed-point Radix-2 FFT.
4. **Mel Filter Bank**: FFT magnitudes are filtered using a bank of Mel-scale triangular filters (fixed-point multiply-accumulate).
5. **Logarithm**: Filter outputs are compressed using a fixed-point log approximation.
6. **DCT**: The log-Mel energies are decorrelated using a fixed-point Discrete Cosine Transform, producing MFCCs.
7. **Output**: MFCC feature vectors are output for downstream wake-word or command detection.

## Fixed-Point Format
- All arithmetic is Q1.15 (signed 16-bit fixed-point) unless otherwise noted.
- Multiplications use 32-bit intermediate results, truncated to 16 bits.
- Coefficients (Hamming, Mel, DCT) are stored as Q1.15 constants.

## Usage Instructions
1. **Simulation**: Use the provided testbenches (e.g., mfcc_pipeline_tb.v) to simulate the pipeline with random or real audio data.
2. **Synthesis**: The RTL is synthesizable for FPGA/ASIC targets. Adjust parameters (frame size, filter count) as needed.
3. **Integration**: Connect the MFCC output to a wake-word or command detection module for real-time edge voice applications.

---

For further details, see the code comments in each RTL module.
