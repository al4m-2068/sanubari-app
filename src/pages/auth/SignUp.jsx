import { useForm } from "react-hook-form"
import { useSariAuthStore } from "../../data/sariAuthStore"
import Button from "../../components/atom/Button"
import { Link, useNavigate } from "react-router"
import googleG from '../../assets/icons/google-g.svg'
import { useState } from "react"

function SignUp() {
  const navigate = useNavigate()
  const signup = useSariAuthStore(state => state.signup)
  const [showPassword, setShowPassword] = useState(false)
  const authError = useSariAuthStore(state => state.error)
  const {register, handleSubmit, formState: { errors, }} = useForm()
  const clearError = useSariAuthStore(state => state.clearError)
  const handleShowPassword = (e) => {
    // biar gak kesubmit tiba-tiba
    e.preventDefault(); 
    setShowPassword(!showPassword);
  };

  return (
    <>
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-4xl/[110%] font-bold text-th-green-darker font-cabinet">Hello, Welcome!</h1>
      <p className="text-lg/[110%] text-th-green-dark">Sign up to continue</p>
    </div>
    {authError && <p className="text-xs text-th-purple-darker">{authError}</p>}
    <form id="signup-form" onSubmit={handleSubmit((data) => {
      const next = signup(data.email, data.password, data.firstName.trim(), data.lastName.trim())
      if (next) {
        setTimeout(() => navigate('/'), 300)
      }
    }) /* handleSubmit = ngecek inputan apakah valid semua, bukan ngirim data */} className="flex flex-col items-center w-full gap-3">
      <fieldset className="flex flex-col w-full gap-3">
        <div className="grid w-full grid-cols-2 gap-y-3">
          <span className={`flex items-center relative ${errors.firstName ? 'text-th-purple-darker' : 'text-th-plain-black'}`}>
            <i className="fi fi-rr-user absolute left-4 text-base/[80%]"></i>
            <input type="text" id="firstName" {...register('firstName', {
              required: "Enter your first name!",
              validate: value => value.trim().length > 0 || "Enter your first name!",
              pattern: {
                value: /^[\p{L}\s.'-]+$/u,
                message: "Name can only contain letters, spaces, hyphens, and apostrophes",
              },
            })} className={`w-full border-[1.2px] border-r-[0.6px] rounded-r-none ${errors.firstName ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-white border-th-plain-grey'} rounded-2xl pl-12 py-4 pr-4 text-xs`} placeholder="First name"/>
          </span>

          <span className="relative">
            <input type="text" id="lastName" {...register('lastName', {
              required: "Enter your last name!",
              validate: value => value.trim().length > 0 || "Enter your last name!",
              pattern: {
                value: /^[\p{L}\s.'-]+$/u,
                message: "Name can only contain letters, spaces, hyphens, and apostrophes",
              },
            })} className={`w-full rounded-l-none border-[1.2px] border-l-[0.6px] ${errors.lastName ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-white border-th-plain-grey'} rounded-2xl py-4 px-4 text-xs`} placeholder="Last name"/>
          </span>

          {errors.firstName && <p className="-mt-1 text-xs text-th-purple-darker">{errors.firstName.message}</p>}
          {errors.lastName && <p className="-mt-1 text-xs text-th-purple-darker">{errors.lastName.message}</p>}
        </div>

        <span className={`flex items-center relative ${errors.email ? 'text-th-purple-darker' : 'text-th-plain-black'}`}>
          <i className="fi fi-rr-envelope absolute left-4 text-base/[80%]"></i>
          <input id="email" name="email" placeholder="youremail@company.com" type="text" {...register('email', {
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Enter a valid email!'
            },
            required: 'Enter your email!',
          })} className={`w-full border-[1.2px] ${errors.email ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-white border-th-plain-grey'} rounded-2xl pl-12 py-4 pr-4 text-xs`} />
        </span>
        {errors.email && <p className="-mt-1 text-xs text-th-purple-darker">{errors.email.message}</p>}

        <span className={`flex items-center relative ${errors.password ? 'text-th-purple-darker' : 'text-th-plain-black'}`}>
          <i className="fi fi-rr-lock absolute left-4 text-base/[80%]"></i>
          <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} absolute right-4 text-base/[80%]`} onClick={handleShowPassword}></i>
          <input id="password" name="password" placeholder="Password" type={showPassword ? 'text' : 'password'} {...register('password', {
            pattern: {
              value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
              message: 'Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.'
            },
            required: 'Enter your password!',
          })} className={`w-full border-[1.2px] ${errors.password ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-white border-th-plain-grey'} rounded-2xl pl-12 py-4 px-4 text-xs`} />
        </span>
        {errors.password && <p className="-mt-1 text-xs text-th-purple-darker">{errors.password.message}</p>}
        
        <span className={`flex items-center relative ${errors.confirmPassword ? 'text-th-purple-darker' : 'text-th-plain-black'}`}>
          <i className="fi fi-rr-lock absolute left-4 text-base/[80%]"></i>
          <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} absolute right-4 text-base/[80%]`} onClick={handleShowPassword}></i>
          <input id="confirmPassword" name="confirmPassword" placeholder="Confirm password" type={showPassword ? 'text' : 'password'} {...register('confirmPassword', {
            validate: (value, formValues) => value === formValues.password || 'Passwords do not match.',
            required: 'Confirm your password!',
          })} className={`w-full border-[1.2px] ${errors.confirmPassword ? 'bg-th-purple-light/25 border-th-purple-dark text-th-purple-darker' : 'bg-white border-th-plain-grey'} rounded-2xl pl-12 py-4 px-4 text-xs`} />
        </span>
        {errors.confirmPassword && <p className="-mt-1 text-xs text-th-purple-darker">{errors.confirmPassword.message}</p>}
      </fieldset>
    </form>
    <div className="flex gap-2">
      <Button form={'signup-form'} type="submit" className="rounded-3xl text-center bg-th-green-light text-lg/[90%] font-medium text-th-plain-white py-6 px-16 justify-center'} to={'/auth/sign-in">Sign Up</Button>
      <Button className={'border-[1.2px] border-th-purple-light p-0 size-16 rounded-3xl justify-center'}>
        <img className="size-6" src={googleG} alt="" />
      </Button>
    </div>
    <p className="text-lg/[110%]">Have an account? <Link className="font-medium text-th-green-dark" to={'/auth/sign-in'} onClick={clearError}>Sign In</Link></p>
    </>
  )
}

export default SignUp