import { NavLink, Outlet } from "react-router"
import Card from "../components/atom/Card"
import { useSariAuthStore } from "../data/sariAuthStore"
import { twMerge } from "tailwind-merge"
import { Popover } from "radix-ui"
import { useState } from "react"

// NEW THING: Declare the classes so tailwind render it for incoming non render usage
const trendBarClass = "w-full rounded-2xl bg-[linear-gradient(to_top,var(--color-th-purple-light),var(--color-th-green-light),var(--color-th-green-dark),var(--color-th-green-darker))]"
const measureStatusClasses = {
  noData: "w-full rounded-2xl border-[1.2px] border-th-plain-black h-6 flex items-center justify-center",
  normal: "w-full rounded-2xl bg-th-green-light border-[1.2px] border-th-green-dark flex items-center justify-center",
  low: "w-full rounded-2xl bg-[color-mix(in_oklab,var(--color-th-green-light)_100%,white_20%)] border-[1.2px] border-th-green-dark flex items-center justify-center",
  high: "w-full rounded-2xl bg-[color-mix(in_oklab,var(--color-th-green-light)_100%,black_10%)] border-[1.2px] border-th-green-light flex items-center justify-center",
}

function getReadingsByDate(measurements) {
  const readingsByDate = new Map()

  measurements.forEach(({ date, bpm }) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/.exec(date ?? '')
    if (!match || typeof bpm !== 'number' || !Number.isFinite(bpm)) return
    // NEW THING: setelah di .exec(ute) oleh regex, () adalah capturing group yang akan dipisah regex dalam array hasil.
    
    const [, year, month, day] = match
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (
      parsedDate.getUTCDate() !== Number(day) ||
      parsedDate.getUTCMonth() !== Number(month) - 1 ||
      parsedDate.getUTCFullYear() !== Number(year)
    ) return

    if (date.includes('T')) {
      const parsedTimestamp = new Date(date)
      if (Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.toISOString() !== date) return
    }

    const dateKey = parsedDate.toISOString().slice(0, 10)
    const readings = readingsByDate.get(dateKey) ?? []
    readings.push(bpm)
    readingsByDate.set(dateKey, readings)
  })

  return readingsByDate
}

function getAverage(readings) {
  return readings.length
    ? Math.round(readings.reduce((total, reading) => total + reading, 0) / readings.length)
    : null
}

function formatTrendDate(dateKey) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`))
}

function formatTrendMonth(dateKey) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}-01T00:00:00.000Z`))
}

function getLatestDate(readingsByDate) {
  const latestDate = [...readingsByDate.keys()].sort().at(-1)
  return latestDate ? new Date(`${latestDate}T00:00:00.000Z`) : null
}

function getWeeklyTrend(measurements) {
  const readingsByDate = getReadingsByDate(measurements)
  const endDate = getLatestDate(readingsByDate)
  if (!endDate) return []

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate)
    date.setUTCDate(endDate.getUTCDate() - 6 + index)
    const dateKey = date.toISOString().slice(0, 10)
    const readings = readingsByDate.get(dateKey) ?? []

    return {
      dateKey,
      bpm: getAverage(readings),
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date),
    }
  })
}

function getMonthlyTrend(measurements) {
  const readingsByDate = getReadingsByDate(measurements)
  const now = new Date()
  const firstDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const daysInMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate()
  const leadingDays = firstDate.getUTCDay()
  const calendarLength = Math.ceil((leadingDays + daysInMonth) / 7) * 7

  return Array.from({ length: calendarLength }, (_, index) => {
    const day = index - leadingDays + 1
    if (day < 1 || day > daysInMonth) {
      return { dateKey: `empty-${index}`, bpm: null, day: null, isPadding: true }
    }

    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), day))
    const dateKey = date.toISOString().slice(0, 10)

    return {
      dateKey,
      bpm: getAverage(readingsByDate.get(dateKey) ?? []),
      day,
      isPadding: false,
    }
  })
}

