package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

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

	r.GET("/me", getProfileHandler)
	r.PUT("/me", updateProfileHandler)
	r.DELETE("/me", deleteAccountHandler)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	log.Printf("User Service running on port %s", port)
	r.Run(":" + port)
}

func getProfileHandler(c *gin.Context) {
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

	var user models.User
	err = db.QueryRow(
		"SELECT id, name, email, role, subscription, created_at FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Subscription, &user.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func updateProfileHandler(c *gin.Context) {
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

	var req struct {
		Name         string `json:"name"`
		Subscription string `json:"subscription"` // E.g., upgrade to premium
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if req.Subscription != "" {
		err = db.QueryRow(
			"UPDATE users SET name = COALESCE(NULLIF($1, ''), name), subscription = COALESCE(NULLIF($2, ''), subscription) WHERE id = $3 RETURNING id, name, email, role, subscription, created_at",
			req.Name, req.Subscription, userID,
		).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Subscription, &user.CreatedAt)
	} else {
		err = db.QueryRow(
			"UPDATE users SET name = COALESCE(NULLIF($1, ''), name) WHERE id = $2 RETURNING id, name, email, role, subscription, created_at",
			req.Name, userID,
		).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Subscription, &user.CreatedAt)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func deleteAccountHandler(c *gin.Context) {
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

	_, err = db.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account successfully deleted"})
}
