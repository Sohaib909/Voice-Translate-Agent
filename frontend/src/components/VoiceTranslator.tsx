import { useState, useEffect, useRef, useCallback } from "react"
import {io,Socket} from "socket.io-client"
import "./VoiceTranslator.css"

interface TranslationMessage {
  id: string
  original: string
  translated: string
  timestamp: Date
}


export function VoiceTranslator() {
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [messages, setMessages] = useState<TranslationMessage[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected")

  const socketRef = useRef<Socket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)

  const handleNewSentence = useCallback((text: string) => {
    const id = Math.random().toString(36).substring(7)
    const newMessage: TranslationMessage = {
      id,
      original: text,
      translated: "Translating...",
      timestamp: new Date(),
    }

    setMessages((prev) => [newMessage, ...prev])

    // Send to server via Socket.io
    if (socketRef.current?.connected) {
      socketRef.current.emit("translate", { id, text })
    } else {
      // Fallback mock translation if server is down
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, translated: `[Mock] ${text} (translated)` } : msg
          )
        )
      }, 1000)
    }
  }, [])

  // Socket.io connection
  useEffect(() => {
    const socket = io("http://localhost:8080", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 3000,
    })

    socket.on("connect", () => {
      console.log("Connected to server")
      setConnectionStatus("connected")
    })

    socket.on("disconnect", () => {
      console.log("Disconnected from server")
      setConnectionStatus("disconnected")
    })

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error)
      setConnectionStatus("disconnected")
    })

    socket.on("translation", (data: { type: string; id: string; text: string }) => {
      if (data.type === "translation") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.id ? { ...msg, translated: data.text } : msg
          )
        )
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  // Speech Recognition setup (for browsers that support it)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim()
        if (transcript) {
          handleNewSentence(transcript)
        }
      }

      recognition.onend = () => {
        if (isRecording) {
          recognition.start()
        }
      }

      recognitionRef.current = recognition
    }
  }, [isRecording, handleNewSentence])

  const startRecording = async (): Promise<void> => {
    try {
      // Try Speech Recognition API first (simpler)
      if (recognitionRef.current) {
        recognitionRef.current.start()
        setIsRecording(true)
        return
      }

      // Fallback to MediaRecorder API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        console.log("Audio recorded, length:", audioBlob.size)
      }

      // Start recording in chunks (every 3 seconds)
      mediaRecorder.start(3000)

      setIsRecording(true)
    } catch (error) {
      console.error("Error starting recording:", error)
      alert("Failed to access microphone. Please check permissions.")
    }
  }

  const stopRecording = (): void => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }

    setIsRecording(false)
  }

  const toggleRecording = (): void => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="voice-translator">
      <div className="header-controls">
        <div className={`status ${connectionStatus}`}>
          <span className="status-dot"></span>
          {connectionStatus === "connected" ? "Connected" : "Disconnected"}
        </div>
        <div className="language-indicator">EN → AUTO</div>
      </div>

      <div className="record-button-container">
        <button
          className={`record-button ${isRecording ? "recording" : ""}`}
          onClick={toggleRecording}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? "⏹" : "🎤"}
        </button>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No translations yet. Click the microphone to start recording.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="message">
              <div className="original-text">{msg.original}</div>
              <div className={`translated-text ${msg.translated === "Translating..." ? "translating" : ""}`}>
                {msg.translated}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}