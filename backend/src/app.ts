import express, { Request, Response, NextFunction } from "express";
import path from "path";
import logger from "morgan";
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws";
import { SpeechClient } from "@google-cloud/speech";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Google Speech-to-Text 클라이언트 초기화
const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`${PORT} 번 포트에서 서버 대기중`);
});

// WebSocket 서버 생성
const wss = new WebSocketServer({ server });

// WebSocket 연결 처리
wss.on("connection", (ws: WebSocket) => {
  console.log("WebSocket connection established.");

  // STT 스트림 생성
  const recognizeStream = speechClient
    .streamingRecognize({
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 16000,
        languageCode: "ko-KR",
      },
      interimResults: true,
    })
    .on("error", (error) => {
      console.error("Speech-to-Text error:", error);
      ws.send(JSON.stringify({ error: error.message }));
    })
    .on("data", (data) => {
      const transcript = data.results
        .map(
          (result: { alternatives: { transcript: string }[] }) =>
            result.alternatives[0].transcript
        )
        .join("\n");

      console.log("Transcript:", transcript);

      // 텍스트 결과 클라이언트에 전송
      ws.send(JSON.stringify({ transcript }));
    });

  // 클라이언트 메시지 처리
  ws.on("message", (message: WebSocket.RawData) => {
    if (typeof message === "string") {
      console.log("Received string message:", message);
      return;
    }

    // 바이너리 데이터 -> Google STT로 스트림 처리
    recognizeStream.write(message as Buffer);
  });

  // WebSocket 연결 종료 처리
  ws.on("close", () => {
    console.log("WebSocket connection closed.");
    recognizeStream.end();
  });
});

app.use((_req: Request, _res: Response, next: NextFunction) => {
  const error: any = new Error("404 error");
  error.status = 404;
  next(error);
});

app.use((err: any, req: Request, res: Response) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.send("error");
});

export default app;
