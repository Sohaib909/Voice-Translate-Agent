import { VoiceTranslator } from "./components/VoiceTranslator"
import "./App.css"

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>Real-time Voice Translator</h1>
      </header>
      <main>
        <VoiceTranslator />
      </main>
    </div>
  )
}

export default App