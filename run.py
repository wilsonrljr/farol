#!/usr/bin/env python3
"""
Run script for the Finance Simulator application.
This script starts both the backend and frontend servers.
"""

import os
import sys
import subprocess
import webbrowser
import time
import signal
import atexit

# Define paths
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')

# Define URLs
BACKEND_URL = 'http://localhost:8000'
FRONTEND_URL = 'http://localhost:5173'

# Global processes
backend_process = None
frontend_process = None

def cleanup():
    """Cleanup function to kill processes on exit."""
    if backend_process:
        print("Stopping backend server...")
        backend_process.terminate()
    
    if frontend_process:
        print("Stopping frontend server...")
        frontend_process.terminate()

# Register cleanup function
atexit.register(cleanup)

def handle_signal(sig, frame):
    """Handle signals like Ctrl+C."""
    print("Received signal to terminate...")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

def start_backend():
    """Start the backend server."""
    global backend_process
    
    print("Starting backend server...")
    os.chdir(BACKEND_DIR)
    
    # Start the backend server
    backend_process = subprocess.Popen(
        ['uvicorn', 'app.main:app', '--reload'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for backend to start
    print("Waiting for backend server to start...")
    time.sleep(2)
    
    # Check if backend started successfully
    if backend_process.poll() is not None:
        print("Error starting backend server:")
        print(backend_process.stderr.read())
        sys.exit(1)
    
    print(f"Backend server running at {BACKEND_URL}")

def start_frontend():
    """Start the frontend development server."""
    global frontend_process
    
    print("Starting frontend server...")
    os.chdir(FRONTEND_DIR)
    
    # Start the frontend server
    frontend_process = subprocess.Popen(
        ['npm', 'run', 'dev'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for frontend to start
    print("Waiting for frontend server to start...")
    time.sleep(5)
    
    # Check if frontend started successfully
    if frontend_process.poll() is not None:
        print("Error starting frontend server:")
        print(frontend_process.stderr.read())
        sys.exit(1)
    
    print(f"Frontend server running at {FRONTEND_URL}")

def open_browser():
    """Open the browser with the application."""
    print("Opening browser...")
    webbrowser.open(FRONTEND_URL)

def main():
    """Main function to run the application."""
    print("Starting Finance Simulator...")
    
    # Start backend
    start_backend()
    
    # Start frontend
    start_frontend()
    
    # Open browser
    open_browser()
    
    print("Application is running!")
    print("Press Ctrl+C to stop the servers.")
    
    # Keep the script running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping servers...")

if __name__ == "__main__":
    main()