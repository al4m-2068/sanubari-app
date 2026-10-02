import { useNavigate, Outlet, NavLink } from "react-router"
import Button from "../components/atom/Button"
import sariLogo from '../assets/icons/sanubari.svg'
import { useSariAuthStore } from "../data/sariAuthStore"

const pageList = [
  { path: '/', title: 'Home', icon: 'fi-rr-home' },
  { path: '/insights', title: 'Insights', icon: 'fi-rr-chart-histogram' },
  { path: '/chatbot', title: 'Chatbot', icon: 'fi-rr-robot' },
]

function Theme() {
  const user = useSariAuthStore(state => state.user)
  const navigate = useNavigate()

  // if (!user) return <Navigate to={'/auth/sign-in'} />

  return (
    <>
      <header className="flex items-center w-full justify-between p-4 sticky top-0 left-0 z-999">
        <img src={sariLogo} alt="SANUBARI icon" className="size-10 shrink-0 cursor-pointer" onClick={() => navigate('/')}/>
        <div className="flex items-center gap-2">
          <Button className='rounded-2xl text-th-green-dark size-9 bg-white flex items-center justify-center shrink-0 cursor-pointer'>
            <i className="fi fi-rr-bell text-base/[90%]"></i>
          </Button>
          <Button className="cursor-pointer" onClick={() => navigate('/profile')}><img src="https://m.media-amazon.com/images/M/MV5BMjI1ODZkYTgtYTY3Yy00ZTJkLWFkOTgtZDUyYWM4MzQwNjk0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg" className="size-10 object-cover object-center rounded-2xl" alt={`${user.name} profile picture`} /></Button>
        </div>
      </header>
      <main className="h-full overflow-y-auto scrollbar-none flex flex-col px-4">
        <Outlet/>
      </main>
      <nav className="absolute bottom-0 left-0 w-full p-4">
        <ul className="border-4 border-th-green-dark bg-th-plain-white flex">
          {pageList.map(({path, title, icon}) => (
            <li key={path} className="flex-1">
              <NavLink to={path} className={({ isActive }) => `
                w-full flex flex-col gap-1 items-center justify-center ${isActive ? 'text-th-green-dark' : 'text-th-green'}
              `}>
                <i className={`fi ${icon}`} aria-hidden='true'></i>
                <span className="text-sm">{title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

export default Theme