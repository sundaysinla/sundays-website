import {
  forwardRef,
  type ReactNode,
  type ElementType,
  type HTMLAttributes,
} from "react"
import { cn } from "@/lib/utils"

interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
  as?: ElementType
}

const Eyebrow = forwardRef<HTMLElement, EyebrowProps>(function Eyebrow(
  { children, className, as: Component = "p", ...rest },
  ref
) {
  return (
    <Component
      ref={ref}
      className={cn(
        "text-sm uppercase tracking-wide font-['Monument-Grotesk'] text-[#C0B9A5]",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  )
})

export default Eyebrow
