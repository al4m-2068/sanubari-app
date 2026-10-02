import { twMerge } from "tailwind-merge"

function Card({children, className, ...rest}) {
  return (
    <div className={twMerge(`flex flex-col p-4 rounded-3xl bg-white`, className)} {...rest}>
      {children}
    </div>
  )
}

export default Card