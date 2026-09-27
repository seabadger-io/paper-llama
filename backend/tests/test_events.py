import asyncio
import json

import pytest

from backend.app.core.events import EventBroadcaster


@pytest.mark.asyncio
async def test_event_broadcaster_subscribe_publish_unsubscribe():
    broadcaster = EventBroadcaster()
    queue = await broadcaster.subscribe()

    assert len(broadcaster._subscribers) == 1

    broadcaster.publish("test_event", {"foo": "bar"})

    # Check that item was received on queue
    item = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert item == {"event": "test_event", "data": {"foo": "bar"}}

    await broadcaster.unsubscribe(queue)
    assert len(broadcaster._subscribers) == 0


@pytest.mark.asyncio
async def test_event_broadcaster_queue_full_drops_oldest():
    broadcaster = EventBroadcaster()
    queue = await broadcaster.subscribe()

    # Fill queue to capacity (maxsize=100)
    for i in range(100):
        queue.put_nowait({"event": "old", "data": {"index": i}})

    # Publishing when full should not raise QueueFull
    broadcaster.publish("new_event", {"index": 100})

    # Draining first item should be index 1 (oldest index 0 was evicted)
    first = queue.get_nowait()
    assert first["data"]["index"] == 1

    await broadcaster.unsubscribe(queue)


@pytest.mark.asyncio
async def test_event_generator_formats_sse_and_ping():
    broadcaster = EventBroadcaster()
    queue = await broadcaster.subscribe()

    # Put an event on queue
    broadcaster.publish("document_started", {"document_id": 42})

    gen = broadcaster.event_generator(queue, ping_interval=0.05)

    # First event is initial 'connected' status
    connected_msg = await anext(gen)
    assert "event: connected\n" in connected_msg
    assert json.dumps({"status": "connected"}) in connected_msg

    # Second event is the published document_started
    doc_msg = await anext(gen)
    assert "event: document_started\n" in doc_msg
    assert json.dumps({"document_id": 42}) in doc_msg

    # Third should be a keepalive ping since ping_interval is short
    ping_msg = await anext(gen)
    assert ping_msg == ": ping\n\n"

    await gen.aclose()
    assert len(broadcaster._subscribers) == 0
