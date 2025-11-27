import re

class LanguageDetector:
    def __init__(self):
        """
        Simple rule-based language detector for Hindi/English
        For production, use fastText or langdetect
        """
        self.hindi_pattern = re.compile(r'[\u0900-\u097F]+')  # Devanagari Unicode range
    
    def detect(self, text):
        """
        Detect if text is primarily Hindi or English
        Returns: 'hi' or 'en'
        """
        hindi_chars = len(self.hindi_pattern.findall(text))
        total_chars = len(text.replace(" ", ""))
        
        if total_chars == 0:
            return "en"
        
        hindi_ratio = hindi_chars / total_chars
        
        return "hi" if hindi_ratio > 0.3 else "en"