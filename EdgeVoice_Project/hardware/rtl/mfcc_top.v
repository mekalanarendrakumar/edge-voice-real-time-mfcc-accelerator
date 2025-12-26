// MFCC Top RTL placeholder

// Top-level MFCC pipeline
module mfcc_top #(
	parameter FRAME_SIZE = 8,
	parameter DATA_WIDTH = 16
)(
	input clk,
	input rst,
	input [DATA_WIDTH-1:0] audio_in,
	input valid_in,
	output [DATA_WIDTH-1:0] mfcc_out,
	output valid_out
);
	// Internal wires
	wire [DATA_WIDTH-1:0] windowed_out;
	wire valid_windowed;
	wire [DATA_WIDTH-1:0] fft_out_real, fft_out_imag;
	wire valid_fft;
	wire [DATA_WIDTH-1:0] mel_out;
	wire valid_mel;

	// Framing and windowing
	framing #(.FRAME_SIZE(FRAME_SIZE), .DATA_WIDTH(DATA_WIDTH)) framing_inst (
		.clk(clk),
		.rst(rst),
		.audio_in(audio_in),
		.valid_in(valid_in),
		.windowed_out(windowed_out),
		.valid_out(valid_windowed)
	);

	// FFT (imaginary part is zero for real input)
	fft #(.N(FRAME_SIZE), .DATA_WIDTH(DATA_WIDTH)) fft_inst (
		.clk(clk),
		.rst(rst),
		.data_in_real(windowed_out),
		.data_in_imag(0),
		.valid_in(valid_windowed),
		.data_out_real(fft_out_real),
		.data_out_imag(fft_out_imag),
		.valid_out(valid_fft)
	);

	// Mel filter bank (use magnitude of FFT output)
	wire [DATA_WIDTH-1:0] fft_mag;
	assign fft_mag = fft_out_real; // Placeholder: use real part only
	mel_filter #(.NUM_FILTERS(4), .FFT_SIZE(FRAME_SIZE), .DATA_WIDTH(DATA_WIDTH)) mel_inst (
		.clk(clk),
		.rst(rst),
		.fft_mag_in(fft_mag),
		.valid_in(valid_fft),
		.mel_out(mel_out),
		.valid_out(valid_mel)
	);

	// Log and DCT
	log_dct #(.NUM_MEL(4), .DATA_WIDTH(DATA_WIDTH)) log_dct_inst (
		.clk(clk),
		.rst(rst),
		.mel_in(mel_out),
		.valid_in(valid_mel),
		.mfcc_out(mfcc_out),
		.valid_out(valid_out)
	);
endmodule
