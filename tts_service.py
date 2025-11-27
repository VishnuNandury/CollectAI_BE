from TTS.api import TTS
import torch

class TTSService:
    def __init__(self):
        """
        Initialize Coqui XTTS-v2 for multilingual TTS
        Supports Hindi and English with voice cloning
        """
        print("Loading XTTS-v2...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(self.device)
        print(f"XTTS loaded on {self.device}")
        
        # Default speaker voice (you can add custom voice samples)
        self.speaker_wav = None  # Path to reference audio for cloning
    
    def synthesize(self, text, language="en", output_path="output.wav"):
        """
        Convert text to speech
        language: 'en' or 'hi'
        """
        # Map language codes
        lang_map = {"en": "en", "hi": "hi"}
        tts_lang = lang_map.get(language, "en")
        
        self.tts.tts_to_file(
            text=text,
            file_path=output_path,
            language=tts_lang,
            speaker_wav=self.speaker_wav  # Optional: for voice cloning
        )
        
        return output_path