import { Link, NavLink, useNavigate } from "react-router"
import Card from "../components/atom/Card"
import { useSariAuthStore } from "../data/sariAuthStore"
import { useState } from "react"
import indicators from '../assets/images/indicators.svg'
import arrIndicator from '../assets/images/arrow-indicator.svg'
import artImage from '../assets/images/image-article.png'
import chatIndicator from '../assets/images/chat-indicator.svg'
import homeFooter from '../assets/images/home-footer.svg'
import { Popover } from "radix-ui"
import sariLogo from '../assets/icons/sanubari.svg'

const EMPTY_MEASUREMENTS = []
const CHAT_BUBBLE_VARIANTS = [
  ['Compare my recent readings', 'How do my readings compare?'],
  ['Why do readings change?', 'Why do my results vary?'],
  ['How does rPPG work?', 'What is rPPG?'],
]
const WEEKLY_TREND_BAR_CLASS = "w-full rounded-2xl bg-[linear-gradient(to_top,var(--color-th-purple-light),var(--color-th-green-light),var(--color-th-green-dark),var(--color-th-green-darker))]"
const HEALTHY_BPM_RANGE = { min: 30, max: 100 }
const HEALTH_METER_START_ANGLE = -75
const HEALTH_METER_STEP_DEGREES = 25
const HEALTH_METER_LEVELS = 6

function getMeasurementDateKey(date) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/.exec(date ?? '')
  if (!match) return null

  const dateKey = match[1]
  const parsedDate = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateKey) return null

  if (date.includes('T')) {
    const parsedTimestamp = new Date(date)
    if (Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.toISOString() !== date) return null
  }

  return dateKey
}

function formatMeasurementDate(date) {
  return getMeasurementDateKey(date) ?? '-'
}

