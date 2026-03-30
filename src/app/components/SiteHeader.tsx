"use client";
import Link from 'next/link';

export default function SiteHeader() {
  return (
    <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 text-white border-b border-gray-800">
      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          {/* Logo/Brand Name — KTdealz.xyz @ KTWholesaleFinds */}
          <h1
            aria-label="KTdealz.xyz at KTWholesaleFinds"
            className="mb-2 flex flex-wrap justify-center items-baseline gap-x-1.5 sm:gap-x-2 gap-y-1 px-2"
          >
            <a
              href="https://ktdealz.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm md:text-base font-semibold bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(251,146,60,0.4)] hover:opacity-90 transition-opacity"
            >
              KTdealz.xyz
            </a>
            <span className="text-gray-500 font-normal text-xs sm:text-sm md:text-base select-none">@</span>
            <Link
              href="/"
              className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]"
            >
              KTWholesaleFinds
            </Link>
          </h1>
          
          {/* Tagline */}
          <p className="text-lg md:text-xl text-blue-300 font-medium tracking-wider drop-shadow-[0_0_8px_rgba(147,197,253,0.4)]">
            Where Your Dream Deals Come To Life!
          </p>
          
          {/* Decorative Elements */}
          <div className="flex justify-center items-center mt-4 space-x-4">
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent to-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]"></div>
            <span className="text-orange-400 text-2xl drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]">★</span>
            <div className="w-8 h-0.5 bg-gradient-to-l from-transparent to-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]"></div>
          </div>
        </div>
      </div>
      
      {/* Bottom Border */}
      <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]"></div>
    </div>
  );
} 