import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Ion } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './index.css'
import App from './App.jsx'

// Initialize Cesium Ion with your access token
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0OWM4NGU2NC1iYTVjLTQ0ZDctOGUxNS1lNzJmNzdlOTRkYWIiLCJpZCI6MTgwNDI0LCJpYXQiOjE3MDAzMjk4MjR9.V1qPw1NtpB1wUHISx29jG8ILR51iQOfKGglmCDIGc-k'; // Replace with your token

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
