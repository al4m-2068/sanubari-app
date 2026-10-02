import { twMerge } from "tailwind-merge"

function Button({children, className, ...rest}) {
  return (
    <button className={twMerge(`flex items-center`, className)} {...rest}>
      {children}
    </button>
  )
}

export default Button