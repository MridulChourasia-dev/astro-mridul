package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// User represents the users table in DB
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Email        string    `json:"email" db:"email"`
	Password     string    `json:"-" db:"password"` // never expose password in JSON
	Role         string    `json:"role" db:"role"`
	Subscription string    `json:"subscription" db:"subscription"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// UserRegisterRequest represents the body for register
type UserRegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// UserLoginRequest represents the body for login
type UserLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// JWTClaims defines the JWT token structure
type JWTClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

// PlanetPosition represents details of a planet
type PlanetPosition struct {
	Planet string  `json:"planet"`
	House  int     `json:"house"`
	Sign   string  `json:"sign"`
	Degree float64 `json:"degree"`
}

// ChartCalculations holds the output of the Astrology calculations
type ChartCalculations struct {
	Ascendant         string           `json:"ascendant"`
	AscendantDegree   float64          `json:"ascendant_degree"`
	MoonSign          string           `json:"moon_sign"`
	SunSign           string           `json:"sun_sign"`
	Nakshatra         string           `json:"nakshatra"`
	NakshatraPada     int              `json:"nakshatra_pada"`
	NakshatraLord     string           `json:"nakshatra_lord"`
	Planets           []PlanetPosition `json:"planets"`
	Houses            map[int]string   `json:"houses"` // house number -> zodiac sign
	VimshottariDasha  []DashaPeriod    `json:"vimshottari_dasha"`
	Doshas            []string         `json:"doshas"`  // e.g. ["Manglik", "Kalsarpa"]
	Yogas             []string         `json:"yogas"`   // e.g. ["Gaja Kesari Yoga", "Raja Yoga"]
}

// DashaPeriod represents Vedic Vimshottari Dasha period
type DashaPeriod struct {
	Lord      string    `json:"lord"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// BirthChart represents the charts table in DB
type BirthChart struct {
	ID           uuid.UUID         `json:"id" db:"id"`
	UserID       uuid.UUID         `json:"user_id" db:"user_id"`
	Name         string            `json:"name" db:"name"`
	BirthDate    string            `json:"birth_date" db:"birth_date"` // YYYY-MM-DD
	BirthTime    string            `json:"birth_time" db:"birth_time"` // HH:MM
	Latitude     float64           `json:"latitude" db:"latitude"`
	Longitude    float64           `json:"longitude" db:"longitude"`
	Timezone     string            `json:"timezone" db:"timezone"`
	Calculations ChartCalculations `json:"calculations" db:"calculations"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
}

// ChartRequest represents the payload to create/generate a chart
type ChartRequest struct {
	Name      string  `json:"name" binding:"required"`
	BirthDate string  `json:"birth_date" binding:"required"` // YYYY-MM-DD
	BirthTime string  `json:"birth_time" binding:"required"` // HH:MM
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	Timezone  string  `json:"timezone" binding:"required"`
}

// Prediction represents a cached prediction
type Prediction struct {
	ID         uuid.UUID `json:"id"`
	ChartID    uuid.UUID `json:"chart_id"`
	Category   string    `json:"category"`
	Prediction string    `json:"prediction"`
	CreatedAt  time.Time `json:"created_at"`
}

// Report represents PDF report metadata
type Report struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	PdfUrl    string    `json:"pdf_url"`
	CreatedAt time.Time `json:"created_at"`
}

// ChatMessage represents a saved Q&A chat message
type ChatMessage struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Question  string    `json:"question"`
	Response  string    `json:"response"`
	CreatedAt time.Time `json:"created_at"`
}
