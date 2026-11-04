r"""
CampVion — Groq Cloud Connectivity & Intent Validation Tool
Run this standalone script to verify your Groq API key, model latency,
and structured intent parsing without needing to start the full web server.

Usage:
  Set-Location "project-55-campus-agent\backend"
  .\venv\Scripts\python.exe -m app.llm.test_groq_connection
"""

import sys
import os
import asyncio
import time

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings
from app.llm.groq_provider import GroqCloudProvider
from app.llm.intent_interpreter import NaturalLanguageIntentInterpreter, InterpretedGoalSchema

async def main():
    print("=" * 75)
    print("CAMPVION — GROQ CLOUD CONNECTIVITY & INTENT VALIDATION")
    print("=" * 75)
    print(f"Configured Provider: {settings.LLM_PROVIDER}")
    print(f"Configured Model:    {settings.effective_llm_model}")
    
    api_key = settings.effective_llm_api_key

    if not api_key:
        print("\n[INFO] GROQ_API_KEY is currently empty in backend/.env.")
        print("-" * 75)
        print("To complete your Groq activation:")
        print("  1. Open the file: backend/.env")
        print("  2. Paste your Groq API key after 'GROQ_API_KEY='")
        print("     Example: GROQ_API_KEY=gsk_yourActualGroqKeyHere...")
        print("  3. Save backend/.env and re-run this command:")
        print("     .\\venv\\Scripts\\python.exe -m app.llm.test_groq_connection")
        print("-" * 75)
        print("All code, dependencies, schemas, and endpoints are already fully prepared.")
        print("=" * 75)
        sys.exit(0)

    provider = GroqCloudProvider(
        api_key=api_key,
        model=settings.effective_llm_model
    )
    print(f"Masked Key:          {provider.mask_api_key()}")
    print("-" * 75)
    print("Step 1: Running lightweight health check probe...")

    t0 = time.perf_counter()
    health = await provider.check_health()
    probe_dur = (time.perf_counter() - t0) * 1000

    if not health.is_available:
        print(f"\n[FAIL] Groq connection probe failed: {health.error_message}")
        print("Please verify that your GROQ_API_KEY in backend/.env is valid and active.")
        sys.exit(1)

    print(f"[SUCCESS] Groq LPU API responded in {health.latency_ms or probe_dur:.1f}ms")
    print(f"          Status: {health.status.upper()}")
    print(f"          Features: {', '.join(health.supported_features)}")

    print("-" * 75)
    print("Step 2: Testing structured student intent parsing with Groq...")
    sample_request = "I need 3 days of medical leave starting tomorrow because I have a high fever."
    print(f"Sample Request: \"{sample_request}\"")

    interpreter = NaturalLanguageIntentInterpreter(provider=provider)
    result = await interpreter.interpret(student_id="S001", raw_text=sample_request)

    if not result.success:
        print(f"\n[FAIL] Intent parsing failed: {result.error_message}")
        sys.exit(1)

    print(f"[SUCCESS] Structured intent parsed in {result.latency_ms:.1f}ms:")
    if result.goal:
        print(f"  • Goal Type:    {result.goal.goal_type}")
        print(f"  • Duration:     {result.goal.parameters.get('days')} days")
        print(f"  • Category:     {result.goal.parameters.get('category')}")
        print(f"  • Reason:       {result.goal.parameters.get('reason')}")
    if result.usage:
        print(f"  • Tokens Used:  {result.usage.total_tokens} (prompt: {result.usage.prompt_tokens}, completion: {result.usage.completion_tokens})")
        print(f"  • Est. Cost:    ${result.usage.estimated_cost_usd:.6f}")

    print("-" * 75)
    print("[READY] Groq integration is fully operational and ready for live student workflows!")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(main())
