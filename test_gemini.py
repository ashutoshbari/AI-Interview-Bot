import google.generativeai as genai
import os
import sys

# Force read .env directly bypassing lru_cache
with open("backend/.env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
models = [m.name for m in genai.list_models() if "generateContent" in m.supported_generation_methods]
print("SUPPORTED MODELS:")
for m in models:
    print(m)

# Let's try some known ones
known = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-2.0-flash"]
for k in known:
    try:
        model = genai.GenerativeModel(k)
        response = model.generate_content('Say OK')
        print(f"✅ {k} works!")
    except Exception as e:
        pass
