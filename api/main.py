"""RainierFinance Python API.

FastAPI service that powers the AI Advisor chat. It verifies the caller's
Supabase JWT, loads their financial data server-side (service role), and
streams a Claude response grounded in that context. The Anthropic key never
leaves this process.

Run locally:  uvicorn main:app --reload --port 8000  (from api/)
"""

import asyncio
from typing import Any

import httpx
from anthropic import AsyncAnthropic
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import config

app = FastAPI(title="RainierFinance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)

REST_URL = f"{config.SUPABASE_URL}/rest/v1"
SERVICE_HEADERS = {
    "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
}

SYSTEM_PROMPT = """You are the AI financial advisor inside RainierFinance, a \
personal finance app. You have read-only access to the user's own financial \
data, provided below. All amounts are in CAD unless stated otherwise.

Guidelines:
- Answer questions about the user's spending, budgets, subscriptions, credit \
cards, investments, crypto, and net worth using the data provided.
- Be specific: cite the actual numbers, categories, and dates from the data.
- Keep answers concise and conversational; use short lists or tables when \
they help.
- You provide general financial education and observations about the user's \
own data. You are not a licensed financial advisor, so frame investment \
choices as considerations, not directives, and say so when asked for \
personalized investment advice.
- If the data doesn't contain the answer, say what's missing rather than \
guessing."""


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


async def get_user(request: Request) -> dict[str, Any]:
    """Verify the Supabase access token and return the auth user."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth.split(" ", 1)[1]
    async with httpx.AsyncClient(timeout=10) as http:
        res = await http.get(
            f"{config.SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {token}",
            },
        )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")
    return res.json()


async def sb_select(http: httpx.AsyncClient, table: str, params: dict) -> list:
    res = await http.get(
        f"{REST_URL}/{table}", headers=SERVICE_HEADERS, params=params
    )
    res.raise_for_status()
    return res.json()


def fmt_amount(value: Any) -> str:
    try:
        return f"${float(value):,.2f}"
    except (TypeError, ValueError):
        return "?"


async def build_financial_context(user_id: str) -> str:
    """Fetch the user's data and render it as compact text for the model."""
    eq = f"eq.{user_id}"
    async with httpx.AsyncClient(timeout=15) as http:
        (
            accounts,
            transactions,
            budgets,
            subscriptions,
            investments,
            crypto,
            snapshots,
            settings,
        ) = await asyncio.gather(
            sb_select(http, "accounts", {"user_id": eq, "is_active": "eq.true"}),
            sb_select(
                http,
                "transactions",
                {"user_id": eq, "order": "date.desc", "limit": "60"},
            ),
            sb_select(http, "budgets", {"user_id": eq}),
            sb_select(
                http, "subscriptions", {"user_id": eq, "status": "eq.active"}
            ),
            sb_select(http, "investments", {"user_id": eq}),
            sb_select(http, "crypto_holdings", {"user_id": eq}),
            sb_select(
                http,
                "net_worth_snapshots",
                {"user_id": eq, "order": "snapshot_date.desc", "limit": "3"},
            ),
            sb_select(http, "user_settings", {"user_id": eq}),
        )

    lines: list[str] = []

    lines.append("## Accounts")
    for a in accounts:
        limit = (
            f", limit {fmt_amount(a['credit_limit'])}"
            if a.get("credit_limit")
            else ""
        )
        lines.append(
            f"- {a['name']} ({a['institution']}, {a['type']}): "
            f"balance {fmt_amount(a['balance'])}{limit}"
        )

    lines.append("\n## Recent transactions (newest first, up to 60)")
    for t in transactions:
        lines.append(
            f"- {t['date']} | {t['description']} | {t['category']} | "
            f"{fmt_amount(t['amount'])} | {t['type']}"
        )

    lines.append("\n## Budgets")
    for b in budgets:
        lines.append(
            f"- {b['name']} ({b.get('period')}): spent "
            f"{fmt_amount(b['spent_amount'])} of {fmt_amount(b['total_amount'])}"
            + (f" [{b['category']}]" if b.get("category") else "")
        )

    lines.append("\n## Active subscriptions")
    for s in subscriptions:
        lines.append(
            f"- {s['name']}: {fmt_amount(s['amount'])} {s.get('billing_cycle')}, "
            f"next billing {s.get('next_billing_date')}"
        )

    lines.append("\n## Investments")
    for i in investments:
        lines.append(
            f"- {i['symbol']} ({i.get('account_type')}): {i['quantity']} @ "
            f"avg {fmt_amount(i['average_cost'])}, value "
            f"{fmt_amount(i.get('market_value'))}, gain "
            f"{fmt_amount(i.get('unrealized_gain'))}"
        )

    lines.append("\n## Crypto holdings")
    for c in crypto:
        lines.append(
            f"- {c['symbol']}: {c['quantity']} @ avg "
            f"{fmt_amount(c['average_cost_cad'])}, value "
            f"{fmt_amount(c.get('market_value_cad'))}"
        )

    lines.append("\n## Net worth snapshots (newest first)")
    for n in snapshots:
        lines.append(
            f"- {n['snapshot_date']}: net worth {fmt_amount(n.get('net_worth'))} "
            f"(assets {fmt_amount(n.get('total_assets'))}, liabilities "
            f"{fmt_amount(n.get('total_liabilities'))})"
        )

    if settings:
        st = settings[0]
        lines.append(
            f"\n## Other\n- Avion points: {st.get('avion_points_balance', 0)}\n"
            f"- Dry powder (cash ready to invest): "
            f"{fmt_amount(st.get('dry_powder_amount'))}"
        )

    return "\n".join(lines)


async def load_history(user_id: str, limit: int = 30) -> list[dict[str, str]]:
    async with httpx.AsyncClient(timeout=10) as http:
        rows = await sb_select(
            http,
            "chat_messages",
            {
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
    rows.reverse()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


async def save_message(user_id: str, role: str, content: str) -> None:
    async with httpx.AsyncClient(timeout=10) as http:
        res = await http.post(
            f"{REST_URL}/chat_messages",
            headers={**SERVICE_HEADERS, "Prefer": "return=minimal"},
            json={"user_id": user_id, "role": role, "content": content},
        )
        res.raise_for_status()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
async def chat(body: ChatRequest, user: dict = Depends(get_user)):
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    user_id = user["id"]
    context, history = await asyncio.gather(
        build_financial_context(user_id), load_history(user_id)
    )

    await save_message(user_id, "user", body.message)
    messages = history + [{"role": "user", "content": body.message}]

    system = [
        {
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        },
        {"type": "text", "text": f"User's financial data:\n\n{context}"},
    ]

    async def generate():
        chunks: list[str] = []
        try:
            async with anthropic_client.messages.stream(
                model=config.ANTHROPIC_MODEL,
                max_tokens=2048,
                system=system,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    chunks.append(text)
                    yield text
        except Exception as err:  # surfaced mid-stream; status is already 200
            yield f"\n\n[Advisor error: {err}]"
            return
        full = "".join(chunks)
        if full.strip():
            await save_message(user_id, "assistant", full)

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
