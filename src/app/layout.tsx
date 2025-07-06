import "./globals.css";
import SessionWrapper from "./SessionWrapper";
import { CartProvider } from "./CartContext";
import Navbar from "./Navbar";
import Toast from "./components/Toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionWrapper>
          <CartProvider>
            <Navbar />
            <Toast />
            {children}
          </CartProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}