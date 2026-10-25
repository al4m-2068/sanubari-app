import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router'
import { router } from './router/router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useSariAuthStore } from './data/sariAuthStore'

const pageTitles = {
  '/welcome': 'SANUBARI',
  '/onboarding': 'Onboarding | SANUBARI',
  '/auth/sign-in': 'Sign In | SANUBARI',
  '/auth/sign-up': 'Sign Up | SANUBARI',
  '/': 'SANUBARI',
  '/home': 'Home | SANUBARI',
  '/insights': 'Insights | SANUBARI',
  '/insights/overview': 'Overview | Insights | SANUBARI',
  '/insights/history': 'History | Insights | SANUBARI',
  '/insights/history/weekly': 'Weekly | Insights | SANUBARI',
  '/insights/history/monthly': 'Monthly | Insights | SANUBARI',
  '/insights/history/yearly': 'Yearly | Insights | SANUBARI',
  '/chatbot': 'Chatbot | SANUBARI',
  '/chatbot/session': 'Chat Session | SANUBARI',
  '/profile': 'Profile | SANUBARI',
  '/measure': 'Measure | SANUBARI',
}

function updateDocumentTitle(pathname = router.state.location.pathname) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const user = useSariAuthStore.getState().user

  document.title = normalizedPath === '/onboarding' && !user
    ? 'SANUBARI | Your heart rate, just a camera away.'
    : pageTitles[normalizedPath] ?? `${normalizedPath.split('/').filter(Boolean).at(-1) ?? 'SANUBARI'} | SANUBARI`
}

router.subscribe(({ location }) => updateDocumentTitle(location.pathname))
useSariAuthStore.subscribe(() => updateDocumentTitle())
updateDocumentTitle()

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