function getYearlyTrend(measurements) {
  const readingsByDate = getReadingsByDate(measurements)
  const readingsByMonth = new Map()
  readingsByDate.forEach((readings, dateKey) => {
    const monthKey = dateKey.slice(0, 7)
    const monthReadings = readingsByMonth.get(monthKey) ?? []
    monthReadings.push(...readings)
    readingsByMonth.set(monthKey, monthReadings)
  })

  const currentYear = new Date().getFullYear()
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(currentYear, index, 1))
    const dateKey = date.toISOString().slice(0, 7)

    return {
      dateKey,
      bpm: getAverage(readingsByMonth.get(dateKey) ?? []),
      month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date),
    }
  })
}

function Insights() {
  return (
    <div className="flex flex-col items-center gap-5 pt-16">
      <div className="flex bg-th-plain-white rounded-2xl text-th-green-dark p-0.5 sticky top-4">
        <NavLink className={({ isActive }) => (`flex w-28 h-8 px-4 items-center justify-center rounded-[14px] ${isActive && 'bg-th-green-dark text-white'}`)} to={'/insights/overview'}>Overview</NavLink>
        <NavLink className={({ isActive }) => (`flex w-28 h-8 px-4 items-center justify-center rounded-[14px] ${isActive && 'bg-th-green-dark text-white'}`)} to={'/insights/history'}>History</NavLink>
      </div>
      <div className="flex flex-col w-full">
        <Outlet/>
      </div>
    </div>
  )
}
export default Insights

