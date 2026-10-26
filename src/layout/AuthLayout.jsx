import { Navigate, Outlet } from "react-router"
import { useSariAuthStore } from "../data/sariAuthStore"

function AuthLayout() {
  const user = useSariAuthStore(state => state.user)
  if (user) return <Navigate to={'/'} />
  return (
    <>
    <div className="flex flex-col items-center justify-center w-full px-11 h-full overflow-y-auto gap-8 bg-[linear-gradient(to_bottom,var(--color-th-plain-white)_80%,var(--color-th-green-dark))] bg-size-[100%_110%]">
      <Outlet/>
    </div>
    </>
  )
}

export default AuthLayout