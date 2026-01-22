//go:build desktop

package main

import (
	"embed"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	// Get screen dimensions with 1-inch margin from all sides
	width, height := getScreenDimensionsWithMargin()

	err := wails.Run(&options.App{
		Title:            "REDX Gmail Desktop Mailer",
		Width:            width,
		Height:           height,
		MinWidth:         1000,
		MinHeight:        700,
		Assets:           assets,
		BackgroundColour: &options.RGBA{R: 245, G: 245, B: 247, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Frameless:        runtime.GOOS != "darwin",
		CSSDragProperty:  "--wails-draggable",
		CSSDragValue:     "drag",
		Mac: &mac.Options{
			TitleBar: mac.TitleBarHiddenInset(),
		},
		WindowStartState: options.Normal,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

func getScreenDimensionsWithMargin() (int, int) {
	// For standard HD screen (1920x1080)
	screenWidth := 1920
	screenHeight := 1080
	
	// Calculate 1 inch margin (assuming 96 DPI, 1 inch = 96 pixels)
	inchMargin := 96
	
	// Calculate width with margins (1 inch from left and right)
	width := screenWidth - (2 * inchMargin)
	
	// Calculate height with margins (1 inch from top and bottom)
	height := screenHeight - (2 * inchMargin)
	
	// Ensure minimum and maximum bounds
	if width < 1000 {
		width = 1000
	}
	if height < 700 {
		height = 700
	}
	if width > 1600 {
		width = 1600
	}
	if height > 900 {
		height = 900
	}
	
	// Ensure window opens at this specific size
	return width, height
}