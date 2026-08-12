import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, ArrowRight } from 'lucide-react'
import Logo from './Logo'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export default function Header({ isLoggedIn }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className={`lp-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="lp-container lp-header-inner">
        <Link to="/" className="lp-header-brand" onClick={closeMenu}>
          <Logo />
        </Link>

        <nav className="lp-header-nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="lp-header-actions">
          {isLoggedIn ? (
            <Link className="btn" to="/dashboard">
              Open dashboard
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <>
              <Link className="lp-header-login" to="/login">
                Log in
              </Link>
              <Link className="btn" to="/signup">
                Start free trial
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="lp-header-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div className={`lp-mobile-menu ${menuOpen ? 'is-open' : ''}`}>
        <nav aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="lp-mobile-menu-actions">
          {isLoggedIn ? (
            <Link className="btn" to="/dashboard" onClick={closeMenu}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login" onClick={closeMenu}>
                Log in
              </Link>
              <Link className="btn" to="/signup" onClick={closeMenu}>
                Start free trial
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
