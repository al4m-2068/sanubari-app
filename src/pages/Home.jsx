import { Link } from "react-router"
import Card from "../components/atom/Card"
import { useSariAuthStore } from "../data/sariAuthStore"
import Button from "../components/atom/Button"

function Home() {
  const user = useSariAuthStore(state => state.user)
  const barTotal = 7
  
  // DUMMY CONDITIONING STATES
  const avgBpm = 72

  return (
    <div className="flex flex-col gap-5 pt-4">
      <h1 className="font-bold font-cabinet text-4xl text-th-plain-black">
        Hello, {user.name.first}!
        <br />
        <span className="font-medium">How are you today?</span>
      </h1>
      <div className="grid grid-cols-5 auto-rows-max gap-2">
        <div className="rounded-3xl flex flex-col col-span-5 h-74 bg-linear-90 from-th-green-light to-th-green-dark">
          <Card className={'h-full'}>
            {/* CHART DIV */}
            <div className="h-full"></div>

            {/* INFO DIV */}
            <div className="flex w-full gap-8">
              <div className="flex-1 flex flex-col gap-3">
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1"><span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">72</span>bpm</p>
                <p className="text-lg/[90%]">Average</p>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1"><span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">112</span>bpm</p>
                <p className="text-lg/[90%]">Peak</p>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <p className="text-xs/[90%] text-th-plain-grey flex items-center gap-1"><span className="text-2xl/[90%] text-th-plain-black font-medium font-cabinet">60</span>bpm</p>
                <p className="text-lg/[90%]">Resting</p>
              </div>
            </div>
          </Card>
          <Link to={'/insights'} className="flex items-center justify-between p-4 block text-sm/[90%] text-white">View Last Measurement <i className="fi fi-rr-arrow-right text-base/[90%]"></i></Link>
        </div>

        {/* CTA to CHATBOT */}
        <Button className={'items-center justify-center bg-th-green-dark bg-[radial-gradient(68.99%_68.99%_at_50%_31.31%,#6A624D_0%,#8C8268_18.54%,#A4B0A3_46.99%,#DCDACA_100%)] text-white rounded-3xl'}>
          <i className="fi fi-br-question text-2xl/[90%]"></i>
        </Button>

        {/* CTA to MEASUREMENT CAM */}
        <Button className={'items-center bg-th-green-light text-white rounded-3xl relative col-span-4 overflow-hidden px-6 text-left h-18'}>
          <p className="text-xl/[100%] font-medium">Quick Daily<br />Measurement</p>
          <div className="flex items-center rounded-full justify-center size-30 absolute -right-6 bg-th-green-dark">
            <i class="fi fi-sr-heart text-[44px]/[90%]"></i>
          </div>
        </Button>

        {/* CTA to INSIGHTS & HEART STATUS */}
        <div className="h-37 grid col-span-5 grid-cols-subgrid grid-rows-3">
          {/* CTA to INSIGHTS */}
          <Card className={'col-span-3 row-span-3 bg-linear-0 from-th-purple-dark to-th-purple-light gap-4'}>
            <p className="flex justify-between items-center text-sm/[90%] text-th-purple-darker font-medium"><span className="flex size-3 bg-th-purple-darker rounded-full"></span>Your Weekly Trend</p>
            <div className="grid h-full grid-cols-7 items-end gap-1">
              {Array.from({ length: barTotal }, (_, index) => (
                <div key={index} style={{height: `${Math.floor(Math.random() * (100 - 30 + 1)) + 30}%`}} className="bg-linear-0 from-th-purple-dark to-th-plain-white rounded-t-lg transition-all duration-500"></div>
              ))}
            </div>
          </Card>
          {/* HEART STATUS */}
          <Card className={'col-span-2 row-span-2 gap-4 p-2 bg-linear-0 from-th-cream-pale to-th-cream relative items-center overflow-hidden'}>
            <p className="flex justify-between items-center text-xs/[110%] text-th-plain-white font-medium bg-th-green-darker px-3 py-2 text-center rounded-2xl z-2">Your average heart rate is within a {(avgBpm > 100 || avgBpm < 30) ? 'bad' : avgBpm >= 60 ? 'normal' : 'good'} range</p>
            <img src="/src/assets/images/heart-big.svg" alt="heart-icon" className="absolute -bottom-22" />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Home