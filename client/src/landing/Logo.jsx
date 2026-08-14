import lightLogo from '../../Images/Logo-for-light-bg.png'
import darkLogo  from '../../Images/Logo-for-dark-bg.png'

/**
 * BuildBot logo image.
 *
 * @param {boolean} dark     - Use the light-text variant for dark backgrounds
 *                             (sidebars, auth panel, footer). Default = light-bg variant.
 * @param {number}  height   - Image height in px (width auto-scales). Default 36.
 * @param {string}  className
 */
export default function Logo({ dark = false, height = 36, className = '' }) {
  return (
    <img
      src={dark ? darkLogo : lightLogo}
      alt="BuildBot"
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
      className={className || undefined}
    />
  )
}
