# Noviaai
Flow for a “book an appointment” message:  Frontend (chat widget / test client) → sends user message → your backend.  Backend calls OpenAI Assistants / Chat Completions with:  user message  tools defined (check_availability, create_appointment, etc.)  OpenAI decides:  “I should call check_availability with { date: "2025-11-30" }”  
