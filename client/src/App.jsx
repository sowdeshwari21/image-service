import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import './App.css';

function App() {
    const [image, setImage] = useState(null);
    const [text, setText] = useState("");
    const [translatedText, setTranslatedText] = useState("");
    const [confidence, setConfidence] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState("");
    const [targetLanguage, setTargetLanguage] = useState("en");
    const [isListening, setIsListening] = useState(false);
    const [voiceCommandLanguage, setVoiceCommandLanguage] = useState("en");
    const recognitionRef = useRef(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const currentUtteranceRef = useRef(null);
    const [recognitionError, setRecognitionError] = useState(null);
    const [summary, setSummary] = useState("");
    const [isSummarizing, setIsSummarizing] = useState(false);
    
    // Available languages for translation - with proper language codes for voice mapping
    const languages = [
        { code: "en", name: "English", voiceCode: "en" },
        { code: "ta", name: "Tamil", voiceCode: "ta" },
        { code: "hi", name: "Hindi", voiceCode: "hi" },
        { code: "es", name: "Spanish", voiceCode: "es" },
        { code: "fr", name: "French", voiceCode: "fr" },
        { code: "de", name: "German", voiceCode: "de" },
        { code: "zh", name: "Chinese", voiceCode: "zh" },
        { code: "ja", name: "Japanese", voiceCode: "ja" },
        { code: "ar", name: "Arabic", voiceCode: "ar" },
    ];
    
    // Enhanced voice command phrases with translate and summarize commands
    const voiceCommands = {
        "en": {
            read: ["read", "speak", "play", "start"],
            stop: ["stop", "end"],
            pause: ["pause", "wait", "hold"],
            continue: ["continue", "resume", "go on"],
            translateTo: ["translate to", "read in", "speak in", "convert to"],
            summarize: ["summarize", "summary", "make it short", "brief"]
        },
        "ta": {
            read: ["படி", "வாசி", "பேசு", "ஒலிபரப்பு", "தொடங்கு"],
            stop: ["நிறுத்து", "முடி"],
            pause: ["இடைநிறுத்து", "பாஸ்", "காத்திரு"],
            continue: ["தொடர்", "தொடரவும்", "மீண்டும் தொடங்கு"],
            translateTo: ["மொழிபெயர்", "மொழியில் படி", "மொழியில் பேசு"],
            summarize: ["சுருக்கு", "சுருக்கம்", "சுருக்கமாக"]
        },
        "hi": {
            read: ["पढ़ो", "बोलो", "शुरू करो", "चालू करो"],
            stop: ["रुको", "बंद करो", "समाप्त"],
            pause: ["ठहरो", "रुक जाओ", "पॉज़"],
            continue: ["जारी रखो", "फिर से शुरू करो", "चालू करो"],
            translateTo: ["अनुवाद करो", "भाषा में पढ़ो", "भाषा में बोलो"],
            summarize: ["सारांश", "संक्षेप में बताओ", "छोटा करो"]
        },
        "es": {
            read: ["leer", "hablar", "reproducir", "iniciar"],
            stop: ["parar", "terminar"],
            pause: ["pausar", "esperar", "detener"],
            continue: ["continuar", "reanudar", "seguir"],
            translateTo: ["traducir a", "leer en", "hablar en", "convertir a"],
            summarize: ["resumir", "resumen", "hacerlo corto", "breve"]
        },
        "fr": {
            read: ["lire", "parler", "jouer", "commencer"],
            stop: ["arrêter", "terminer"],
            pause: ["pause", "attendre", "suspendre"],
            continue: ["continuer", "reprendre", "poursuivre"],
            translateTo: ["traduire en", "lire en", "parler en", "convertir en"],
            summarize: ["résumer", "résumé", "rendre court", "bref"]
        }
    };

    useEffect(() => {
        // Get available voices when component mounts
        const getVoices = () => {
            const availableVoices = speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
                setSelectedVoice(availableVoices[0].name);
            }
        };
        
        speechSynthesis.onvoiceschanged = getVoices;
        getVoices();
        
        return () => {
            speechSynthesis.cancel(); // Cleanup any ongoing speech
        };
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            
            // Create image preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = async () => {
        if (!image) return alert("Please upload an image!");

        setIsLoading(true);
        setText(""); // Clear previous text
        setConfidence(null); // Clear previous confidence
        const formData = new FormData();
        formData.append("image", image);

        try {
            const response = await axios.post("http://localhost:3000/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 60000 // Increase timeout to 60 seconds for OCR processing
            });
            setText(response.data.text);
            // Set confidence to the value from response or default to null if not provided
            setConfidence(response.data.confidence || null);
        } catch (error) {
            console.error("Error uploading image", error);
            let errorMessage = "Failed to process image. Please try again.";
            
            if (error.code === 'ERR_NETWORK') {
                errorMessage = "Network error: The server appears to be offline or unreachable. Please make sure the backend server is running at http://localhost:3000";
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = "Request timed out. The server took too long to respond.";
            } else if (error.response) {
                // The server responded with a status code outside the 2xx range
                errorMessage = `Server error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`;
            }
            
            alert(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTranslate = async () => {
        if (!text) return;
        
        if (targetLanguage === "en") {
            // If target is English and we already have English text, no need to translate
            setTranslatedText(text);
            return;
        }
        
        setIsTranslating(true);
        
        try {
            const response = await axios.post("http://localhost:3000/translate", {
                text: text,
                targetLang: targetLanguage
            }, {
                timeout: 15000 // 15 second timeout for translation
            });
            
            if (response.data && response.data.translatedText) {
                setTranslatedText(response.data.translatedText);
                
                // Log the translation engine used
                console.log(`Translation provided by: ${response.data.engine}`);
                
                // If source language was detected, log it
                if (response.data.from) {
                    console.log(`Detected source language: ${response.data.from}`);
                }
            } else {
                // Fallback to original text if no translation
                setTranslatedText(text);
                console.warn("No translation received, using original text");
            }
        } catch (error) {
            console.error("Translation error", error);
            setTranslatedText(text);
            
            if (error.code === 'ERR_NETWORK') {
                alert("Translation service is currently unavailable. Using original text.");
            }
        } finally {
            setIsTranslating(false);
        }
    };

    useEffect(() => {
        // Automatically translate when text or target language changes
        if (text && targetLanguage) {
            handleTranslate();
        }
    }, [text, targetLanguage]);
    
    // Enhanced playText function for better language-specific voice selection
    const playText = () => {
        const textToSpeak = translatedText || text;
        if (!textToSpeak) return;
        
        // If already speaking and paused, resume
        if (isSpeaking && isPaused) {
            resumeSpeech();
            return;
        }
        
        // Cancel any existing speech
        stopSpeech();
        
        // Create new utterance
        const speech = new SpeechSynthesisUtterance(textToSpeak);
        
        // Track speech state more reliably
        speech.onstart = () => {
            console.log("Speech started");
            setIsSpeaking(true);
            setIsPaused(false);
        };
        
        speech.onend = () => {
            console.log("Speech ended");
            setIsSpeaking(false);
            setIsPaused(false);
            currentUtteranceRef.current = null;
        };
        
        speech.onpause = () => {
            console.log("Speech paused");
            setIsPaused(true);
        };
        
        speech.onresume = () => {
            console.log("Speech resumed");
            setIsPaused(false);
        };
        
        speech.onerror = (event) => {
            console.error("Speech synthesis error:", event);
            setIsSpeaking(false);
            setIsPaused(false);
            currentUtteranceRef.current = null;
        };
        
        // Get the voice code for the selected target language
        const selectedLanguage = languages.find(lang => lang.code === targetLanguage);
        const voiceCode = selectedLanguage?.voiceCode || 'en';
        
        // Try to find a matching voice for the translated language
        let matchedVoice = null;
        
        // First try: exact match for language code
        const exactMatches = voices.filter(voice => 
            voice.lang.toLowerCase().startsWith(voiceCode.toLowerCase())
        );
        
        if (exactMatches.length > 0) {
            // Found exact language match
            matchedVoice = exactMatches[0];
            console.log(`Found exact voice match: ${matchedVoice.name} (${matchedVoice.lang})`);
        } else {
            // Second try: for languages like Tamil that might not have exact matches
            // Try matching based on common patterns or partial matches
            if (voiceCode === 'ta') {
                // For Tamil, try to find an Indian English voice as fallback
                const indianVoices = voices.filter(voice => 
                    voice.lang.includes('IN') || voice.name.includes('Indian')
                );
                if (indianVoices.length > 0) {
                    matchedVoice = indianVoices[0];
                    console.log(`Found Tamil fallback voice: ${matchedVoice.name} (${matchedVoice.lang})`);
                }
            } else if (voiceCode === 'hi') {
                // Similar approach for Hindi
                const indianVoices = voices.filter(voice => 
                    voice.lang.includes('IN') || voice.name.includes('Indian')
                );
                if (indianVoices.length > 0) {
                    matchedVoice = indianVoices[0];
                }
            }
        }
        
        // If still no match, use the user-selected voice
        if (!matchedVoice) {
            matchedVoice = voices.find(v => v.name === selectedVoice);
            console.log(`Using manually selected voice: ${matchedVoice?.name}`);
        }
        
        if (matchedVoice) {
            speech.voice = matchedVoice;
        }
        
        // Set language attribute explicitly to help with pronunciation
        speech.lang = matchedVoice?.lang || voiceCode;
        
        speech.rate = 1.0;
        speech.pitch = 1.0;
        
        // Log available voices for debugging
        console.log("Available voices for", voiceCode, ":", voices
            .filter(v => v.lang.toLowerCase().includes(voiceCode.substring(0, 2).toLowerCase()))
            .map(v => `${v.name} (${v.lang})`));
        
        // Store the utterance for pause/resume control
        currentUtteranceRef.current = speech;
        
        try {
            // Add global reference to current utterance for better pause/resume handling
            window.currentSpeech = speech;
            
            // Check for browser support for pause/resume
            const pauseSupported = typeof speechSynthesis.pause === 'function';
            const resumeSupported = typeof speechSynthesis.resume === 'function';
            console.log(`Browser speech capabilities - pause: ${pauseSupported}, resume: ${resumeSupported}`);
            
            speechSynthesis.speak(speech);
            console.log("Started speaking");
        } catch (error) {
            console.error("Error starting speech:", error);
            alert("Unable to start speech synthesis. Try a different browser.");
        }
    };

    // More reliable pause function
    const pauseSpeech = () => {
        console.log("Attempting to pause speech, state:", { isSpeaking, isPaused });
        if (isSpeaking && !isPaused) {
            try {
                // Some browsers don't support pause/resume
                if (typeof speechSynthesis.pause !== 'function') {
                    throw new Error("Speech pause not supported in this browser");
                }
                
                speechSynthesis.pause();
                console.log("Speech paused successfully");
                setIsPaused(true);
            } catch (error) {
                console.error("Error pausing speech:", error);
                
                // Create manual pause/resume by storing current position
                try {
                    // Custom pause implementation: remember position, then stop
                    const currentText = translatedText || text;
                    if (currentText && window.currentSpeech) {
                        // Save position info for later resuming
                        const approxPosition = currentText.length * 0.5; // Rough estimate
                        sessionStorage.setItem('speech-position', approxPosition);
                        sessionStorage.setItem('speech-text', currentText);
                        
                        // Stop current speech
                        speechSynthesis.cancel();
                        setIsPaused(true);
                        setIsSpeaking(true); // Keep speaking status true even though we cancelled
                        console.log("Used custom pause implementation");
                    } else {
                        // If we can't estimate position, just stop
                        stopSpeech();
                        alert("Pausing not supported in this browser. Speech has been stopped.");
                    }
                } catch (fallbackError) {
                    console.error("Fallback pause also failed:", fallbackError);
                    stopSpeech();
                    alert("Pausing failed. Speech has been stopped.");
                }
            }
        }
    };
    
    // More reliable resume function
    const resumeSpeech = () => {
        console.log("Attempting to resume speech, state:", { isSpeaking, isPaused });
        if (isSpeaking && isPaused) {
            try {
                // Some browsers don't support pause/resume
                if (typeof speechSynthesis.resume !== 'function') {
                    throw new Error("Speech resume not supported in this browser");
                }
                
                speechSynthesis.resume();
                console.log("Speech resumed successfully");
                setIsPaused(false);
            } catch (error) {
                console.error("Error resuming speech:", error);
                
                // Custom resume implementation
                try {
                    const savedText = sessionStorage.getItem('speech-text');
                    const position = sessionStorage.getItem('speech-position');
                    
                    if (savedText && position) {
                        // Create a new utterance for the remaining text
                        const remainingText = savedText.substring(parseInt(position));
                        const speech = new SpeechSynthesisUtterance(remainingText);
                        
                        // Copy voice settings from current settings
                        const selectedLanguage = languages.find(lang => lang.code === targetLanguage);
                        const voiceCode = selectedLanguage?.voiceCode || 'en';
                        const matchedVoice = voices.find(v => v.name === selectedVoice) || 
                            voices.find(v => v.lang.toLowerCase().startsWith(voiceCode.toLowerCase()));
                        
                        if (matchedVoice) {
                            speech.voice = matchedVoice;
                            speech.lang = matchedVoice.lang;
                        }
                        
                        // Set event handlers
                        speech.onend = () => {
                            setIsSpeaking(false);
                            setIsPaused(false);
                            sessionStorage.removeItem('speech-text');
                            sessionStorage.removeItem('speech-position');
                        };
                        
                        // Start speaking again
                        speechSynthesis.speak(speech);
                        setIsPaused(false);
                        console.log("Used custom resume implementation");
                    } else {
                        // If no saved position, just restart
                        setIsPaused(false);
                        playText();
                    }
                } catch (fallbackError) {
                    console.error("Fallback resume also failed:", fallbackError);
                    // If resume fails, just restart speech
                    stopSpeech();
                    setTimeout(playText, 100);
                }
            }
        }
    };
    
    // More reliable stop function
    const stopSpeech = () => {
        try {
            speechSynthesis.cancel();
            console.log("Speech stopped successfully");
            
            // Clear any saved pause/resume state
            sessionStorage.removeItem('speech-text');
            sessionStorage.removeItem('speech-position');
            window.currentSpeech = null;
        } catch (error) {
            console.error("Error stopping speech:", error);
        }
        setIsSpeaking(false);
        setIsPaused(false);
        currentUtteranceRef.current = null;
    };

    // Fix speech recognition initialization - improved version
    useEffect(() => {
        // Check if browser supports SpeechRecognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error("Speech recognition not supported in this browser");
            setRecognitionError("Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.");
            return;
        }
        
        // Create a single recognition instance that we can reuse
        let recognition = null;
        
        const startRecognition = () => {
            // If recognition is already running, stop it first
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (error) {
                    console.warn("Error stopping previous recognition instance:", error);
                }
            }
            
            // Create new instance
            recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            
            // Configure the recognition
            recognition.continuous = false; // Changed to false to prevent looping issues
            recognition.interimResults = false; // Only get final results
            recognition.maxAlternatives = 1; // Just get the most likely result
            
            // Set language with better formatting
            try {
                const langMap = {
                    'en': 'en-US',
                    'ta': 'ta-IN',
                    'hi': 'hi-IN',
                    'es': 'es-ES',
                    'fr': 'fr-FR',
                    'de': 'de-DE',
                    'zh': 'zh-CN',
                    'ja': 'ja-JP',
                    'ar': 'ar-SA'
                };
                
                recognition.lang = langMap[voiceCommandLanguage] || 'en-US';
                console.log(`Speech recognition language set to: ${recognition.lang}`);
                setRecognitionError(null);
            } catch (error) {
                console.error("Error setting speech recognition language:", error);
                recognition.lang = 'en-US'; // Fallback to English
            }
            
            // Result handler
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.trim().toLowerCase();
                console.log(`Voice command detected: "${transcript}" (${voiceCommandLanguage})`);
                
                // Process commands
                const commands = voiceCommands[voiceCommandLanguage];
                
                // Check for specific commands
                if (commands.read.some(cmd => transcript.includes(cmd))) {
                    console.log("Read command detected");
                    playText();
                } else if (commands.stop.some(cmd => transcript.includes(cmd))) {
                    console.log("Stop command detected");
                    stopSpeech();
                } else if (commands.pause.some(cmd => transcript.includes(cmd))) {
                    console.log("Pause command detected");
                    pauseSpeech();
                } else if (commands.continue.some(cmd => transcript.includes(cmd))) {
                    console.log("Continue command detected");
                    resumeSpeech();
                } else if (commands.summarize.some(cmd => transcript.includes(cmd))) {
                    console.log("Summarize command detected");
                    handleSummarize();
                } else {
                    // Check for complex translation commands like "translate to spanish"
                    const isTranslateCommand = commands.translateTo.some(cmd => transcript.includes(cmd));
                    
                    if (isTranslateCommand) {
                        console.log("Translation command detected");
                        
                        // Look for language name in the command
                        const languageMatch = findLanguageInCommand(transcript);
                        
                        if (languageMatch) {
                            console.log(`Detected language in command: ${languageMatch.name}`);
                            handleVoiceTranslation(languageMatch.code);
                        } else {
                            console.log("No specific language found in command");
                            // Default behavior if no language is specified
                            playText();
                        }
                    } else {
                        console.log("No command matched");
                    }
                }
            };
            
            // Error handler
            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                
                if (event.error === 'not-allowed') {
                    setRecognitionError("Microphone access denied. Please allow microphone access in your browser settings.");
                    setIsListening(false);
                } else if (event.error === 'audio-capture') {
                    setRecognitionError("No microphone found. Please connect a microphone and try again.");
                    setIsListening(false);
                } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    setRecognitionError(`Recognition error: ${event.error}`);
                    setIsListening(false);
                }
            };
            
            // Handle end event - controlled restart to avoid loops
            recognition.onend = () => {
                console.log("Speech recognition session ended");
                
                // Only restart if we're still in listening mode
                if (isListening && recognitionRef.current === recognition) {
                    console.log("Preparing to restart recognition...");
                    
                    // Use a timer to delay restart and prevent CPU hogging
                    setTimeout(() => {
                        if (isListening) {
                            try {
                                recognition.start();
                                console.log("Recognition restarted");
                            } catch (error) {
                                console.error("Failed to restart recognition:", error);
                                setIsListening(false);
                                setRecognitionError("Failed to restart recognition. Please try again.");
                            }
                        }
                    }, 1000); // Longer delay to prevent rapid restart loops
                } else {
                    console.log("Not restarting recognition (listening mode inactive)");
                }
            };
            
            // Start recognition
            try {
                recognition.start();
                console.log("Speech recognition started successfully");
            } catch (error) {
                console.error("Failed to start speech recognition:", error);
                setIsListening(false);
                setRecognitionError("Failed to start speech recognition. Please refresh the page and try again.");
            }
        };
        
        // Start or stop recognition based on isListening state
        if (isListening) {
            startRecognition();
        } else {
            // Stop recognition if it's running
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                    console.log("Recognition stopped");
                } catch (error) {
                    console.error("Error stopping recognition:", error);
                }
            }
        }
        
        // Cleanup function
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                    console.log("Recognition cleaned up");
                } catch (error) {
                    console.error("Error cleaning up recognition:", error);
                }
            }
        };
    }, [isListening, voiceCommandLanguage]);

    // Add a more user-friendly toggle with status indicator and feedback
    const toggleVoiceCommands = () => {
        if (isListening) {
            console.log("Disabling voice commands");
            setIsListening(false);
        } else {
            console.log("Enabling voice commands");
            setIsListening(true);
            
            // Show user feedback about microphone access
            if (!recognitionError) {
                // This is shown temporarily to guide the user
                setRecognitionError("Please allow microphone access if prompted by your browser.");
                setTimeout(() => {
                    if (isListening) {
                        setRecognitionError(null);
                    }
                }, 3000);
            }
        }
    };

    // Function to summarize text - improved with better error handling
    const summarizeText = async (textToSummarize) => {
        if (!textToSummarize || textToSummarize.trim().length === 0) {
            console.warn("No text to summarize");
            return textToSummarize;
        }
        
        setIsSummarizing(true);
        console.log("Attempting to summarize text of length:", textToSummarize.length);
        
        try {
            // Check if the server is responding first
            const serverCheck = await axios.get("http://localhost:3000/", { timeout: 2000 })
                .catch(() => null);
            
            if (!serverCheck) {
                console.warn("Server unreachable, using client-side fallback");
                throw new Error("Server unreachable");
            }
            
            // Try server summarization
            const response = await axios.post("http://localhost:3000/summarize", {
                text: textToSummarize
            }, {
                timeout: 20000 // Increase timeout for larger texts
            });
            
            if (response.data && response.data.summary) {
                console.log("Summary received from server");
                const summaryText = response.data.summary;
                setSummary(summaryText);
                return summaryText;
            } else {
                throw new Error("No summary in response");
            }
        } catch (error) {
            console.error("Summarization error, using client fallback:", error);
            // Client-side fallback summarization
            const fallbackSummary = getFallbackSummary(textToSummarize);
            setSummary(fallbackSummary);
            return fallbackSummary;
        } finally {
            setIsSummarizing(false);
        }
    };
    
    // Helper function for fallback summarization
    const getFallbackSummary = (text) => {
        if (!text) return "";
        
        // Try to split by sentences and get first few
        const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
        if (sentences.length > 0) {
            // Take first 2-3 sentences depending on length
            const numSentences = sentences.length <= 5 ? 2 : 3;
            return sentences.slice(0, numSentences).join(" ");
        }
        
        // If sentence splitting fails, just take first 150 chars
        return text.length > 150 ? text.substring(0, 150) + "..." : text;
    };

    // Improved handle summarize command
    const handleSummarize = async () => {
        // Use the original text for summarization
        const textToSummarize = text;
        
        if (!textToSummarize || textToSummarize.trim().length === 0) {
            alert("No text to summarize.");
            return;
        }
        
        // Show user we're summarizing
        const originalText = text;
        setText("Summarizing text...");
        
        try {
            // Wait longer for summarization
            const summaryResult = await summarizeText(textToSummarize);
            
            if (!summaryResult) {
                throw new Error("Failed to generate summary");
            }
            
            // Display the summary
            setText(summaryResult);
            console.log("Summary displayed, preparing to speak");
            
            // Add a visual indicator that this is a summary
            setTranslatedText("SUMMARY: " + summaryResult);
            
            // Speak the summary
            setTimeout(() => {
                playText();
                
                // After a longer delay, restore the original text
                setTimeout(() => {
                    setText(originalText);
                    // Clear the summary indicator
                    setTranslatedText("");
                    // Trigger a new translation
                    handleTranslate();
                    console.log("Restored original text");
                }, 15000); // 15 seconds to read summary before restoring
            }, 800);
        } catch (error) {
            console.error("Error in summarize process:", error);
            setText(originalText); // Restore original on error
            alert("Failed to summarize the text. Please try again.");
        }
    };

    // Function to find language name in voice command
    const findLanguageInCommand = (transcript) => {
        for (const lang of languages) {
            // Check for language name in the command (case insensitive)
            if (transcript.toLowerCase().includes(lang.name.toLowerCase())) {
                return lang;
            }
            
            // Additional checks for common language variations
            if (lang.code === 'es' && transcript.includes('spanish')) return lang;
            if (lang.code === 'fr' && transcript.includes('french')) return lang;
            if (lang.code === 'de' && transcript.includes('german')) return lang;
            if (lang.code === 'hi' && (transcript.includes('hindi') || transcript.includes('indian'))) return lang;
            if (lang.code === 'ta' && (transcript.includes('tamil') || transcript.includes('tamizh'))) return lang;
            if (lang.code === 'zh' && (transcript.includes('chinese') || transcript.includes('mandarin'))) return lang;
            if (lang.code === 'ja' && transcript.includes('japanese')) return lang;
            if (lang.code === 'ar' && transcript.includes('arabic')) return lang;
        }
        
        return null;
    };

    // Handle voice translation command
    const handleVoiceTranslation = (langCode) => {
        if (langCode && langCode !== targetLanguage) {
            // Change target language
            setTargetLanguage(langCode);
            // The translation will happen automatically via useEffect
            
            // Wait for translation to complete before speaking
            const checkAndSpeak = () => {
                if (!isTranslating) {
                    playText();
                } else {
                    // Check again in 500ms
                    setTimeout(checkAndSpeak, 500);
                }
            };
            
            // Start checking after a short delay
            setTimeout(checkAndSpeak, 500);
        } else {
            // If already in the target language, just speak
            playText();
        }
    };

    // Enhanced recognition with improved translation and summarization commands
    useEffect(() => {
        // Check if browser supports SpeechRecognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error("Speech recognition not supported in this browser");
            setRecognitionError("Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.");
            return;
        }
        
        // Create a single recognition instance that we can reuse
        let recognition = null;
        
        const startRecognition = () => {
            // If recognition is already running, stop it first
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (error) {
                    console.warn("Error stopping previous recognition instance:", error);
                }
            }
            
            // Create new instance
            recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            
            // Configure the recognition
            recognition.continuous = false; // Changed to false to prevent looping issues
            recognition.interimResults = false; // Only get final results
            recognition.maxAlternatives = 3; // Get multiple alternatives for better matching
            
            // Set language with better formatting
            try {
                const langMap = {
                    'en': 'en-US',
                    'ta': 'ta-IN',
                    'hi': 'hi-IN',
                    'es': 'es-ES',
                    'fr': 'fr-FR',
                    'de': 'de-DE',
                    'zh': 'zh-CN',
                    'ja': 'ja-JP',
                    'ar': 'ar-SA'
                };
                
                recognition.lang = langMap[voiceCommandLanguage] || 'en-US';
                console.log(`Speech recognition language set to: ${recognition.lang}`);
                setRecognitionError(null);
            } catch (error) {
                console.error("Error setting speech recognition language:", error);
                recognition.lang = 'en-US'; // Fallback to English
            }
            
            // Enhanced result handler with better command matching
            recognition.onresult = (event) => {
                // Check if there are results
                if (!event.results || event.results.length === 0) {
                    console.warn("No speech recognition results received");
                    return;
                }
                
                // Get all alternatives from the first result
                const alternatives = [];
                for (let i = 0; i < event.results[0].length; i++) {
                    alternatives.push(event.results[0][i].transcript.trim().toLowerCase());
                }
                
                console.log(`Voice command detected. Alternatives:`, alternatives);
                const transcript = alternatives[0]; // Use the first (best match) by default
                
                // Debug all alternatives to help troubleshoot recognition issues
                alternatives.forEach((alt, i) => {
                    console.log(`Alternative ${i+1}: "${alt}" (confidence: ${event.results[0][i].confidence.toFixed(3)})`);
                });
                
                // Process commands
                const commands = voiceCommands[voiceCommandLanguage];
                
                // IMPROVED: Check for translate commands first with more flexible matching
                let isTranslateCommand = false;
                let targetLangMatch = null;
                
                // Check all alternatives for better chance of catching the command
                for (const alt of alternatives) {
                    // Check for translation command patterns
                    if (commands.translateTo.some(cmd => alt.includes(cmd))) {
                        isTranslateCommand = true;
                        console.log("Translation command detected in: ", alt);
                        
                        // Look for language name in the command
                        for (const lang of languages) {
                            if (alt.includes(lang.name.toLowerCase())) {
                                targetLangMatch = lang;
                                console.log(`Found language match: ${lang.name} (${lang.code})`);
                                break;
                            }
                        }
                        
                        // Additional special cases for common language mentions
                        if (!targetLangMatch) {
                            if (alt.includes('tamil')) targetLangMatch = languages.find(l => l.code === 'ta');
                            else if (alt.includes('hindi')) targetLangMatch = languages.find(l => l.code === 'hi');
                            else if (alt.includes('spanish')) targetLangMatch = languages.find(l => l.code === 'es');
                            else if (alt.includes('french')) targetLangMatch = languages.find(l => l.code === 'fr');
                            else if (alt.includes('german')) targetLangMatch = languages.find(l => l.code === 'de');
                            else if (alt.includes('chinese')) targetLangMatch = languages.find(l => l.code === 'zh');
                            else if (alt.includes('japanese')) targetLangMatch = languages.find(l => l.code === 'ja');
                            else if (alt.includes('arabic')) targetLangMatch = languages.find(l => l.code === 'ar');
                            else if (alt.includes('english')) targetLangMatch = languages.find(l => l.code === 'en');
                            
                            if (targetLangMatch) {
                                console.log(`Found language match using specific check: ${targetLangMatch.name}`);
                            }
                        }
                        
                        if (targetLangMatch) break; // Exit loop if we found a match
                    }
                }
                
                // If translation command was found with a target language
                if (isTranslateCommand && targetLangMatch) {
                    console.log(`Executing translation command to ${targetLangMatch.name}`);
                    // Change target language
                    setTargetLanguage(targetLangMatch.code);
                    
                    // Wait for translation to complete before speaking
                    setTimeout(() => {
                        // Check if translation is still in progress
                        if (!isTranslating) {
                            playText();
                        } else {
                            // If still translating, check again after a delay
                            console.log("Translation in progress, waiting before speaking...");
                            const interval = setInterval(() => {
                                if (!isTranslating) {
                                    clearInterval(interval);
                                    playText();
                                }
                            }, 500);
                            
                            // Clear interval after 10 seconds as a safety measure
                            setTimeout(() => clearInterval(interval), 10000);
                        }
                    }, 800);
                    
                    return; // Exit after handling translation command
                }
                
                // If not a translation command, check for other commands
                // Check for summarize command
                let isSummarizeCommand = false;
                for (const alt of alternatives) {
                    if (commands.summarize.some(cmd => alt.includes(cmd))) {
                        isSummarizeCommand = true;
                        console.log("Summarize command detected in:", alt);
                        break;
                    }
                }
                
                if (isSummarizeCommand) {
                    console.log("Executing summarize command");
                    handleSummarize();
                    return;
                }
                
                // Check for pause command
                let isPauseCommand = false;
                for (const alt of alternatives) {
                    if (commands.pause.some(cmd => alt.includes(cmd))) {
                        isPauseCommand = true;
                        console.log("Pause command detected in:", alt);
                        break;
                    }
                }
                
                if (isPauseCommand && isSpeaking && !isPaused) {
                    console.log("Executing pause command");
                    pauseSpeech();
                    return;
                }
                
                // Check for continue/resume command
                let isContinueCommand = false;
                for (const alt of alternatives) {
                    if (commands.continue.some(cmd => alt.includes(cmd))) {
                        isContinueCommand = true;
                        console.log("Continue command detected in:", alt);
                        break;
                    }
                }
                
                if (isContinueCommand && isSpeaking && isPaused) {
                    console.log("Executing continue command");
                    resumeSpeech();
                    return;
                }
                
                // Check for stop command
                let isStopCommand = false;
                for (const alt of alternatives) {
                    if (commands.stop.some(cmd => alt.includes(cmd))) {
                        isStopCommand = true;
                        console.log("Stop command detected in:", alt);
                        break;
                    }
                }
                
                if (isStopCommand) {
                    console.log("Executing stop command");
                    stopSpeech();
                    return;
                }
                
                // Check for read command
                let isReadCommand = false;
                for (const alt of alternatives) {
                    if (commands.read.some(cmd => alt.includes(cmd))) {
                        isReadCommand = true;
                        console.log("Read command detected in:", alt);
                        break;
                    }
                }
                
                if (isReadCommand) {
                    console.log("Executing read command");
                    playText();
                    return;
                }
                
                console.log("No command matched");
            };
            
            // Error handler
            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                
                if (event.error === 'not-allowed') {
                    setRecognitionError("Microphone access denied. Please allow microphone access in your browser settings.");
                    setIsListening(false);
                } else if (event.error === 'audio-capture') {
                    setRecognitionError("No microphone found. Please connect a microphone and try again.");
                    setIsListening(false);
                } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    setRecognitionError(`Recognition error: ${event.error}`);
                    setIsListening(false);
                }
            };
            
            // Handle end event - more reliable restart logic
            recognition.onend = () => {
                console.log("Speech recognition session ended");
                
                // Only restart if we're still in listening mode
                if (isListening && recognitionRef.current === recognition) {
                    console.log("Preparing to restart recognition...");
                    
                    // Use a timer to delay restart and prevent CPU hogging
                    setTimeout(() => {
                        if (isListening) {
                            try {
                                recognition.start();
                                console.log("Recognition restarted");
                            } catch (error) {
                                console.error("Failed to restart recognition:", error);
                                setIsListening(false);
                                setRecognitionError("Failed to restart recognition. Please try again.");
                            }
                        }
                    }, 1000); // Longer delay to prevent rapid restart loops
                } else {
                    console.log("Not restarting recognition (listening mode inactive)");
                }
            };
            
            // Start recognition
            try {
                recognition.start();
                console.log("Speech recognition started successfully");
            } catch (error) {
                console.error("Failed to start speech recognition:", error);
                setIsListening(false);
                setRecognitionError("Failed to start speech recognition. Please refresh the page and try again.");
            }
        };
        
        // Start or stop recognition based on isListening state
        if (isListening) {
            startRecognition();
        } else {
            // Stop recognition if it's running
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                    console.log("Recognition stopped");
                } catch (error) {
                    console.error("Error stopping recognition:", error);
                }
            }
        }
        
        // Cleanup function
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                    console.log("Recognition cleaned up");
                } catch (error) {
                    console.error("Error cleaning up recognition:", error);
                }
            }
        };
    }, [isListening, voiceCommandLanguage]);

    return (
        <div className="container">
            <header>
                <h1>Image to Speech Converter</h1>
                <p>Extract text from images and convert to speech</p>
            </header>
            
            <main>
                <section className="upload-section">
                    <div className="file-input-container">
                        <label htmlFor="file-upload" className="custom-file-upload">
                            Choose Image
                        </label>
                        <input 
                            id="file-upload" 
                            type="file" 
                            onChange={handleFileChange} 
                            accept="image/*"
                        />
                        <span>{image ? image.name : "No file selected"}</span>
                    </div>
                    
                    <button 
                        className="primary-button" 
                        onClick={handleUpload} 
                        disabled={!image || isLoading}
                    >
                        {isLoading ? "Processing... (This may take a minute)" : "Extract Text"}
                    </button>
                </section>
                
                <div className="content-area">
                    <div className="preview-container">
                        {preview && (
                            <div className="image-preview">
                                <h3>Image Preview</h3>
                                <img src={preview} alt="Preview" />
                            </div>
                        )}
                    </div>
                    
                    <div className="text-container">
                        <h3>Extracted Text</h3>
                        {isLoading && (
                            <div className="loading-indicator">
                                OCR processing in progress... Please wait.
                            </div>
                        )}
                        {confidence !== null && (
                            <div className="confidence-indicator">
                                Confidence: {confidence.toFixed(2)}%
                            </div>
                        )}
                        <div className="text-box">
                            {text || (isLoading ? "Processing..." : "Extracted text will appear here")}
                        </div>
                        
                        {text && (
                            <div className="translation-container">
                                <div className="translation-controls">
                                    <label htmlFor="target-language">Translate to:</label>
                                    <select
                                        id="target-language"
                                        value={targetLanguage}
                                        onChange={(e) => setTargetLanguage(e.target.value)}
                                        className="language-select"
                                    >
                                        {languages.map(lang => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                {isTranslating ? (
                                    <div className="loading-indicator">
                                        Translating...
                                    </div>
                                ) : (
                                    <div className="translated-text-box">
                                        {translatedText || "Translation will appear here"}
                                        {translatedText && (
                                            translatedText.includes("[No translation available") || 
                                            translatedText.includes("[Translation to")
                                        ) && (
                                            <div className="translation-note">
                                                Using basic translation. Only common words will be translated.
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="voice-controls">
                                    <div className="voice-select-container">
                                        <label>Voice selection:</label>
                                        <select 
                                            value={selectedVoice}
                                            onChange={(e) => setSelectedVoice(e.target.value)}
                                            className="voice-select"
                                        >
                                            {voices.map(voice => (
                                                <option key={voice.name} value={voice.name}>
                                                    {voice.name} ({voice.lang})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="speech-controls">
                                        {!isSpeaking ? (
                                            <>
                                                <button 
                                                    className="speech-button play" 
                                                    onClick={playText}
                                                    title="Start speaking"
                                                >
                                                    <span className="button-icon">▶️</span> Play
                                                </button>
                                                
                                                <button 
                                                    className="speech-button summarize" 
                                                    onClick={handleSummarize}
                                                    disabled={isSummarizing}
                                                    title="Create a summary of the text"
                                                >
                                                    <span className="button-icon">📝</span> 
                                                    {isSummarizing ? "Summarizing..." : "Summarize"}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    className="speech-button stop" 
                                                    onClick={stopSpeech}
                                                    title="Stop speaking"
                                                >
                                                    <span className="button-icon">⏹️</span> Stop
                                                </button>
                                                
                                                {isPaused ? (
                                                    <button 
                                                        className="speech-button resume" 
                                                        onClick={resumeSpeech}
                                                        title="Resume speaking"
                                                    >
                                                        <span className="button-icon">▶️</span> Resume
                                                    </button>
                                                ) : (
                                                    <button 
                                                        className="speech-button pause" 
                                                        onClick={pauseSpeech}
                                                        title="Pause speaking"
                                                    >
                                                        <span className="button-icon">⏸️</span> Pause
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    
                                    <div className="voice-command-container">
                                        <div className="command-language">
                                            <label>Voice command language:</label>
                                            <select
                                                value={voiceCommandLanguage}
                                                onChange={(e) => setVoiceCommandLanguage(e.target.value)}
                                                className="language-select"
                                                disabled={isListening}
                                            >
                                                {languages.map(lang => (
                                                    <option key={lang.code} value={lang.code}>
                                                        {lang.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <button 
                                            className={`voice-command-button ${isListening ? 'listening' : ''}`} 
                                            onClick={toggleVoiceCommands}
                                            title={isListening ? "Disable voice commands" : "Enable voice commands"}
                                            disabled={Boolean(recognitionError) && !isListening}
                                        >
                                            {isListening ? 'Listening for commands... (Click to stop)' : 'Enable voice commands'}
                                            <span className={`microphone-icon ${isListening ? 'active' : ''}`}>🎤</span>
                                        </button>
                                        
                                        {recognitionError && (
                                            <div className="recognition-error">
                                                {recognitionError}
                                            </div>
                                        )}
                                        
                                        {isListening && (
                                            <div className="voice-hints">
                                                <p>Say "{voiceCommands[voiceCommandLanguage].read[0]}" to read the text</p>
                                                <p>Say "{voiceCommands[voiceCommandLanguage].translateTo[0]} Tamil" to translate and read in Tamil</p>
                                                <p>Say "{voiceCommands[voiceCommandLanguage].summarize[0]}" to summarize the text</p>
                                                <p>Say "{voiceCommands[voiceCommandLanguage].pause[0]}" to pause</p>
                                                <p>Say "{voiceCommands[voiceCommandLanguage].continue[0]}" to resume</p>
                                                <p>Say "{voiceCommands[voiceCommandLanguage].stop[0]}" to stop</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            
            <footer>
                <p>© 2025 OCR Text-to-Speech Tool</p>
            </footer>
        </div>
    );
}

export default App;