import os
import logging
from minio import Minio
import psycopg2
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configs
MINIO_HOST = os.getenv("MINIO_HOST", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minio_admin")
MINIO_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minio_password")
BUCKET_NAME = "reports"

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "astronlp_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "astronlp_password")
DB_NAME = os.getenv("DB_NAME", "astronlp_db")

def get_minio_client():
    return Minio(
        MINIO_HOST,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False
    )

def ensure_bucket_exists():
    try:
        client = get_minio_client()
        found = client.bucket_exists(BUCKET_NAME)
        if not found:
            client.make_bucket(BUCKET_NAME)
            logger.info(f"Created MinIO bucket: {BUCKET_NAME}")
            
            # Set public read access policy
            policy = f'''{{
                "Version":"2012-10-17",
                "Statement":[
                    {{
                        "Sid":"PublicRead",
                        "Effect":"Allow",
                        "Principal": {{"AWS":["*"]}},
                        "Action":["s3:GetObject"],
                        "Resource":["arn:aws:s3:::{BUCKET_NAME}/*"]
                    }}
                ]
            }}'''
            client.set_bucket_policy(BUCKET_NAME, policy)
        else:
            logger.info(f"MinIO bucket {BUCKET_NAME} already exists.")
    except Exception as e:
        logger.error(f"MinIO bucket initialization failed: {e}")

def update_report_db(report_id, pdf_url):
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
            "UPDATE reports SET pdf_url = %s WHERE id = %s",
            (pdf_url, report_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Successfully updated database for report {report_id} with URL {pdf_url}")
    except Exception as e:
        logger.error(f"Failed to update database for report {report_id}: {e}")

def generate_astrology_pdf(report_id, user_id, chart_data):
    # Ensure MinIO bucket exists
    ensure_bucket_exists()
    
    pdf_filename = f"report_{report_id}.pdf"
    scratch_dir = os.path.join(os.path.dirname(__file__), "scratch")
    local_path = os.path.join(scratch_dir, pdf_filename)
    
    # Ensure scratch dir exists
    os.makedirs(scratch_dir, exist_ok=True)
    
    logger.info(f"Generating PDF at {local_path}...")
    
    # Create Document
    doc = SimpleDocTemplate(local_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#4A154B'), # Deep Purple
        spaceAfter=15,
        alignment=1 # Center
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitleStyle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#36C5F0'), # Bright Accent
        spaceBefore=12,
        spaceAfter=6,
        borderPadding=5
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#222222'),
        spaceAfter=8
    )

    bold_body_style = ParagraphStyle(
        'BoldBodyStyle',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    story = []
    
    # Title
    story.append(Paragraph("AstroNLP AI - Personalized Birth Chart Report", title_style))
    story.append(Spacer(1, 10))
    
    # Birth Details Table
    details_data = [
        [Paragraph("Name", bold_body_style), Paragraph(chart_data.get("name", "N/A"), body_style),
         Paragraph("Birth Date", bold_body_style), Paragraph(chart_data.get("birth_date", "N/A"), body_style)],
        [Paragraph("Birth Time", bold_body_style), Paragraph(chart_data.get("birth_time", "N/A"), body_style),
         Paragraph("Location", bold_body_style), Paragraph(f"{chart_data.get('latitude')}, {chart_data.get('longitude')}", body_style)],
        [Paragraph("Ascendant", bold_body_style), Paragraph(chart_data.get("calculations", {}).get("ascendant", "N/A"), body_style),
         Paragraph("Moon Sign", bold_body_style), Paragraph(chart_data.get("calculations", {}).get("moon_sign", "N/A"), body_style)],
        [Paragraph("Sun Sign", bold_body_style), Paragraph(chart_data.get("calculations", {}).get("sun_sign", "N/A"), body_style),
         Paragraph("Nakshatra", bold_body_style), Paragraph(f"{chart_data.get('calculations', {}).get('nakshatra')} (Pada {chart_data.get('calculations', {}).get('nakshatra_pada')})", body_style)]
    ]
    
    t = Table(details_data, colWidths=[100, 150, 100, 150])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8F9FA')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E9ECEF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#DEE2E6')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    
    story.append(t)
    story.append(Spacer(1, 15))
    
    # Planetary Positions Section
    story.append(Paragraph("Planetary Placements", section_title_style))
    planets_headers = [Paragraph("<b>Planet</b>", bold_body_style), 
                       Paragraph("<b>House</b>", bold_body_style), 
                       Paragraph("<b>Sign</b>", bold_body_style), 
                       Paragraph("<b>Degree</b>", bold_body_style)]
    
    planets_data = [planets_headers]
    for p in chart_data.get("calculations", {}).get("planets", []):
        planets_data.append([
            Paragraph(p.get("planet"), body_style),
            Paragraph(str(p.get("house")), body_style),
            Paragraph(p.get("sign"), body_style),
            Paragraph(f"{p.get('degree'):.2f}°", body_style)
        ])
        
    pt = Table(planets_data, colWidths=[120, 120, 120, 120])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E9ECEF')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DEE2E6')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CED4DA')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(pt)
    story.append(Spacer(1, 15))
    
    # House Placements Section
    story.append(Paragraph("House Configuration", section_title_style))
    houses_text = "The division of your houses shows how energies are mapped in your life:\n\n"
    for house_num, sign_name in chart_data.get("calculations", {}).get("houses", {}).items():
        houses_text += f"• <b>House {house_num}:</b> Governs {get_house_meaning(int(house_num))}, mapped to <b>{sign_name}</b>.\n"
    story.append(Paragraph(houses_text.replace("\n", "<br/>"), body_style))
    story.append(Spacer(1, 15))

    # Yogas and Doshas
    story.append(Paragraph("Yogas & Doshas", section_title_style))
    yogas = chart_data.get("calculations", {}).get("yogas", [])
    doshas = chart_data.get("calculations", {}).get("doshas", [])
    
    y_text = "<b>Yogas Present:</b> " + (", ".join(yogas) if yogas else "None detected")
    d_text = "<b>Doshas Present:</b> " + (", ".join(doshas) if doshas else "None detected")
    story.append(Paragraph(y_text, body_style))
    story.append(Paragraph(d_text, body_style))
    story.append(Spacer(1, 15))

    # Detailed Predictions Section
    story.append(Paragraph("Life Area Interpretations", section_title_style))
    predictions = chart_data.get("predictions", {})
    for category, pred_text in predictions.items():
        story.append(Paragraph(f"<b>{category.capitalize()} Analysis:</b>", bold_body_style))
        story.append(Paragraph(pred_text, body_style))
        story.append(Spacer(1, 10))

    # Build Document
    doc.build(story)
    logger.info("PDF build completed.")
    
    # Upload to MinIO
    client = get_minio_client()
    minio_path = f"report_{report_id}.pdf"
    
    client.fput_object(
        BUCKET_NAME,
        minio_path,
        local_path,
        content_type="application/pdf"
    )
    
    logger.info(f"Uploaded PDF to MinIO: {minio_path}")
    
    # Remove local temp file
    if os.path.exists(local_path):
        os.remove(local_path)
        
    # Generate public downloadable URL
    # For local development we can return direct MinIO URL
    public_url = f"http://localhost:9000/{BUCKET_NAME}/{minio_path}"
    update_report_db(report_id, public_url)

def get_house_meaning(house):
    meanings = {
        1: "Self, physical appearance, character, and new beginnings",
        2: "Wealth, family, speech, and immediate assets",
        3: "Siblings, courage, communication, short journeys, and initiative",
        4: "Mother, home, happiness, vehicle, and domestic environment",
        5: "Education, intellect, children, creativity, and past life merits (Purva Punya)",
        6: "Debts, enemies, illnesses, daily routines, and obstacles",
        7: "Spouse, partnership, business relations, and legal contracts",
        8: "Longevity, mysticism, transformation, hidden assets, and research",
        9: "Luck, father, higher education, foreign travels, and religion",
        10: "Career, status, power, father-figure, and public success",
        11: "Gains, desires, elder siblings, social networks, and income source",
        12: "Expenses, isolation, foreign land, spiritual liberation (Moksha), and sleep"
    }
    return meanings.get(house, "")
