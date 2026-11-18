from fastapi import APIRouter, Depends
from app.api.routes import auth, colleges, gates, health, rooms, students, tools, traces, agent, policies, evaluation, llm, conversations, requests, events, verify
from app.core.security import require_authenticated_user

protected = [Depends(require_authenticated_user)]

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(colleges.router, prefix="/colleges", tags=["colleges"])
api_router.include_router(verify.router, prefix="/verify", tags=["verify"])
api_router.include_router(gates.router, prefix="/gates", tags=["gates"], dependencies=protected)
api_router.include_router(rooms.router, prefix="/rooms", tags=["rooms"], dependencies=protected)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(students.router, prefix="/students", tags=["students"], dependencies=protected)
api_router.include_router(tools.router, prefix="/tools", tags=["tools"], dependencies=protected)
api_router.include_router(traces.router, prefix="/traces", tags=["traces"], dependencies=protected)
api_router.include_router(agent.router, prefix="/agent", tags=["agent"], dependencies=protected)
api_router.include_router(policies.router, prefix="/policies", tags=["policies"], dependencies=protected)
api_router.include_router(evaluation.router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(llm.router, prefix="/llm", tags=["llm"], dependencies=protected)
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"], dependencies=protected)
api_router.include_router(requests.router, prefix="/requests", tags=["requests"], dependencies=protected)
api_router.include_router(events.events_router, prefix="/events", tags=["events"])
api_router.include_router(events.notifications_router, prefix="/notifications", tags=["notifications"], dependencies=protected)
