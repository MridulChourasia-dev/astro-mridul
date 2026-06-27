package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"astronlp/pkg/astronomy"
	"astronlp/pkg/models"
	"astronlp/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var db *sql.DB

func main() {
	var err error
	db, err = utils.GetDBConnection()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	r := gin.Default()

	r.POST("/", generateChartHandler)
	r.GET("/:id", getChartHandler)
	r.DELETE("/:id", deleteChartHandler)
	r.GET("/", listChartsHandler)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}
	log.Printf("Chart Service running on port %s", port)
	r.Run(":" + port)
}

func generateChartHandler(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	var req models.ChartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Run calculations
	calculations := astronomy.CalculateChart(req.Name, req.BirthDate, req.BirthTime, req.Latitude, req.Longitude, req.Timezone)

	calculationsJSON, err := json.Marshal(calculations)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize calculations"})
		return
	}

	var chart models.BirthChart
	err = db.QueryRow(
		"INSERT INTO charts (user_id, name, birth_date, birth_time, latitude, longitude, timezone, calculations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, user_id, name, birth_date, birth_time, latitude, longitude, timezone, calculations, created_at",
		userID, req.Name, req.BirthDate, req.BirthTime, req.Latitude, req.Longitude, req.Timezone, calculationsJSON,
	).Scan(&chart.ID, &chart.UserID, &chart.Name, &chart.BirthDate, &chart.BirthTime, &chart.Latitude, &chart.Longitude, &chart.Timezone, &calculationsJSON, &chart.CreatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save chart: " + err.Error()})
		return
	}

	// Deserialise to ensure correct return type
	if err := json.Unmarshal(calculationsJSON, &chart.Calculations); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse calculations"})
		return
	}

	c.JSON(http.StatusCreated, chart)
}

func getChartHandler(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	chartIDStr := c.Param("id")
	chartID, err := uuid.Parse(chartIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chart ID format"})
		return
	}

	var chart models.BirthChart
	var calculationsJSON []byte
	err = db.QueryRow(
		"SELECT id, user_id, name, birth_date, birth_time, latitude, longitude, timezone, calculations, created_at FROM charts WHERE id = $1",
		chartID,
	).Scan(&chart.ID, &chart.UserID, &chart.Name, &chart.BirthDate, &chart.BirthTime, &chart.Latitude, &chart.Longitude, &chart.Timezone, &calculationsJSON, &chart.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chart not found"})
		return
	}

	// Check if this chart belongs to the user or if they are admin
	if chart.UserID.String() != userIDStr && c.GetHeader("X-User-Role") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	if err := json.Unmarshal(calculationsJSON, &chart.Calculations); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse calculations"})
		return
	}

	c.JSON(http.StatusOK, chart)
}

func listChartsHandler(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	rows, err := db.Query(
		"SELECT id, user_id, name, birth_date, birth_time, latitude, longitude, timezone, calculations, created_at FROM charts WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query charts"})
		return
	}
	defer rows.Close()

	charts := make([]models.BirthChart, 0)
	for rows.Next() {
		var chart models.BirthChart
		var calculationsJSON []byte
		err := rows.Scan(&chart.ID, &chart.UserID, &chart.Name, &chart.BirthDate, &chart.BirthTime, &chart.Latitude, &chart.Longitude, &chart.Timezone, &calculationsJSON, &chart.CreatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan chart"})
			return
		}
		if err := json.Unmarshal(calculationsJSON, &chart.Calculations); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse calculations"})
			return
		}
		charts = append(charts, chart)
	}

	c.JSON(http.StatusOK, charts)
}

func deleteChartHandler(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	chartIDStr := c.Param("id")
	chartID, err := uuid.Parse(chartIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chart ID format"})
		return
	}

	// Verify ownership or admin
	var ownerID string
	err = db.QueryRow("SELECT user_id FROM charts WHERE id = $1", chartID).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chart not found"})
		return
	}

	if ownerID != userIDStr && c.GetHeader("X-User-Role") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	_, err = db.Exec("DELETE FROM charts WHERE id = $1", chartID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete chart"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Chart deleted successfully"})
}
