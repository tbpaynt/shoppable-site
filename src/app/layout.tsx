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