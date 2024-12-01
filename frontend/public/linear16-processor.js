class Linear16Processor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      const int16Buffer = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        int16Buffer[i] = Math.max(-1, Math.min(1, channelData[i])) * 0x7fff;
      }
      this.port.postMessage(int16Buffer.buffer);
    }
    return true;
  }
}

registerProcessor("linear16-processor", Linear16Processor);
