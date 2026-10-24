import { useEffect, useState, useRef } from "react"
import { twMerge } from "tailwind-merge"
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"
import Button from "../components/atom/Button"
import faceGuide from "/src/assets/images/face-guideline.svg"
import Card from "../components/atom/Card"
import { Link } from "react-router"
import Drawer from "../components/Drawer"
import {
  FACE_MODEL_URL,
  FACE_WASM_FILESET_URL,
  getGuidePolygon,
  isFaceInsideGuide,
} from "../config/faceModel"

const requirementsClass = {
  check: 'bg-th-green-dark',
  onStage: 'bg-th-purple-light',
  uncheck: 'bg-th-plain-white'
}
const stageTexts = {
  face: {
    p: 'Stay in the designated area!',
    h1: 'Keep your face inside the frame',
  },
  movement: {
    p: 'Stay still, don’t move!',
    h1: 'Don’t make any sudden movement!',
  },
  light: {
    p: 'Keep enough lighting!',
    h1: 'Ensure your face is visible under light',
  },
}

/** Number of progress lines that have to be filled before measuring can start. */
const PROGRESS_LINES = 3
/** Time (ms) a single progress line needs to fill from empty to full. */
const LINE_FILL_MS = 900

/**
 * MediaPipe needs a WebGL context for its graph. When the browser cannot
 * provide one (hardware acceleration off, GPU blocked, ...) the detector would
 * die with "GLctx is undefined", so we check it upfront and report it.
 */
