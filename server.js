import * as dotenv from "dotenv"
dotenv.config();
import express from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import cors from "cors";
import axios from "axios";
import translate from 'google-translate-api-x';
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json()); // For parsing application/json

// Configure multer with larger limits
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // Increase to 10MB max file size
    }
});

// Add a longer timeout for the server
app.use((req, res, next) => {
    res.setTimeout(120000); // 2 minute timeout for long OCR operations
    next();
});



// Enhanced translation endpoint using google-translate-api-x
app.post("/translate", async (req, res) => {
    const { text, targetLang } = req.body;
    
    if (!text || !targetLang) {
        return res.status(400).json({ error: "Text and target language are required" });
    }
    
    console.log(`Translating text to ${targetLang}...`);
    
    try {
        // Use google-translate-api-x for high-quality translation
        const result = await translate(text, { to: targetLang });
        
        console.log("Translation successful using google-translate-api-x");
        
        // Return the translation result
        res.json({
            translatedText: result.text,
            engine: "google-translate-api",
            from: result.from.language.iso
        });
        
    } catch (error) {
        console.error("Google translate API error:", error);
        
        // Fall back to our dictionary-based translation if Google API fails
        try {
            console.log("Falling back to dictionary translation");
            const fallbackResult = simpleTranslate(text, targetLang);
            res.json(fallbackResult);
        } catch (fallbackError) {
            console.error("All translation methods failed:", fallbackError);
            res.json({
                translatedText: text,
                engine: "none",
                error: "Translation failed"
            });
        }
    }
});

// Keep the simple translate function as fallback
const simpleTranslate = (text, targetLang) => {
    // If target is English, return the original text
    if (targetLang === 'en') {
        return { translatedText: text, engine: "local-dictionary" };
    }
    
    // Basic dictionaries for common languages
    const dictionaries = {
        ta: { // Tamil
            "hello": "வணக்கம்",
            "thank you": "நன்றி",
            "welcome": "வரவேற்கிறோம்",
            "image": "படம்",
            "text": "உரை",
            "speech": "பேச்சு",
            "convert": "மாற்றவும்",
            "processing": "செயலாக்கம்",
            "extracted": "பிரித்தெடுக்கப்பட்டது"
        },
        hi: { // Hindi
            "hello": "नमस्ते",
            "thank you": "धन्यवाद",
            "welcome": "स्वागत है",
            "image": "छवि",
            "text": "पाठ",
            "speech": "भाषण",
            "convert": "परिवर्तित करें",
            "processing": "प्रसंस्करण",
            "extracted": "निकाला गया"
        },
        es: { // Spanish
            "hello": "hola",
            "thank you": "gracias",
            "welcome": "bienvenido",
            "image": "imagen",
            "text": "texto",
            "speech": "habla",
            "convert": "convertir",
            "processing": "procesando",
            "extracted": "extraído"
        },
        fr: { // French
            "hello": "bonjour",
            "thank you": "merci",
            "welcome": "bienvenue",
            "image": "image",
            "text": "texte",
            "speech": "parole",
            "convert": "convertir",
            "processing": "traitement",
            "extrait": "extrait"
        },
        // Add more languages as needed
    };
    
    // If we don't have a dictionary for this language
    if (!dictionaries[targetLang]) {
        return {
            translatedText: `[No translation available for ${targetLang}. Original text: ${text}]`,
            engine: "local-fallback"
        };
    }
    
    // Basic word-by-word translation (very simplistic)
    const words = text.toLowerCase().split(/\s+/);
    const dictionary = dictionaries[targetLang];
    
    const translatedWords = words.map(word => {
        // Remove punctuation for lookup
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        // Use translated word if available, otherwise keep original
        return dictionary[cleanWord] || word;
    });
    
    return {
        translatedText: translatedWords.join(' '),
        engine: "local-dictionary"
    };
};

