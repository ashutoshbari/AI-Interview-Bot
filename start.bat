@echo off
echo Starting AI Interview Bot...

echo Starting Backend...
cd backend
start cmd /k "venv\Scripts\uvicorn.exe app.main:app --reload"
cd ..

echo Starting Frontend...
cd frontend
start cmd /k "npm run dev"
cd ..

echo Application is starting up. Check the newly opened terminal windows.
