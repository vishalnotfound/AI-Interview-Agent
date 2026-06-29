# InterviewAI - Live Link : https://ai-interview-agent-bot.vercel.app/

A modern, AI-powered interview platform that adaptively generates technical questions based on your resume with live camera and tab switch proctoring. Built with **React**, **FastAPI**, and **Groq (Llama 3.3)**.

## 🚀 Features

- **Resume Parsing**: Automatically extracts skills and experience from PDF/DOCX resumes.
- **Adaptive Interviewing**: Generates personalized questions that deep-dive into your specific background.
- **Real-time Evaluation**: Provides a comprehensive score and feedback roadmap after the interview.
- **Fast and Lightweight**: Built with modern frameworks for a smooth local development experience.

## 🛠️ Setup & Running

### Prerequisites
- Python 3.9+
- Node.js 18+
- Groq API Key (Sign up at [console.groq.com](https://console.groq.com/))

### Local Development (Direct)

1.  **Backend**:
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # or venv\Scripts\activate on Windows
    pip install -r requirements.txt
    # Add GROQ_API_KEY to .env
    uvicorn main:app --reload
    ```

2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 📡 Monitoring

- **Backend Health**: `http://localhost:8000/health`

## 🔒 Security Notes

- **API Keys**: In a real production deployment, pass the `GROQ_API_KEY` as an environment variable rather than using a committed `.env` file.
- **CORS**: By default, it allows `localhost`. Update the `ALLOWED_ORIGINS` environment variable in the backend if deploying elsewhere.
