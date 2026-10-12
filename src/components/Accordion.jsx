import { useState } from "react"
import Button from "./atom/Button"
import { twMerge } from "tailwind-merge"

function Accordion({title, children, defaultOpen = false, className, wrapperClassName}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={twMerge(`w-full flex flex-col`, wrapperClassName)}>
      <Button type="button" aria-expanded={open} className={twMerge('text-left justify-between items-center round flex gap-2 bg-th-green-light/25 text-lg/[130%] font-medium p-6', className)} onClick={() => setOpen(!open)}>{title}<i className={`fi fi-rr-angle-small-up -ml-1.5 text-th-green-dark text-lg/[80%] transition-transform ${open ? '' : 'rotate-180'}`}></i></Button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default Accordion