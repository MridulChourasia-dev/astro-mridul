package astronomy

import (
	"math"
	"time"

	"astronlp/pkg/models"
)

// Zodiac signs list
var ZodiacSigns = []string{
	"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
	"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
}

// Nakshatras list
var Nakshatras = []string{
	"Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
	"Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
	"Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
}

// Nakshatra Lords list
var NakshatraLords = []string{
	"Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
}

// Dasha Lords in Vimshottari order
var DashaLords = []string{
	"Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
}

// Dasha Years for each lord
var DashaYears = map[string]int{
	"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7, "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17,
}

// CalculateChart calculates birth chart parameters deterministically based on input parameters
func CalculateChart(name string, birthDate, birthTime string, latitude, longitude float64, timezone string) models.ChartCalculations {
	// Parse date and time
	t, err := time.Parse("2006-01-02 15:04", birthDate+" "+birthTime)
	if err != nil {
		t = time.Now()
	}

	// Calculate Julian Day (simplified for calculation epoch 2000)
	// Reference: 2000 Jan 1.5 is JD 2451545.0
	y := float64(t.Year())
	m := float64(t.Month())
	d := float64(t.Day())
	hour := float64(t.Hour()) + float64(t.Minute())/60.0

	if m <= 2 {
		y -= 1
		m += 12
	}
	A := math.Floor(y / 100.0)
	B := 2.0 - A + math.Floor(A/4.0)
	jd := math.Floor(365.25*(y+4716.0)) + math.Floor(30.6001*(m+1.0)) + d + hour/24.0 + B - 1524.5

	// Calculate Local Sidereal Time (LST)
	// Simplification for Ascendant
	dJD := jd - 2451545.0 // Days since J2000.0
	lst := 18.697374558 + 24.06570982441908*dJD + longitude/15.0
	lst = math.Mod(lst, 24.0)
	if lst < 0 {
		lst += 24.0
	}

	// Ascendant Degree is based on Local Sidereal Time
	ascendantDeg := lst * 15.0
	ascendantSignIdx := int(math.Floor(ascendantDeg/30.0)) % 12
	ascendant := ZodiacSigns[ascendantSignIdx]

	// Planetary positions using simplified Keplerian elements relative to JD
	// We'll calculate degrees for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu
	planetsList := []string{"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"}
	planetPositions := make([]models.PlanetPosition, len(planetsList))

	// Base orbits (simplified rates)
	orbits := map[string]struct{ period, epoch float64 }{
		"Sun":     {365.256, 280.46},
		"Moon":    {27.321, 218.31},
		"Mars":    {686.980, 355.45},
		"Mercury": {87.969, 252.25},
		"Jupiter": {4332.589, 34.35},
		"Venus":   {224.701, 181.98},
		"Saturn":  {10759.22, 50.08},
		"Rahu":    {-6798.38, 125.04}, // Retrograde
		"Ketu":    {-6798.38, 305.04}, // Opposite Rahu
	}

	for i, name := range planetsList {
		orbit := orbits[name]
		meanLong := orbit.epoch + (360.0/orbit.period)*dJD
		deg := math.Mod(meanLong, 360.0)
		if deg < 0 {
			deg += 360.0
		}

		signIdx := int(math.Floor(deg/30.0)) % 12
		house := (signIdx - ascendantSignIdx + 12) % 12
		if house == 0 {
			house = 12
		}

		planetPositions[i] = models.PlanetPosition{
			Planet: name,
			House:  house,
			Sign:   ZodiacSigns[signIdx],
			Degree: math.Mod(deg, 30.0),
		}
	}

	// Moon details for Nakshatra calculation
	var moonDeg float64
	for _, p := range planetPositions {
		if p.Planet == "Moon" {
			// Get actual longitudinal degree of Moon (0-360)
			for j, signName := range ZodiacSigns {
				if signName == p.Sign {
					moonDeg = float64(j)*30.0 + p.Degree
					break
				}
			}
		}
	}

	// Calculate Nakshatra from Moon Degree (360 / 27 = 13.3333 degrees per Nakshatra)
	nakshatraIdx := int(math.Floor(moonDeg / 13.333333)) % 27
	nakshatra := Nakshatras[nakshatraIdx]
	nakshatraPada := int(math.Floor(math.Mod(moonDeg, 13.333333)/3.333333)) + 1
	nakshatraLord := NakshatraLords[nakshatraIdx%9]

	// Houses mapping
	houses := make(map[int]string)
	for h := 1; h <= 12; h++ {
		signIdx := (ascendantSignIdx + h - 1) % 12
		houses[h] = ZodiacSigns[signIdx]
	}

	// Calculate Dasha starting period based on Moon's Nakshatra
	// Calculate fraction of Nakshatra elapsed
	nakshatraStartDeg := float64(nakshatraIdx) * 13.333333
	elapsed := moonDeg - nakshatraStartDeg
	elapsedFraction := elapsed / 13.333333

	dashaList := make([]models.DashaPeriod, 0)
	currentLordIdx := nakshatraIdx % 9

	startDate := t
	for k := 0; k < 9; k++ {
		lord := DashaLords[(currentLordIdx+k)%9]
		years := DashaYears[lord]
		duration := float64(years)

		// First dasha is partially spent
		if k == 0 {
			duration = float64(years) * (1.0 - elapsedFraction)
		}

		endDate := startDate.AddDate(int(duration), int((duration-float64(int(duration)))*12.0), 0)
		dashaList = append(dashaList, models.DashaPeriod{
			Lord:      lord,
			StartDate: startDate,
			EndDate:   endDate,
		})
		startDate = endDate
	}

	// Yogas and Doshas based on rules
	doshas := make([]string, 0)
	yogas := make([]string, 0)

	// Simple Manglik Dosha: Mars in 1, 4, 7, 8, 12 house
	for _, p := range planetPositions {
		if p.Planet == "Mars" && (p.House == 1 || p.House == 4 || p.House == 7 || p.House == 8 || p.House == 12) {
			doshas = append(doshas, "Manglik Dosha")
			break
		}
	}

	// Gaja Kesari Yoga: Jupiter in 1, 4, 7, 10 house from Moon
	var jupHouse, moonHouse int
	for _, p := range planetPositions {
		if p.Planet == "Jupiter" {
			jupHouse = p.House
		}
		if p.Planet == "Moon" {
			moonHouse = p.House
		}
	}
	diff := (jupHouse - moonHouse + 12) % 12
	if diff == 0 || diff == 3 || diff == 6 || diff == 9 { // 1, 4, 7, 10 count from Moon
		yogas = append(yogas, "Gaja Kesari Yoga")
	}

	// Budhaditya Yoga: Sun and Mercury in the same house
	var sunHouse, mercHouse int
	for _, p := range planetPositions {
		if p.Planet == "Sun" {
			sunHouse = p.House
		}
		if p.Planet == "Mercury" {
			mercHouse = p.House
		}
	}
	if sunHouse == mercHouse {
		yogas = append(yogas, "Budhaditya Yoga")
	}

	// Sun Sign and Moon Sign
	var sunSign, moonSign string
	for _, p := range planetPositions {
		if p.Planet == "Sun" {
			sunSign = p.Sign
		}
		if p.Planet == "Moon" {
			moonSign = p.Sign
		}
	}

	return models.ChartCalculations{
		Ascendant:        ascendant,
		AscendantDegree:  ascendantDeg,
		MoonSign:         moonSign,
		SunSign:          sunSign,
		Nakshatra:        nakshatra,
		NakshatraPada:    nakshatraPada,
		NakshatraLord:    nakshatraLord,
		Planets:          planetPositions,
		Houses:           houses,
		VimshottariDasha: dashaList,
		Doshas:           doshas,
		Yogas:            yogas,
	}
}
