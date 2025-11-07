import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AppState, SkinReport, DetailToVerify, UserData } from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audio';

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

const ONBOARDING_SYSTEM_INSTRUCTION = `
You are "Medzeal AI" — a friendly, professional AI guiding users through a facial skin analysis check-up.

YOUR PERSONA:
- You are professional, reassuring, and clear.
- Your language is simple and direct. Avoid jargon.

**YOUR TASK: GATHER AND VERIFY USER INFORMATION**
1.  **Greeting**: Start warmly. "Hi! I’m your Medzeal AI assistant. To create your personalized skin report, I just need a few details. First, can I get your full name, please?"
2.  **Name Verification**:
    -   Once the user provides a name, the app will display it.
    -   You MUST say: "Thank you. I have your name as {user's name}. Is that correct on your screen?"
    -   If 'no', respond: "My apologies. Could you please spell your full name for me?" After spelling, confirm again.
3.  **Phone Number**:
    -   Once the name is confirmed, ask: “Great! Now, can you please tell me your mobile number?”
    -   After they say the number, the app will display it.
    -   You MUST say: "Okay, I have your number as {user's number}. Please check your screen, is that correct?"
    -   If 'no', ask them to repeat it slowly.
4.  **Transition to Scan (CRITICAL)**:
    -   Once the phone number is confirmed correct, you MUST say: “Thank you, {name}! We have everything we need. I'm now starting the facial scan.”
    -   Immediately after saying this, you MUST call the \`start_facial_scan\` function. Do not wait for any further user input. Just call the function.
`;

const START_SCAN_TOOL: FunctionDeclaration = {
    name: 'start_facial_scan',
    description: 'Call this function to start the camera for the facial scan once the user has confirmed they are ready.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] }
};

const ANALYSIS_SYSTEM_INSTRUCTION = `You are an expert dermatological AI assistant from Medzeal. Your task is to analyze user-submitted facial images for potential skin conditions and provide a structured report in JSON format. Analyze the provided image(s) for a wide range of dermatological conditions. Identify potential issues like: acne vulgaris (pimples, blackheads, whiteheads), cystic acne, rosacea, eczema (atopic dermatitis), hyperpigmentation (sun spots, melasma), fine lines, wrinkles, dark under-eye circles, enlarged pores, signs of dehydration, excess oiliness, and visible scarring. For each issue you identify, provide a simple, one-sentence description. Then, suggest a relevant service from the Medzeal catalog that could help address the issue. If the skin appears healthy with no major issues, state that clearly in the summary and leave the issues array empty. Structure your entire response according to the provided JSON schema.`;

const POST_REPORT_SYSTEM_INSTRUCTION = `You have just presented the user with their skin report. 
- Your first and only task is to ask them: "I've prepared your report. Would you like me to send a copy to you on WhatsApp?".
- If they say yes or agree in any affirmative way, you MUST immediately call the function 'send_report_to_whatsapp'. 
- If they say no or decline, respond politely with "Alright. Is there anything else I can help you with regarding the report?" and end the conversation.
- Do not ask any other questions.
`;

const SEND_WHATSAPP_TOOL: FunctionDeclaration = {
    name: 'send_report_to_whatsapp',
    description: 'Call this function when the user confirms they want the report sent to their WhatsApp.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] }
};

const REPORT_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A one or two sentence summary of the overall findings." },
        issues: {
            type: Type.ARRAY, description: "A list of all detected skin issues.",
            items: {
                type: Type.OBJECT,
                properties: {
                    issue: { type: Type.STRING, description: "The name of the detected issue (e.g., 'Acne Vulgaris')." },
                    description: { type: Type.STRING, description: "A brief, one-sentence description of the issue." }
                }, required: ["issue", "description"]
            }
        },
        recommendations: {
            type: Type.ARRAY, description: "A list of Medzeal services recommended to treat the detected issues.",
            items: {
                type: Type.OBJECT,
                properties: {
                    treatment: { type: Type.STRING, description: "The name of the Medzeal service or product (e.g., 'HydraFacial')." },
                    description: { type: Type.STRING, description: "A brief, one-sentence description of how this treatment helps." }
                }, required: ["treatment", "description"]
            }
        }
    }, required: ["summary", "issues", "recommendations"]
};


