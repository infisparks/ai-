import React, {useCallback, useRef} from 'react';
import { useMedzealAssistant } from '@/hooks/useDentalAssistant';
import { AppState } from '@/types';
import Report from './Report';
import { Icon } from './Icon';
import { Avatar } from './Avatar';

const App: React.FC = () => {
  const {
    appState,
    videoRef,
    startOnboardingConversation,
    error,
    report,
    isMuted,
    toggleMute,
    isAssistantSpeaking,
    detailToVerify,
    currentGeminiText,
    capturedImages,
    setCapturedImages,
    analyzeImages,
    startPostReportConversation,
    cleanupConversation // Import cleanupConversation
  } = useMedzealAssistant();
  
  const isCheckinPhase = [AppState.CONNECTING, AppState.GATHERING_DETAILS, AppState.POST_REPORT_CONVERSATION, AppState.SCANNING].includes(appState);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  const handleCapture = useCallback(() => {
    if (videoRef.current && capturedImages.length < 5) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally to match the user's mirrored view
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImages([...capturedImages, dataUrl.split(',')[1]]);
    }
  }, [capturedImages, setCapturedImages, videoRef]);

  // New handler for the button click
  const handleAnalyzeClick = async () => {
    const success = await analyzeImages();
    if (success) {
      cleanupConversation(); // Manually close mic if button is clicked
    }
  }

  const renderContent = () => {
    switch (appState) {
      case AppState.IDLE:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Medzeal AI Checkup</h1>
            <p className="text-gray-600 mb-8">Your personal AI-powered facial skin analysis.</p>
            <button
              onClick={startOnboardingConversation}
              className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
            >
              Start Check-up
            </button>
          </div>
        );
      case AppState.DENIED:
      case AppState.ERROR:
        return (
          <div className="text-center p-8 bg-red-100 border border-red-400 text-red-700 rounded-lg max-w-md flex flex-col items-center shadow-lg">
            <h2 className="text-2xl font-bold mb-2">{appState === AppState.DENIED ? 'Permissions Required' : 'An Error Occurred'}</h2>
            <p className="mb-6">{error}</p>
            <button
              onClick={startOnboardingConversation}
              className="px-8 py-3 bg-red-600 text-white font-semibold rounded-full shadow-lg hover:bg-red-700 transition-all duration-300 transform hover:scale-105"
            >
              Try Again
            </button>
          </div>
        );
      case AppState.REPORT:
        return report ? <Report report={report} onReset={startOnboardingConversation} onDiscuss={startPostReportConversation} /> : <p>Generating report...</p>;
      
      case AppState.SCANNING:
          return (
            <div className="w-full max-w-4xl flex flex-col items-center gap-4">
                <div className="w-full aspect-[3/4] md:aspect-video rounded-2xl overflow-hidden shadow-2xl relative bg-black">
                     <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform -scale-x-100"
                        onCanPlay={() => {
                            if (videoRef.current) {
                                videoRef.current.play();
                            }
                        }}
                     />
                     {/* Face Positioning Guide Overlay */}
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10" aria-hidden="true">
                        <div 
                            className="w-[65%] max-w-[300px] md:w-[45%] md:max-w-[350px] aspect-[3/4] rounded-[50%]"
                            style={{ boxShadow: '0 0 20px 5px rgba(255, 255, 255, 0.25), inset 0 0 10px 2px rgba(255, 255, 255, 0.2), 0 0 0 9999px rgba(0, 0, 0, 0.5)' }}
                        ></div>
                     </div>
                </div>
                 <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full">
                    {/* --- UPDATED: RESPONSIVE GRID --- */}
                    <div className="order-last md:order-first flex-1 h-auto bg-gray-200 rounded-lg grid grid-cols-5 gap-2 p-2 w-full">
                        {capturedImages.map((img, index) => (
                             <img key={index} src={`data:image/jpeg;base64,${img}`} className="w-full aspect-square object-cover rounded-md" />
                        ))}
                        {Array(5 - capturedImages.length).fill(0).map((_, i) => (
                             <div key={i} className="w-full aspect-square bg-gray-300 rounded-md" />
                        ))}
                    </div>
                    <div className="flex w-full md:w-auto gap-4">
                        <button onClick={handleCapture} disabled={capturedImages.length >= 5} className="flex-1 md:w-24 h-20 md:h-24 bg-blue-600 text-white rounded-full flex items-center justify-center flex-col text-sm font-semibold disabled:bg-gray-400 hover:bg-blue-700 transition">
                            Capture
                            <span className="text-xs">({capturedImages.length}/5)</span>
                        </button>
                        <button onClick={handleAnalyzeClick} disabled={capturedImages.length < 3} className="flex-1 md:w-auto h-20 md:h-24 px-6 bg-green-600 text-white rounded-lg font-semibold disabled:bg-gray-400 hover:bg-green-700 transition">
                            Analyze Photos ({capturedImages.length})
                        </button>
                    </div>
                 </div>
                 {/* --- UPDATED: HELPER TEXT --- */}
                 <p className="text-white text-center mt-2 px-4">
                    Position your face within the oval and capture 3-5 photos.
                    <br />
                    When ready, click "Analyze Photos" or say "I'm ready".
                 </p>
            </div>
          );
      case AppState.ANALYZING:
      case AppState.GENERATING_PDF:
         return (
             <div className="bg-black/60 flex flex-col items-center justify-center text-white">
                 <div className="w-16 h-16 border-4 border-t-transparent border-blue-400 rounded-full animate-spin mb-4"></div>
                 <p className="text-xl font-medium">{appState === AppState.ANALYZING ? 'Analyzing your photos...' : 'Preparing your report PDF...'}</p>
                 <p className="text-gray-400">This may take a moment.</p>
             </div>
         );

      default:
        return (
          <div className="w-full max-w-4xl h-[70vh] md:h-auto md:aspect-video rounded-2xl overflow-hidden shadow-2xl relative flex flex-col items-center justify-center transition-colors duration-500 bg-gray-800">
            {appState === AppState.POST_REPORT_CONVERSATION && report && (
                <div className="absolute inset-0">
                    <div id="report-content" className="opacity-10 blur-sm scale-105">
                         <Report report={report} onReset={()=>{}} onDiscuss={()=>{}} />
                    </div>
                </div>
            )}
            {isCheckinPhase && (
                <div className="flex flex-col items-center justify-center text-center z-10">
                    <Avatar state={isAssistantSpeaking ? 'speaking' : 'listening'} />
                    {detailToVerify && (
                        <div className="mt-8 bg-black/30 p-4 rounded-lg">
                            <p className="text-sm text-gray-300 capitalize">{detailToVerify.type === 'unknown' ? 'Heard' : `${detailToVerify.type} for Verification`}:</p>
                            <p className="text-2xl font-mono tracking-widest text-white">{detailToVerify.value}</p>
                        </div>
                    )}
                </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm z-20">
                <span className={`w-2.5 h-2.5 rounded-full ${appState === AppState.CONNECTING ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <span>{appState.replace(/_/g, ' ')}</span>
            </div>
            
            <button onClick={toggleMute} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white hover:bg-black/75 transition z-20">
              {isMuted ? <Icon type="micOff" /> : <Icon type="micOn" />}
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-8 text-center text-white z-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                <p className="text-2xl font-medium transition-opacity duration-500">
                    {currentGeminiText}
                </p>
            </div>
          </div>
        );
    }
  };

  const getBackgroundColor = () => {
    if (isCheckinPhase || [AppState.ANALYZING, AppState.GENERATING_PDF].includes(appState)) return 'bg-gray-800';
    return 'bg-gray-100';
  };

  return (
    <main className={`w-full min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-500 ${getBackgroundColor()}`}>
      {renderContent()}
    </main>
  );
};

export default App;