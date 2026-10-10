import { useEffect, useState } from "react"
import { twMerge } from "tailwind-merge"
import Button from "../components/atom/Button"
import faceGuide from "/src/assets/images/face-guideline.svg"
import Card from "../components/atom/Card"
import { NavLink } from "react-router"

const requirementsClass = {
  check: 'text-th-plain-white bg-th-green-dark',
  onStage: 'text-th-green-dark',
  uncheck: 'text-th-plain-grey'
}
const stageTexts = {
  face: {
    icon: 'fi fi-rr-qr-scan',
    p: 'Stay in the designated area!',
    h1: 'Keep a steady face in the area',
  },
  movement: {
    icon: 'fi fi-rr-laugh',
    p: 'Stay still, don’t move!',
    h1: 'Don’t make any sudden movement!',
  },
  light: {
    icon: 'fi fi-rr-bulb',
    p: 'Keep enough lighting!',
    h1: 'Make sure your face is visible under light',
  },
  finished: {
    p: 'Ready and set!',
  },
}

function Camera() {
  const [start, setStart] = useState(false)
  const [resultStat, setResultStat] = useState(0)
  const [stage, setStage] = useState('')
  const [stageCompleted, setStageCompleted] = useState({
    face: false,
    movement: false,
    light: false,
  })
  const getStageClass = (label) => stage === label ? 'onStage' : stageCompleted[label] ? 'check' : 'uncheck'
  const notMeasureStages = stage !== 'measuring' && stage !== 'result'
  const expectedTime = /* 30000 */ 5000
  const perMs = /* 30000 */ 100
  const [moveTooMuch, setMoveTooMuch] = useState(false)
  const overviewStatus = 'Great'

  function handleMoveTooMuch(e) {
    if (stage !== 'measuring') return
    const moveX = e.movementX
    const moveY = e.movementY
    
    if (Math.abs(moveX) > 20 || Math.abs(moveY) > 20) {
      setMoveTooMuch(true)
      setResultStat(0)
      setStageCompleted(prev => Object.fromEntries(Object.keys(prev).map(key => [key, false])))
    }

    console.log(moveX, moveY)
  }

  useEffect(() => {
    if (stage === 'finished' || stage === 'measuring' || stage === 'result') return
    const camStageTimeout = setTimeout(() => {
      setStageCompleted(prev => ({...prev, [stage]: true}))
      setStage(prev => prev === 'face' ? 'movement' : prev === 'movement' ? 'light' : 'finished')
    }, 1000)

    return () => clearTimeout(camStageTimeout)
  }, [stage])

  useEffect(() => {
    if (stage !== 'measuring') return
    if (resultStat === 100) {
      setStage('result')
      return
    }
    const increment = 100 / (expectedTime / perMs)

    const resultStatTimeout = setTimeout(() => {
      setResultStat(current => Math.min(current + increment, 100))
    }, perMs)
    if (moveTooMuch) clearTimeout(resultStatTimeout)


    return () => clearTimeout(resultStatTimeout)
  }, [stage, resultStat])

  return (
    <div className={`flex flex-col items-center h-full pt-16 ${stage === 'measuring' ? 'gap-0' : stage === 'result' ? 'gap-12' : 'gap-7'}`}>
      {/* DIV for START OVERLAY */}
      {!start &&
        <div className="flex flex-col items-center justify-center w-full h-full gap-3 px-6 text-center">
          <p className="text-lg/[110%] text-th-green-dark">Start Measuring!</p>
          <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">Do a quick<br/>measurement!</h1>
          <Button className={'mt-10 h-23 border-4 text-th-green-dark rounded-3xl text-2xl/[110%] font-medium bg-th-green-dark/20 w-full justify-center'} onClick={() => {
            setStart(true)
            setStage('face')
          }}>Start</Button>
        </div>
      }

      {start && (
        <>
        {/* DIV for CAMERA [BACKEND] */}
        {stage !== 'result' && (
          <div id="camContainer" onMouseMove={handleMoveTooMuch} style={{ width: '100%', height: '420px' }} className={`bg-[url('https://m.media-amazon.com/images/I/71+NJH3rphL._AC_UF1000,1000_QL80_.jpg')] bg-cover bg-center rounded-3xl shrink-0 items-center justify-center flex relative ${!notMeasureStages && 'rounded-b-none'}`}>
            {/* CAMERA */}
            {stage === 'face' ? (
              <img src={faceGuide} alt="" />
            ) : stage === 'measuring' ? (
              <div className="absolute bottom-0 flex w-full h-2"><div className="flex h-2 transition-all duration-200 bg-th-green-dark" style={{ width: `${resultStat}%` }}></div></div>
            ) : ''}
          </div>
        )}

        {/* DIV for PREP ICONS [stageTexts.stage?.icon] */}
        {notMeasureStages && (
          <div className="flex flex-col items-center w-full h-full gap-7">
            {stageCompleted !== true && stage !== 'finished' && notMeasureStages && (
              <div className="flex items-center">
                <p className={twMerge('size-12 flex items-center justify-center text-2xl/[80%] font-medium rounded-2xl', requirementsClass[getStageClass('face')])}><i className={`fi ${stageTexts['face'].icon}`}></i></p>
                <p className={twMerge('size-12 flex items-center justify-center text-2xl/[80%] font-medium rounded-2xl', requirementsClass[getStageClass('movement')])}><i className={`fi ${stageTexts['movement'].icon}`}></i></p>
                <p className={twMerge('size-12 flex items-center justify-center text-2xl/[80%] font-medium rounded-2xl', requirementsClass[getStageClass('light')])}><i className={`fi ${stageTexts['light'].icon}`}></i></p>
              </div>
            )}
            {/* DIV for PREP INFO [stageTexts] */}
            <div className={`flex flex-col items-center w-full gap-2 text-th-plain-grey text-center ${stage === 'finished' ? 'px-11' : stage === 'light' ? 'px-7' : 'px-9'}`}>
              {notMeasureStages && stageTexts[stage] && <p className={`text-lg/[110%] ${stage === 'finished' && 'text-th-green-dark'}`}>{stageTexts[stage].p}</p>}
              {stageCompleted !== true && stage !== 'finished' && notMeasureStages && (
                <>
                <h1 className="text-4xl/[110%] font-medium font-cabinet">{stageTexts[stage].h1}</h1>
                </>
              )}
              {stage === 'finished' && stageCompleted && notMeasureStages && (
                <Button className={'mt-6 h-23 border-4 text-th-green-dark rounded-3xl text-2xl/[110%] font-medium bg-th-green-dark/20 w-full justify-center'} onClick={() => {
                  setStage('measuring')
                }}>Start Measuring!</Button>
              )}
            </div>
          </div>
        )}

        {/* CARD for MEASUREMENT INFO [BACKEND] */}
        {stage === 'measuring' && (
          <Card className={'h-full w-full rounded-t-none'}>
            <div className="flex justify-between">
              <p className="flex flex-col text-xs/[90%] gap-1 font-medium">
                Stay Still!
                <span className="font-normal">Measuring...</span>
              </p>
              <span className="flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-lg bg-th-green-dark/20 text-th-green-dark">
                <div className="rounded-full size-2 bg-th-green-dark"></div>
                Stable
              </span>
            </div>
            {/* CHART DIV */}
            <div className="h-full"></div>

            {/* INFO DIV */}
            <div className="flex w-full gap-8">
              <div className="flex flex-col flex-1 gap-3">
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1"><span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">{'67'}</span>bpm</p>
                <p className="text-lg/[90%]">Average</p>
              </div>
              <div className="flex flex-col flex-1 gap-3">
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1"><span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">{'59'}</span>bpm</p>
                <p className="text-lg/[90%]">Peak</p>
              </div>
              <div className="flex flex-col flex-1 gap-3">
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1"><span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">{'70'}</span>bpm</p>
                <p className="text-lg/[90%]">Lowest</p>
              </div>
            </div>
          </Card>
        )}

        {/* CARD for MOVEMENT POPUP [BACKEND] */}
        {stage === 'measuring' && moveTooMuch && (
          <div className="absolute top-0 left-0 flex flex-col items-center justify-center w-full h-full bg-th-green-light/50 backdrop-blur-xs">
            <Card className={'rounded-3xl bg-th-plain-white px-9 py-16 text-th-green-light items-center text-center gap-6'}>
              <i className="fi fi-sr-limit-hand text-[64px]/[80%] text-th-green-dark"></i>
              <p className="text-lg/[110%] text-th-green-dark">Stay Still!</p>
              <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">You're moving<br/>way too much!</h1>
              <Button onClick={() => {
                setMoveTooMuch(false)
                setStage('face')
              }} className={'text-xs/[90%] font-medium w-41 h-9 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white'}>Okay</Button>
            </Card>
          </div>
        )}

        {/* DIV for RESULT [BACKEND] */}
        {stage === 'result' && (
          <>
            <div className="flex flex-col items-center justify-center gap-2 text-center text-th-plain-black w-49">
              <h1 className="text-4xl/[110%] font-bold text-th-green-darker font-cabinet">Well Done!</h1>
              <p className="text-xs/[110%]">your heart rate is within a healthy range, with an average of</p>
            </div>
            <div className="flex flex-col w-full gap-3">
              <Card className={'h-64 grid auto-rows-max gap-x-2 gap-y-4 grid-cols-[132px_132px_1fr] w-full rounded-3xl'}>
                <div className="flex flex-col gap-6"> 
                    <p className="text-lg/[110%] font-medium flex flex-col gap-1">Your average heart rate <span className="text-xs/[90%] text-th-plain-grey font-normal">20th September 2026</span></p>
                  <h1 className="text-[64px]/[90%] font-bold font-cabinet flex items-start gap-1">67<i className="text-xs fi fi-sr-heart text-th-purple-light"></i></h1>
                </div>

                {/* DIV for CHART [BACKEND] */}
                <div className="col-span-2"></div>

                <Card className="gap-2 font-normal border-b-2 border-th-green-dark rounded-2xl">
                  <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">68<span className="text-xs/[90%] font-normal font-general text-th-green-dark">bpm</span></p>
                  <p className="text-xs/[90%]">Peak</p>
                </Card>
                <Card className="gap-2 font-normal border-b-2 border-th-cream-pale rounded-2xl">
                  <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">65<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
                  <p className="text-xs/[90%]">Lowest</p>
                </Card>
                <Card className={`relative items-center py-3 overflow-hidden rounded-lg ${overviewStatus == 'Great!' ? 'bg-th-green-dark/20 text-th-green-dark ' : 'bg-th-purple-light text-th-purple-darker'}`}>
                  <p className="flex items-center text-xs/[110%] font-semibold text-center z-2">{overviewStatus}</p>
                  <img src={overviewStatus == 'Great!' ? "/src/assets/images/heart-small.svg" : "/src/assets/images/heart-small-poor.svg"} alt="heart-icon" className='absolute h-auto max-w-none w-19 -bottom-8' />
                </Card>
              </Card>
              <NavLink to={'/insights'} className={'h-13 w-full text-xs/[90%] font-medium text-th-purple-darker bg-linear-20 from-th-purple-dark to-th-purple-light rounded-3xl flex items-center justify-center'}>
                View your Weekly Insights
              </NavLink>
              <Card className={'bg-th-green-dark bg-[radial-gradient(68.99%_68.99%_at_50%_31.31%,#6A624D_0%,#8C8268_18.54%,#A4B0A3_46.99%,#DCDACA_100%)] p-0 rounded-3xl overflow-clip flex-row w-full h-max shrink-0'}>
                <div className="flex items-center self-stretch justify-center flex-1 shrink-0 text-th-cream-pale bg-th-cream aspect-square">
                  <i className="fi fi-rr-beacon text-5xl/[80%]"></i>
                </div>
                <div className="flex flex-col items-start gap-3 p-4 flex-2">
                  <p className="font-medium text-xs/[110%] text-th-plain-white">Your heart rate is within a healthy range! want to see how it compares with your past measurements?</p>
                  <NavLink to={'/chatbot/session'} className={'border-[1.2px] border-th-plain-grey bg-th-plain-white px-4 py-3 rounded-2xl text-xs/[100%] text-th-plain-black'}>Ask SARI Chatbot</NavLink>
                </div>
              </Card>
            </div>
            <NavLink onClick={() => {
              setMoveTooMuch(false)
              setStage('')
              setResultStat(0)
              setStageCompleted(prev => Object.fromEntries(Object.keys(prev).map(key => [key, false])))
            }} to={'/home'} className={'text-xs/[90%] font-medium w-41 h-9 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white'}>Back to Dashboard</NavLink>
          </>
        )}
        </>
      )}
    </div>
  )
}

export default Camera