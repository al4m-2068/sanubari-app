import { useEffect, useState } from 'react'
import sariLogo from '../assets/icons/sanubari.svg'
import bgSplash from '../assets/images/bg-splash.png'
import hiwFace from '../assets/images/hiw-face.svg'
import hiwSignal from '../assets/images/hiw-signal.svg'
import hiwRate from '../assets/images/hiw-heartrate.svg'
import enterIllust from '../assets/images/enter-illustration.svg'
import { useSariAuthStore } from '../data/sariAuthStore'
import { Link, useNavigate } from 'react-router'
import Button from '../components/atom/Button'
import Card from '../components/atom/Card'

const hiwContents = [
  {title: 'Your Face', desc: 'Camera captures your facial video', icon: hiwFace},
  {title: 'rPPG Signal', desc: 'Detects subtle color changes in skin', icon: hiwSignal},
  {title: 'Heart rate', desc: 'Calculated in real-time', icon: hiwRate},
]

function Onboarding() {
  const [stage, setStage] = useState(null)

  return (
    <div className={`flex flex-col px-8 pt-25 pb-12 w-full h-full bg-[linear-gradient(to_bottom,var(--color-th-plain-white)_80%,var(--color-th-green-dark))] bg-size-[100%_110%] relative overflow-hidden ${stage === 'howitworks' ? 'justify-between' : 'gap-8'}`}>
      {!stage && (
        <>
        <div className="flex flex-col gap-6 items-start z-2">
          <div className="flex flex-col gap-4">
            <p className="text-lg/[110%] text-th-green-dark">Get Started!</p>
            <h1 className="text-4xl/[110%] font-medium text-th-plain-black font-cabinet"><b>Your Heart Rate,</b><br/>Just a camera away.</h1>
          </div>
          <p className='text-lg/[130%]'>SANUBARI uses rPPG technology to measure your heart rate through your phone’s camera - safely, quickly and easily.</p>
          <Button onClick={() => setStage('howitworks')} className={'mt-2 rounded-3xl text-center bg-th-green-light text-lg/[90%] font-medium text-th-plain-white py-6 px-16'}>Continue</Button>
        </div>
        <img src={enterIllust} alt="" className='w-full h-auto scale-160 absolute bottom-3 -translate-x-5' />
        </>
      )}
      {stage === 'howitworks' && (
        <>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl/[110%] font-bold text-th-plain-black font-cabinet">How it works.</h1>
          <p className='text-lg/[130%]'>Subtle changes in your skin color reveal your heart rate. Our app captures and analyzes these signals using your camera.</p>
        </div>
        <div className="flex flex-col gap-6">
          {hiwContents.map(({title, desc, icon}) => (  
            <Card className={'px-6 py-5 bg-th-green-light/25 rounded-3xl flex-row items-center gap-4'}>
              <img className='rounded-3xl' src={icon} alt="" />
              <div className="space-y-2">
                <p className='text-th-green-darker text-lg/[90%] font-medium'>{title}</p>
                <p className='text-th-green-dark text-lg/[130%]'>{desc}</p>
              </div>
            </Card>
          ))}
        </div>
        <Link onClick={() => setStage('howitworks')} className={'mt-2 rounded-3xl text-center bg-th-green-light text-lg/[90%] font-medium text-th-plain-white py-6 px-16 justify-center'} to={'/auth/sign-in'}>Get Started!</Link>
        </>
      )}
    </div>
  )
}
export default Onboarding

export function Splash() {
  const user = useSariAuthStore(state => state.user)
  const navigate = useNavigate()

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      if (!user) return navigate('/onboarding')
      navigate('/')
    }, 3000)

    return () => clearTimeout(splashTimer)
  }, [])
  return (
    <div style={{backgroundImage: `url(${bgSplash})`}} className="flex items-center justify-center w-full h-full bg-size-[100%_100%] bg-center">
    <img src={sariLogo} alt="" className='size-43' />
    </div>
  )
}