from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

class LLMService:
    def __init__(self, model_name="mistralai/Mistral-7B-Instruct-v0.2"):
        """
        Initialize instruction-tuned LLM
        For better Hindi support, consider: ai4bharat/Airavata or google/gemma-7b-it
        """
        print(f"Loading LLM {model_name}...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            device_map="auto",
            load_in_8bit=True  # Use 8-bit quantization to save memory
        )
        print(f"LLM loaded on {self.device}")
    
    def generate_response(self, user_input, language="en"):
        """
        Generate conversational response
        """
        # Prompt template
        if language == "hi":
            system_prompt = "आप एक सहायक AI असिस्टेंट हैं। उपयोगकर्ता की भाषा में जवाब दें।"
        else:
            system_prompt = "You are a helpful AI assistant. Answer in the user's language."
        
        prompt = f"<s>[INST] {system_prompt}\n\nUser: {user_input}\nAssistant: [/INST]"
        
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=150,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=self.tokenizer.eos_token_id
        )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract only the assistant's response
        response = response.split("[/INST]")[-1].strip()
        
        return response