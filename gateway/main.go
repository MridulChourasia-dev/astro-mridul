package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"astronlp/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var (
	redisClient       *redis.Client
	authServiceUrl     *url.URL
	userServiceUrl     *url.URL
	chartServiceUrl    *url.URL
	predictionServiceUrl *url.URL
)

func main() {
	// Initialize redis
	redisClient = utils.GetRedisClient()

	// Parse service URLs
	var err error
	authServiceUrl, err = url.Parse(getEnv("AUTH_SERVICE_URL", "http://localhost:8081"))
	if err != nil {
		log.Fatalf("Invalid auth service URL: %v", err)
	}
	userServiceUrl, err = url.Parse(getEnv("USER_SERVICE_URL", "http://localhost:8082"))
	if err != nil {
		log.Fatalf("Invalid user service URL: %v", err)
	}
	chartServiceUrl, err = url.Parse(getEnv("CHART_SERVICE_URL", "http://localhost:8083"))
	if err != nil {
		log.Fatalf("Invalid chart service URL: %v", err)
	}
	predictionServiceUrl, err = url.Parse(getEnv("PREDICTION_SERVICE_URL", "http://localhost:8084"))
	if err != nil {
		log.Fatalf("Invalid prediction service URL: %v", err)
	}

	r := gin.Default()

	// CORS Middleware
	r.Use(corsMiddleware())

	// Rate Limiting Middleware
	r.Use(rateLimitMiddleware())

	// Setup Reverse Proxies
	authProxy := httputil.NewSingleHostReverseProxy(authServiceUrl)
	userProxy := httputil.NewSingleHostReverseProxy(userServiceUrl)
	chartProxy := httputil.NewSingleHostReverseProxy(chartServiceUrl)
	predictionProxy := httputil.NewSingleHostReverseProxy(predictionServiceUrl)

	// Auth routes (No JWT required)
	r.Any("/auth/*any", func(c *gin.Context) {
		// Strip the /auth prefix for downstream service
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/auth")
		authProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Protected routes (JWT required)
	protected := r.Group("/")
	protected.Use(authMiddleware())

	protected.Any("/users/*any", func(c *gin.Context) {
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/users")
		userProxy.ServeHTTP(c.Writer, c.Request)
	})

	protected.Any("/chart/*any", func(c *gin.Context) {
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/chart")
		chartProxy.ServeHTTP(c.Writer, c.Request)
	})

	protected.Any("/prediction/*any", func(c *gin.Context) {
		c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, "/prediction")
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Catch-all predictions / compatibility / chat direct routes mapping
	protected.Any("/prediction", func(c *gin.Context) {
		c.Request.URL.Path = "/prediction"
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/compatibility", func(c *gin.Context) {
		c.Request.URL.Path = "/compatibility"
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/chat", func(c *gin.Context) {
		c.Request.URL.Path = "/chat"
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/daily", func(c *gin.Context) {
		c.Request.URL.Path = "/daily"
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/report/generate", func(c *gin.Context) {
		c.Request.URL.Path = "/report/generate"
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.GET("/report/:id", func(c *gin.Context) {
		c.Request.URL.Path = "/report/" + c.Param("id")
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.GET("/report/download/:id", func(c *gin.Context) {
		c.Request.URL.Path = "/report/download/" + c.Param("id")
		predictionProxy.ServeHTTP(c.Writer, c.Request)
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	port := getEnv("PORT", "8080")
	log.Printf("API Gateway running on port %s", port)
	r.Run(":" + port)
}

func getEnv(key, fallback string) string {
	if val, exists := os.LookupEnv(key); exists {
		return val
	}
	return fallback
}

// corsMiddleware configures CORS headers
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-User-ID, X-User-Role, X-User-Email")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// rateLimitMiddleware restricts API requests per client IP / user
func rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := context.Background()
		clientIP := c.ClientIP()
		key := fmt.Sprintf("rate_limit:%s", clientIP)

		// Increment request count in Redis (window of 1 minute)
		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			// Fail open if Redis is down for development robustness
			c.Next()
			return
		}

		if count == 1 {
			redisClient.Expire(ctx, key, time.Minute)
		}

		// Limit to 100 requests per minute
		if count > 100 {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Please try again later."})
			return
		}

		c.Next()
	}
}

// authMiddleware validates the JWT token and appends headers for downstream services
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header must be Bearer <token>"})
			return
		}

		tokenStr := parts[1]
		claims, err := utils.ValidateJWT(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Set downstream headers
		c.Request.Header.Set("X-User-ID", claims.UserID.String())
		c.Request.Header.Set("X-User-Email", claims.Email)
		c.Request.Header.Set("X-User-Role", claims.Role)

		c.Next()
	}
}
