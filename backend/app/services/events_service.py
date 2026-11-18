"""
Real-Time Event Pub/Sub Broker for Server-Sent Events (SSE).
Designed behind a clean EventBroker interface so the in-process asyncio.Queue
implementation can be swapped for Redis Pub/Sub cleanly without touching callers.
"""

import asyncio
import json
import logging
import threading
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, Iterable, Optional, Set, Tuple

logger = logging.getLogger("campvion.events")


def _normalize_role(role: Optional[str]) -> str:
    raw = (role or "").strip().lower()
    if raw in {"admin", "administrator", "system_administrator"}:
        return "administrator"
    return raw or "student"


@dataclass
class SSEEvent:
    event_id: str
    event_type: str
    payload: Dict[str, Any]
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_sse_frame(self) -> str:
        envelope = {
            "id": self.event_id,
            "type": self.event_type,
            "timestamp": self.created_at,
            "data": self.payload,
        }
        return f"id: {self.event_id}\nevent: {self.event_type}\ndata: {json.dumps(envelope, default=str)}\n\n"


@dataclass(eq=False)
class Subscriber:
    subscriber_id: str
    user_id: int
    role: str
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=256))


class EventBroker(ABC):
    @abstractmethod
    async def subscribe(self, user_id: int, role: str) -> AsyncIterator[SSEEvent]:
        """Yield live events for the given user & role."""

    @abstractmethod
    def publish(
        self,
        *,
        event_type: str,
        payload: Dict[str, Any],
        target_user_ids: Optional[Iterable[int]] = None,
        target_roles: Optional[Iterable[str]] = None,
        event_id: Optional[str] = None,
    ) -> SSEEvent:
        """Broadcast an event to matching subscribers safely from sync or async context."""


class InMemorySSEBroker(EventBroker):
    """
    Thread-safe in-process pub/sub broker backed by asyncio.Queue per connection.
    Supports targeting specific user_ids and/or normalized roles.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._by_user: Dict[int, Set[Subscriber]] = {}
        self._by_role: Dict[str, Set[Subscriber]] = {}

    def _register(self, user_id: int, role: str) -> Subscriber:
        loop = asyncio.get_running_loop()
        sub = Subscriber(
            subscriber_id=str(uuid.uuid4()),
            user_id=user_id,
            role=_normalize_role(role),
            loop=loop,
        )
        with self._lock:
            self._by_user.setdefault(user_id, set()).add(sub)
            self._by_role.setdefault(sub.role, set()).add(sub)
        return sub

    def _unregister(self, sub: Subscriber) -> None:
        with self._lock:
            user_set = self._by_user.get(sub.user_id)
            if user_set:
                user_set.discard(sub)
                if not user_set:
                    self._by_user.pop(sub.user_id, None)
            role_set = self._by_role.get(sub.role)
            if role_set:
                role_set.discard(sub)
                if not role_set:
                    self._by_role.pop(sub.role, None)

    async def subscribe(self, user_id: int, role: str) -> AsyncIterator[SSEEvent]:
        sub = self._register(user_id=user_id, role=role)
        try:
            while True:
                event = await sub.queue.get()
                yield event
        finally:
            self._unregister(sub)

    def _enqueue_on_loop(self, sub: Subscriber, event: SSEEvent) -> None:
        if sub.loop.is_closed():
            return

        def _put() -> None:
            try:
                if sub.queue.full():
                    try:
                        sub.queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                sub.queue.put_nowait(event)
            except Exception:
                pass

        try:
            sub.loop.call_soon_threadsafe(_put)
        except RuntimeError:
            pass

    def publish(
        self,
        *,
        event_type: str,
        payload: Dict[str, Any],
        target_user_ids: Optional[Iterable[int]] = None,
        target_roles: Optional[Iterable[str]] = None,
        event_id: Optional[str] = None,
    ) -> SSEEvent:
        evt = SSEEvent(
            event_id=str(event_id or uuid.uuid4()),
            event_type=event_type,
            payload=payload,
        )

        recipients: Set[Subscriber] = set()
        with self._lock:
            if target_user_ids:
                for uid in target_user_ids:
                    if uid is not None:
                        recipients.update(self._by_user.get(int(uid), set()))
            if target_roles:
                for role in target_roles:
                    norm_role = _normalize_role(role)
                    recipients.update(self._by_role.get(norm_role, set()))

        for sub in recipients:
            self._enqueue_on_loop(sub, evt)

        return evt


event_broker: EventBroker = InMemorySSEBroker()
