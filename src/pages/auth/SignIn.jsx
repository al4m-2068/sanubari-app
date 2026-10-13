import { useForm } from "react-hook-form"
import { useSariAuthStore } from "../../data/sariAuthStore"
import Button from "../../components/atom/Button"
import { Link, useNavigate } from "react-router"
import googleG from '../../assets/icons/google-g.svg'
import { useState } from "react"
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { auth } from "../../firebase"

function SignIn() {
  const navigate = useNavigate()
  const login = useSariAuthStore(state => state.login)
  const loginWithGoogle = useSariAuthStore(state => state.loginWithGoogle)
  const [showPassword, setShowPassword] = useState(false)
  const authError = useSariAuthStore(state => state.error)
  const {register, handleSubmit, watch, formState: { errors, }} = useForm()
  const handleShowPassword = (e) => {
    // biar gak kesubmit tiba-tiba
    e.preventDefault(); 
    setShowPassword(!showPassword);
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
  
    try {
      const result = await signInWithPopup(auth, provider);
      loginWithGoogle(result.user);
      console.log("google log success:", result.user);
        
      navigate('/home');
    } catch (err) {
      console.error("google log failed", err.message);
    }
  };
  return (
    <>
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-4xl/[110%] font-bold text-th-green-darker font-cabinet">Welcome Back!</h1>
      <p className="text-lg/[110%] text-th-green-dark">Sign in to continue</p>
      {authError && <p className="-mt-1 text-xs text-th-purple-darker">{authError}</p>}
    </div>
    <form id="login-form" onSubmit={handleSubmit((data) => {
      const next = login(data.email, data.password)
      if (next) {
        setTimeout(() => navigate('/'), 300)
      }
    }) /* handleSubmit = ngecek inputan apakah valid semua, bukan ngirim data */} className="flex flex-col items-center w-full gap-3">
      <fieldset className="flex flex-col w-full gap-3">
        <span className={`flex items-center relative ${errors.email ? 'text-th-purple-darker' : 'text-th-plain-black'}`}>
          <i className="fi fi-rr-envelope absolute left-4 text-base/[80%]"></i>
          <input id="email" name="email" autoComplete="username" placeholder="youremail@company.com" type="text" {...register('email', {
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Enter a valid email!'
            },
            required: 'Enter your email!',
          })} className={`w-full border-[1.2px] ${errors.email ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-th-plain-white border-th-plain-grey'} rounded-2xl pl-12 py-4 pr-4 text-xs`} />
        </span>
        {errors.email && <p className="-mt-1 text-xs text-th-purple-darker">{errors.email.message}</p>}
        <span className={`flex items-center relative ${errors.email ? 'text-th-purple-darker' : 'text-th-plain-black'}`}>
          <i className="fi fi-rr-lock absolute left-4 text-base/[80%]"></i>
          <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} absolute right-4 text-base/[80%]`} onClick={handleShowPassword}></i>
          <input id="password" name="password" placeholder="••••••••" autoComplete="current-password" type={showPassword ? 'text' : 'password'} {...register('password', {
            required: 'Enter your password!',
          })} className={`w-full border-[1.2px] ${errors.password ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-th-plain-white border-th-plain-grey'} rounded-2xl pl-12 py-4 px-4 text-xs`} />
        </span>
        {errors.password && <p className="-mt-1 text-xs text-th-purple-darker">{errors.password.message}</p>}
        <p className="font-medium text-th-green-dark text-xs/[110%]">Forgot password?</p>
      </fieldset>
    </form>
    <div className="flex gap-2">
      <Button form={'login-form'} type="submit" className="rounded-3xl text-center bg-th-green-light text-lg/[90%] font-medium text-th-plain-white py-6 px-16 justify-center'} to={'/auth/sign-in">Sign In</Button>
      <Button onClick={handleGoogleLogin} type="button" className={'border-[1.2px] border-th-purple-light p-0 size-16 rounded-3xl justify-center'}>
        <img className="size-6" src={googleG} alt="" />
      </Button>
    </div>
    <p className="text-lg/[110%]">Don't have an account? <Link className="font-medium text-th-green-dark" to={'/auth/sign-up'}>Sign Up</Link></p>
    </>
  )
}

export default SignIn