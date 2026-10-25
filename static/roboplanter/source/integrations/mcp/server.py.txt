#!/usr/bin/env python3
"""Official-SDK RoboPlanter MCP server. No real device call occurs at startup."""
from __future__ import annotations

import argparse
from pathlib import Path
import site
import sys
from typing import Annotated, Any, Literal

# Only workspace-local packages are installed. addsitedir also honours pywin32
# path setup needed by the official SDK's Windows stdio transport.
ROOT = Path(__file__).resolve().parents[2]
site.addsitedir(str(ROOT / ".tools" / "mcp-python"))

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field, StrictBool, StrictInt

if __package__:
    from .bridge import Config, PlanterBridge
else:  # Preserve direct `python integrations/mcp/server.py` usage.
    from bridge import Config, PlanterBridge

RequestId = Annotated[str, Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$",
    description="Required unique action ID. Keep the same ID when querying; never invent a new ID to retry an unknown outcome.")]
Duration = Annotated[StrictInt, Field(ge=1, le=30000, description="Pump duration in milliseconds, not millilitres. Bridge default maximum is 3000 ms.")]
PrintText = Annotated[str, Field(min_length=1, max_length=160, description="Printable ASCII or newline only, at most 160 bytes; no printer control codes.")]
LightEffect = Literal["solid", "breath", "chase", "rainbow"]


def create_server(config: Config | None = None, *, port: int = 8765,
                  bridge: Any | None = None,
                  transport_security: TransportSecuritySettings | None = None) -> FastMCP:
    if bridge is not None and config is not None:
        raise ValueError("Pass either an injected bridge or a device config, not both")
    if bridge is None:
        bridge = PlanterBridge(config or Config.from_env())
    server = FastMCP(
        "RoboPlanter", host="127.0.0.1", port=port,
        instructions=("Use sensor tools read-only unless the user explicitly asks for a device action. "
                      "Emotion, conversation, low soil readings and plant-care questions are not authorization to water. "
                      "Never repeat an unknown action; query its request ID. completed is software feedback only."),
        stateless_http=True, json_response=True, max_request_body_size=16384,
        log_level="WARNING",
        transport_security=transport_security or TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=["127.0.0.1:*", "localhost:*"],
            allowed_origins=["http://127.0.0.1:*", "http://localhost:*"],
        ),
    )
    readonly = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
    action = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False)

    @server.tool(annotations=readonly)
    async def get_planter_state() -> dict[str, Any]:
        """Read live XIAO state. Check _bridge.fresh, valid and soil.calibrated; null is unknown. This never waters. Air/UV are raw ADC, not CO2/PAR. Environmental humidity is not soil moisture."""
        return await bridge.get_state()

    @server.tool(annotations=action)
    async def water(request_id: RequestId, duration_ms: Duration) -> dict[str, Any]:
        """Water only after an explicit user request for a timed pulse. Never infer permission from mood or sensor data. Duration is ms, not ml; default bridge cap is 3000 ms. accepted is not completed; unknown must be queried, never retried."""
        return await bridge.act(request_id, "water", duration_ms=duration_ms)

    @server.tool(annotations=action)
    async def stop_water(request_id: RequestId) -> dict[str, Any]:
        """Send one stop-water command when requested. Bypasses sensor freshness preflight; still requires a configured device token. This network command is not a physical emergency stop."""
        return await bridge.act(request_id, "stop_water")

    @server.tool(annotations=action)
    async def set_light(request_id: RequestId, on: StrictBool, effect: LightEffect = None) -> dict[str, Any]:  # type: ignore[assignment]
        """Set light only when requested. Optional on-only effects: solid (default), breath, chase, rainbow. Requires a fresh enabled capability. Completion confirms software state, not measured illumination."""
        # None is the Python omission default; the Literal annotation rejects
        # an explicitly supplied JSON null before reaching this function.
        values: dict[str, Any] = {"on": on}
        if effect is not None:
            values["effect"] = effect
        return await bridge.act(request_id, "light", **values)

    @server.tool(annotations=action)
    async def print_note(request_id: RequestId, text: PrintText) -> dict[str, Any]:
        """Print a user-requested note, ASCII/newline only, max 160 bytes. completed means UART bytes sent, not confirmed paper output. Unknown result must not be retried."""
        return await bridge.act(request_id, "print", text=text)

    @server.tool(annotations=readonly)
    async def get_action_result(request_id: RequestId) -> dict[str, Any]:
        """Read a prior action's cached result by ID; sends no action. 404 becomes unknown because a device restart can erase an executed request. Never replay automatically."""
        return await bridge.get_result(request_id)

    return server


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--transport", choices=("stdio", "streamable-http"), default="stdio")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    if not 1024 <= args.port <= 65535:
        parser.error("port must be 1024..65535")
    try:
        server = create_server(port=args.port)
    except ValueError as error:
        parser.error(str(error))
    # No configurable host: unauthenticated HTTP may only bind loopback.
    server.run(transport=args.transport)


if __name__ == "__main__":
    main()
