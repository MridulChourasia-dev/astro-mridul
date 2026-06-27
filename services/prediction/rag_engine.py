import os
# Configure HuggingFace/Transformers to run in offline mode for faster startup
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import logging
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "astrology_knowledge"

class RAGEngine:
    def __init__(self):
        logger.info(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
        self.client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        logger.info("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.vector_size = 384 # Dimension of all-MiniLM-L6-v2
        
        # Ensure collection exists and index default data
        self.init_collection()

    def init_collection(self):
        try:
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            if COLLECTION_NAME not in collection_names:
                logger.info(f"Creating Qdrant collection: {COLLECTION_NAME}")
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=qmodels.VectorParams(
                        size=self.vector_size,
                        distance=qmodels.Distance.COSINE
                    )
                )
                self.seed_default_data()
            else:
                logger.info(f"Qdrant collection {COLLECTION_NAME} already exists.")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {e}")

    def seed_default_data(self):
        logger.info("Seeding default astrology knowledge base...")
        default_knowledge = [
            # Mahadasha explanations
            {
                "text": "Rahu Mahadasha lasts for 18 years. It is a period of intense desires, material expansion, sudden shifts, and spiritual illusions. Remedies include chanting Rahu Mantra, donating black sesame seeds, and helping clean public spaces.",
                "metadata": {"category": "dasha", "planet": "Rahu"}
            },
            {
                "text": "Jupiter Mahadasha lasts for 16 years. It is generally a period of wisdom, wealth, spiritual progress, children, education, and benevolence. Honoring mentors and studying scriptures are highly auspicious remedies during this period.",
                "metadata": {"category": "dasha", "planet": "Jupiter"}
            },
            {
                "text": "Saturn Mahadasha (Shani Dasha) lasts for 19 years. It demands discipline, hard work, patience, and humility. It often brings major karmic corrections. Remedies include helping the elderly, donating black clothes, and praying to Lord Hanuman.",
                "metadata": {"category": "dasha", "planet": "Saturn"}
            },
            # Dosha explanations
            {
                "text": "Manglik Dosha (Kuja Dosha) occurs when Mars is placed in the 1st, 4th, 7th, 8th, or 12th house from the Ascendant. It causes friction in relationships, delay in marriage, and aggressive behavior. Remedies include marrying a Manglik partner, Kumbh Vivah, and reciting Hanuman Chalisa.",
                "metadata": {"category": "dosha", "type": "Manglik"}
            },
            {
                "text": "Kalsarpa Dosha is formed when all planets are hemmed between Rahu and Ketu in the birth chart. It leads to struggles, delays in success, and health issues. Performing the Kalsarpa Shanti Puja and praying to Lord Shiva are recommended.",
                "metadata": {"category": "dosha", "type": "Kalsarpa"}
            },
            # Yogas
            {
                "text": "Gaja Kesari Yoga is one of the most auspicious yogas in Vedic astrology. It is formed when Jupiter is in a Kendra (1st, 4th, 7th, or 10th house) from the Moon. It brings wisdom, fame, leadership, and prosperity.",
                "metadata": {"category": "yoga", "type": "Gaja Kesari"}
            },
            {
                "text": "Budhaditya Yoga is formed when the Sun and Mercury are conjoined in the same house. It enhances intellect, communication, logical skills, business acumen, and public speaking abilities.",
                "metadata": {"category": "yoga", "type": "Budhaditya"}
            },
            # Career and Gemstones
            {
                "text": "The 10th house governs career, profession, status, and public reputation. Strong planets in the 10th house or its lord placed in an auspicious house indicate career success. Saturn governs labor, Jupiter governs teaching/counseling, and Sun governs leadership/authority.",
                "metadata": {"category": "career"}
            },
            {
                "text": "Ruby (Manik) is the gemstone for the Sun. It boosts confidence, leadership, and vitality. Yellow Sapphire (Pukhraj) is for Jupiter, boosting wealth and wisdom. Blue Sapphire (Neelam) is for Saturn, bringing stability but must be worn after careful testing.",
                "metadata": {"category": "gemstones"}
            }
        ]

        payloads = [k["metadata"] for k in default_knowledge]
        for i, k in enumerate(default_knowledge):
            payloads[i]["text"] = k["text"]

        texts = [k["text"] for k in default_knowledge]
        embeddings = self.model.encode(texts).tolist()

        points = [
            qmodels.PointStruct(
                id=i,
                vector=embeddings[i],
                payload=payloads[i]
            )
            for i in range(len(default_knowledge))
        ]

        self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        logger.info(f"Successfully seeded {len(points)} documents to Qdrant.")

    def search(self, query: str, limit: int = 3):
        try:
            query_vector = self.model.encode(query).tolist()
            search_response = self.client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=limit
            )
            
            contexts = []
            for res in search_response.points:
                contexts.append({
                    "text": res.payload.get("text"),
                    "score": res.score,
                    "metadata": {k: v for k, v in res.payload.items() if k != "text"}
                })
            return contexts
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
