import { useRef, useState } from "react";
import { createWavFile } from "./voice";

function App() {
  const [voiceText, setVoiceText] = useState("");
  const webSocket = useRef<WebSocket>();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const processor = useRef<AudioWorkletNode>();
  const audioChunks = useRef<Uint8Array[]>([]);

  const closeWebSocket = () => {
    if (webSocket.current) {
      webSocket.current.close();
    }
  };

  const setupWebSocket = () => {
    closeWebSocket();

    const ws = new WebSocket(`ws://localhost:8080`);

    ws.onopen = async () => {
      try {
        const sampleRate = 16000;
        const chunkRate = 100;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: sampleRate,
            channelCount: 1,
            echoCancellation: true,
          },
        });

        mediaRecorder.current = new MediaRecorder(stream);

        audioContext.current = new window.AudioContext({
          sampleRate: sampleRate,
        });

        await audioContext.current.audioWorklet.addModule(
          "./linear16-processor.js"
        );

        const source = audioContext.current.createMediaStreamSource(stream);
        processor.current = new AudioWorkletNode(
          audioContext.current,
          "linear16-processor"
        );

        processor.current.port.onmessage = (event) => {
          if (webSocket.current) {
            if (webSocket.current.readyState === WebSocket.OPEN) {
              webSocket.current.send(event.data);
              audioChunks.current.push(
                new Int16Array(event.data) as unknown as Uint8Array
              );
            }
          }
        };

        source.connect(processor.current);
        processor.current.connect(audioContext.current.destination);

        mediaRecorder.current.onstop = () => {
          if (processor.current && audioContext.current) {
            stream.getTracks().forEach((track) => track.stop());
            createWavFile(audioChunks.current);
            source.disconnect(processor.current);
            processor.current.disconnect(audioContext.current.destination);
          }
        };

        mediaRecorder.current.start(chunkRate);
      } catch (error) {
        console.error(error);
      }
    };

    ws.onmessage = (event) => {
      const receivedData = JSON.parse(event.data).transcript;

      setVoiceText(receivedData);
    };

    ws.onerror = (error) => {
      console.error("WebSocket 오류:", error);

      setVoiceText("");
    };

    ws.onclose = () => {
      console.log("커넥션 닫힘");
    };

    webSocket.current = ws;
  };

  return (
    <>
      <button onClick={setupWebSocket}>듣기</button>
      <button onClick={closeWebSocket}>멈추기</button>
      <br />
      <div>{voiceText}</div>
    </>
  );
}

export default App;
