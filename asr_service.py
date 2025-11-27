import whisper
import torch

class ASRService:
    def __init__(self, model_size="large-v3"):
        """
        Initialize Whisper ASR model
        For Hindi-English, use large-v3 or fine-tuned checkpoint
        """
        print(f"Loading Whisper {model_size}...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = whisper.load_model(model_size, device=self.device)
        print(f"Whisper loaded on {self.device}")
    
    def transcribe(self, audio_path):
        """
        Transcribe audio file to text
        Returns: transcript string
        """
        result = self.model.transcribe(
            audio_path,
            language=None,  # Auto-detect Hindi/English
            task="transcribe",
            fp16=(self.device == "cuda")
        )
        return result["text"].strip()