import { useReveal } from '../hooks/useReveal'

/**
 * Wraps children in a div that fades/slides into view on scroll.
 * `as` lets you render a semantic tag instead of a div.
 * `delay` (ms) staggers groups of reveals.
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  variant = 'up',
  ...rest
}) {
  const [ref, visible] = useReveal()

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant} ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
