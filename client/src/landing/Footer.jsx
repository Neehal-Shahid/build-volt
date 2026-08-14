import { Link } from 'react-router-dom'
import Logo from './Logo'

const PRODUCT_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-grid">
        <div className="lp-footer-brand">
          <Logo />
          <p>
            The AI PC-build recommendation widget for parts retailers in
            Pakistan — embed it once, let it sell for you.
          </p>
        </div>

        <div className="lp-footer-col">
          <h4>Product</h4>
          <ul>
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-footer-col">
          <h4>Account</h4>
          <ul>
            <li>
              <Link to="/signup">Create a store</Link>
            </li>
            <li>
              <Link to="/login">Store login</Link>
            </li>
            <li>
              <Link to="/admin">Admin login</Link>
            </li>
          </ul>
        </div>

        <div className="lp-footer-col">
          <h4>Legal</h4>
          <ul>
            <li>
              <Link to="/terms">Terms of Service</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="lp-container lp-footer-bottom">
        <p>© {year} BuildBot. Built for PC parts retailers in Pakistan.</p>
      </div>
    </footer>
  )
}
