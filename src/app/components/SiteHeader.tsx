"use client";
import Link from 'next/link';

export default function SiteHeader() {
  return (
    <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 text-white border-b border-gray-800">
      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          {/* Balanced grid: dealz links in left third, brand dead center, empty right third */}
          <div className="mb-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-y-2 sm:gap-x-2 sm:items-center px-2">
            <div className="flex flex-col items-center gap-0.5 sm:items-end sm:justify-self-end sm:pr-1 md:pr-2">
              <a
                href="https://ktdealz.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm md:text-base font-semibold bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(251,146,60,0.4)] hover:opacity-90 transition-opacity leading-tight whitespace-nowrap"
              >
                KTdealz.com
              </a>
              <a
                href="https://ktdealz.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm md:text-base font-semibold bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(251,146,60,0.4)] hover:opacity-90 transition-opacity leading-tight whitespace-nowrap"
              >
                KTdealz.xyz
              </a>
            </div>
            <h1
              aria-label="KTdealz.com and KTdealz.xyz at KTWholesaleFinds"
              className="flex flex-wrap justify-center items-baseline gap-x-1.5 sm:gap-x-2 gap-y-1 min-w-0 text-center"
            >
              <span className="text-gray-500 font-normal text-xs sm:text-sm md:text-base select-none">@</span>
              <Link
                href="/"
                className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]"
              >
                KTWholesaleFinds
              </Link>
            </h1>
            <div className="hidden sm:block" aria-hidden="true" />
          </div>

          {/* Tagline */}
          <p className="text-lg md:text-xl text-blue-300 font-medium tracking-wider drop-shadow-[0_0_8px_rgba(147,197,253,0.4)] text-center">
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