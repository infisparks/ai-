
import React from 'react';

interface AvatarProps {
  state: 'speaking' | 'listening';
}

export const Avatar: React.FC<AvatarProps> = ({ state }) => {
  const isSpeaking = state === 'speaking';

  return (
    <div className="relative w-48 h-48" aria-label={`Avatar is currently ${state}`}>
      {/* Head */}
      <div className="absolute inset-0 bg-gray-300 rounded-full border-4 border-gray-400 shadow-lg"></div>

      {/* Eyes container */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex gap-8">
        {/* Left & Right Eye */}
        {[...Array(2)].map((_, i) => (
          <div key={i} className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-gray-400 overflow-hidden">
            <div className={`w-5 h-5 bg-blue-500 rounded-full transition-transform duration-500 ${!isSpeaking ? 'animate-pulse' : ''}`}></div>
          </div>
        ))}
      </div>

      {/* Mouth */}
       <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-20 rounded-full bg-gray-700 transition-all duration-200 ease-in-out"
           style={{ 
             height: isSpeaking ? '20px' : '5px',
             transform: isSpeaking ? 'translate(-50%, 5px)' : 'translate(-50%, 0)',
           }}>
      </div>

      {/* Antenna */}
      <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 w-2 h-8 bg-gray-400" />
      <div className="absolute top-[-32px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-gray-400">
        {/* Inner light with animation */}
        <div className={`w-full h-full rounded-full transition-colors ${isSpeaking ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
      </div>
    </div>
  );
};
