"""LangGraph turn for one line in the BAND room.

The speaker posts first. If the line names a teammate, that teammate answers
with one sentence from the local model and posts the answer back.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

Post = Callable[[str, str, list[str]], Awaitable[None]]
Complete = Callable[[str, str, str], Awaitable[str]]


class CollabState(TypedDict, total=False):
    speaker: str
    text: str
    post_to: list[str]
    reply_to: str
    action: str
    reason: str
    reply_from: str
    reply: str


def build_collab_graph(complete: Complete, post: Post):
    async def announce(state: CollabState) -> dict:
        await post(state["speaker"], state["text"], state.get("post_to") or [])
        return {}

    async def respond(state: CollabState) -> dict:
        teammate = state.get("reply_to") or ""
        if not teammate:
            return {}
        line = await complete(
            teammate,
            f"Answer {state['speaker']}, who just said: {state['text']}",
            state.get("reason") or "A teammate spoke to you during the code",
        )
        if not line:
            return {}
        await post(teammate, line, [state["speaker"]])
        return {"reply_from": teammate, "reply": line}

    def route(state: CollabState) -> str:
        return "respond" if state.get("reply_to") else "done"

    graph = StateGraph(CollabState)
    graph.add_node("announce", announce)
    graph.add_node("respond", respond)
    graph.add_edge(START, "announce")
    graph.add_conditional_edges("announce", route, {"respond": "respond", "done": END})
    graph.add_edge("respond", END)
    return graph.compile()
