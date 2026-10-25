import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import Button from "../components/atom/Button"
import Card from "../components/atom/Card"
import { useSariAuthStore } from "../data/sariAuthStore"
import { useNavigate } from "react-router"
import Drawer from "../components/Drawer"
import Accordion from "../components/Accordion"
import { signOut } from "firebase/auth"
import { auth } from "../firebase"
import sariLogo from '../assets/icons/sanubari.svg'
import homeFooter from '../assets/images/home-footer.svg'



const faqContents = [
  {title: 'How does SANUBARI measure my heart rate using a camera?', desc: 'SANUBARI uses rPPG to analyze subtle facial color changes captured by your camera and estimate your heart rate. Use good lighting and remain still.'},
  {title: 'Why did my measurement fail?', desc: 'Poor lighting, movement, or an unclear view of your face can affect a reading. Try again in a well-lit place, keep your face in the guide, and stay still throughout the measurement.'},
  {title: 'Can I use it for medical diagnosis?', desc: 'No. SANUBARI provides an estimate for general wellness and is not a medical device or a substitute for professional diagnosis. If you have concerns about your heart rate or health, consult a healthcare professional.'},
  {title: 'How is my data protected?', desc: 'Camera access requires your permission, which you can manage in your device or browser settings. Keep your password private, and review the app’s privacy information for details about how account and measurement data are handled.'},
]

