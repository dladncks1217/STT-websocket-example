export function createWavHeader(
  byteLength: number,
  sampleRate: number,
  channels: number
) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, byteLength, true);

  return new Uint8Array(header);
}

export function createWavFile(audioChunks: Uint8Array[]) {
  const totalLength = audioChunks.reduce((acc, val) => acc + val.length, 0);
  const combinedBuffer = new Int16Array(totalLength);

  let offset = 0;
  for (const chunk of audioChunks) {
    combinedBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  const wavHeader = createWavHeader(combinedBuffer.length * 2, 16000, 1);
  const wavBuffer = new Uint8Array(
    wavHeader.length + combinedBuffer.byteLength
  );

  wavBuffer.set(wavHeader, 0);
  wavBuffer.set(new Uint8Array(combinedBuffer.buffer), wavHeader.length);

  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "recording.wav";
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
}
