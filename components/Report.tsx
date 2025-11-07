import React from 'react';
import { SkinReport } from '../types';

// Simple placeholder for logo
const MedzealLogo = () => (
    <svg className="w-32 h-auto" viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25.8 48.6H17.2V16.7L11.7 20.3V13.8L21.5 8H25.8V48.6ZM34.6 48.6V8H39.2V48.6H34.6ZM55.5 48.6H46.9V42.1H55.5V48.6ZM55.5 36.8H46.9V30.2H55.5V36.8ZM55.5 24.9H46.9V18.3H55.5V24.9ZM55.5 13H46.9V6.4H55.5V13ZM73.5 49C66.8 49 61.6 43.8 61.6 37.1C61.6 30.4 66.8 25.2 73.5 25.2C80.2 25.2 85.4 30.4 85.4 37.1C85.4 43.8 80.2 49 73.5 49ZM73.5 43.7C77.3 43.7 80.3 40.7 80.3 37.1C80.3 33.5 77.3 30.5 73.5 30.5C69.7 30.5 66.7 33.5 66.7 37.1C66.7 40.7 69.7 43.7 73.5 43.7ZM99.1 48.6H90.5V16.7L85 20.3V13.8L94.8 8H99.1V48.6ZM113 48.6H104.4V8H113C119.5 8 123.9 12.3 123.9 18.5C123.9 24.7 119.5 29 113 29H109V23.7H112.4C115.9 23.7 118.5 21.4 118.5 18.5C118.5 15.6 115.9 13.3 112.4 13.3H109V43.3H113.3V34.3H118.6V48.6H113Z" fill="#1A202C"/>
        <path d="M129.2 48.6V8H133.8V48.6H129.2ZM151.7 48.6H143.1V8H151.7C158.2 8 162.6 12.3 162.6 18.5C162.6 24.7 158.2 29 151.7 29H147.7V23.7H151.1C154.6 23.7 157.2 21.4 157.2 18.5C157.2 15.6 154.6 13.3 151.1 13.3H147.7V43.3H152V34.3H157.2V48.6H151.7Z" fill="#3B82F6"/>
    </svg>
);

const ReportSection: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-3 text-2xl">{icon}</span> {title}
        </h2>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

const Report: React.FC<{ report: SkinReport; onReset: () => void; onDiscuss: () => void; }> = ({ report, onReset, onDiscuss }) => {
  return (
    <>
      {/* --- A4 Sized Report Wrapper --- */}
      <div 
        id="report-content" 
        className="w-full max-w-4xl md:w-[210mm] md:min-h-[297mm] bg-white p-8 md:p-16 rounded-lg shadow-2xl border border-gray-100 font-sans text-gray-800 mx-auto"
        style={{
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 15px rgba(0,0,0,0.07)',
        }}
      >
        {/* --- Header --- */}
        <header className="flex justify-between items-start pb-8 border-b border-gray-300">
          <div className="flex-1">
            <MedzealLogo />
            <p className="text-gray-500 mt-4 text-sm">AI-Powered Skin Analysis</p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Skin Report</h1>
            <p className="text-gray-600 mt-2 font-medium">{report.name}</p>
            <p className="text-sm text-gray-500">{report.phone}</p>
            <p className="text-sm text-gray-500 mt-1">{report.date}</p>
          </div>
        </header>

        <main className="py-10 space-y-8">
            {/* --- AI Summary --- */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-3 flex items-center">
                <span className="mr-3 text-2xl">⭐</span> AI Summary
              </h2>
              <p className="text-gray-700 leading-relaxed text-base">{report.summary}</p>
            </div>

            {/* --- Details Grid --- */}
            <div className="grid md:grid-cols-2 gap-8">
              <ReportSection title="Detected Issues" icon="⚠️">
                {report.issues.length > 0 ? (
                    report.issues.map((issue, index) => (
                      <div key={index} className="text-gray-700 pb-2 border-b border-gray-100 last:border-b-0">
                        <p className="font-semibold text-base">{issue.issue}</p>
                        <p className="text-sm text-gray-600">{issue.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">No significant issues were detected based on the analysis.</p>
                  )}
              </ReportSection>
              
              <ReportSection title="Medzeal Recommendations" icon="💊">
                 {report.recommendations.length > 0 ? (
                    report.recommendations.map((rec, index) => (
                      <div key={index} className="text-gray-700 pb-2 border-b border-gray-100 last:border-b-0">
                        <p className="font-semibold text-base">{rec.treatment}</p>
                        <p className="text-sm text-gray-600">{rec.description}</p>
                      </div>
                    ))
                  ) : (
                      <p className="text-gray-600">General skincare advice applies. No specific treatments are recommended at this time.</p>
                  )}
              </ReportSection>
            </div>
        </main>

        <footer className="pt-8 border-t border-gray-300 mt-10">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
                This is a preliminary AI analysis and not a substitute for a professional dermatological examination. 
                Please consult with a qualified dermatologist for a formal diagnosis and treatment plan.
            </p>
        </footer>
      </div>

      {/* --- Buttons (Moved Outside) --- */}
      <div className="w-full max-w-4xl text-center mt-8">
         <div className="flex flex-col sm:flex-row justify-center gap-4 flex-wrap">
            <button
                onClick={onDiscuss}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-full shadow-md hover:bg-green-700 transition-all duration-300"
            >
                Send to WhatsApp
            </button>
            <button
                onClick={onReset}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 transition-all duration-300"
            >
                Start New Check-up
            </button>
        </div>
      </div>
    </>
  );
};

export default Report;