import { useNavigate, Outlet, NavLink, useLocation } from "react-router"
import Button from "../components/atom/Button"
import { useSariAuthStore } from "../data/sariAuthStore"
import bgMain from '/src/assets/images/bg-main-gradient.png'
import bgTwo from '/src/assets/images/bg-two-gradient.png'

const pageList = [
  { path: '/home', title: 'Home', icon: 'fi-rr-home' },
  { path: '/insights', title: 'Insights', icon: 'fi-rr-heart-rate' },
  { path: '/measure', title: 'Measure', icon: 'fi-rr-camera-viewfinder' },
  { path: '/chatbot', title: 'Chatbot', icon: 'fi-rr-beacon' },
  { path: '/profile', title: 'Profile', icon: 'fi-rr-user' },
]

function Theme() {
  const pathname = useLocation().pathname

  // if (!user) return <Navigate to={'/auth/sign-in'} />

  return (
    <div style={{backgroundImage: `url(${pathname == '/home' ? bgMain : bgTwo})`}} className="bg-size-[100%_100%] bg-fixed w-full h-full">
      <main className="relative flex flex-col h-full px-4 overflow-y-auto pb-27 scrollbar-none">
        <Outlet/>
      </main>
      <nav className="absolute bottom-0 left-0 w-full p-4">
        <ul className="ring-4 ring-th-green-dark/20 bg-th-plain-white flex justify-between p-1.5 w-full rounded-3xl">
          {pageList.map(({path, icon}, index) => (
            <li key={path} className="flex-1">
              <NavLink to={path} className={({ isActive }) => `
                flex flex-col gap-1 items-center justify-center size-16 rounded-3xl ${index == 2 ? 'text-th-plain-white bg-th-green-dark' : 'text-th-green-dark bg-th-plain-white'} ${isActive ? 'text-th-green-darker shadow-th-green-dark/20 shadow-lg' : 'text-th-green-dark'}
              `}>
                <i className={`fi ${icon} text-2xl/[90%]`} aria-hidden='true'></i>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default Theme