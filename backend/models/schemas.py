from pydantic import BaseModel
from typing import List, Optional


class EvaluateRequest(BaseModel):
    session_id: str
    current_question: str
    current_answer: str
    previous_questions: List[str] = []
    previous_answers: List[str] = []


class EvaluationScore(BaseModel):
    technical_score: float
    clarity_score: float
    structure_score: float
    relevance_score: float
    strengths: str
    weaknesses: str
    improvement_tip: str


class EvaluateResponse(BaseModel):
    evaluation: EvaluationScore
    next_question: Optional[str] = None
    question_count: int


class FinalReport(BaseModel):
    overall_score: float
    summary: str
    strong_areas: str
    weak_areas: str
    hire_recommendation: str
    improvement_roadmap: str


class FinalReportResponse(BaseModel):
    final_report: FinalReport


class ProctorFlagItem(BaseModel):
    timestamp: str
    object_label: str
    confidence: float
    screenshot: str
