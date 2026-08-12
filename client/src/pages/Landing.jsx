import { useAuth } from "../context/AuthContext";
import Header from "../landing/Header";
import Hero from "../landing/Hero";
import PurposeStrip from "../landing/PurposeStrip";
import Features from "../landing/Features";
import HowItWorks from "../landing/HowItWorks";
import Showcase from "../landing/Showcase";
import LocalStrip from "../landing/LocalStrip";
import Pricing from "../landing/Pricing";
import Faq from "../landing/Faq";
import FinalCta from "../landing/FinalCta";
import Footer from "../landing/Footer";
import "../landing/landing.css";

export default function Landing() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="lp">
      <Header isLoggedIn={isLoggedIn} />
      <main>
        <Hero isLoggedIn={isLoggedIn} />
        <PurposeStrip />
        <Features />
        <HowItWorks />
        <Showcase />
        <LocalStrip />
        <Pricing />
        <Faq />
        <FinalCta isLoggedIn={isLoggedIn} />
      </main>
      <Footer />
    </div>
  );
}
