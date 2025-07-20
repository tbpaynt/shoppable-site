import "./globals.css";
import SessionWrapper from "./SessionWrapper";
import { CartProvider } from "./CartContext";
import Navbar from "./Navbar";
import Footer from "./components/Footer";
import Toast from "./components/Toast";
import SiteHeader from "./components/SiteHeader";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>KT Wholesale Finds - Everything Only $10!</title>
        <meta name="description" content="Amazing deals on wholesale products - everything only $10! Shop the best prices on quality items with fast shipping." />
        <meta name="keywords" content="wholesale, deals, $10, cheap, discount, online shopping, bargain" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="KT Wholesale Finds - Everything Only $10!" />
        <meta property="og:description" content="Amazing deals on wholesale products - everything only $10!" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ktwholesalefinds.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="KT Wholesale Finds - Everything Only $10!" />
        <meta name="twitter:description" content="Amazing deals on wholesale products - everything only $10!" />
        <link rel="canonical" href="https://ktwholesalefinds.com" />
      </head>
      <body>
        <SessionWrapper>
          <CartProvider>
            <SiteHeader />
            <Navbar />
            <Toast />
            {children}
            <Footer />
          </CartProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}