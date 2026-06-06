import uuid
import logging
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import EvaluateRequest
from services.resume_parser import parse_resume
from services.groq_service import (
    validate_resume,
    generate_first_question,
    generate_next_question,
    generate_final_report,
)
from database import create_tables
from routes.auth import router as auth_router
from routes.history import router as history_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api")

app = FastAPI(title="InterviewAI API")

# Productive CORS — configurable via env var
allowed_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost,"
    "http://127.0.0.1:5173,http://127.0.0.1:3000,"
    "https://ai-interview-agent-bot.vercel.app",
)
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth & history routers
app.include_router(auth_router)
app.include_router(history_router)


@app.on_event("startup")
async def startup_event():
    """Validate environment and initialize database on startup."""
    if not os.getenv("GROQ_API_KEY"):
        logger.error("GROQ_API_KEY environment variable is not set!")
    else:
        logger.info("GROQ_API_KEY is configured.")

    if not os.getenv("JWT_SECRET"):
        logger.warning("JWT_SECRET is not set — using fallback (not secure for production).")

    # Create database tables
    try:
        await create_tables()
        logger.info("Database connected and tables verified.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

@app.get("/health")
async def health_check():
    """Simple health check endpoint for monitoring."""
    return {"status": "healthy"}

# In-memory session     
sessions: dict = {}

TOTAL_QUESTIONS = 6


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """Parse resume, create session, and generate the first interview question."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    try:
        file_bytes = await file.read()
        resume_text = parse_resume(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse resume file.")

    # Validate that the document is actually a resume
    try:
        if not validate_resume(resume_text):
            raise HTTPException(
                status_code=400,
                detail="The uploaded document does not appear to be a resume or CV. "
                       "Please upload a valid resume (PDF or DOCX) containing your "
                       "name, skills, experience, or education.",
            )
    except HTTPException:
        raise
    except Exception:
        pass  # If validation itself fails, proceed anyway

    try:
        first_question = generate_first_question(resume_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "resume_text": resume_text,
        "questions": [first_question],
        "answers": [],
    }

    logger.info(f"New session created: {session_id}")
    return {"session_id": session_id, "first_question": first_question}


@app.post("/submit-answer")
async def submit_answer(req: EvaluateRequest):
    """Accept an answer, generate next question or final report after 5 questions."""
    session_id = req.session_id
    current_question = req.current_question
    current_answer = req.current_answer

    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Store the answer
    session["answers"].append(current_answer)
    question_number = len(session["answers"])

    # If all questions answered → generate
    if question_number >= TOTAL_QUESTIONS:
        try:
            report = generate_final_report(
                resume_text=session["resume_text"],
                questions=session["questions"],
                answers=session["answers"],
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Final report error: {str(e)}")

        return {
            "question_count": question_number,
            "final_report": report,
        }

    # Use server-side session history as the source of truth
    # (the frontend may send stale data due to closure issues
    server_prev_questions = session["questions"][:-1]  # all except the current one
    server_prev_answers = session["answers"][:-1]       # all except the one just added

    # Otherwise generate next question
    try:
        next_q = generate_next_question(
            resume_text=session["resume_text"],
            previous_questions=server_prev_questions,
            previous_answers=server_prev_answers,
            current_question=current_question,
            current_answer=current_answer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    session["questions"].append(next_q)

    return {
        "next_question": next_q,
        "question_count": question_number,
    }
