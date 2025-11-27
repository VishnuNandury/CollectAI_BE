let mediaRecorder;
let audioChunks = [];
const API_URL = 'http://localhost:8000';

const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const userTranscript = document.getElementById('userTranscript');
const botResponse = document.getElementById('botResponse');
const responseAudio = document.getElementById('responseAudio');

// Start recording
recordBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await sendAudioToServer(audioBlob);
        };
        
        mediaRecorder.start();
        
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = '🔴 Recording...';
        status.className = 'status recording';
        
    } catch (error) {
        status.textContent = '❌ Microphone access denied';
        status.className = 'status error';
    }
});

// Stop recording
stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = '⏳ Processing...';
    status.className = 'status processing';
});

// Send audio to backend
async function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    
    try {
        const response = await fetch(`${API_URL}/api/process-audio`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Server error');
        }
        
        const audioResponseBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioResponseBlob);
        
        responseAudio.src = audioUrl;
        responseAudio.play();
        
        status.textContent = '✅ Response ready!';
        status.className = 'status success';
        
        // Note: In production, you'd get transcript and response text from server
        userTranscript.textContent = 'Transcript will appear here...';
        botResponse.textContent = 'Response text will appear here...';
        
    } catch (error) {
        status.textContent = '❌ Error processing audio';
        status.className = 'status error';
        console.error(error);
    }
}