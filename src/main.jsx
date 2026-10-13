import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router'
import { router } from './router/router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useSariAuthStore } from './data/sariAuthStore'

function AuthSync() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      useSariAuthStore.getState().syncFirebaseUser(firebaseUser)
    })
    return unsubscribe
  }, [])
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthSync />
    <RouterProvider router={router}/>
  </StrictMode>,
)
