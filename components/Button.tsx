'use client'

import * as React from 'react'
import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap font-["Monument-Grotesk"] uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default:
                    'bg-[#EBEAE0] text-[#010101] border border-[#EBEAE0] hover:bg-[#E2E0D8]',
                primary:
                    'bg-[#C0B9A5] text-white border border-[#EBEAE0] hover:opacity-90',
                dark:
                    'bg-black text-[#EEEBE3] border border-transparent hover:bg-[#EEEBE3] hover:text-black',
                ghost:
                    'bg-transparent text-[#010101] hover:opacity-70',
                outline:
                    'bg-transparent text-[#010101] border border-[#C0B9A5] hover:bg-[#C0B9A5]/10',
            },
            size: {
                sm: 'text-[11px] px-3 pt-1.5 pb-1 rounded-2xl',
                md: 'text-[12px] md:text-[14px] px-4 pt-2 pb-1.5 rounded-2xl',
                lg: 'text-sm md:text-base px-6 pt-2.5 pb-2 rounded-2xl',
            },
            shape: {
                pill: 'rounded-2xl',
                rounded: 'rounded-lg',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
            shape: 'pill',
        },
    }
)

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
    className?: string
    children: React.ReactNode
}

type ButtonLinkProps = ButtonBaseProps & {
    href: string
    external?: boolean
}

type ButtonActionProps = ButtonBaseProps & {
    href?: never
    external?: never
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
}

type ButtonProps = ButtonLinkProps | ButtonActionProps

export default function Button({
    href,
    external = false,
    variant,
    size,
    shape,
    className,
    children,
    ...rest
}: ButtonProps) {
    const classes = cn(buttonVariants({ variant, size, shape }), 'relative overflow-hidden group', className)

    const squircle = { cornerShape: 'squircle' } as React.CSSProperties

    const inner = (
        <>
            <span className="inline-block transition-transform duration-300 ease-out group-hover:-translate-y-full">
                {children}
            </span>
            <span className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out translate-y-full group-hover:translate-y-0">
                {children}
            </span>
        </>
    )

    if (href) {
        return (
            <Link
                href={href}
                className={classes}
                style={squircle}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
                {inner}
            </Link>
        )
    }

    return (
        <button className={classes} style={squircle} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
            {inner}
        </button>
    )
}

export { buttonVariants }
