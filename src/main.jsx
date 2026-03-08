import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MiniRecorder from './components/MiniRecorder.jsx'

// URL-based routing: ?view=recorder loads the mini recorder popup
const params = new URLSearchParams(window.location.search);
const view = params.get('view');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {view === 'recorder' ? <MiniRecorder /> : <App />}
  </StrictMode>,
)
