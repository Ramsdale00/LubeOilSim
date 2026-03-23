import asyncio
import json

from fastapi import WebSocket, WebSocketDisconnect


async def websocket_endpoint(websocket: WebSocket, channel: str) -> None:
    """
    WebSocket endpoint that bridges Redis pub/sub to the client.
    Subscribes to the given Redis channel and streams messages to the WebSocket.
    Handles disconnect cleanly.
    """
    await websocket.accept()

    redis = websocket.app.state.redis
    if redis is None:
        await websocket.send_json({"error": "Redis not available", "channel": channel})
        await websocket.close()
        return

    # Create a dedicated async Redis pubsub connection
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)

    read_task = None

    async def redis_reader() -> None:
        """Background task: read from Redis pub/sub and forward to WebSocket."""
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    await websocket.send_text(data)
        except Exception:
            pass

    read_task = asyncio.create_task(redis_reader())

    try:
        # Keep connection alive — handle pings and client-sent messages
        while True:
            try:
                text = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Echo back for ping/pong keepalive
                if text == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "channel": channel}))
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                try:
                    await websocket.send_text(json.dumps({"type": "heartbeat", "channel": channel}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        read_task.cancel()
        try:
            await read_task
        except (asyncio.CancelledError, Exception):
            pass
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass
