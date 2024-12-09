import { useRef, useState } from "react";

function App() {
  const [voiceText, setVoiceText] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const webSocket = useRef<WebSocket>();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const processor = useRef<AudioWorkletNode | null>();
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

        const analyser = audioContext.current.createAnalyser();
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        source.connect(processor.current);
        processor.current.connect(audioContext.current.destination);

        source.connect(analyser);

        const detectTalking = () => {
          if (!webSocket.current) {
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          const avgVolume =
            dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

          if (avgVolume > 50) {
            setIsTalking(true);
          } else {
            setIsTalking(false);
          }

          requestAnimationFrame(detectTalking);
        };

        detectTalking();

        mediaRecorder.current.onstop = () => {
          if (processor.current && audioContext.current) {
            stream.getTracks().forEach((track) => track.stop());
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
      if (processor.current) {
        processor.current.disconnect();
        processor.current = null;
      }
      if (audioContext.current) {
        audioContext.current.close();
        audioContext.current = null;
      }
      if (mediaRecorder.current) {
        mediaRecorder.current.stop();
        mediaRecorder.current = null;
      }
    };

    webSocket.current = ws;
  };

  return (
    <>
      <button onClick={setupWebSocket}>듣기</button>
      <button onClick={closeWebSocket}>멈추기</button>
      <br />
      <div>{voiceText}</div>
      {isTalking && <div>말하는중</div>}
    </>
  );
}

export default App;
