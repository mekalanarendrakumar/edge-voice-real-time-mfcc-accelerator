// MFCC Testbench placeholder

// Testbench for framing and windowing
module mfcc_tb();
	reg clk = 0;
	reg rst = 1;
	reg [15:0] audio_in;
	reg valid_in;
	wire [15:0] windowed_out;
	wire valid_out;

	framing #(.FRAME_SIZE(8), .DATA_WIDTH(16)) dut (
		.clk(clk),
		.rst(rst),
		.audio_in(audio_in),
		.valid_in(valid_in),
		.windowed_out(windowed_out),
		.valid_out(valid_out)
	);

	always #5 clk = ~clk;

	initial begin
		rst = 1;
		valid_in = 0;
		audio_in = 0;
		#20;
		rst = 0;
		#10;
		// Feed 8 sample values
		repeat (8) begin
			@(negedge clk);
			valid_in = 1;
			audio_in = $random;
		end
		@(negedge clk);
		valid_in = 0;
		#50;
		$finish;
		// FFT test signals
		reg [15:0] fft_in_real;
		reg [15:0] fft_in_imag;
		reg fft_valid_in;
		wire [15:0] fft_out_real;
		wire [15:0] fft_out_imag;
		wire fft_valid_out;

		fft #(.N(8), .DATA_WIDTH(16)) fft_dut (
			.clk(clk),
			.rst(rst),
			.data_in_real(fft_in_real),
			.data_in_imag(fft_in_imag),
			.valid_in(fft_valid_in),
			.data_out_real(fft_out_real),
			.data_out_imag(fft_out_imag),
			.valid_out(fft_valid_out)
		);

		initial begin
			// ...existing framing test...
			// FFT test
			fft_in_real = 0;
			fft_in_imag = 0;
			fft_valid_in = 0;
			#100;
			repeat (8) begin
				@(negedge clk);
				fft_valid_in = 1;
				fft_in_real = $random;
				fft_in_imag = 0;
			end
			@(negedge clk);
			fft_valid_in = 0;
			#50;
			$finish;
		// Mel filter test signals
		reg [15:0] mel_fft_mag_in;
		reg mel_valid_in;
		wire [15:0] mel_out;
		wire mel_valid_out;

		mel_filter #(.NUM_FILTERS(4), .FFT_SIZE(8), .DATA_WIDTH(16)) mel_dut (
			.clk(clk),
			.rst(rst),
			.fft_mag_in(mel_fft_mag_in),
			.valid_in(mel_valid_in),
			.mel_out(mel_out),
			.valid_out(mel_valid_out)
		);

		initial begin
			// ...existing framing and FFT test...
			// Mel filter test
			mel_fft_mag_in = 0;
			mel_valid_in = 0;
			#200;
			repeat (32) begin // 4 filters x 8 bins
				@(negedge clk);
				mel_valid_in = 1;
				mel_fft_mag_in = $random;
			end
			@(negedge clk);
			mel_valid_in = 0;
			#50;
			$finish;
		// Log and DCT test signals
		reg [15:0] log_mel_in;
		reg log_valid_in;
		wire [15:0] mfcc_out;
		wire mfcc_valid_out;

		log_dct #(.NUM_MEL(8), .DATA_WIDTH(16)) log_dct_dut (
			.clk(clk),
			.rst(rst),
			.mel_in(log_mel_in),
			.valid_in(log_valid_in),
			.mfcc_out(mfcc_out),
			.valid_out(mfcc_valid_out)
		);

		initial begin
			// ...existing framing, FFT, Mel filter test...
			// Log and DCT test
			log_mel_in = 0;
			log_valid_in = 0;
			#300;
			repeat (8) begin
				@(negedge clk);
				log_valid_in = 1;
				log_mel_in = $random;
			end
			@(negedge clk);
			log_valid_in = 0;
			#50;
			$finish;
		end
endmodule
