"""Runtime validation helpers for untyped PostgREST JSON responses."""

from typing import Any, TypeAlias

JsonRow: TypeAlias = dict[str, Any]


def json_rows(data: object) -> list[JsonRow]:
    """Return only object-shaped rows from a PostgREST response payload.

    Supabase's generated Python type models expose response data as arbitrary
    JSON. Application queries in this service expect arrays of JSON objects;
    validating that boundary once keeps malformed provider responses from
    reaching business logic and gives the type checker an honest row shape.
    """

    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]
