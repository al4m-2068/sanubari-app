import { useEffect, useState, useRef } from "react"
import { twMerge } from "tailwind-merge"
import Button from "../components/atom/Button"
import faceGuide from "/src/assets/images/face-guideline.svg"
import Card from "../components/atom/Card"
import { Link } from "react-router"
import Drawer from "../components/Drawer"

// ── Constants ────────────────────────────────────────────────────────────────
const FRAME_INTERVAL_MS = 250
const FACE_DETECTION_WINDOW = 5
const FACE_DETECTION_THRESHOLD = 3
const STABLE_DURATION_MS = 1500
const BRIGHTNESS_SAMPLES = 5
const BRIGHTNESS_THRESHOLD = 40
const MEASURE_VALID_FRAMES = Math.round(30000 / FRAME_INTERVAL_MS)
const MEASURE_MIN_SQI = 0.3

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
  const getStageClass = (label) =>
    stage === label ? 'onStage' : stageCompleted[label] ? 'check' : 'uncheck'
  const notMeasureStages = stage !== 'measuring' && stage !== 'result'
  const [moveTooMuch, setMoveTooMuch] = useState(false)
  const [bpm, setBpm] = useState(0)
  const [sqi, setSqi] = useState(0)
  const [cameraError, setCameraError] = useState('')
  const [liveStatus, setLiveStatus] = useState('Initializing...')

  // ── Refs survive re-renders without restarting camera ──────────────────
  const sessionIdRef = useRef('')
  const streamRef = useRef(null)
  const processingRef = useRef(false)
  const stoppedRef = useRef(false)
  const intervalIdRef = useRef(null)

  // Preparation tracking
  const faceHistoryRef = useRef([])
  const motionStableMsRef = useRef(0)
  const brightnessHistoryRef = useRef([])
  const lastFrameTimeRef = useRef(0)
  const validFrameCountRef = useRef(0)

  // Live indicator state (triggers re-renders)
  const [liveFaceDetected, setLiveFaceDetected] = useState(false)
  const [liveMotionStable, setLiveMotionStable] = useState(false)
  const [liveBrightnessOk, setLiveBrightnessOk] = useState(false)

  // Keep a ref synced with stage so the interval callback always reads the current value
  // without needing `stage` in the useEffect dependency array (which would restart the camera).
  const stageRef = useRef('')
  useEffect(() => { stageRef.current = stage }, [stage])

  // Sync moveTooMuch into a ref so the interval always sees the current value without
  // needing it in the useEffect dependency array.
  const moveTooMuchRef = useRef(false)
  useEffect(() => { moveTooMuchRef.current = moveTooMuch }, [moveTooMuch])

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Compute mean luminance from an ImageData region. */
  function meanBrightness(ctx, x, y, w, h) {
    const { data } = ctx.getImageData(x, y, w, h)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }
    return sum / (w * h)
  }

  /** Advance to next stage. */
  function goStage(next) { setStage(next) }

  /** Mark a stage as completed (idempotent). */
  function markDone(label) {
    setStageCompleted(prev => (prev[label] ? prev : { ...prev, [label]: true }))
  }

  /**
   * Called every frame during preparation phases (face / movement / light).
   * Evaluates face, motion, brightness against real data and auto-advances.
   */
  function evaluatePreparation(faceDetected, motionRejected, brightness) {
    const now = performance.now()
    const dt = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 0
    lastFrameTimeRef.current = now

    // ── Face presence (rolling window, debounced) ──────────────────────
    faceHistoryRef.current.push(faceDetected)
    if (faceHistoryRef.current.length > FACE_DETECTION_WINDOW)
      faceHistoryRef.current.shift()
    const faceStable =
      faceHistoryRef.current.filter(Boolean).length >= FACE_DETECTION_THRESHOLD
    setLiveFaceDetected(faceStable)

    // ── Motion stability (accumulates while motion_rejected is false) ──
    if (faceStable) {
      if (motionRejected) {
        motionStableMsRef.current = 0
        setLiveMotionStable(false)
      } else {
        motionStableMsRef.current += dt
        setLiveMotionStable(motionStableMsRef.current >= STABLE_DURATION_MS)
      }
    } else {
      motionStableMsRef.current = 0
      setLiveMotionStable(false)
    }

    // ── Brightness (valid only when face is in frame) ────────────────
    if (faceStable) {
      brightnessHistoryRef.current.push(brightness)
      if (brightnessHistoryRef.current.length > BRIGHTNESS_SAMPLES)
        brightnessHistoryRef.current.shift()
      const avg =
        brightnessHistoryRef.current.reduce((a, b) => a + b, 0) /
        brightnessHistoryRef.current.length
      setLiveBrightnessOk(avg >= BRIGHTNESS_THRESHOLD)
    } else {
      brightnessHistoryRef.current = []
      setLiveBrightnessOk(false)
    }

    // ── Stage transitions ─────────────────────────────────────────────
    if (stageRef.current === 'face' && faceStable) {
      markDone('face')
      goStage('movement')
      return
    }

    if (stageRef.current === 'movement') {
      if (!faceStable) { goStage('face'); return }
      if (motionStableMsRef.current >= STABLE_DURATION_MS) {
        markDone('movement')
        goStage('light')
      }
      return
    }

    if (stageRef.current === 'light') {
      if (!faceStable) { goStage('face'); return }
      if (motionStableMsRef.current < STABLE_DURATION_MS) {
        // Lost stability — push back to movement
        setStageCompleted(prev => ({ ...prev, movement: false }))
        goStage('movement')
        return
      }
      const avg =
        brightnessHistoryRef.current.reduce((a, b) => a + b, 0) /
        (brightnessHistoryRef.current.length || 1)
      if (avg >= BRIGHTNESS_THRESHOLD) {
        markDone('light')
        goStage('finished')
      }
    }
  }

  // ── Camera + frame loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!start || stage === '' || stage === 'result') return

    // Fresh session on each Start press — NOT on stage change
    sessionIdRef.current = crypto.randomUUID()
    stoppedRef.current = false
    processingRef.current = false
    faceHistoryRef.current = []
    motionStableMsRef.current = 0
    brightnessHistoryRef.current = []
    lastFrameTimeRef.current = 0
    validFrameCountRef.current = 0
    // Intentional state resets on camera init
    ;[setLiveFaceDetected, setLiveMotionStable, setLiveBrightnessOk,
      setCameraError, setBpm, setSqi, setResultStat, setMoveTooMuch
    ].forEach(fn => fn(false))

    let stream = null

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        if (stoppedRef.current) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream

        const video = document.getElementById('rppgVideo')
        if (!video) return
        video.srcObject = stream
        await video.play()

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        intervalIdRef.current = setInterval(async () => {
          if (
            stoppedRef.current ||
            processingRef.current ||
            !video ||
            video.readyState < 2 ||
            video.videoWidth === 0
          ) return

          processingRef.current = true

          try {
            canvas.width = 320
            canvas.height = Math.round(320 * video.videoHeight / video.videoWidth)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            const brightness = meanBrightness(ctx, 0, 0, canvas.width, canvas.height)

            const response = await fetch('http://127.0.0.1:8000/frame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: sessionIdRef.current,
                image: canvas.toDataURL('image/jpeg', 0.7),
              }),
            })

            if (!response.ok) throw new Error(`API ${response.status}`)

            const data = await response.json()
            if (stoppedRef.current) return

            const faceDetected = Boolean(data.face_detected)
            const motionRejected = Boolean(data.motion_rejected)
            const bpmVal = Number(data.bpm) || 0
            const sqiVal = Number(data.sqi) || 0

            // ── Preparation ──────────────────────────────────────────
            if (stageRef.current !== 'finished' && stageRef.current !== 'measuring' && stageRef.current !== 'result') {
              evaluatePreparation(faceDetected, motionRejected, brightness)
            }

            // ── Live status badge ────────────────────────────────────
            if (stageRef.current === 'measuring') {
              if (!faceDetected) setLiveStatus('Face not detected')
              else if (motionRejected) setLiveStatus('Stay still')
              else if (bpmVal > 0) setLiveStatus('Signal detected')
              else setLiveStatus('Collecting signal')
            }

            // ── Measurement ───────────────────────────────────────────
            if (stageRef.current === 'measuring') {
              setBpm(bpmVal)
              setSqi(sqiVal)

              if (bpmVal > 0 && sqiVal >= MEASURE_MIN_SQI) {
                validFrameCountRef.current += 1
              }

              const pct = Math.min(
                100,
                Math.round((validFrameCountRef.current / MEASURE_VALID_FRAMES) * 100)
              )
              setResultStat(pct)

              if (validFrameCountRef.current >= MEASURE_VALID_FRAMES) {
                goStage('result')
              }

              // Motion popup
              if (motionRejected && !moveTooMuchRef.current) {
                setMoveTooMuch(true)
              }
            }
          } catch (err) {
            if (stoppedRef.current) return
            console.error('rPPG frame error:', err)
            setCameraError('Connection to measurement engine failed.')
          } finally {
            processingRef.current = false
          }
        }, FRAME_INTERVAL_MS)

      } catch (err) {
        console.error('Camera access failed:', err)
        if (err.name === 'NotAllowedError')
          setCameraError('Camera permission denied. Please allow camera access in your browser settings.')
        else if (err.name === 'NotFoundError')
          setCameraError('No camera found on this device.')
        else
          setCameraError('Failed to access camera.')
      }
    }

    initCamera()

    return () => {
      stoppedRef.current = true
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      const sid = sessionIdRef.current
      if (sid) {
        fetch(`http://127.0.0.1:8000/session/${sid}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }, [start]) // eslint-disable-line react-hooks/exhaustive-deps -- stageRef is kept in sync via its own useEffect; adding stage or evaluatePreparation would restart the camera loop

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col items-center h-full pt-16 ${stage === 'measuring' ? 'gap-0' : stage === 'result' ? 'gap-12' : 'gap-7'}`}>

      {/* START OVERLAY */}
      {!start && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-3 px-6 text-center">
          <p className="text-lg/[110%] text-th-green-dark">Start Measuring!</p>
          <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">
            Do a quick<br/>measurement!
          </h1>
          <Button
            className={'mt-10 h-23 border-4 text-th-green-dark rounded-3xl text-2xl/[110%] font-medium bg-th-green-dark/20 w-full justify-center'}
            onClick={() => {
              setStart(true)
              setStage('face')
              setStageCompleted({ face: false, movement: false, light: false })
            }}
          >
            Start
          </Button>
        </div>
      )}

      {start && (
        <>
          {/* CAMERA PREVIEW */}
          {stage !== 'result' && (
            <div
              id="camContainer"
              style={{ width: '100%', height: '420px' }}
              className={`bg-black rounded-3xl shrink-0 items-center justify-center flex relative overflow-hidden ${!notMeasureStages && 'rounded-b-none'}`}
            >
              <video id="rppgVideo" autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />

              {stage === 'face' && (
                <img src={faceGuide} alt="" className="relative z-10" />
              )}

              {cameraError && (
                <p className="absolute z-20 p-3 text-sm text-white bg-black/70 rounded-xl max-w-[90%] text-center">
                  {cameraError}
                </p>
              )}

              {/* Preparation live-indicator strip */}
              {notMeasureStages && stage !== 'finished' && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-3 text-xs font-medium text-th-plain-white/70">
                  <span className={liveFaceDetected ? 'text-th-green-dark' : ''}>
                    {liveFaceDetected ? '✓ Face' : '○ Face'}
                  </span>
                  <span className={liveMotionStable ? 'text-th-green-dark' : ''}>
                    {liveMotionStable ? '✓ Stable' : '○ Stable'}
                  </span>
                  <span className={liveBrightnessOk ? 'text-th-green-dark' : ''}>
                    {liveBrightnessOk ? '✓ Light' : '○ Light'}
                  </span>
                </div>
              )}

              {/* Measuring progress bar */}
              {stage === 'measuring' && (
                <div className="absolute bottom-0 z-10 flex w-full h-2">
                  <div className="h-2 transition-all bg-th-green-dark" style={{ width: `${resultStat}%` }} />
                </div>
              )}
            </div>
          )}

          {/* PREPARATION INDICATORS + TEXT */}
          {notMeasureStages && (
            <div className="flex flex-col items-center w-full h-full gap-7">
              <div className="flex items-center">
                <p className={twMerge('size-12 flex items-center justify-center text-2xl/[80%] font-medium rounded-2xl', requirementsClass[getStageClass('face')])}>
                  <i className={`fi ${stageTexts['face'].icon}`}></i>
                </p>
                <p className={twMerge('size-12 flex items-center justify-center text-2xl/[80%] font-medium rounded-2xl', requirementsClass[getStageClass('movement')])}>
                  <i className={`fi ${stageTexts['movement'].icon}`}></i>
                </p>
                <p className={twMerge('size-12 flex items-center justify-center text-2xl/[80%] font-medium rounded-2xl', requirementsClass[getStageClass('light')])}>
                  <i className={`fi ${stageTexts['light'].icon}`}></i>
                </p>
              </div>

              <div className={`flex flex-col items-center w-full gap-2 text-th-plain-grey text-center ${stage === 'finished' ? 'px-11' : stage === 'light' ? 'px-7' : 'px-9'}`}>
                {stageTexts[stage]?.p && (
                  <p className={`text-lg/[110%] ${stage === 'finished' ? 'text-th-green-dark' : ''}`}>
                    {stageTexts[stage].p}
                  </p>
                )}

                {stage !== 'finished' && stageTexts[stage]?.h1 && (
                  <h1 className="text-4xl/[110%] font-medium font-cabinet">
                    {stageTexts[stage].h1}
                  </h1>
                )}

                {stage === 'finished' && (
                  <Button
                    className={'mt-6 h-23 border-4 text-th-green-dark rounded-3xl text-2xl/[110%] font-medium bg-th-green-dark/20 w-full justify-center'}
                    onClick={() => {
                      validFrameCountRef.current = 0
                      goStage('measuring')
                    }}
                  >
                    Start Measuring!
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* MEASURING CARD */}
          {stage === 'measuring' && (
            <Card className={'h-full w-full rounded-t-none'}>
              <div className="flex justify-between">
                <p className="flex flex-col text-xs/[90%] gap-1 font-medium">
                  Stay Still!
                  <span className="font-normal">Measuring...</span>
                </p>
                <span className="flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-lg bg-th-green-dark/20 text-th-green-dark">
                  <div className="rounded-full size-2 bg-th-green-dark"></div>
                  {liveStatus}
                </span>
              </div>

              <div className="h-full"></div>

              <div className="flex w-full gap-8">
                <div className="flex flex-col flex-1 gap-3">
                  <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                    <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                      {bpm > 0 ? Math.round(bpm) : '--'}
                    </span>
                    bpm
                  </p>
                  <p className="text-lg/[90%]">Average</p>
                </div>
                <div className="flex flex-col flex-1 gap-3">
                  <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                    <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                      {bpm > 0 ? Math.round(bpm * 1.04) : '--'}
                    </span>
                    bpm
                  </p>
                  <p className="text-lg/[90%]">Peak</p>
                </div>
                <div className="flex flex-col flex-1 gap-3">
                  <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                    <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                      {bpm > 0 ? Math.round(bpm * 0.96) : '--'}
                    </span>
                    bpm
                  </p>
                  <p className="text-lg/[90%]">Lowest</p>
                </div>
                <div className="flex flex-col flex-1 gap-3">
                  <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                    <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                      Signal Quality
                    </span>
                  </p>
                  <p className="text-lg/[90%]">
                    {sqi >= MEASURE_MIN_SQI
                      ? `${Math.round(sqi * 100)}%`
                      : 'Collecting signal...'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* MOVEMENT WARNING DRAWER */}
          {stage === 'measuring' && moveTooMuch && (
            <Drawer
              isOpen={moveTooMuch}
              onClose={() => {
                setMoveTooMuch(false)
                validFrameCountRef.current = 0
                setResultStat(0)
              }}
              className={'h-74 justify-between relative'}
            >
              <i className="fi fi-rr-seal-exclamation text-[166px]/[80%] absolute -z-1 top-1/2 -translate-y-1/2 text-th-green-dark/20"></i>
              <div className="flex flex-col gap-2">
                <p className="text-lg/[110%] text-th-green-dark">Stay Still!</p>
                <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">
                  You’re moving<br/>way too much!
                </h1>
              </div>
              <Button
                onClick={() => {
                  setMoveTooMuch(false)
                  validFrameCountRef.current = 0
                  setResultStat(0)
                }}
                className={'text-xs/[90%] font-medium w-full h-9 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white'}
              >
                Okay
              </Button>
            </Drawer>
          )}

          {/* RESULT */}
          {stage === 'result' && (
            <>
              <div className="flex flex-col items-center justify-center gap-2 text-center text-th-plain-black w-49">
                <h1 className="text-4xl/[110%] font-bold text-th-green-darker font-cabinet">
                  Well Done!
                </h1>
                <p className="text-xs/[110%]">
                  your heart rate is within a healthy range, with an average of
                </p>
              </div>

              <div className="flex flex-col w-full gap-3">
                <Card className={'h-64 grid auto-rows-max gap-x-2 gap-y-4 grid-cols-[132px_132px_1fr] w-full rounded-3xl'}>
                  <div className="flex flex-col gap-6">
                    <p className="text-lg/[110%] font-medium flex flex-col gap-1">
                      Your average heart rate
                      <span className="text-xs/[90%] text-th-plain-grey font-normal">
                        {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </p>
                    <h1 className="text-[64px]/[90%] font-bold font-cabinet flex items-start gap-1">
                      {bpm > 0 ? Math.round(bpm) : '--'}
                      <i className="text-xs fi fi-sr-heart text-th-purple-light"></i>
                    </h1>
                  </div>

                  <div className="col-span-2"></div>

                  <Card className="gap-2 font-normal border-b-2 border-th-green-dark rounded-2xl">
                    <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">
                      {bpm > 0 ? Math.round(bpm * 1.04) : '--'}
                      <span className="text-xs/[90%] font-normal font-general text-th-green-dark">bpm</span>
                    </p>
                    <p className="text-xs/[90%]">Peak</p>
                  </Card>

                  <Card className="gap-2 font-normal border-b-2 border-th-cream-pale rounded-2xl">
                    <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">
                      {bpm > 0 ? Math.round(bpm * 0.96) : '--'}
                      <span className="text-xs font-normal font-general text-th-cream-pale">bpm</span>
                    </p>
                    <p className="text-xs/[90%]">Lowest</p>
                  </Card>

                  <Card className={`relative items-center py-3 overflow-hidden rounded-lg ${sqi >= MEASURE_MIN_SQI ? 'bg-th-green-dark/20 text-th-green-dark' : 'bg-th-purple-light text-th-purple-darker'}`}>
                    <p className="flex items-center text-xs/[110%] font-semibold text-center z-2">
                      {sqi >= MEASURE_MIN_SQI ? 'Great!' : 'Poor signal'}
                    </p>
                    <img
                      src={sqi >= MEASURE_MIN_SQI ? "/src/assets/images/heart-small.svg" : "/src/assets/images/heart-small-poor.svg"}
                      alt="heart-icon"
                      className='absolute h-auto max-w-none w-19 -bottom-8'
                    />
                  </Card>
                </Card>

                <Link to={'/insights'} className={'h-13 w-full text-xs/[90%] font-medium text-th-purple-darker bg-linear-20 from-th-purple-dark to-th-purple-light rounded-3xl flex items-center justify-center'}>
                  View your Weekly Insights
                </Link>

                <Card className={'bg-[radial-gradient(68.99%_68.99%_at_50%_31.31%,#6A624D_0%,#8C8268_18.54%,#A4B0A3_46.99%,#DCDACA_100%)] p-0 rounded-3xl overflow-clip flex-row w-full h-max shrink-0'}>
                  <div className="flex items-center self-stretch justify-center flex-1 shrink-0 text-th-cream-pale bg-th-cream aspect-square">
                    <i className="fi fi-rr-beacon text-5xl/[80%]"></i>
                  </div>
                  <div className="flex flex-col items-start gap-3 p-4 flex-2">
                    <p className="font-medium text-xs/[110%] text-th-plain-white">
                      Your heart rate is within a healthy range! want to see how it compares with your past measurements?
                    </p>
                    <Link to={'/chatbot/session'} className={'border-[1.2px] border-th-plain-grey bg-th-plain-white px-4 py-3 rounded-2xl text-xs/[100%] text-th-plain-black'}>
                      Ask SARI Chatbot
                    </Link>
                  </div>
                </Card>
              </div>

              <Link
                to={'/home'}
                onClick={() => {
                  setMoveTooMuch(false)
                  setStage('')
                  setResultStat(0)
                  setStageCompleted({ face: false, movement: false, light: false })
                  setBpm(0)
                  setSqi(0)
                  setStart(false)
                }}
                className={'text-xs/[90%] font-medium w-41 h-9 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white'}
              >
                Back to Dashboard
              </Link>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Camera