function hasWebGLSupport() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function FaceGateProgress({ progress }) {
  return (
    <div className="flex flex-col w-full gap-2">
      {progress.map((value, index) => (
        <div key={index} className="w-full h-1.5 rounded-sm bg-th-plain-grey/50 overflow-hidden">
          <div className="h-full rounded-sm bg-th-green-dark" style={{ width: `${value}%` }} />
        </div>
      ))}
    </div>
  )
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
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const guideRef = useRef(null)
  const landmarkerRef = useRef(null)
  const faceInFrameRef = useRef(false)
  const [faceInFrame, setFaceInFrame] = useState(false)
  const [detectorReady, setDetectorReady] = useState(false)
  const [detectorError, setDetectorError] = useState(false)
  const [lineProgress, setLineProgress] = useState([0, 0, 0])
  const lineProgressRef = useRef([0, 0, 0])
  // MediaPipe needs a strictly increasing millisecond timestamp, and every
  // submitted frame has to be a new one - both are kept across effect runs.
  const lastTimestampRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const detectionLoopRef = useRef(0)
  const detectorAliveRef = useRef(false)
  const detectionLogsRef = useRef(0)
  const detectorSizeRef = useRef({ width: 0, height: 0 })
  const [detectorKey, setDetectorKey] = useState(0)

  /** Strictly increasing integer millisecond timestamp for detectForVideo(). */
  const nextTimestamp = () => {
    const now = Math.round(performance.now())
    lastTimestampRef.current = Math.max(now, lastTimestampRef.current + 1)
    return lastTimestampRef.current
  }

  /** Back to square one: no progress lines filled, no measuring button. */
  const resetFaceGate = () => {
    lineProgressRef.current = [0, 0, 0]
    setLineProgress([0, 0, 0])
  }

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
    let stream = null
    if (start) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((s) => {
          stream = s
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((err) => {
          console.error("Gagal mengakses kamera:", err)
        })
    }
  
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [start])
  
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

  /* LOAD FACE DETECTOR */
  useEffect(() => {
    if (!start) return
    let cancelled = false
    let landmarker = null

    const createLandmarker = async () => {
      const fileset = await FilesetResolver.forVisionTasks(FACE_WASM_FILESET_URL)
      return FaceLandmarker.createFromOptions(fileset, {
        // CPU delegate: the detector must not depend on a WebGL/GPU context,
        // otherwise the browser throws "GLctx is undefined".
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    }

    const load = async () => {
      if (!hasWebGLSupport()) {
        setDetectorError(true)
        return
      }
      try {
        landmarker = await createLandmarker()
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        detectorAliveRef.current = true
        // a new detector starts with a new stream: reset the frame bookkeeping
        lastVideoTimeRef.current = -1
        detectorSizeRef.current = { width: videoRef.current?.videoWidth ?? 0, height: videoRef.current?.videoHeight ?? 0 }
        setDetectorReady(true)
      } catch (err) {
        console.error("Gagal memuat model deteksi wajah:", err)
        if (!cancelled) setDetectorError(true)
      }
    }

    load()

    return () => {
      cancelled = true
      detectorAliveRef.current = false
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
      }
      setDetectorReady(false)
    }
  }, [start, detectorKey])

  /* DETECT FACE INSIDE THE FRAME */
  useEffect(() => {
    if (!start || !detectorReady || detectorError) return
    if (stage === 'measuring' || stage === 'result') return

    let raf = 0
    let stopped = false

    const detect = () => {
      const video = videoRef.current
      const container = containerRef.current
      const landmarker = landmarkerRef.current
      // the detector must be alive and the video must have real dimensions
      if (!video || !container || !landmarker || !detectorAliveRef.current) return
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        raf = requestAnimationFrame(detect)
        return
      }
      // the graph is built for one frame size: a size change needs a new detector
      const size = detectorSizeRef.current
      if (!size.width) {
        detectorSizeRef.current = { width: video.videoWidth, height: video.videoHeight }
      } else if (size.width !== video.videoWidth || size.height !== video.videoHeight) {
        console.warn('[face] ukuran video berubah, membuat ulang detector', video.videoWidth, video.videoHeight)
        setDetectorKey(key => key + 1)
        return
      }
      // only a new frame may be submitted, the timestamp has to move forward
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        const previousTimestamp = lastTimestampRef.current
        const timestamp = nextTimestamp()
        if (detectionLogsRef.current < 5) {
          detectionLogsRef.current++
          console.log('[face] detect', {
            timestamp,
            previousTimestamp,
            videoTime: video.currentTime,
            width: video.videoWidth,
            height: video.videoHeight,
          })
        }
        try {
          const results = landmarker.detect(video);
          const landmarks = results.faceLandmarks?.[0]
          const inside = landmarks
            ? isFaceInsideGuide(
              landmarks,
              {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                containerWidth: container.clientWidth,
                containerHeight: container.clientHeight,
              },
              getGuidePolygon(container, guideRef.current),
            )
            : false
          if (inside !== faceInFrameRef.current) {
            faceInFrameRef.current = inside
            setFaceInFrame(inside)
            if (!inside) {
              // the face is gone or out of frame: reset the progress before it is finished
              if (stage === 'face') {
                lineProgressRef.current = [0, 0, 0]
                setLineProgress([0, 0, 0])
              }
            }
          }
        } catch (err) {
          // the detector is broken - stop the loop instead of flooding the console
          console.error("Deteksi wajah dihentikan:", err)
          stopped = true
          faceInFrameRef.current = false
          setFaceInFrame(false)
          setLineProgress([0, 0, 0])
          setDetectorError(true)
          return
        }
      }
      if (!stopped) {
        raf = requestAnimationFrame(detect)
        detectionLoopRef.current = raf
      }
    }

    // one single detection loop: never schedule a second one while this runs
    if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current)
    raf = requestAnimationFrame(detect)
    detectionLoopRef.current = raf

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      if (detectionLoopRef.current === raf) detectionLoopRef.current = 0
    }
  }, [start, detectorReady, detectorError, stage])

  /* FILL THE PROGRESS LINES ONE BY ONE */
  useEffect(() => {
    if (!faceInFrame || stage !== 'face') return

    let raf = 0
    let previousTime = performance.now()

    const fill = (now) => {
      const elapsed = now - previousTime
      previousTime = now
      // the face has to stay in frame while the lines are filling
      if (!faceInFrameRef.current) return
      const next = [...lineProgressRef.current]
      for (let index = 0; index < PROGRESS_LINES; index++) {
        if (next[index] >= 100) continue
        next[index] = Math.min(100, next[index] + (elapsed / LINE_FILL_MS) * 100)
        break
      }
      lineProgressRef.current = next
      setLineProgress(next)
      // every line is full and the face is still in frame -> measuring can start
      if (next.every(value => value >= 100) && faceInFrameRef.current) {
        setStage('finished')
        return
      }
      raf = requestAnimationFrame(fill)
    }

    raf = requestAnimationFrame(fill)
    return () => cancelAnimationFrame(raf)
  }, [faceInFrame, stage])

  return (
    <div className={`flex flex-col items-center h-full pb-33 ${stage === 'measuring' ? 'gap-0' : stage === 'result' ? 'gap-12 overflow-y-auto scrollbar-none' : 'gap-7'}`}>
      {/* DIV for START OVERLAY */}
      {!start &&
        <div className="flex flex-col items-center justify-center w-full h-full gap-3 px-6 text-center">
          <p className="text-lg/[110%] text-th-green-dark">Start Measuring!</p>
          <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">Do a quick<br/>measurement!</h1>
          <Button className={'mt-10 h-23 border-2 text-th-green-dark rounded-3xl text-2xl/[110%] font-medium bg-th-green-dark/20 w-full justify-center'} onClick={() => {
            setStart(true)
            setStage('face')
          }}>Start</Button>
        </div>
      }

      {start && (
        <>
        {stage !== 'result' && (
          <div id="camContainer" ref={containerRef} onMouseMove={handleMoveTooMuch} style={{ width: 'calc(100% + 16px * 2)', height: '532px' }} className={`bg-black shrink-0 items-center justify-center flex flex-col relative ${stage !== 'measuring' && 'rounded-b-[36px] overflow-hidden'}`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover -scale-x-100"
            />
            <div className="absolute w-full h-full top-0 bg-th-green-darker/30 mask-t-to-transparent mask-t-from-10 mask-t-to-40 backdrop-blur-xs pointer-events-none" />
            {stage === 'face' ? (
              <img ref={guideRef} src={faceGuide} alt="" className="z-10 pointer-events-none" />
            ) : stage === 'measuring' ? (
              <div className="absolute bottom-0 flex w-full h-2 translate-y-1/2 z-10"><div className="flex h-2 transition-all duration-200 bg-th-green-dark w-8" style={{ width: `${resultStat}%` }} /></div>
            ) : ''}
        
            {stageCompleted !== true && stage !== 'finished' && notMeasureStages && (
              <div className="flex items-center w-full px-8 py-4 gap-2 absolute bottom-0 z-10">
                <div className={twMerge('w-full rounded-sm h-1', requirementsClass[getStageClass('face')])} />
                <div className={twMerge('w-full rounded-sm h-1', requirementsClass[getStageClass('movement')])} />
                <div className={twMerge('w-full rounded-sm h-1', requirementsClass[getStageClass('light')])} />
              </div>
            )}
          </div>
        )}

        {/* DIV for PREP ICONS [stageTexts.stage?.icon] */}
        {notMeasureStages && (
          <div className="flex flex-col items-center w-full h-full gap-7">
            {/* DIV for PREP INFO [stageTexts] */}
            <div className={`flex flex-col items-center justify-center h-full w-full gap-2 text-th-plain-grey text-center px-6.5`}>
              {stageCompleted !== true && stage !== 'finished' && notMeasureStages && (
                <>
                <h1 className={`text-4xl/[110%] font-medium font-cabinet ${stageCompleted[stage] && 'text-th-green-dark'}`}>{stageTexts[stage].h1}</h1>
                </>
              )}
              {notMeasureStages && stageTexts[stage] && stage !== 'finished' &&
                <p className={`text-lg/[110%] ${stage === 'finished' && 'text-th-green-dark'}`}>{stageTexts[stage].p}</p>
              }
              {(stage === 'face' || stage === 'finished') && (
                <>
                  <FaceGateProgress progress={lineProgress} />
                  {stage === 'face' && (
                    <p className="text-xs/[110%] text-th-plain-grey">
                      {detectorError
                        ? 'Face detection is unavailable. Please reload the page and enable hardware acceleration.'
                        : !detectorReady
                          ? 'Preparing face detection...'
                          : faceInFrame
                            ? 'Face detected, hold still!'
                            : 'Place your face inside the frame'}
                    </p>
                  )}
                </>
              )}
              {stage === 'finished' && stageCompleted && notMeasureStages && (
                <Button className={'h-23 border-2 text-th-green-dark rounded-3xl text-2xl/[110%] font-medium bg-th-green-dark/20 w-full justify-center'} onClick={() => {
                  setStage('measuring')
                }}>Start Measuring!</Button>
              )}
            </div>
          </div>
        )}

        {/* CARD for MEASUREMENT INFO [BACKEND] */}
        {stage === 'measuring' && (
          <Card className={'mt-2 h-full w-full rounded-t-none bg-transparent'}>
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
          <Drawer onClose={() => {
            setMoveTooMuch(false)
            resetFaceGate()
            setStage('face')
          }} isOpen={moveTooMuch} className={'h-74 justify-between relative'}>
            <i className="fi fi-rr-seal-exclamation text-[166px]/[80%] absolute -z-1 top-1/2 -translate-y-1/2 text-th-green-dark/20"></i>
            <div className="flex flex-col gap-2">
              <p className="text-lg/[110%] text-th-green-dark">Stay Still!</p>
              <h1 className="text-4xl/[110%] font-medium text-th-green-darker font-cabinet">You're moving<br/>way too much!</h1>
            </div>
            <Button onClick={() => {
              setMoveTooMuch(false)
              resetFaceGate()
              setStage('face')
            }} className={'text-xs/[90%] font-medium w-full h-9 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white'}>Okay</Button>
          </Drawer>
        )}

        {/* DIV for RESULT [BACKEND] */}
        {stage === 'result' && (
          <>
            <div className="flex flex-col items-center justify-center gap-2 text-center text-th-plain-black w-49 mt-23">
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
              <Link to={'/insights'} className={'h-13 w-full text-xs/[90%] font-medium text-th-purple-darker bg-linear-20 from-th-purple-dark to-th-purple-light rounded-3xl flex items-center justify-center'}>
                View your Weekly Insights
              </Link>
              <Card className={'bg-th-green-dark bg-[radial-gradient(68.99%_68.99%_at_50%_31.31%,#6A624D_0%,#8C8268_18.54%,#A4B0A3_46.99%,#DCDACA_100%)] p-0 rounded-3xl overflow-clip flex-row w-full h-max shrink-0'}>
                <div className="flex items-center self-stretch justify-center flex-1 shrink-0 text-th-cream-pale bg-th-cream aspect-square">
                  <i className="fi fi-rr-beacon text-5xl/[80%]"></i>
                </div>
                <div className="flex flex-col items-start gap-3 p-4 flex-2">
                  <p className="font-medium text-xs/[110%] text-th-plain-white">Your heart rate is within a healthy range! want to see how it compares with your past measurements?</p>
                  <Link to={'/chatbot'} className={'border-[1.2px] border-th-plain-grey bg-white px-4 py-3 rounded-2xl text-xs/100 text-th-plain-black'}>Ask SARI Chatbot</Link>
                </div>
              </Card>
            </div>
            <Link onClick={() => {
              setMoveTooMuch(false)
              setStage('')
              setResultStat(0)
              resetFaceGate()
              setStageCompleted(prev => Object.fromEntries(Object.keys(prev).map(key => [key, false])))
            }} to={'/home'} className={'text-xs/[90%] font-medium w-41 h-9 flex justify-center items-center bg-th-green-dark rounded-2xl text-th-plain-white shrink-0'}>Back to Dashboard</Link>
          </>
        )}
        </>
      )}
    </div>
  )
}

export default Camera