function Profile() {
  const user = useSariAuthStore(state => state.user)
  const logout = useSariAuthStore(state => state.logout)
  const editAccount = useSariAuthStore(state => state.editAccount)
  const authError = useSariAuthStore(state => state.error)
  const clearError = useSariAuthStore(state => state.clearError)
  const [logoutPopup, setLogoutPopup] = useState(false)
  const [savePopup, setSavePopup] = useState(false)
  const [editOverlay, setEditOverlay] = useState(false)
  const [supportOverlay, setSupportOverlay] = useState(false)
  const [newPicture, setNewPicture] = useState(undefined)
  const profilePictureInput = useRef(null)
  const navigate = useNavigate()
  const { register, handleSubmit, reset, trigger, formState: { errors } } = useForm({
    defaultValues: {
      firstName: user?.name.first ?? '',
      lastName: user?.name.last ?? '',
      email: user?.email ?? '',
      password: user?.password ?? '',
    },
  })

  // Statistik asli dari measurementData (sebelumnya hardcode 72 & 67)
  const measurements = (user?.measurementData ?? []).filter(m => typeof m.bpm === 'number' && Number.isFinite(m.bpm))
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const lastWeek = measurements.filter(m => Date.parse(m.date) >= weekAgo)
  const avgBpm = lastWeek.length ? Math.round(lastWeek.reduce((t, m) => t + m.bpm, 0) / lastWeek.length) : null
  const totalSessions = measurements.length
  const latestMeasurement = measurements
    .map((measurement) => ({
      ...measurement,
      timestamp: typeof measurement.date === 'string' ? Date.parse(measurement.date) : Number.NaN,
    }))
    .filter((measurement) => Number.isFinite(measurement.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
  const latestBpm = latestMeasurement?.bpm ?? null
  const heartRateStatus = latestBpm === null
    ? 'No data'
    : (latestBpm > 100 || latestBpm < 30) ? 'Unstable' : 'Stable'

  const handlePictureChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      // kecilin dulu biar gak bikin localStorage penuh
      const img = new Image()
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const min = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size)
        setNewPicture(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const openEditOverlay = () => {
    reset({
      firstName: user.name.first,
      lastName: user.name.last,
      email: user.email,
      password: user.password ?? '',
    })
    setNewPicture(undefined)
    clearError()
    setEditOverlay(true)
  }

  const closeEditOverlay = () => {
    clearError()
    setNewPicture(undefined)
    setEditOverlay(false)
    setSavePopup(false)
  }

  const submitAccountEdit = (data) => {
    if (editAccount(data.email, data.password, data.firstName, data.lastName, newPicture)) {
      setNewPicture(undefined)
      setEditOverlay(false)
      setSavePopup(false)
    }
  }

  const requestSaveConfirmation = async () => {
    if (await trigger()) {
      setSavePopup(true)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col items-center pt-16 gap-6 -mb-27">
      <div className="flex flex-col items-center gap-8 z-2">
        <img src={user.profilePicture} referrerPolicy="no-referrer" alt="" className="size-48 rounded-[64px] border-[1.2px] border-th-plain-grey object-cover object-center" />
        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl/[110%] font-bold text-th-plain-black font-cabinet">{user.name.first} {user.name.last}</h1>
          <p className="text-lg/[110%] text-th-green-darker">{user.email}</p>
        </div>
      </div>
      <div className="text-center z-2 flex gap-11 items-end mt-5">
        <div className="flex flex-col items-center gap-1">
          <i className="fi fi-sr-flame text-2xl/[80%] text-th-green-dark mb-1" />
          <p className="text-lg/[110%] font-medium text-th-green-darker">{totalSessions ?? '-'}x</p>
          <p className="text-th-plain-grey text-xs/[110%] font-medium">Measured</p>
        </div>
        <div className="flex flex-col items-center gap-1 pb-4">
          <i className="fi fi-sr-heart text-2xl/[80%] text-th-purple-light mb-1" />
          <p className="text-lg/[110%] font-medium text-th-green-darker">{avgBpm ?? '-'} bpm</p>
          <p className="text-th-plain-grey text-xs/[110%] font-medium">Average</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <i className="fi fi-sr-stethoscope text-2xl/[80%] text-th-oak mb-1" />
          <p className={`text-lg/[110%] font-medium text-th-green-darker`}>{heartRateStatus}</p>
          <p className="text-th-plain-grey text-xs/[110%] font-medium">Condition</p>
        </div>
      </div>
      <div className="h-full w-full flex flex-col z-2 gap-7">
        <Card className="text-xs/100 text-th-plain-black w-full p-0 border-[1.2px] border-th-plain-grey">
          <Button onClick={openEditOverlay} className={'p-6 gap-6 w-full items-center'}><i className="fi fi-rr-user text-base/[80%]"/>Personal Information<i className="fi fi-rr-angle-right text-[8px]/[80%] ml-auto" /></Button>
          <Button onClick={() => setSupportOverlay(true)} className={'p-6 gap-6 w-full items-center'}><i className="fi fi-rr-question text-base/[80%]"/>Help & Support<i className="fi fi-rr-angle-right text-[8px]/[80%] ml-auto" /></Button>
          <Button onClick={() => setLogoutPopup(true)} className={'p-6 gap-6 w-full items-center'}><i className="fi fi-rr-leave text-base/[80%]"/>Log Out<i className="fi fi-rr-angle-right text-[8px]/[80%] ml-auto" /></Button>
        </Card>
        <p className="col-span-2 text-center text-xs/[130%] mb-4 text-th-plain-white">
          Designated for personal wellness insights, not a<br/>replacement for professional medical device
        </p>
      </div>
      <div className="sticky -bottom-27 mt-[-55%] flex flex-col items-center justify-center w-full shrink-0 bg-contain bg-bottom bg-no-repeat">
        <div className="relative flex flex-col items-center justify-center h-35 w-full shrink-0 bg-contain bg-bottom bg-no-repeat">
          <img src={homeFooter} alt="SANUBARI Logo" className="inline-block scale-110" />
        </div>
        <div className="h-55 bg-th-green-light w-[calc(100%+16px*2)] self-center -mt-12 shrink-0" />
      </div>
      {logoutPopup && (
        <Drawer onClose={() => {
          setLogoutPopup(false)
        }} isOpen={logoutPopup} className={'h-74 justify-between relative'}>
          <i className="fi fi-rr-seal-exclamation text-[166px]/[80%] absolute -z-1 top-1/2 -translate-y-1/2 text-th-green-dark/20"></i>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">Are you sure?</h1>
            <p className="text-lg/[110%] text-th-green-dark font-medium">Are you sure you want to log out<br/>from your current account?</p>
          </div>
          <div className="flex w-full">
            <Button onClick={async () => {
              await signOut(auth)
              logout()
              navigate('/welcome')
            }} className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white flex-1 min-w-0'}>Logout</Button>
            <Button onClick={() => setLogoutPopup(false)} className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-white rounded-2xl text-th-green-darker flex-1 min-w-0'}>Cancel</Button>
          </div>
        </Drawer>
      )}

      {editOverlay && (
        <div className="absolute top-0 left-0 z-48 flex flex-col w-full h-full bg-[linear-gradient(to_bottom,var(--color-th-plain-white)_80%,var(--color-th-green-dark))] bg-size-[100%_113%] px-6 py-9 rounded-t-3xl">
          <Button onClick={() => setEditOverlay(false)}><i className="fi fi-rr-angle-small-left -ml-1.5 text-th-green-dark text-2xl/[80%]"></i></Button>
          <form id="edit-form" noValidate onSubmit={handleSubmit(submitAccountEdit, () => setSavePopup(false))} className="flex flex-col items-center w-full h-full gap-8">
            <span className="relative">
              <img src={newPicture ?? user.profilePicture} referrerPolicy="no-referrer" className="size-32 rounded-3xl border-[1.2px] border-th-plain-grey object-cover object-center" />
              <input ref={profilePictureInput} type="file" accept="image/*" onChange={handlePictureChange} className="hidden" />
              <Button type="button" onClick={() => profilePictureInput.current?.click()} className={'size-9 text-th-green-dark absolute right-0 bottom-0 translate-y-[30%] translate-x-[30%] bg-white border-[1.2px] border-th-plain-grey justify-center rounded-2xl text-base/[80%]'}><i className="fi fi-sr-pencil"></i></Button>
            </span>
            <div className="flex flex-col w-full gap-2">
              <label htmlFor="firstName" className={`font-medium text-xs/[110%] ${errors.firstName || errors.lastName ? 'text-th-purple-darker' : 'text-th-green-dark'}`}>Full Name</label>
              <div className="flex w-full">
                <input id="firstName" type="text" {...register('firstName', {
                  required: 'Enter your first name.',
                  validate: value => value.trim().length > 0 || 'Enter your first name.',
                  pattern: {
                    value: /^[\p{L}\s.'-]+$/u,
                    message: 'Use letters, spaces, periods, apostrophes, or hyphens.',
                  },
                })} className={`w-full border-[1.2px] border-r-[0.6px] rounded-r-none bg-white ${errors.firstName ? 'border-th-purple-dark text-th-purple-darker' : 'border-th-plain-grey'} rounded-2xl p-4 text-xs`} />
                <input id="lastName" type="text" {...register('lastName', {
                  required: 'Enter your last name.',
                  validate: value => value.trim().length > 0 || 'Enter your last name.',
                  pattern: {
                    value: /^[\p{L}\s.'-]+$/u,
                    message: 'Use letters, spaces, periods, apostrophes, or hyphens.',
                  },
                })} className={`w-full border-[1.2px] border-l-[0.6px] rounded-l-none bg-white ${errors.lastName ? 'border-th-purple-dark text-th-purple-darker' : 'border-th-plain-grey'} rounded-2xl p-4 text-xs`} />
              </div>
              {(errors.firstName || errors.lastName) && <p className="text-xs text-th-purple-darker">{errors.firstName?.message || errors.lastName?.message}</p>}
            </div>
            <div className="flex flex-col w-full gap-2">
              <label htmlFor="email" className={`font-medium text-xs/[110%] ${errors.email ? 'text-th-purple-darker' : 'text-th-green-dark'}`}>Email</label>
              <input id="email" type="email" autoComplete="username" {...register('email', {
                required: 'Enter your email.',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Enter a valid email address.',
                },
              })} className={`w-full border-[1.2px] bg-white ${errors.email ? 'border-th-purple-dark text-th-purple-darker' : 'border-th-plain-grey'} rounded-2xl p-4 text-xs`} />
              {errors.email && <p className="text-xs text-th-purple-darker">{errors.email.message}</p>}
            </div>
            {user.source !== 'firebase' && (
              <div className="flex flex-col w-full gap-2">
                <label htmlFor="password" className={`font-medium text-xs/[110%] ${errors.password ? 'text-th-purple-darker' : 'text-th-green-dark'}`}>Password</label>
                <input id="password" type="password" autoComplete="new-password" {...register('password', {
                  required: 'Enter your password.',
                  minLength: { value: 8, message: 'Password must be at least 8 characters.' },
                })} className={`w-full border-[1.2px] bg-white ${errors.password ? 'border-th-purple-dark text-th-purple-darker' : 'border-th-plain-grey'} rounded-2xl p-4 text-xs`} />
                {errors.password && <p className="text-xs text-th-purple-darker">{errors.password.message}</p>}
              </div>
            )}
            {authError && <p role="alert" className="text-xs text-th-purple-darker">{authError}</p>}
            <div className="flex w-full mt-auto">
              <Button type="button" onClick={requestSaveConfirmation} className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white flex-1 min-w-0'}>Save Changes</Button>
              <Button type="button" onClick={closeEditOverlay} className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-white rounded-2xl text-th-green-darker flex-1 min-w-0'}>Cancel</Button>
            </div>
          </form>
          {/* DIV for SAVE POPUP */}
          {savePopup && (
            <Drawer onClose={() => {
              setSavePopup(false)
            }} isOpen={savePopup} className={'h-74 justify-between relative'}>
              <i className="fi fi-rr-seal-exclamation text-[166px]/[80%] absolute -z-1 top-1/2 -translate-y-1/2 text-th-green-dark/20"></i>
              <div className="flex flex-col gap-2">
                <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">Save Changes?</h1>
                <p className="text-lg/[110%] text-th-green-dark font-medium">Are you sure you want to save these<br/>changes for your current account? </p>
              </div>
              <div className="flex w-full">
                <Button type="submit" form={'edit-form'} className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white flex-1 min-w-0'}>Confirm</Button>
                <Button onClick={closeEditOverlay} className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-white rounded-2xl text-th-green-darker flex-1 min-w-0'}>Discard</Button>
              </div>
            </Drawer>
          )}
        </div>
      )}

      {supportOverlay && (
        <div className="absolute top-0 left-0 z-48 flex flex-col w-full h-full bg-[linear-gradient(to_bottom,var(--color-th-plain-white)_80%,var(--color-th-green-dark))] bg-size-[100%_113%] px-6 py-9 gap-6 rounded-t-3xl">
          <Button onClick={() => setSupportOverlay(false)}><i className="fi fi-rr-angle-small-left -ml-1.5 text-th-green-dark text-2xl/[80%]"></i></Button>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">How can we help?</h1>
            <p className="text-lg/[130%] text-th-green-dark">We’re here to help you get the<br/>most out of SANUBARI.</p>
          </div>
          <div className="h-full overflow-y-auto scrollbar-none">
            <div className="flex flex-col gap-4">
              {faqContents.map(({title, desc}) => (
                <Accordion wrapperClassName={'rounded-2xl overflow-hidden text-th-green-darker'} key={title} title={title}>
                  <p className="text-xs/[130%] bg-th-green-light/25 p-6 border-t-[1.2px] border-th-green-dark">{desc}</p>
                </Accordion>
              ))}
            </div>
          </div>
          <div className="flex w-full mt-auto items-center gap-8">
            <p className={'text-lg/[110%] font-medium text-th-green-dark'}>Still need help?</p>
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=helpsanubari@gmail.com&su=SANUBARI%20Support%20Request" target="_blank" rel="noopener noreferrer" className={'text-xs/[90%] font-medium w-full h-12 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white flex-1 min-w-0'}>Contact Support</a>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile