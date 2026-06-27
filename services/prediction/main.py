import os
import uuid
import logging
import psycopg2
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load .env file from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

from google import genai


from rag_engine import RAGEngine
import pdf_generator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AstroNLP Prediction Service")

# CORS Setup is handled globally at the Go API Gateway level.
# No local CORSMiddleware needed here to avoid duplicate headers.

# Initialize RAG Engine
try:
    rag = RAGEngine()
except Exception as e:
    logger.error(f"Failed to start RAG Engine: {e}")
    rag = None

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
client = None

if GEMINI_API_KEY:
    logger.info("Initializing Gemini API...")
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        available_models = [m.name for m in client.models.list()]
        logger.info(f"Available Gemini models: {available_models}")
        # Use a project relative directory for writing logs/metadata
        scratch_dir = os.path.join(os.path.dirname(__file__), "scratch")
        os.makedirs(scratch_dir, exist_ok=True)
        with open(os.path.join(scratch_dir, "gemini_models.txt"), "w") as f:
            f.write("\n".join(available_models))
        
        # If the default gemini-2.5-flash is not available, check for a valid fallback model
        available_short_names = [m.split("/")[-1] for m in available_models]
        if GEMINI_MODEL not in available_short_names and f"models/{GEMINI_MODEL}" not in available_models:
            fallbacks = ["gemini-2.0-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"]
            for fb in fallbacks:
                if fb in available_short_names:
                    logger.warning(f"Default model {GEMINI_MODEL} not available. Falling back to {fb}.")
                    GEMINI_MODEL = fb
                    break
            else:
                # Select the first model that contains 'flash' if available, or just the first model
                flash_models = [m.split("/")[-1] for m in available_models if "flash" in m.lower()]
                if flash_models:
                    GEMINI_MODEL = flash_models[0]
                elif available_models:
                    GEMINI_MODEL = available_models[0].split("/")[-1]
                logger.warning(f"Using fallback model: {GEMINI_MODEL}")
    except Exception as e:
        logger.error(f"Failed to list/configure Gemini models: {e}")

else:
    logger.warning("No GEMINI_API_KEY found. Using mock AI fallbacks.")


# Database Credentials
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "astronlp_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "astronlp_password")
DB_NAME = os.getenv("DB_NAME", "astronlp_db")

# Schemas
class PredictionRequest(BaseModel):
    chart_id: str
    calculations: Dict

class CompatibilityRequest(BaseModel):
    chart1: Dict
    chart2: Dict

class ChatRequest(BaseModel):
    question: str
    chart_id: Optional[str] = None
    calculations: Optional[Dict] = None

class ReportRequest(BaseModel):
    chart_id: str
    calculations: Dict
    name: str
    birth_date: str
    birth_time: str
    latitude: float
    longitude: float

# Helper to generate rule-based fallback predictions
def get_rule_predictions(calc: Dict) -> Dict[str, str]:
    asc = calc.get("ascendant", "Aries")
    moon = calc.get("moon_sign", "Aries")
    sun = calc.get("sun_sign", "Aries")
    nakshatra = calc.get("nakshatra", "Ashwini")
    
    planets = {p["planet"]: p for p in calc.get("planets", [])}
    
    # Career Prediction
    career = f"With your Ascendant in {asc} and Sun in {sun}, you possess a natural inclination toward self-expression and leadership. "
    if "Sun" in planets and planets["Sun"].get("house") in [1, 10]:
        career += "Your Sun is placed strongly, indicating high ambition, potential for managerial roles, or government service. "
    elif "Jupiter" in planets and planets["Jupiter"].get("house") in [9, 10]:
        career += "Jupiter influences your professional spheres, pointing to teaching, consulting, finance, or spiritual counseling. "
    else:
        career += "Your career will see steady progress as you learn to balance details with big-picture thinking. "
    career += f"Your 10th house is governed by {calc.get('houses', {}).get('10', 'Aries')}, advising you to build discipline."

    # Marriage Prediction
    marriage = f"Your Moon Sign is {moon}, indicating deep emotional sensitivity in relationships. "
    if "Mars" in planets and planets["Mars"].get("house") in [1, 4, 7, 8, 12]:
        marriage += "Mars influences your relationship houses (Manglik alignment). This suggests high passion but also a need to manage temper and communication to avoid friction. "
    else:
        marriage += "Your marital sphere shows compatibility and emotional support. "
    marriage += f"The 7th house of partnerships resides in {calc.get('houses', {}).get('7', 'Libra')}, meaning balance and mutual respect are keys to success."

    # Finance Prediction
    finance = "Your financial prospects look favorable. "
    if "Venus" in planets and planets["Venus"].get("house") in [2, 11]:
        finance += "Venus placed in wealth houses points to luxury, comfort, and multiple sources of income, possibly linked to arts, beauty, or communications. "
    else:
        finance += "Steady accumulation of assets through consistent effort is indicated. Avoid speculative investments. "
    finance += f"The 2nd house of accumulated wealth is in {calc.get('houses', {}).get('2', 'Taurus')}, highlighting resource management."

    # Remedies
    remedies = []
    if "Manglik Dosha" in calc.get("doshas", []):
        remedies.append("Recite Hanuman Chalisa on Tuesdays and donate red lentils to the needy.")
    if "Kalsarpa Dosha" in calc.get("doshas", []):
        remedies.append("Perform prayers to Lord Shiva and offer milk on Shivratri.")
    if not remedies:
        remedies.append("Perform daily meditation, respect parents/teachers, and wear light-colored clothes on Thursdays.")
    
    return {
        "career": career,
        "marriage": marriage,
        "finance": finance,
        "education": f"Your intelligence is guided by Nakshatra {nakshatra}. Focus on practical learning and deep research.",
        "health": "Overall health is stable. Pay attention to digestion and maintain a balanced sleep schedule.",
        "spiritual": "Spiritual growth is highlighted by the influence of your Ascendant Lord. Regular yoga and silent contemplation will bring clarity.",
        "remedies": " -> ".join(remedies)
    }

# Endpoints
@app.post("/prediction")
def get_prediction(req: PredictionRequest):
    calc = req.calculations
    
    # 1. Try LLM if API Key is configured
    if GEMINI_API_KEY and client:
        try:
            prompt = f"""
            As an expert Vedic Astrologer, analyze the following birth chart calculations:
            Ascendant: {calc.get('ascendant')}
            Sun Sign: {calc.get('sun_sign')}
            Moon Sign: {calc.get('moon_sign')}
            Nakshatra: {calc.get('nakshatra')}
            Planets: {calc.get('planets')}
            Yogas: {calc.get('yogas')}
            Doshas: {calc.get('doshas')}
            
            Provide short, clear interpretations (1-2 paragraphs each) for:
            1. Career
            2. Marriage & Relationships
            3. Finance & Wealth
            4. Education
            5. Health
            6. Spiritual Growth
            7. Remedies
            Format the output strictly as a JSON object with keys: "career", "marriage", "finance", "education", "health", "spiritual", "remedies". Do not wrap in markdown.
            """
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            if not response or not response.text:
                raise ValueError("Empty or null response received from Gemini API")
            import json
            cleaned_text = response.text.replace('```json', '').replace('```', '').strip()
            return json.loads(cleaned_text)
        except Exception as e:
            logger.error(f"Gemini API error: {e}. Falling back to rules.")
            
    # 2. Rule fallback
    return get_rule_predictions(calc)

@app.post("/compatibility")
def get_compatibility(req: CompatibilityRequest):
    c1 = req.chart1.get("calculations", {})
    c2 = req.chart2.get("calculations", {})
    
    # Run a simplified Ashtakoota compatibility scoring
    score = 50.0
    
    # Check Moon Sign alignment (out of 10)
    m1 = c1.get("moon_sign")
    m2 = c2.get("moon_sign")
    emotional = 60
    if m1 == m2:
        score += 15.0
        emotional = 90
    elif m1 in ["Cancer", "Scorpio", "Pisces"] and m2 in ["Cancer", "Scorpio", "Pisces"]:
        score += 10.0
        emotional = 80
        
    # Check Nakshatra harmony (out of 15)
    n1 = c1.get("nakshatra")
    n2 = c2.get("nakshatra")
    communication = 65
    if n1 == n2:
        score += 15.0
        communication = 95
        
    # Check Manglik compatibility (out of 15)
    m_dosha1 = "Manglik Dosha" in c1.get("doshas", [])
    m_dosha2 = "Manglik Dosha" in c2.get("doshas", [])
    marriage = 70
    if m_dosha1 == m_dosha2:
        score += 15.0 # Compatible (both Manglik or both non-Manglik)
        marriage = 85
    else:
        score -= 10.0 # Friction (one Manglik, one non-Manglik)
        marriage = 50
        
    # Ensure score falls within 0 - 100
    score = max(10.0, min(100.0, score))
    
    return {
        "score": int(score),
        "emotional": emotional,
        "marriage": marriage,
        "communication": communication,
        "financial": int(score * 0.9),
        "challenges": "Difference in temperament and lifestyle values" if score < 70 else "Minor differences in long-term financial planning",
        "suggestions": "Wear matching crystal accessories and practice joint meditation." if score < 70 else "Maintain a joint savings account and schedule weekly review talks."
    }

@app.post("/chat")
def chat(req: ChatRequest):
    question = req.question
    calc = req.calculations
    
    # Retrieve matching context from Qdrant
    results = []
    rag_context = ""
    if rag:
        results = rag.search(question, limit=2)
        rag_context = "\n".join([r["text"] for r in results])
        
    chart_info = ""
    if calc:
        chart_info = f"User birth chart - Ascendant: {calc.get('ascendant')}, Moon Sign: {calc.get('moon_sign')}, Sun Sign: {calc.get('sun_sign')}, Nakshatra: {calc.get('nakshatra')}."
        
    # Use Gemini if available
    if GEMINI_API_KEY and client:
        try:
            prompt = f"""
            You are a helpful, wise Vedic astrologer chatbot. 
            User details: {chart_info}
            Astrology reference literature matches: {rag_context}
            
            User's question: {question}
            
            Provide a warm, personalized, insightful response directly answering their question using the birth chart and reference texts. Include a disclaimer that astrology is for guidance and entertainment. Keep the response under 150 words.
            """
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            if response and response.text:
                return {"response": response.text, "citations": [r["text"] for r in results]}
            else:
                raise ValueError("Empty or null response text received from Gemini API")
        except Exception as e:
            logger.error(f"Gemini chat failed: {e}. Falling back to mock response.")
            
    # Mock Chat Response
    moon_sign = calc.get('moon_sign', 'Aries') if calc else 'Aries'
    mock_resp = f"Based on your Moon Sign ({moon_sign}) and Nakshatra, "
    if "marriage" in question.lower() or "spouse" in question.lower() or "partner" in question.lower():
        mock_resp += "relationships require patience. Venus indicates strong potential for partnership, but ensure mutual understanding before proceeding."
    elif "job" in question.lower() or "career" in question.lower() or "business" in question.lower():
        mock_resp += "career prospects are governed by Saturn's discipline. Focus on steady, persistent efforts, especially under the current transit."
    elif "rahu" in question.lower() or "dasha" in question.lower():
        mock_resp += "Mahadasha cycles mark major life shifts. Dedicate time to charity and meditation to offset transit friction."
    else:
        mock_resp += "the planetary configurations advise maintaining balance. Ensure your daily habits align with your Ascendant's qualities."
        
    mock_resp += "\n\nDisclaimer: Astrological readings are for informational and guidance purposes only."
    return {"response": mock_resp, "citations": [r["text"] for r in results] if results else ["Reference text regarding Mahadasha effects and house placements."] }

@app.post("/daily")
def daily(req: PredictionRequest):
    calc = req.calculations
    sun = calc.get("sun_sign", "Aries")
    moon = calc.get("moon_sign", "Aries")
    
    # Calculate a mock daily transit index based on today's date
    import datetime
    today = datetime.date.today().day
    score = (today * 7 + len(sun) * 3) % 100
    
    if score > 75:
        general = "An excellent day for planning and initiating projects. Energy is high!"
        lucky_number = 7
        lucky_color = "Gold"
    elif score > 50:
        general = "A stable day for focus. Work steadily on routine assignments."
        lucky_number = 3
        lucky_color = "Royal Blue"
    else:
        general = "Minor obstacles might arise. Take care of speech and stay hydrated."
        lucky_number = 9
        lucky_color = "Emerald Green"
        
    return {
        "date": str(datetime.date.today()),
        "score": score,
        "prediction": f"Today, the transit Moon is aspects your natal Moon in {moon}, affecting emotional clarity. {general}",
        "lucky_number": lucky_number,
        "lucky_color": lucky_color,
        "lucky_day": "Thursday"
    }

@app.post("/report/generate")
def generate_report(req: ReportRequest, background_tasks: BackgroundTasks, x_user_id: str = Header(None)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    # Generate unique report ID
    report_id = str(uuid.uuid4())
    
    # 1. Insert report row in DB with status "pending"
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO reports (id, user_id, pdf_url) VALUES (%s, %s, %s)",
            (report_id, x_user_id, "pending")
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to record report in DB: {e}")
        raise HTTPException(status_code=500, detail="Database write failure")
        
    # 2. Get detailed predictions for the PDF sections
    detailed_predictions = get_rule_predictions(req.calculations)
    
    # Compile full chart data for PDF
    pdf_chart_data = {
        "name": req.name,
        "birth_date": req.birth_date,
        "birth_time": req.birth_time,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "calculations": req.calculations,
        "predictions": detailed_predictions
    }
    
    # 3. Queue PDF generation, upload, and URL update in background
    background_tasks.add_task(
        pdf_generator.generate_astrology_pdf,
        report_id,
        x_user_id,
        pdf_chart_data
    )
    
    return {"id": report_id, "status": "pending", "message": "Report generation queued successfully."}

@app.get("/report/list")
def list_reports(x_user_id: str = Header(None)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        cur = conn.cursor()
        cur.execute("SELECT id, pdf_url, created_at FROM reports WHERE user_id = %s ORDER BY created_at DESC", (x_user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        reports = []
        for r in rows:
            status = "completed" if r[1] != "pending" else "pending"
            reports.append({
                "id": r[0],
                "status": status,
                "pdf_url": r[1] if status == "completed" else None,
                "created_at": r[2]
            })
        return reports
    except Exception as e:
        logger.error(f"Failed to list reports: {e}")
        raise HTTPException(status_code=500, detail="Database fetch failure")

@app.get("/report/{id}")
def get_report_status(id: str, x_user_id: str = Header(None)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
        cur = conn.cursor()
        cur.execute("SELECT id, user_id, pdf_url, created_at FROM reports WHERE id = %s", (id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
            
        rep_id, rep_user_id, pdf_url, created_at = row
        
        # Verify ownership
        if rep_user_id != x_user_id:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        status = "completed" if pdf_url != "pending" else "pending"
        return {"id": rep_id, "status": status, "pdf_url": pdf_url if status == "completed" else None, "created_at": created_at}
    except Exception as e:
        logger.error(f"Failed to fetch report status: {e}")
        raise HTTPException(status_code=500, detail="Database fetch failure")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8084))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
