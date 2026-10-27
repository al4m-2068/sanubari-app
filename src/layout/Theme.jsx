import { Fragment, useEffect, useRef, useState } from "react"
import { useNavigate, Outlet, NavLink, useLocation, Navigate } from "react-router"
import { Popover } from "radix-ui"
import Button from "../components/atom/Button"
import { useSariAuthStore } from "../data/sariAuthStore"
import sariLogo from '../assets/icons/sanubari.svg'
import bgMain from '/src/assets/images/bg-main-gradient.png'
import bgTwo from '/src/assets/images/bg-two-gradient.png'

function NotificationTicker({ text, className = '' }) {
  const viewportRef = useRef(null)
  const textRef = useRef(null)
  const [metrics, setMetrics] = useState({ overflow: false, viewportWidth: 0 })

  useEffect(() => {
    const viewport = viewportRef.current
    const content = textRef.current
    if (!viewport || !content) return

    const measure = () => {
      const viewportWidth = viewport.clientWidth
      const overflow = content.scrollWidth > viewportWidth
      setMetrics(current => current.overflow === overflow && current.viewportWidth === viewportWidth
        ? current
        : { overflow, viewportWidth })
    }

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(content)
    measure()

    return () => observer.disconnect()
  }, [text])

  return (
    <div ref={viewportRef} className="min-w-0">
      <p
        ref={textRef}
        className={`w-max whitespace-nowrap ${className} ${metrics.overflow ? 'notification-ticker' : ''}`}
        style={metrics.overflow ? { '--ticker-start': `${metrics.viewportWidth}px` } : undefined}
      >
        {text}
      </p>
    </div>
  )
}

const pageList = [
  { path: '/home', title: 'Home', icon: 'fi-rr-home', iconActive: 'fi-sr-home' },
  { path: '/insights', title: 'Insights', icon: 'fi-rr-heart-rate', iconActive: 'fi-sr-heart-rate' },
  { path: '/measure', title: 'Measure', icon: 'fi-sr-heart', iconActive: 'fi-sr-heart' },
  { path: '/chatbot', title: 'Chatbot', icon: 'fi-rr-beacon', iconActive: 'fi-sr-beacon' },
  { path: '/profile', title: 'Profile', icon: 'fi-rr-user', iconActive: 'fi-sr-user' },
]

function Theme() {
  const pathname = useLocation().pathname
  const navigate = useNavigate()
  const user = useSariAuthStore(state => state.user)
  const notifications = useSariAuthStore(state => state.notifications)
  const deleteNotification = useSariAuthStore(state => state.deleteNotification)
  const mainRef = useRef(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const scrollContainer = mainRef.current
    if (!scrollContainer) return

    const updateScrollState = () => setIsScrolled(scrollContainer.scrollTop > 0)
    updateScrollState()
    scrollContainer.addEventListener('scroll', updateScrollState, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', updateScrollState)
  }, [user])

  if (!user) return <Navigate to={'/welcome'} />

  return (
    <div style={{backgroundImage: `url(${pathname == '/home' ? bgMain : bgTwo})`}} className="bg-size-[100%_100%] bg-fixed w-full h-full">
      <header className={`${pathname !== '/home' && '-translate-y-full invisible'} absolute p-4 top-0 flex items-center justify-between w-full z-999 transition-all duration-500 ${isScrolled ? 'bg-th-plain-white/10 backdrop-blur-sm' : ''}`}>
        <img src={sariLogo} alt="SANUBARI icon" className="cursor-pointer size-10 shrink-0" onClick={() => navigate('/')}/>
        <div className="flex items-center gap-2">
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button className='flex items-center justify-center bg-white cursor-pointer rounded-2xl text-th-green-dark size-9 shrink-0'>
                <i className="fi fi-rr-bell text-base/[90%]"></i>
              </Button>
            </Popover.Trigger>
            <Popover.Content align="end" alignOffset={-48} className="z-50 rounded-2xl bg-white py-3 px-4 text-xs/[100%] text-th-plain-black flex flex-col gap-3 w-75 shadow-2xl shadow-th-plain-black/20">
              {notifications.map(({id, title, desc}, index) => (
                <Fragment key={id}>
                <div className="relative flex items-center">
                  <div className="flex flex-col flex-1 min-w-0 gap-1 py-1 overflow-hidden pr-7">
                    <NotificationTicker text={title} className="font-medium" />
                    <NotificationTicker text={desc} />
                    <div className="absolute top-0 right-0 h-full w-10 bg-linear-240 from-th-plain-white from-60% to-transparent" />
                  </div>
                  <Button
                    type="button"
                    aria-label={`Delete notification: ${title}`}
                    className="absolute right-0 z-10 cursor-pointer"
                    onClick={() => deleteNotification(id)}
                  >
                    <i className="fi fi-tr-circle-trash text-sm/[80%]"></i>
                  </Button>
                </div>
                {index !== notifications.length - 1 && <hr className="border border-th-plain-grey" />}
                </Fragment>
              ))}
              <Popover.Arrow className="fill-th-plain-white" height={8} width={10}/>
            </Popover.Content>
          </Popover.Root>
          <Button className="cursor-pointer" onClick={() => navigate('/profile')}><img src={user.profilePicture} referrerPolicy="no-referrer" className="object-cover object-center size-10 rounded-2xl" alt={`${user.name?.first ?? ''} profile picture`} /></Button>
        </div>
      </header>
      <main ref={mainRef} className={`relative flex flex-col h-full px-4 overflow-y-auto scrollbar-none ${pathname === '/home' && 'pt-18'} transition-all duration-700 pb-27`}>
        <Outlet/>
      </main>
      <nav className="absolute bottom-0 left-0 w-full p-4 z-9">
        <ul className="bg-th-plain-white flex justify-between p-1.5 w-full rounded-3xl">
          {pageList.map(({path, icon, iconActive}, index) => (
            <li key={path} className="flex-1 flex justify-center">
              <NavLink to={path} className={({ isActive }) => `
                flex flex-col relative gap-1 items-center justify-center size-16 rounded-3xl ${index == 2 ? 'text-th-plain-white bg-th-purple-light' : isActive && index !== 2 ? 'text-th-green-dark' : 'text-th-plain-grey'}
              `}>
                {({ isActive }) => (
                  <>
                  <i className={`fi ${isActive ? iconActive : icon} text-2xl/[90%] transition-all duration-150`} aria-hidden='true'></i>
                  {index !== 2 && <div className={`transition-all duration-150 ${isActive ? 'bg-th-green-dark' : 'bg-transparent'} w-6 h-1 rounded-sm absolute bottom-0`} />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default Theme