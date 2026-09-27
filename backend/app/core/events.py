import asyncio
import json
import logging
from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)


class EventBroadcaster:
    """Manages active SSE client subscriber queues and broadcasts events."""

    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue:
        """Subscribes a new client and returns an asyncio.Queue for receiving events."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
        logger.debug(f"SSE client subscribed. Total active subscribers: {len(self._subscribers)}")
        return queue

    async def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribes a client queue."""
        async with self._lock:
            self._subscribers.discard(queue)
        logger.debug(f"SSE client unsubscribed. Total active subscribers: {len(self._subscribers)}")

    def publish(self, event_type: str, data: dict):
        """Non-blocking broadcast of an event to all connected subscriber queues."""
        payload = {"event": event_type, "data": data}
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # If subscriber queue is full, discard oldest message to make room
                try:
                    queue.get_nowait()
                    queue.put_nowait(payload)
                except Exception:
                    pass

    async def event_generator(
        self, queue: asyncio.Queue, ping_interval: float = 15.0
    ) -> AsyncGenerator[str, None]:
        """Yields Server-Sent Events formatted text with keep-alive pings."""
        try:
            # Send initial connected confirmation event
            initial_data = json.dumps({"status": "connected"})
            yield f"event: connected\ndata: {initial_data}\n\n"

            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=ping_interval)
                    event_type = item.get("event", "message")
                    data_str = json.dumps(item.get("data", {}))
                    yield f"event: {event_type}\ndata: {data_str}\n\n"
                except TimeoutError:
                    # Send keep-alive comment so browsers and proxies don't close idle connection
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await self.unsubscribe(queue)


event_broadcaster = EventBroadcaster()