export function Overview() {
  const measurements = useSariAuthStore(state => state.user?.measurementData ?? [])
  const weeklyTrend = getWeeklyTrend(measurements)
  const overviewDateKeys = new Set(weeklyTrend.map(({ dateKey }) => dateKey))
  const overviewReadings = [...getReadingsByDate(measurements)]
    .filter(([dateKey]) => overviewDateKeys.has(dateKey))
    .flatMap(([, readings]) => readings)
  const overviewAverage = getAverage(overviewReadings)
  const overviewPeak = overviewReadings.length ? Math.max(...overviewReadings) : null
  const overviewLowest = overviewReadings.length ? Math.min(...overviewReadings) : null
  const overviewStatus = overviewReadings.length === 0
    ? 'No data'
    : overviewReadings.every(bpm => bpm >= 30 && bpm <= 100) ? 'Great!' : 'Poor'
  const overviewSummary = overviewReadings.length === 0
    ? 'No heart rate data available for the last 7 days'
    : `Overall, your heart rate over the last 7 days is ${overviewStatus === 'Great!' ? 'within' : 'outside'} a healthy range`

  return (
    <div className="flex flex-col gap-8 w-full text-xs/[110%] font-medium pt-3">
      <p className="mx-auto text-center w-50">{overviewSummary}</p>
      <div className="flex flex-col w-full gap-4 text-th-green-darker ">
        <Card className={'h-64 grid auto-rows-max gap-x-2 gap-y-4 grid-cols-[132px_132px_1fr] w-full h-'}>
          <div className="flex flex-col gap-6"> 
              <p className="text-lg/[110%] font-medium flex flex-col gap-1">Your average heart rate <span className="text-xs/[90%] text-th-plain-grey font-normal">Last 7 days</span></p>
            <h1 className="text-[64px]/[90%] font-bold font-cabinet flex items-start gap-1">{overviewAverage ?? '—'}<i className="text-xs fi fi-sr-heart text-th-purple-light"></i></h1>
          </div>

          {/* DIV for CHART [BACKEND] */}
          <div className="col-span-2"></div>

          <Card className="font-normal border-b-2 border-th-green-dark rounded-2xl">
            <p className="flex items-center justify-between text-2xl font-medium font-cabinet">{overviewPeak ?? '—'}<span className="text-xs font-normal font-general text-th-green-dark">bpm</span></p>
            <p className="text-xs">Peak</p>
          </Card>
          <Card className="font-normal border-b-2 border-th-cream-pale rounded-2xl">
            <p className="flex items-center justify-between text-2xl font-medium font-cabinet">{overviewLowest ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
            <p className="text-xs">Lowest</p>
          </Card>
          <Card className={`relative items-center py-3 overflow-hidden rounded-lg ${overviewStatus == 'Great!' ? 'bg-th-green-dark/20 text-th-green-dark ' : 'bg-th-purple-light text-th-purple-darker'}`}>
            <p className="flex items-center text-xs/[110%] font-semibold text-center z-2">{overviewStatus}</p>
            <img src={overviewStatus == 'Great!' ? "/src/assets/images/heart-small.svg" : "/src/assets/images/heart-small-poor.svg"} alt="heart-icon" className='absolute h-auto max-w-none w-19 -bottom-8' />
          </Card>
        </Card>
        <Card className={'h-64 flex flex-col gap-9 w-full'}>
          <p className="flex justify-between items-center text-lg/[110%] font-medium">7 Day Trend<NavLink className="text-xs font-normal font-general text-th-green-dark" to={'/insights/history/weekly'}>See More</NavLink></p>
          <div className="flex text-xs/[110%] font-normal gap-2 h-full">
            {weeklyTrend.length
              ? weeklyTrend.map(({ dateKey, bpm, day }) => (
                <div key={dateKey} aria-label={`${day}: ${bpm === null ? 'no reading' : `${bpm} bpm`}`} className="flex flex-col items-center justify-end w-full h-full gap-2">
                  <p>{bpm ?? '—'}</p>
                  {bpm !== null ? (
                    <div style={{ height: `${Math.min(bpm, 100)}%` }} className={trendBarClass} />
                  ) : (
                    <div className={"w-full rounded-2xl border-[1.2px] border-th-plain-black h-6"} />
                  )}
                  <p>{day}</p>
                </div>
              ))
              : <p className="self-center w-full text-center text-th-plain-grey">No heart rate data available</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function History() {
  return (
    <div className="flex flex-col items-center w-full gap-5 pt-13">
      {/* DIV of NAVIGATION */}
      <div className="flex border-th-green-light/20 rounded-full border-[1.2px] p-1">
        <NavLink to={'/insights/history/weekly'} className={({ isActive }) => `size-12 flex items-center justify-center border-[1.2px] text-lg font-medium rounded-full ${isActive ? 'border-th-plain-grey text-th-plain-black bg-th-plain-white' : 'text-th-green-light'}`}>W</NavLink>
        <NavLink to={'/insights/history/monthly'} className={({ isActive }) => `size-12 flex items-center justify-center border-[1.2px] text-lg font-medium rounded-full ${isActive ? 'border-th-plain-grey text-th-plain-black bg-th-plain-white' : 'text-th-green-light'}`}>M</NavLink>
        <NavLink to={'/insights/history/yearly'} className={({ isActive }) => `size-12 flex items-center justify-center border-[1.2px] text-lg font-medium rounded-full ${isActive ? 'border-th-plain-grey text-th-plain-black bg-th-plain-white' : 'text-th-green-light'}`}>Y</NavLink>
      </div>
      {/* DIV of CONTENT */}
      <div className="flex flex-col w-full px-3">
        <Outlet/>
      </div>
    </div>
  )
}
export function Weekly() {
  const [openPopoverDate, setOpenPopoverDate] = useState(null)
  const measurements = useSariAuthStore(state => state.user?.measurementData ?? [])
  const weeklyTrend = getWeeklyTrend(measurements)
  const weeklySessions = weeklyTrend.filter(({ bpm }) => bpm !== null).length
  const weekDateKeys = new Set(weeklyTrend.map(({ dateKey }) => dateKey))
  const weeklyReadings = [...getReadingsByDate(measurements)]
    .filter(([dateKey]) => weekDateKeys.has(dateKey))
    .flatMap(([, readings]) => readings)
  const weeklyAverage = weeklyReadings.length
    ? Math.round(weeklyReadings.reduce((total, bpm) => total + bpm, 0) / weeklyReadings.length)
    : null
  const weeklyPeak = weeklyReadings.length ? Math.max(...weeklyReadings) : null
  const weeklyLowest = weeklyReadings.length ? Math.min(...weeklyReadings) : null
  const weeklyStatus = weeklyReadings.length === 0
    ? 'No data'
    : weeklyReadings.every(bpm => bpm >= 30 && bpm <= 100) ? 'Great!' : 'Poor'

  return (
    <div className="flex flex-col w-full gap-5">
      <Card className={'h-65 flex flex-col gap-9 w-full bg-transparent'}>
        <div className="flex text-xs/[110%] font-normal gap-2 h-full">
          {weeklyTrend.length
            ? weeklyTrend.map(({ dateKey, bpm, day }) => (
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
                    {bpm !== null ? (
                      <button
                        type="button"
                        aria-label={`${day}, ${formatTrendDate(dateKey)}: ${bpm} bpm`}
                        data-week-day
                        style={{ height: `${Math.min(bpm, 100)}%` }}
                        className={twMerge(measureStatusClasses[bpm > 100 ? 'high' : bpm < 30 ? 'low' : 'normal'], `${openPopoverDate === dateKey && 'bg-th-purple-light text-th-purple-darker border-th-purple-dark'}`)}
                      />
                    ) : (
                      <button
                        type="button"
                        aria-label={`${day}, ${formatTrendDate(dateKey)}: no reading`}
                        data-week-day
                        className={twMerge(measureStatusClasses.noData, `${openPopoverDate === dateKey && 'bg-th-purple-light text-th-purple-darker border-th-purple-dark'}`)}
                      />
                    )}
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
                    className="z-50 rounded-2xl bg-th-plain-white p-3 text-xs/[90%] font-medium text-th-plain-black"
                  >
                    <p>{formatTrendDate(dateKey)}</p>
                    <Popover.Arrow className="fill-th-plain-white" height={14} width={16}/>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ))
            : <p className="self-center w-full text-center text-th-plain-grey">No heart rate data available</p>}
        </div>
      </Card>
      <div className={'grid grid-cols-5 w-full auto-rows-max p-0 gap-2 bg-transparent'}>
        <Card className="p-3 bg-th-green-light text-th-green-dark rounded-[14px] col-span-3 h-31 justify-between">
          <p className="text-lg/[90%] font-medium">Sessions</p>
          <div className="flex justify-between items-center font-cabinet text-th-plain-black text-5xl/[90%] font-bold">{weeklySessions}/7 <span className="text-xs font-normal text-th-green-dark font-general">Day{weeklySessions > 1 && 's'}</span></div>
        </Card>
        <Card className="p-3 bg-th-purple-light text-th-purple-darker rounded-[14px] col-span-2 justify-between">
          <p className="text-lg/[90%] font-medium">Average</p>
          <div className="flex justify-between items-center font-cabinet text-th-plain-white text-5xl/[90%] font-bold">{weeklyAverage ?? '—'} <span className="text-xs font-normal text-th-purple-dark font-general">bpm</span></div>
        </Card>
        <Card className="justify-between col-span-2 p-3 font-normal border-b-2 border-th-cream-pale rounded-[14px] h-17">
          <p className="text-xs/[90%] font-medium">Peak</p>
          <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">{weeklyPeak ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
        </Card>
        <Card className="justify-between col-span-2 p-3 font-normal border-b-2 border-th-cream-pale rounded-[14px] h-17">
          <p className="text-xs/[90%] font-medium">Lowest</p>
          <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">{weeklyLowest ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
        </Card>
        <Card className={`relative items-center py-3 overflow-hidden rounded-lg ${weeklyStatus === 'Great!' ? 'bg-th-green-dark/20 text-th-green-dark' : 'bg-th-purple-light text-th-purple-darker'}`}>
          <p className="flex items-center text-xs/[110%] font-semibold text-center z-2">{weeklyStatus}</p>
          <img src={weeklyStatus === 'Great!' ? "/src/assets/images/heart-small.svg" : "/src/assets/images/heart-small-poor.svg"} alt="heart-icon" className="absolute h-auto max-w-none w-19 -bottom-8" />
        </Card>
      </div>
    </div>
  )
}
export function Monthly() {
  const [openPopoverDate, setOpenPopoverDate] = useState(null)
  const measurements = useSariAuthStore(state => state.user?.measurementData ?? [])
  const monthlyTrend = getMonthlyTrend(measurements)
  const monthDays = monthlyTrend.filter(({ isPadding }) => !isPadding)
  const monthlySessions = monthDays.filter(({ bpm }) => bpm !== null).length
  const monthDateKeys = new Set(monthDays.map(({ dateKey }) => dateKey))
  const monthlyReadings = [...getReadingsByDate(measurements)]
    .filter(([dateKey]) => monthDateKeys.has(dateKey))
    .flatMap(([, readings]) => readings)
  const monthlyAverage = monthlyReadings.length
    ? Math.round(monthlyReadings.reduce((total, bpm) => total + bpm, 0) / monthlyReadings.length)
    : null
  const monthlyPeak = monthlyReadings.length ? Math.max(...monthlyReadings) : null
  const monthlyLowest = monthlyReadings.length ? Math.min(...monthlyReadings) : null
  const monthlyStatus = monthlyReadings.length === 0
    ? 'No data'
    : monthlyReadings.every(bpm => bpm >= 30 && bpm <= 100) ? 'Great!' : 'Poor'

  return (
    <div className="flex flex-col w-full gap-5">
      <Card className={'flex flex-col gap-2 w-full bg-transparent'}>
        <div className="grid grid-cols-7 text-xs font-medium text-center text-th-green-darker">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <p key={day}>{day}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 text-xs/[110%] font-normal gap-1 h-full" style={{ gridTemplateRows: `repeat(${monthlyTrend.length / 7}, minmax(0, 1fr))` }}>
          {monthlyTrend.length
            ? monthlyTrend.map(({ dateKey, bpm, isPadding }) => isPadding ? (
              <div key={dateKey} aria-hidden="true" />
            ) : (
              <Popover.Root
                key={dateKey}
                open={openPopoverDate === dateKey}
                onOpenChange={open => setOpenPopoverDate(currentDate => {
                  if (open) return dateKey
                  return currentDate === dateKey ? null : currentDate
                })}
              >
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    aria-label={`${formatTrendDate(dateKey)}: ${bpm === null ? 'no reading' : `${bpm} bpm`}`}
                    data-month-day
                    className="relative flex flex-col items-center justify-center w-full h-full appearance-none border-0 bg-transparent p-0 text-lg text-[color-mix(in_oklab,var(--color-th-green-light)_100%,black_50%)]"
                  >
                    {bpm !== null ? (
                      <div className={twMerge(measureStatusClasses[bpm > 100 ? 'high' : bpm < 30 ? 'low' : 'normal'], `h-full aspect-square ${openPopoverDate === dateKey && 'bg-th-purple-light text-th-purple-darker border-th-purple-dark'}`)}>
                        <p>{bpm}</p>
                      </div>
                    ) : (
                      <div className={twMerge(measureStatusClasses.noData, `h-full text-th-green-light border-th-green-light aspect-square ${openPopoverDate === dateKey && 'bg-th-purple-light text-th-purple-darker border-th-purple-dark'}`)}>—</div>
                    )}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    onInteractOutside={event => {
                      if (event.target instanceof Element && event.target.closest('[data-month-day]')) {
                        event.preventDefault()
                      }
                    }}
                    side="top"
                    align="center"
                    sideOffset={-12}
                    className="z-50 rounded-2xl bg-th-plain-white p-3 text-xs/[90%] font-medium text-th-plain-black"
                  >
                    <p>{formatTrendDate(dateKey)}</p>
                    <Popover.Arrow className="fill-th-plain-white" height={14} width={16}/>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ))
            : <p className="self-center w-full text-center text-th-plain-grey">No heart rate data available</p>}
        </div>
      </Card>
      <div className={'grid grid-cols-5 w-full auto-rows-max p-0 gap-2 bg-transparent'}>
        <Card className="p-3 bg-th-green-light text-th-green-dark rounded-[14px] col-span-3 h-31 justify-between">
          <p className="text-lg/[90%] font-medium">Sessions</p>
          <div className="flex justify-between items-center font-cabinet text-th-plain-black text-5xl/[90%] font-bold">{monthlySessions}/{monthDays.length} <span className="text-xs font-normal text-th-green-dark font-general">Day{monthlySessions !== 1 && 's'}</span></div>
        </Card>
        <Card className="p-3 bg-th-purple-light text-th-purple-darker rounded-[14px] col-span-2 justify-between">
          <p className="text-lg/[90%] font-medium">Average</p>
          <div className="flex justify-between items-center font-cabinet text-th-plain-white text-5xl/[90%] font-bold">{monthlyAverage ?? '—'} <span className="text-xs font-normal text-th-purple-dark font-general">bpm</span></div>
        </Card>
        <Card className="justify-between col-span-2 p-3 font-normal border-b-2 border-th-cream-pale rounded-[14px] h-17">
          <p className="text-xs/[90%] font-medium">Peak</p>
          <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">{monthlyPeak ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
        </Card>
        <Card className="justify-between col-span-2 p-3 font-normal border-b-2 border-th-cream-pale rounded-[14px] h-17">
          <p className="text-xs/[90%] font-medium">Lowest</p>
          <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">{monthlyLowest ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
        </Card>
        <Card className={`relative items-center py-3 overflow-hidden rounded-lg ${monthlyStatus === 'Great!' ? 'bg-th-green-dark/20 text-th-green-dark' : 'bg-th-purple-light text-th-purple-darker'}`}>
          <p className="flex items-center text-xs/[110%] font-semibold text-center z-2">{monthlyStatus}</p>
          <img src={monthlyStatus === 'Great!' ? "/src/assets/images/heart-small.svg" : "/src/assets/images/heart-small-poor.svg"} alt="heart-icon" className="absolute h-auto max-w-none w-19 -bottom-8" />
        </Card>
      </div>
    </div>
  )
}
export function Yearly() {
  const [openPopoverMonth, setOpenPopoverMonth] = useState(null)
  const measurements = useSariAuthStore(state => state.user?.measurementData ?? [])
  const yearlyTrend = getYearlyTrend(measurements)
  const currentYear = String(new Date().getFullYear())
  const yearlyReadingsByDate = [...getReadingsByDate(measurements)]
    .filter(([dateKey]) => dateKey.startsWith(`${currentYear}-`))
  const yearlySessions = yearlyReadingsByDate.length
  const yearlyReadings = yearlyReadingsByDate.flatMap(([, readings]) => readings)
  const yearDays = (Date.UTC(Number(currentYear) + 1, 0, 1) - Date.UTC(Number(currentYear), 0, 1)) / 86400000
  const yearlyAverage = yearlyReadings.length
    ? Math.round(yearlyReadings.reduce((total, bpm) => total + bpm, 0) / yearlyReadings.length)
    : null
  const yearlyPeak = yearlyReadings.length ? Math.max(...yearlyReadings) : null
  const yearlyLowest = yearlyReadings.length ? Math.min(...yearlyReadings) : null
  const yearlyStatus = yearlyReadings.length === 0
    ? 'No data'
    : yearlyReadings.every(bpm => bpm >= 30 && bpm <= 100) ? 'Great!' : 'Poor'

  return (
    <div className="flex flex-col w-full gap-5">
      <Card className={'flex flex-col gap-2 w-full bg-transparent'}>
        <div className="grid grid-cols-4 grid-rows-3 text-xs/[110%] font-normal gap-1 h-full">
          {yearlyTrend.length
            ? yearlyTrend.map(({ dateKey, bpm }) => (
              <Popover.Root
                key={dateKey}
                open={openPopoverMonth === dateKey}
                onOpenChange={open => setOpenPopoverMonth(currentMonth => {
                  if (open) return dateKey
                  return currentMonth === dateKey ? null : currentMonth
                })}
              >
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    aria-label={`${formatTrendMonth(dateKey)}: ${bpm === null ? 'no reading' : `${bpm} bpm`}`}
                    data-year-month
                    className={`relative flex flex-col items-center justify-center w-full h-full appearance-none border-0 bg-transparent p-0 text-lg text-[color-mix(in_oklab,var(--color-th-green-light)_100%,black_50%)] ${openPopoverMonth === dateKey ? 'text-th-purple-darker' : ''}`}
                  >
                    {bpm !== null ? (
                      <div className={twMerge(measureStatusClasses[bpm > 100 ? 'high' : bpm < 30 ? 'low' : 'normal'], `h-full aspect-square rounded-3xl ${openPopoverMonth === dateKey && 'bg-th-purple-light text-th-purple-darker border-th-purple-dark'}`)}>
                        <p>{bpm}</p>
                      </div>
                    ) : (
                      <div className={twMerge(measureStatusClasses.noData, `h-full text-th-green-light border-th-green-light aspect-square rounded-3xl ${openPopoverMonth === dateKey && 'bg-th-purple-light text-th-purple-darker border-th-purple-dark'}`)}>—</div>
                    )}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    onInteractOutside={event => {
                      if (event.target instanceof Element && event.target.closest('[data-year-month]')) {
                        event.preventDefault()
                      }
                    }}
                    side="top"
                    align="center"
                    sideOffset={-12}
                    className="z-50 rounded-2xl bg-th-plain-white p-3 text-xs/[90%] font-medium text-th-plain-black"
                  >
                    <p>{formatTrendMonth(dateKey)}</p>
                    <Popover.Arrow className="fill-th-plain-white" height={14} width={16}/>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ))
            : <p className="self-center w-full text-center text-th-plain-grey">No heart rate data available</p>}
        </div>
      </Card>
      <div className={'grid grid-cols-5 w-full auto-rows-max p-0 gap-2 bg-transparent'}>
        <Card className="p-3 bg-th-green-light text-th-green-dark rounded-[14px] col-span-3 h-31 justify-between">
          <p className="text-lg/[90%] font-medium">Sessions</p>
          <div className="flex justify-between items-center font-cabinet text-th-plain-black text-5xl/[90%] font-bold">{yearlySessions}/{yearDays} <span className="text-xs font-normal text-th-green-dark font-general">Day{yearlySessions !== 1 && 's'}</span></div>
        </Card>
        <Card className="p-3 bg-th-purple-light text-th-purple-darker rounded-[14px] col-span-2 justify-between">
          <p className="text-lg/[90%] font-medium">Average</p>
          <div className="flex justify-between items-center font-cabinet text-th-plain-white text-5xl/[90%] font-bold">{yearlyAverage ?? '—'} <span className="text-xs font-normal text-th-purple-dark font-general">bpm</span></div>
        </Card>
        <Card className="justify-between col-span-2 p-3 font-normal border-b-2 border-th-cream-pale rounded-[14px] h-17">
          <p className="text-xs/[90%] font-medium">Peak</p>
          <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">{yearlyPeak ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
        </Card>
        <Card className="justify-between col-span-2 p-3 font-normal border-b-2 border-th-cream-pale rounded-[14px] h-17">
          <p className="text-xs/[90%] font-medium">Lowest</p>
          <p className="flex items-center justify-between text-2xl/[80%] font-medium font-cabinet">{yearlyLowest ?? '—'}<span className="text-xs font-normal font-general text-th-cream-pale">bpm</span></p>
        </Card>
        <Card className={`relative items-center py-3 overflow-hidden rounded-lg ${yearlyStatus === 'Great!' ? 'bg-th-green-dark/20 text-th-green-dark' : 'bg-th-purple-light text-th-purple-darker'}`}>
          <p className="flex items-center text-xs/[110%] font-semibold text-center z-2">{yearlyStatus}</p>
          <img src={yearlyStatus === 'Great!' ? "/src/assets/images/heart-small.svg" : "/src/assets/images/heart-small-poor.svg"} alt="heart-icon" className="absolute h-auto max-w-none w-19 -bottom-8" />
        </Card>
      </div>
    </div>
  )
}