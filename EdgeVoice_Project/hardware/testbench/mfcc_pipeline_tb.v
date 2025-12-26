// Integration testbench for MFCC pipeline
module mfcc_pipeline_tb();
    reg clk = 0;
    reg rst = 1;
    reg [15:0] audio_in;
    reg valid_in;
    wire [15:0] mfcc_out;
    wire valid_out;

    mfcc_top #(.FRAME_SIZE(8), .DATA_WIDTH(16)) dut (
        .clk(clk),
        .rst(rst),
        .audio_in(audio_in),
        .valid_in(valid_in),
        .mfcc_out(mfcc_out),
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
        #200;
        $finish;
    end
endmodule
