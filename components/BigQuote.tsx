import {
  forwardRef,
  type ReactNode,
  type ElementType,
  type HTMLAttributes,
} from "react"
import { cn } from "@/lib/utils"

interface BigQuoteProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
  as?: ElementType
}

const BigQuote = forwardRef<HTMLElement, BigQuoteProps>(function BigQuote(
  { children, className, as: Component = "p", ...rest },
  ref
) {
  return (
    <Component
      ref={ref}
      className={cn(
        "text-xl md:text-2xl lg:text-3xl font-['Office-Times-Sharp-Regular'] text-black leading-snug",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  )
})

export default BigQuote
