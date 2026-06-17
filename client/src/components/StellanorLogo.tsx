import React from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const StellanorLogo: React.FC<LogoProps> = ({ className = "h-8 w-8", showText = true }) => {
  return (
    <div className="flex items-center gap-3">
      {/* Geometric North Star Icon */}
      <svg 
        className={`{className} text-teal-400 animate-pulse-slow`} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M50 5 L56 38 L89 44 L56 50 L50 83 L44 50 L11 44 L44 38 Z" 
          fill="currentColor"
        />
        <circle cx="50" cy="50" r="6" fill="#0f172a" />
      </svg>

      {showText && (
        <span className="font-sans font-bold tracking-wider text-xl text-slate-100">
          STELLA<span className="text-teal-400">NORD</span>
        </span>
      )}
    </div>
  );
};