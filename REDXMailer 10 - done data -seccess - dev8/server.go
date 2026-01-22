package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

var app *App

func main() {
	// Initialize app
	app = NewApp()
	
	// Create data directories
	os.MkdirAll("uploads", 0755)
	os.MkdirAll("tasks", 0755)
	os.MkdirAll("smtp", 0755)
	os.MkdirAll("temp", 0755)
	
	// Initialize router
	r := mux.NewRouter()
	
	// API routes
	api := r.PathPrefix("/api").Subrouter()
	
	// Authentication
	api.HandleFunc("/login", loginHandler).Methods("POST")
	api.HandleFunc("/logout", logoutHandler).Methods("POST")
	api.HandleFunc("/current-user", currentUserHandler).Methods("GET")
	api.HandleFunc("/check-login-status", checkLoginStatusHandler).Methods("GET")
	api.HandleFunc("/test-send-limit", testSendLimitHandler).Methods("POST")
	
	// Task management
	api.HandleFunc("/create-task", createTaskHandler).Methods("POST")
	api.HandleFunc("/update-task", updateTaskHandler).Methods("POST")
	api.HandleFunc("/delete-task", deleteTaskHandler).Methods("POST")
	api.HandleFunc("/get-task", getTaskHandler).Methods("GET")
	api.HandleFunc("/get-tasks", getTasksHandler).Methods("GET")
	api.HandleFunc("/clear-completed-tasks", clearCompletedTasksHandler).Methods("POST")
	
	// Task control
	api.HandleFunc("/start-sending", startSendingHandler).Methods("POST")
	api.HandleFunc("/pause-task", pauseTaskHandler).Methods("POST")
	api.HandleFunc("/resume-task", resumeTaskHandler).Methods("POST")
	api.HandleFunc("/stop-task", stopTaskHandler).Methods("POST")
	
	// File upload
	api.HandleFunc("/upload-file", uploadFileHandler).Methods("POST")
	
	// SMTP management
	api.HandleFunc("/smtp-settings", smtpSettingsHandler).Methods("GET")
	api.HandleFunc("/update-smtp", updateSmtpHandler).Methods("POST")
	api.HandleFunc("/upload-smtp", uploadSmtpHandler).Methods("POST")
	api.HandleFunc("/add-manual-smtp", addManualSmtpHandler).Methods("POST")
	api.HandleFunc("/test-smtp-connection", testSmtpConnectionHandler).Methods("POST")
	api.HandleFunc("/clear-smtp-accounts", clearSmtpAccountsHandler).Methods("POST")
	api.HandleFunc("/download-smtp-report", downloadSmtpReportHandler).Methods("GET")
	
	// Tags
	api.HandleFunc("/task-tags", taskTagsHandler).Methods("GET")
	
	// Window controls (web versions)
	api.HandleFunc("/maximize-window", maximizeWindowHandler).Methods("POST")
	api.HandleFunc("/minimize-window", minimizeWindowHandler).Methods("POST")
	api.HandleFunc("/restore-window", restoreWindowHandler).Methods("POST")
	api.HandleFunc("/close-window", closeWindowHandler).Methods("POST")
	api.HandleFunc("/set-window-size", setWindowSizeHandler).Methods("POST")
	api.HandleFunc("/get-window-state", getWindowStateHandler).Methods("GET")
	
	// Serve static files
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./public")))
	
	// CORS middleware
	corsMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
	
	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      corsMiddleware(r),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	
	log.Printf("Server starting on port %s", port)
	log.Fatal(server.ListenAndServe())
}

// ==================================================
// HANDLER FUNCTIONS
// ==================================================

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": message,
	})
}

// Authentication handlers
func loginHandler(w http.ResponseWriter, r *http.Request) {
	var creds LoginCredentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.Login(creds)
	writeJSON(w, result)
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	result := app.Logout()
	writeJSON(w, result)
}

func currentUserHandler(w http.ResponseWriter, r *http.Request) {
	result := app.GetCurrentUser()
	writeJSON(w, result)
}

func checkLoginStatusHandler(w http.ResponseWriter, r *http.Request) {
	result := app.CheckLoginStatus()
	writeJSON(w, result)
}

func testSendLimitHandler(w http.ResponseWriter, r *http.Request) {
	var req TestLimitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.TestSendLimit(req)
	writeJSON(w, result)
}

// Task management handlers
func createTaskHandler(w http.ResponseWriter, r *http.Request) {
	result := app.CreateTask()
	writeJSON(w, result)
}

func updateTaskHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		TaskID  string                 `json:"taskId"`
		Updates map[string]interface{} `json:"updates"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.UpdateTask(data.TaskID, data.Updates)
	writeJSON(w, result)
}

func deleteTaskHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		TaskID string `json:"taskId"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.DeleteTask(data.TaskID)
	writeJSON(w, result)
}

func getTaskHandler(w http.ResponseWriter, r *http.Request) {
	taskID := r.URL.Query().Get("taskId")
	if taskID == "" {
		writeError(w, "taskId parameter is required", http.StatusBadRequest)
		return
	}
	
	result := app.GetTask(taskID)
	writeJSON(w, result)
}

func getTasksHandler(w http.ResponseWriter, r *http.Request) {
	result := app.GetAllTasks()
	writeJSON(w, result)
}

func clearCompletedTasksHandler(w http.ResponseWriter, r *http.Request) {
	result := app.ClearCompletedTasks()
	writeJSON(w, result)
}

// Task control handlers
func startSendingHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		TaskID string `json:"taskId"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.StartSending(data.TaskID)
	writeJSON(w, result)
}

func pauseTaskHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		TaskID string `json:"taskId"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.PauseTask(data.TaskID)
	writeJSON(w, result)
}

func resumeTaskHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		TaskID string `json:"taskId"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.ResumeTask(data.TaskID)
	writeJSON(w, result)
}

func stopTaskHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		TaskID string `json:"taskId"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.StopTask(data.TaskID)
	writeJSON(w, result)
}

// File upload handler
func uploadFileHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB max
		writeError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}
	
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()
	
	// Read file data
	fileData, err := io.ReadAll(file)
	if err != nil {
		writeError(w, "Failed to read file", http.StatusInternalServerError)
		return
	}
	
	// Convert to base64
	base64Data := base64.StdEncoding.EncodeToString(fileData)
	
	// Upload to app
	filePath, err := app.UploadFile(base64Data, header.Filename)
	if err != nil {
		writeError(w, "Failed to upload file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	
	writeJSON(w, map[string]interface{}{
		"success": true,
		"filePath": filePath,
		"fileName": header.Filename,
	})
}

// SMTP handlers
func smtpSettingsHandler(w http.ResponseWriter, r *http.Request) {
	result := app.GetSMTPSettings()
	writeJSON(w, result)
}

func updateSmtpHandler(w http.ResponseWriter, r *http.Request) {
	var server SMTPServer
	if err := json.NewDecoder(r.Body).Decode(&server); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.UpdateSMTPServer(server)
	writeJSON(w, result)
}

func uploadSmtpHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Base64Data string `json:"base64Data"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.UploadSMTPFile(data.Base64Data)
	writeJSON(w, result)
}

func addManualSmtpHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.AddManualSMTP(data.Email, data.Password)
	writeJSON(w, result)
}

func testSmtpConnectionHandler(w http.ResponseWriter, r *http.Request) {
	result := app.TestSMTPConnection()
	writeJSON(w, result)
}

func clearSmtpAccountsHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		AccountType string `json:"accountType"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.ClearSMTPAccounts(data.AccountType)
	writeJSON(w, result)
}

func downloadSmtpReportHandler(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("type")
	if reportType == "" {
		writeError(w, "type parameter is required", http.StatusBadRequest)
		return
	}
	
	report := app.DownloadSMTPReport(reportType)
	if report == "" {
		writeError(w, "No data to download", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "text/plain")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_smtp_report_%s.txt\"", reportType, time.Now().Format("2006-01-02")))
	w.Write([]byte(report))
}

// Tags handler
func taskTagsHandler(w http.ResponseWriter, r *http.Request) {
	result := app.GetTaskTags()
	writeJSON(w, result)
}

// Window control handlers (web versions)
func maximizeWindowHandler(w http.ResponseWriter, r *http.Request) {
	result := app.MaximizeWindow()
	writeJSON(w, result)
}

func minimizeWindowHandler(w http.ResponseWriter, r *http.Request) {
	result := app.MinimizeWindow()
	writeJSON(w, result)
}

func restoreWindowHandler(w http.ResponseWriter, r *http.Request) {
	result := app.RestoreWindow()
	writeJSON(w, result)
}

func closeWindowHandler(w http.ResponseWriter, r *http.Request) {
	result := app.CloseWindow()
	writeJSON(w, result)
}

func setWindowSizeHandler(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	result := app.SetWindowSize(data.Width, data.Height)
	writeJSON(w, result)
}

func getWindowStateHandler(w http.ResponseWriter, r *http.Request) {
	result := app.GetWindowState()
	writeJSON(w, result)
}