export const useMedzealAssistant = () => {
    const [appState, setAppState] = useState<AppState>(AppState.IDLE);
    const [currentGeminiText, setCurrentGeminiText] = useState('');
    const [report, setReport] = useState<SkinReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const [detailToVerify, setDetailToVerify] = useState<DetailToVerify | null>(null);
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    
    const userData = useRef<UserData>({ name: '', phone: ''});
    const videoRef = useRef<HTMLVideoElement>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const lastQuestionRef = useRef<'name'|'phone'|null>(null);
    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const conversationType = useRef<'onboarding' | 'post_report' | null>(null);

    const cleanupConversation = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
       
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;

        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
        }
        inputAudioContextRef.current = null;
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.error);
        }
        outputAudioContextRef.current = null;
        conversationType.current = null;
    }, []);

    const prepareAndDownloadPdf = useCallback(async () => {
        setAppState(AppState.GENERATING_PDF);
    
        const reportElement = document.getElementById('report-content');
        if (!reportElement) {
            setError("Could not find report content to generate PDF.");
            setAppState(AppState.REPORT);
            return;
        }
    
        try {
            const { jsPDF } = window.jspdf;
            const canvas = await window.html2canvas(reportElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
            const friendlyFileName = `Medzeal-AI-Report-${userData.current.name.replace(/\s/g, '_') || 'user'}.pdf`;
            
            // --- Live WhatsApp API Integration Logic ---
            // The following code demonstrates how to send the report via an API.
            // This requires hosting the generated PDF to get a public URL, which is
            // not possible in this frontend-only environment.
            // For the demo, we trigger a browser download instead.
            /*
            const WHATSAPP_API_KEY = "4nAJab0oyVlworJu1veRaGfmvkO0yxf2";
            const pdfBlob = pdf.output('blob');
            
            // Step 1: Upload pdfBlob to a hosting service (e.g., Supabase, S3) to get a public URL.
            // const publicUrl = await uploadFileAndGetUrl(pdfBlob, friendlyFileName);
    
            // Step 2: Call the WhatsApp API with the public URL.
            const payload = {
                number: "91" + userData.current.phone,
                mediatype: "document",
                mimetype: "application/pdf",
                caption: `Hi ${userData.current.name}, here is your Medzeal AI Skin Report.`,
                media: publicUrl, // The public URL from the hosting service
                fileName: friendlyFileName,
            };
    
            await fetch("https://evo.infispark.in/message/sendMedia/medfordlab", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "apikey": WHATSAPP_API_KEY
                },
                body: JSON.stringify(payload),
            });
            */
    
            pdf.save(friendlyFileName);
    
        } catch (e) {
            console.error("Failed to generate PDF:", e);
            setError("Could not generate the PDF report. Please try again.");
        } finally {
            setAppState(AppState.REPORT); 
        }
    }, []);

    const handleMessage = useCallback(async (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
            setCurrentGeminiText(prev => prev + message.serverContent.outputTranscription.text);
        } else if (message.serverContent?.inputTranscription && conversationType.current === 'onboarding') {
            const text = message.serverContent.inputTranscription.text;
            if(lastQuestionRef.current) {
                setDetailToVerify({ type: lastQuestionRef.current, value: text });
            }
        }

        if (message.toolCall?.functionCalls) {
            for(const fc of message.toolCall.functionCalls) {
                if (fc.name === 'start_facial_scan') {
                    setAppState(AppState.SCANNING);
                    cleanupConversation();
                }
                if (fc.name === 'send_report_to_whatsapp') {
                    cleanupConversation();
                    prepareAndDownloadPdf();
                }
            }
        }
    
        if (message.serverContent?.turnComplete) {
            if (conversationType.current === 'onboarding') {
                const outputText = currentGeminiText.toLowerCase();
                const inputText = detailToVerify?.value || '';
        
                const isAskingForName = outputText.includes("can i get your full name");
                const isAskingForPhone = outputText.includes("can you please tell me your mobile number");
        
                if (isAskingForName) {
                    lastQuestionRef.current = 'name';
                } else if (isAskingForPhone) {
                    lastQuestionRef.current = 'phone';
                } 
                // Only process saved details if the AI is not asking a new question.
                // This prevents a race condition where the old detail is saved for the new question.
                else if (inputText && lastQuestionRef.current) {
                    if (lastQuestionRef.current === 'name') {
                        userData.current.name = inputText;
                    } else if (lastQuestionRef.current === 'phone') {
                        userData.current.phone = inputText;
                    }
                    lastQuestionRef.current = null;
                }
            }
            
            setTimeout(() => {
                setCurrentGeminiText('');
                setDetailToVerify(null);
            }, 2000);
        }
    
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && outputAudioContextRef.current) {
            setIsAssistantSpeaking(true);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContextRef.current.destination);
            
            const currentTime = outputAudioContextRef.current.currentTime;
            const startTime = Math.max(currentTime, nextAudioStartTimeRef.current);
            
            source.start(startTime);
            nextAudioStartTimeRef.current = startTime + audioBuffer.duration;
            audioSourcesRef.current.add(source);
            source.onended = () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                    setIsAssistantSpeaking(false);
                }
            };
        }
    }, [currentGeminiText, detailToVerify, cleanupConversation, prepareAndDownloadPdf]);

    const startConversation = useCallback(async (type: 'onboarding' | 'post_report') => {
        cleanupConversation();
        conversationType.current = type;
        
        setAppState(type === 'onboarding' ? AppState.CONNECTING : AppState.POST_REPORT_CONVERSATION);
        setError(null);
        if (type === 'onboarding') {
            setReport(null);
            setCapturedImages([]);
            userData.current = { name: '', phone: ''};
        }
        
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            setError("The API key is missing. Please ensure it is configured correctly.");
            setAppState(AppState.ERROR);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey });
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const isOnboarding = type === 'onboarding';

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setAppState(isOnboarding ? AppState.GATHERING_DETAILS : AppState.POST_REPORT_CONVERSATION);
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                if (!isMuted) session.sendRealtimeInput({ media: pcmBlob });
                            }).catch(console.error);
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: handleMessage,
                    onerror: (e: ErrorEvent) => {
                        console.error('API Error:', e);
                        setError('Connection error. Please check your internet connection and try again.');
                        setAppState(AppState.ERROR);
                        cleanupConversation();
                    },
                    onclose: () => { 
                        cleanupConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: isOnboarding ? ONBOARDING_SYSTEM_INSTRUCTION : POST_REPORT_SYSTEM_INSTRUCTION,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{functionDeclarations: isOnboarding ? [START_SCAN_TOOL] : [SEND_WHATSAPP_TOOL]}]
                },
            });
        } catch (err) {
            console.error('Permission or setup error:', err);
            setError('Could not access microphone. Please check permissions and refresh.');
            setAppState(AppState.DENIED);
        }
    }, [handleMessage, isMuted, cleanupConversation]);

    const analyzeImages = useCallback(async () => {
        if(capturedImages.length === 0) return;
        setAppState(AppState.ANALYZING);

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            setError("The API key is missing. Please ensure it is configured correctly.");
            setAppState(AppState.ERROR);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            const imageParts = capturedImages.map(imgBase64 => ({
                inlineData: { mimeType: 'image/jpeg', data: imgBase64, },
            }));

            const userContext = { text: `This analysis is for user ${userData.current.name}.` };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [userContext, ...imageParts] },
                config: {
                    systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json",
                    responseSchema: REPORT_SCHEMA,
                }
            });
            
            const parsedReport = JSON.parse(response.text);
            
            const newReport: SkinReport = {
                name: userData.current.name,
                phone: userData.current.phone,
                date: new Date().toLocaleString(),
                ...parsedReport
            };

            setReport(newReport);
            setAppState(AppState.REPORT);

        } catch(e) {
            console.error("Analysis failed:", e);
            setError("Sorry, the analysis could not be completed. Please try again.");
            setAppState(AppState.ERROR);
        }

    }, [capturedImages]);

    useEffect(() => {
        let videoStream: MediaStream | null = null;
        const startCamera = async () => {
            if (appState === AppState.SCANNING) {
                try {
                    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (videoRef.current) {
                        videoRef.current.srcObject = videoStream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setError("Could not access camera. Please check permissions and refresh.");
                    setAppState(AppState.DENIED);
                }
            }
        };

        startCamera();

        return () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [appState]);

    useEffect(() => {
        return () => {
            cleanupConversation();
        };
    }, [cleanupConversation]);
    
    const toggleMute = () => setIsMuted(prev => !prev);
    
    return {
        appState,
        videoRef,
        startOnboardingConversation: () => startConversation('onboarding'),
        startPostReportConversation: () => startConversation('post_report'),
        error,
        report,
        isMuted,
        toggleMute,
        isAssistantSpeaking,
        detailToVerify,
        currentGeminiText,
        capturedImages,
        setCapturedImages,
        analyzeImages
    }
}