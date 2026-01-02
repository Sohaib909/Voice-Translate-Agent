import dotenv from "dotenv"
import { Server } from "socket.io"
import http from "http"
import { Socket } from "socket.io"

dotenv.config()

// Create HTTP server
const server = http.createServer()

// Initialize Socket.io server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
})

const PORT = 8080

interface TranslationData {
  id: string
  text: string
}

interface TranslationResponse {
  type: string
  id: string
  text: string
}

// Initialize OpenAI if API key is available
let openai: any = null
if (process.env.OPENAI_API_KEY) {
  try {
    const OpenAI = require("openai")
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    console.log("OpenAI initialized successfully")
  } catch (error) {
    console.warn("  OpenAI package not found. Install it with: npm install openai")
  }
} else {
  console.log("  OPENAI_API_KEY not found. Using mock translations.")
}

// Mock translation function (fallback when AI API is not configured)
const getMockTranslation = (text: string): string => {
  const mockTranslations = [
    `[ES] ${text}`,
    `[FR] ${text}`,
    `[DE] ${text}`,
  ]
  return mockTranslations[Math.floor(Math.random() * mockTranslations.length)]
}

// AI API translation function
const translateWithAI = async (text: string): Promise<string> => {
  // Use OpenAI if available
  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional translator. Translate the following English text to Spanish. Return only the translated text without any additional explanation or formatting.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      })

      const translation = response.choices[0].message.content?.trim() || ""
      return translation
    } catch (error: any) {
      console.error("OpenAI API error:", error.message)
      // Fallback to mock on error
      return getMockTranslation(text)
    }
  }

  // Fallback to mock translation if OpenAI is not configured
  return getMockTranslation(text)
}

// Socket.io connection handling
io.on("connection", (socket: Socket) => {
  console.log("Client connected:", socket.id)

  socket.on("translate", async (data: TranslationData) => {
    try {
      const { id, text } = data
      console.log(`Received translation request: "${text}"`)

      // Make AI API request or use mock
      const translation = await translateWithAI(text)

      // Send translation back to client
      const response: TranslationResponse = {
        type: "translation",
        id,
        text: translation,
      }
      socket.emit("translation", response)
    } catch (error: any) {
      console.error("Error processing translation:", error)
      // Fallback to mock translation on error
      const { id, text } = data
      const response: TranslationResponse = {
        type: "translation",
        id,
        text: getMockTranslation(text),
      }
      socket.emit("translation", response)
    }
  })

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
  })

  socket.on("error", (error: Error) => {
    console.error("Socket error:", error)
  })
})

server.listen(PORT, () => {
  console.log(`Socket.io server running on http://localhost:${PORT}`)
  console.log("WebSocket endpoint: ws://localhost:8080")
})