function formatTrendDate(dateKey) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`))
}

function getReadingStats(readings) {
  const bpmValues = readings.map(({ bpm }) => bpm)

  return {
    count: readings.length,
    average: bpmValues.length
      ? Math.round(bpmValues.reduce((total, bpm) => total + bpm, 0) / bpmValues.length)
      : null,
    peak: bpmValues.length ? Math.max(...bpmValues) : null,
    lowest: bpmValues.length ? Math.min(...bpmValues) : null,
  }
}

function buildAreaChartPoints(readings) {
  const chronologicalReadings = [...readings]
    .filter(({ bpm, timestamp }) => (
      typeof bpm === 'number'
      && Number.isFinite(bpm)
      && Number.isFinite(timestamp)
    ))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (!chronologicalReadings.length) return []

  const bpmValues = chronologicalReadings.map(({ bpm }) => bpm)
  const minBpm = Math.min(...bpmValues)
  const maxBpm = Math.max(...bpmValues)

  // Tambahkan ruang atas dan bawah supaya grafik tidak menempel di ujung card.
  const padding = Math.max(5, (maxBpm - minBpm) * 0.2)
  const chartMin = minBpm - padding
  const chartMax = maxBpm + padding
  const chartRange = chartMax - chartMin || 1

  return chronologicalReadings.map((reading, index) => {
    const x = chronologicalReadings.length === 1
      ? 50
      : (index / (chronologicalReadings.length - 1)) * 100

    const y = 100 - ((reading.bpm - chartMin) / chartRange) * 100

    return {
      ...reading,
      x,
      y,
    }
  })
}

function MeasurementAreaChart({ readings }) {
  const points = buildAreaChartPoints(readings)

  if (!points.length) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-th-plain-grey">
        No measurement data yet
      </div>
    )
  }

  const linePoints = points
    .map(({ x, y }) => `${x},${y}`)
    .join(' ')

  const areaPoints = [
    `${points[0].x},100`,
    ...points.map(({ x, y }) => `${x},${y}`),
    `${points[points.length - 1].x},100`,
  ].join(' ')

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      aria-label={`Heart rate trend across ${points.length} measurements`}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="measurement-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DDB8D6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#F1E3EF" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        <polygon
          points={areaPoints}
          fill="url(#measurement-area-gradient)"
        />

        <polyline
          points={linePoints}
          fill="none"
          stroke="#D4AED0"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function getWeeklyTrend(readings, weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setUTCDate(weekStart.getUTCDate() + index)
    const dateKey = date.toISOString().slice(0, 10)
    const dayReadings = readings.filter(reading => reading.dateKey === dateKey)

    return {
      dateKey,
      bpm: getReadingStats(dayReadings).average,
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date),
    }
  })
}

function getHealthLevel(bpm) {
  if (bpm === null) return null
  const range = HEALTHY_BPM_RANGE.max - HEALTHY_BPM_RANGE.min
  const level = Math.ceil(((bpm - HEALTHY_BPM_RANGE.min) / range) * (HEALTH_METER_LEVELS - 1)) + 1
  return Math.min(HEALTH_METER_LEVELS, Math.max(1, level))
}

function WeekSummaryCard({ title, stats, className, barClassName, valueClassName }) {
  const metrics = [
    { label: 'Avg', value: stats.average },
    { label: 'Lowest', value: stats.lowest },
    { label: 'Peak', value: stats.peak },
  ]

  return (
    <Card className={className}>
      <div className="flex flex-col gap-2">
        <p className="text-lg/[90%] font-medium">{title}</p>
        <span className="text-xs/[90%]">{stats.count} measurements</span>
      </div>
      <div className="flex items-end flex-1 gap-2">
        {metrics.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center justify-end w-full h-full gap-2">
            <p className="text-xs/[110%] font-medium">{value ?? '—'}</p>
            <div
              style={{ height: `${value === null ? 0 : Math.min(value, 100)}%` }}
              className={`w-full rounded-2xl ${barClassName}`}
            />
            <p className={`text-xs/[110%] ${valueClassName}`}>{label}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Home() {
  const navigate = useNavigate()
  const user = useSariAuthStore(state => state.user)
  const measurements = useSariAuthStore(state => state.user?.measurementData ?? EMPTY_MEASUREMENTS)
  const [chatBubbleMessages] = useState(() => CHAT_BUBBLE_VARIANTS.map(
    variants => variants[Math.floor(Math.random() * variants.length)],
  ))
  const [openPopoverDate, setOpenPopoverDate] = useState(null)
  const readings = measurements
    .map(measurement => {
      const date = typeof measurement.date === 'string' ? measurement.date : ''
      return {
        ...measurement,
        dateKey: getMeasurementDateKey(date),
        timestamp: Date.parse(date.includes('T') ? date : `${date}T00:00:00.000Z`),
      }
    })
    .filter(({ dateKey, bpm, timestamp }) => dateKey && typeof bpm === 'number' && Number.isFinite(bpm) && Number.isFinite(timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
  const lastMeasurement = readings[0] ?? null
  const formattedDate = formatMeasurementDate(lastMeasurement?.date)
  const readingStats = getReadingStats(readings)
  const latestBpm = lastMeasurement?.bpm ?? null
  const heartRateStatus = latestBpm === null
    ? 'No data'
    : (latestBpm > HEALTHY_BPM_RANGE.max || latestBpm < HEALTHY_BPM_RANGE.min) ? 'Unstable' : 'Stable'
  const heartRateStatusAppearance = heartRateStatus === 'Stable'
    ? { badge: 'bg-th-green-dark/20 text-th-green-dark', indicator: 'bg-th-green-dark' }
    : heartRateStatus === 'Unstable'
      ? { badge: 'bg-th-purple-light/20 text-th-purple-darker', indicator: 'bg-th-purple-darker' }
      : { badge: 'bg-th-plain-grey/20 text-th-plain-grey', indicator: 'bg-th-plain-grey' }
  const heartRateHealth = latestBpm === null
    ? 'No heart rate data available'
    : `Overall, your current heart rate is ${heartRateStatus === 'Stable' ? 'within' : 'outside'} a healthy range`
  const latestMeasurementDate = lastMeasurement
    ? new Date(`${lastMeasurement.dateKey}T00:00:00.000Z`)
    : new Date()
  const latestWeekStart = new Date(latestMeasurementDate)
  latestWeekStart.setUTCDate(latestWeekStart.getUTCDate() - 6)
  const previousWeekStart = new Date(latestWeekStart)
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7)
  const latestWeekReadings = readings.filter(({ timestamp }) => (
    timestamp >= latestWeekStart.getTime() && timestamp < latestMeasurementDate.getTime() + 24 * 60 * 60 * 1000
  ))
  const previousWeekReadings = readings.filter(({ timestamp }) => (
    timestamp >= previousWeekStart.getTime() && timestamp < latestWeekStart.getTime()
  ))
  const latestWeekStats = getReadingStats(latestWeekReadings)
  const previousWeekStats = getReadingStats(previousWeekReadings)
  const weeklyTrend = getWeeklyTrend(readings, latestWeekStart)
  const restingBpmReadings = readings
    .map(({ restingBpm }) => restingBpm)
    .filter(bpm => typeof bpm === 'number' && Number.isFinite(bpm))
  const restingBpm = restingBpmReadings.length
    ? Math.round(restingBpmReadings.reduce((total, bpm) => total + bpm, 0) / restingBpmReadings.length)
    : null
  const healthLevel = getHealthLevel(latestBpm)
  const [comparisonPage, setComparisonPage] = useState('last-week')
  const renderWeeklyTrendDay = ({ dateKey, bpm, day }) => {
    return (
      <Popover.Root
        key={dateKey}
        open={openPopoverDate === dateKey}
        onOpenChange={open => setOpenPopoverDate(currentDate => {
          if (open) return dateKey
          return currentDate === dateKey ? null : currentDate
        })}
      >
        <div className="flex flex-col items-center justify-end w-full h-full gap-2">
          <p>{bpm ?? '—'}</p>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={`${day}, ${formatTrendDate(dateKey)}: ${bpm === null ? 'no reading' : `${bpm} bpm`}`}
              data-week-day
              style={{ height: bpm === null ? '1.5rem' : `${Math.min(bpm, 100)}%` }}
              className={bpm === null
                ? "w-full rounded-2xl border-[1.2px] border-th-plain-black h-6 flex items-center justify-center"
                : WEEKLY_TREND_BAR_CLASS}
            />
          </Popover.Trigger>
          <p className="font-medium">{day}</p>
        </div>
        <Popover.Portal>
          <Popover.Content
            onInteractOutside={event => {
              if (event.target instanceof Element && event.target.closest('[data-week-day]')) {
                event.preventDefault()
              }
            }}
            side="top"
            align="center"
            sideOffset={-12}
            className="z-50 rounded-2xl bg-white p-3 text-xs/[90%] font-medium text-th-plain-black"
          >
            <p>{formatTrendDate(dateKey)}</p>
            <Popover.Arrow className="fill-th-plain-white" height={14} width={16} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }
    
  return (
    <>
    <div className="flex flex-col h-full pt-4 gap-11 rounded-2xl">
      <h1 className="text-4xl font-bold text-center font-cabinet text-th-plain-black">
        Hello, {user.name.first}!
        <br />
        <span className="font-medium">How are you today?</span>
      </h1>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center -space-y-11">
          <img src={indicators} alt="" />
        <span className="relative flex items-end justify-center">
          <img
            src={arrIndicator}
            alt=""
            className="origin-[50%_70%] h-13 w-auto transition-transform"
            style={{
              transform: `rotate(${healthLevel === null
                ? HEALTH_METER_START_ANGLE
                : HEALTH_METER_START_ANGLE + (healthLevel - 1) * HEALTH_METER_STEP_DEGREES}deg)`,
              opacity: healthLevel === null ? 0.5 : 1,
            }}
          />
          <i className="absolute fi fi-sr-heart text-th-plain-white" />
        </span>
      </div>
      <p className="px-4 py-2 bg-white rounded-lg shadow-th-green-dark/10 shadow-th-sm mx-auto text-center text-xs/[110%] font-medium w-53">{heartRateHealth}</p>
      </div>
      <div className="grid grid-cols-5 gap-2 auto-rows-max">
        {/* Card Wrapper */}
        <div className="flex flex-col col-span-5 rounded-3xl bg-linear-90 from-th-green-light to-th-green-dark">
          <Card className={'space-y-6'}>
            <div className="flex justify-between">
              <p className="flex flex-col text-xs/[90%] gap-1 font-medium">
                Last Measurement
                <span className="font-normal">{formattedDate}</span>
              </p>
              <span className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-lg ${heartRateStatusAppearance.badge}`}>
                <div className={`rounded-full size-2 ${heartRateStatusAppearance.indicator}`}></div>
                {heartRateStatus}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <h1 className="text-[64px]/[80%] font-extrabold text-th-plain-black font-cabinet flex items-start">
                {readingStats.average ?? '-'}
                <i className="text-xs fi fi-sr-heart text-th-purple-light -ml-1.5"></i>
              </h1>

              <div className="flex flex-col gap-1">
                <p className="text-lg/[90%] font-medium">Average</p>
                <span className="text-xs/[90%] text-th-plain-grey">
                  beats per minute
                </span>
              </div>
            </div>

            <div className="flex w-full gap-8">
              <div className="flex flex-col flex-1 gap-3">
                <p className="text-xs/[90%]">Peak</p>
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                  <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                    {readingStats.peak ?? '—'}
                  </span>
                  bpm
                </p>
              </div>

              <div className="flex flex-col flex-1 gap-3">
                <p className="text-xs/[90%]">Lowest</p>
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                  <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                    {readingStats.lowest ?? '—'}
                  </span>
                  bpm
                </p>
              </div>

              <div className="flex flex-col flex-1 gap-3">
                <p className="text-xs/[90%]">Resting</p>
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1">
                  <span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">
                    {restingBpm ?? '—'}
                  </span>
                  bpm
                </p>
              </div>
            </div>

            {/* FULL MEASUREMENT HISTORY AREA CHART */}
            <div className="h-28 w-full">
              <MeasurementAreaChart readings={readings} />
            </div>
          </Card>
          <Link to={'/insights'} className="flex items-center justify-between p-4 text-sm/[90%] text-white">View Last Measurement <i className="fi fi-rr-arrow-right text-base/[80%]"></i></Link>
        </div>
        {/*! DON'T DELETE */}
        {/* <div className="flex flex-col items-center justify-center col-span-5 gap-6 pt-16 pb-20">
          <span className="flex items-center px-4 py-2 text-xs/[110%] font-medium text-center rounded-lg bg-white text-th-plain-black">
            Current heart condition
          </span>
          <div className="flex items-center justify-center -space-x-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <>
              {(index + 1) === heartHealth ? (
                <div className="flex animate-beat size-12 rounded-[22px] items-center justify-center bg-th-purple-light border border-white"><i className="fi fi-sr-heart text-xl/[80%] text-white"></i></div>
              ) : (
                <div style={{ backgroundColor: `color-mix(in oklab, var(--color-th-green-light) 100%, black ${(index + 1) * 5}%)` }} className="border border-white rounded-full size-8" />
              )}
              </>
            ))}
          </div>
          <p className="mx-auto text-center w-50 text-xs/[110%]">Overall, your current heart rate<br/>is within a healthy range</p>
        </div> */}
      </div>
      {/* // COMPARISON // */}
      <div className="flex flex-col">
        {/* // NAVIGATION // */}
        <div className="flex items-center justify-between gap-6 px-6 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs/[110%] font-medium text-th-plain-black">Recent Comparison</p>
            <span className="text-xs/[90%] text-th-oak">{comparisonPage === 'last-week' ? 'Last vs This week' : 'Latest 7 days'}</span>
          </div>
          <div className="flex bg-white rounded-2xl text-th-green-dark p-px sticky top-4 text-xs/[90%] font-medium border border-th-cream-pale -space-x-2">
            <button onClick={() => setComparisonPage('last-week')} className={`cursor-pointer transition-all duration-500 flex w-25 h-8 items-center justify-center rounded-[14px] ${comparisonPage === 'last-week' ? 'bg-th-cream-pale text-white' : 'text-th-cream-pale'}`} to={'/insights/overview'}>Last Week</button>
            <button onClick={() => setComparisonPage('this-week')} className={`cursor-pointer transition-all duration-500 flex w-25 h-8 items-center justify-center rounded-[14px] ${comparisonPage === 'this-week' ? 'bg-th-cream-pale text-white' : 'text-th-cream-pale'}`} to={'/insights/history'}>This Week</button>
          </div>
        </div>
        {/* // CONTENT // */}
        <div className="flex gap-2">
          {comparisonPage === 'last-week' ? (
            <>
              {/* // LAST WEEK // */}
              <WeekSummaryCard
                title="Last Week"
                stats={previousWeekStats}
                className="w-full h-56 gap-6 text-th-plain-black"
                barClassName="bg-[linear-gradient(to_top,var(--color-th-purple-light),var(--color-th-green-light),var(--color-th-green-dark),var(--color-th-green-darker))]"
                valueClassName="text-th-plain-black"
              />
              {/* // THIS WEEK // */}
              <WeekSummaryCard
                title="This Week"
                stats={latestWeekStats}
                className="w-full h-56 gap-6 bg-th-green-light text-th-plain-white"
                barClassName="bg-th-plain-white"
                valueClassName="text-th-plain-white"
              />
            </>
          ) : (
            <>
            <Card className={'h-65 gap-2 w-full'}>
              <p className="flex justify-between items-center text-lg/[110%] font-medium">This Week<NavLink className="text-xs font-normal font-general text-th-oak" to={'/insights/history/weekly'}>See More</NavLink></p>
              <div className="flex text-xs/[110%] font-normal gap-2 h-full">
                {weeklyTrend.map(renderWeeklyTrendDay)}
              </div>
            </Card>
            </>
          )}
        </div>
      </div>
      {/* // DAILY READ // */}
      <div className="flex flex-col items-center gap-6 my-6">
        <p className="px-4 py-2 bg-white rounded-lg shadow-th-green-dark/10 shadow-th-sm mx-auto text-center text-xs/[110%]">Daily read for you</p>
        <div className="-space-y-3.5 flex flex-col items-center text-center">
          <img src={artImage} className="w-50" />
          <h1 className="text-2xl/[110%] font-medium text-th-plain-black w-78">Keep water nearby and drink regularly throughout the day.</h1>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs/[90%] text-th-plain-grey">5 min read</p>
          <span className="flex size-0.5 bg-th-plain-grey rounded-full" />
          <a className="text-xs/[90%] text-th-green-dark font-medium flex gap-2 items-center cursor-pointer" href="https://wikipedia.org">Learn More <i className="fi fi-rr-angle-right text-[8px]/[80%]" /></a>
        </div>
      </div>
      {/* // CHATBOT CTA */}
      <div className="flex">
        <Card onClick={() => navigate('/chatbot/session')} className={'hover:scale-107 group transition-all duration-500 p-6 justify-between h-42 text-th-plain-white rounded-[36px] bg-[radial-gradient(68.99%_68.99%_at_50%_31.31%,#6A624D_0%,#8C8268_18.54%,#A4B0A3_46.99%,#DCDACA_100%)] w-56 shrink-0 z-2 cursor-pointer'}>
          <i className="fi fi-rr-microphone text-2xl/[80%] group-hover:-translate-y-1 transition-all duration-500" />
          <div className="flex flex-col gap-2">
            <p className="text-lg/[130%] font-medium">Talk with<br/>Our Chatbot</p>
            <p className="text-xs/[90%]">Ask anything!</p>
          </div>
        </Card>
        <div className="flex flex-col -mt-3 -ml-4 -space-y-8">
          <div className="flex flex-col w-[70%]">
            <p className="p-4 bg-white rounded-2xl text-xs/100">{chatBubbleMessages[0]}</p>
            <img src={chatIndicator} className="w-4 h-auto text-white ml-7" />
          </div>
          <div className="flex flex-col w-[70%] self-end">
            <p className="p-4 text-right bg-white rounded-2xl text-xs/100">{chatBubbleMessages[1]}</p>
            <img src={chatIndicator} className="self-end w-4 h-auto mr-4 text-white" />
          </div>
          <div className="flex flex-col w-[70%] -ml-4 z-3">
            <p className="p-4 bg-white rounded-2xl text-xs/100">{chatBubbleMessages[2]}</p>
            <img src={chatIndicator} className="w-4 h-auto ml-4 text-white" />
          </div>
        </div>
      </div>
      <footer className="relative flex flex-col items-center justify-center mt-8 h-35 w-full shrink-0 bg-contain bg-bottom bg-no-repeat">
        <img src={sariLogo} alt="SANUBARI Logo" className="inline-block size-16 z-2 absolute" />
        <img src={homeFooter} alt="SANUBARI Logo" className="inline-block scale-110" />
      </footer>
      <div className="h-22 bg-th-green-light w-[calc(100%+16px*2)] self-center -mt-12 shrink-0" />
    </div>
    </>
  )
}

export default Home