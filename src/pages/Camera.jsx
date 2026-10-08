import { twMerge } from "tailwind-merge"

const requirementsClass = {
  check: 'text-th-green-dark',
  uncheck: 'text-th-plain-grey'
}
function Camera() {
  return (
    <div className="flex flex-col items-center h-full pt-16 gap-7">
      {/* DIV for CAMERA */}
      <div id="camContainer" style={{ width: '100%', height: '420px' }} className="bg-[url('https://m.media-amazon.com/images/I/71+NJH3rphL._AC_UF1000,1000_QL80_.jpg')] bg-cover bg-center rounded-3xl shrink-0">
        {/* CAMERA */}
      </div>

      <div className="flex flex-col justify-between h-full">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl/[100%] font-bold font-cabinet">Stay Still!</h1>
          <p className="text-lg/[110%] text-th-plain-grey">Measuring...</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className={twMerge('border-[1.2px] p-4 text-sm/[130%] font-medium rounded-2xl', requirementsClass['uncheck'])}>Keep a steady face in the area</p>
          <p className={twMerge('border-[1.2px] p-4 text-sm/[130%] font-medium rounded-2xl', requirementsClass['check'])}>Maintain a good lighthing</p>
          <p className={twMerge('border-[1.2px] p-4 text-sm/[130%] font-medium rounded-2xl', requirementsClass['uncheck'])}>Reduce movement</p>
        </div>
      </div>
    </div>
  )
}

export default Camera