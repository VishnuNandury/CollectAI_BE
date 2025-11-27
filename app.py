from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
from asr_service import ASRService
from llm_service import LLMService
from tts_service import TTSService
from language_detector import LanguageDetector

app = FastAPI(title="Bilingual Voice Bot")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
asr = ASRService()
llm = LLMService()
tts = TTSService()
lang_detector = LanguageDetector()

@app.post("/api/process-audio")
async def process_audio(audio: UploadFile = File(...)):
    """
    Main endpoint: receives audio, returns synthesized response audio
    """
    try:
        # Save uploaded audio temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_input:
            content = await audio.read()
            tmp_input.write(content)
            input_path = tmp_input.name
        
        # Step 1: Speech-to-Text
        transcript = asr.transcribe(input_path)
        print(f"Transcript: {transcript}")
        
        # Step 2: Detect language
        detected_lang = lang_detector.detect(transcript)
        print(f"Detected language: {detected_lang}")
        
        # Step 3: Generate LLM response
        response_text = llm.generate_response(transcript, detected_lang)
        print(f"Response: {response_text}")
        
        # Step 4: Text-to-Speech
        output_path = tempfile.mktemp(suffix=".wav")
        tts.synthesize(response_text, detected_lang, output_path)
        
        # Cleanup input
        os.unlink(input_path)
        
        # Return audio file
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="response.wav",
            background=lambda: os.unlink(output_path)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "services": ["asr", "llm", "tts"]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)