app.post("/upload", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    console.log("Starting OCR processing...");
    
    try {
        const result = await Tesseract.recognize(
            req.file.buffer, 
            "eng", 
            {
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        console.log(`OCR Progress: ${(progress.progress * 100).toFixed(2)}%`);
                    }
                }
            }
        );
        
        console.log("Processing complete");
        
        // Extract confidence data from Tesseract result
        let avgConfidence = 0;
        if (result.data.words && result.data.words.length > 0) {
            const totalConfidence = result.data.words.reduce((sum, word) => sum + word.confidence, 0);
            avgConfidence = totalConfidence / result.data.words.length;
        } else {
            // If no words detected or confidence not available
            avgConfidence = result.data.confidence || 0;
        }
        
        res.json({ 
            text: result.data.text,
            confidence: avgConfidence 
        });
    } catch (error) {
        console.error("Tesseract error:", error);
        res.status(500).json({ error: "Error processing image" });
    }
});

// Improved summarization endpoint with better error handling
app.post("/summarize", async (req, res) => {
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: "Text is required" });
    }
    
    console.log("Received summarization request for text of length:", text.length);
    
    try {
        // Simple validation to make debugging easier
        if (text.length < 10) {
            return res.status(400).json({ 
                error: "Text too short to summarize",
                summary: text // Return original for very short text
            });
        }
        
        // Split text into sentences with more robust regex
        const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
        
        console.log(`Text contains ${sentences.length} sentences`);
        
        if (sentences.length <= 3) {
            // Text is already short, return as is
            console.log("Text is already concise, returning original");
            return res.json({ summary: text });
        }
        
        // Score sentences - same algorithm as before
        const scoredSentences = sentences.map((sentence, index) => {
            // Clean the sentence of excess whitespace
            const cleanSentence = sentence.trim().replace(/\s+/g, " ");
            
            // Higher score for sentences at the beginning and end
            const positionScore = (index === 0 || index === sentences.length - 1) ? 2 : 
                                 (index < 3) ? 1.5 : 1;
            
            // Prefer medium-length sentences (not too short, not too long)
            const words = cleanSentence.split(/\s+/).length;
            const lengthScore = (words > 5 && words < 25) ? 1.5 : 
                              (words <= 5) ? 0.8 : 1;  // Penalize very short sentences
            
            // Check for important indicator words
            const importantWords = ["important", "significant", "key", "main", "crucial", "essential", 
                                  "primary", "critical", "vital", "necessary", "fundamental"];
            const containsImportantWord = importantWords.some(word => 
                cleanSentence.toLowerCase().includes(word)
            );
            const importanceScore = containsImportantWord ? 1.7 : 1;
            
            const totalScore = positionScore * lengthScore * importanceScore;
            
            return { sentence: cleanSentence, score: totalScore, originalIndex: index };
        });
        
        // Pick top sentences
        const sortedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
        const summaryLength = Math.max(2, Math.min(Math.ceil(sentences.length * 0.3), 5)); // At most 5 sentences
        const topSentences = sortedSentences.slice(0, summaryLength);
        
        // Reorder by original position for coherent reading
        const orderedSummary = topSentences
            .sort((a, b) => a.originalIndex - b.originalIndex)
            .map(item => item.sentence)
            .join(" ");
        
        console.log("Summarization complete: Original", text.length, "chars →", orderedSummary.length, "chars");
        
        // Send the summary immediately without setTimeout
        res.json({ 
            summary: orderedSummary,
            originalLength: text.length,
            summaryLength: orderedSummary.length,
            compressionRate: Math.round((1 - orderedSummary.length / text.length) * 100)
        });
    } catch (error) {
        console.error("Error during summarization:", error);
        
        // Provide a simpler fallback if main algorithm fails
        try {
            const simpleSummary = text.split('.').slice(0, 3).join('.') + '.';
            console.log("Using basic fallback summarization");
            res.json({ 
                summary: simpleSummary,
                fallback: true
            });
        } catch (fallbackError) {
            console.error("Even fallback summarization failed:", fallbackError);
            // If all else fails, just return the original text
            res.json({ 
                summary: text,
                error: "Summarization failed, returning original text"
            });
        }
    }
});

// Remove the previous __dirname declaration and static serving code
const __dirname = dirname(fileURLToPath(import.meta.url));

// Add more specific static file serving configuration
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Add error handling for static files
app.use((err, req, res, next) => {
    console.error('Static file error:', err);
    next(err);
});

// Update the catch-all route with error handling
app.get("*", (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Error loading page');
        }
    });
});
const port = process.env.PORT
// Move the listen call to the end
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log("Static files being served from:", publicPath);
});