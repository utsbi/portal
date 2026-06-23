"""Adversarial tests for PostgREST filter injection in rag_service._scope_or_filter.

REQUIREMENT derived first: ``_scope_or_filter`` embeds ``client_id`` VERBATIM
into a PostgREST ``or=`` filter string ("and(uid.eq.{client_id},project_id.is.
null)"). PostgREST treats commas, parentheses and dots as filter syntax, so a
client_id that is not a strict UUID could break out of the intended clause and
widen the row set (e.g. add an OR clause matching every row). The code defends
with ``_UUID_RE.fullmatch`` — these tests verify that defense actually rejects
almost-UUIDs and metacharacter payloads, and that project_ids (ints) can't carry
injection either.
"""
from __future__ import annotations

import pytest

from app.explore.services.rag_service import RAGService

_GOOD_UUID = "12345678-1234-1234-1234-123456789abc"


class TestScopeOrFilterUuidValidation:
    def test_valid_uuid_is_embedded(self):
        f = RAGService._scope_or_filter([], _GOOD_UUID)
        assert f == f"and(uid.eq.{_GOOD_UUID},project_id.is.null)"

    @pytest.mark.parametrize(
        "bad_client_id",
        [
            # PostgREST metacharacter break-outs:
            "12345678-1234-1234-1234-123456789abc),uid.not.is.null,and(uid.eq.x",
            "*),(uid.gte.0",
            "x,project_id.gte.0",
            "1234) or (1=1",
            # Almost-a-UUID (wrong shape) must also be rejected:
            "12345678-1234-1234-1234-123456789ab",   # too short
            "12345678-1234-1234-1234-123456789abcd",  # too long
            "1234567812341234123412345678abcd",       # no dashes
            "gggggggg-1234-1234-1234-123456789abc",   # non-hex
            "",                                        # empty -> falsy, but if forced...
            "   ",                                     # whitespace
            "12345678-1234-1234-1234-123456789abc\n",  # trailing newline
        ],
    )
    def test_non_uuid_client_id_is_rejected(self, bad_client_id):
        """A non-UUID client_id must raise ValueError (fail closed), never be
        embedded into the filter string where it could inject clauses.

        Note: empty / whitespace-only strings are 'falsy enough' that the code
        may skip the clause entirely (also safe). We accept EITHER a ValueError
        OR a filter that does NOT contain the raw payload."""
        if not bad_client_id.strip():
            # Falsy/blank: the only safe outcomes are skip (no uid clause) or
            # raise. The key invariant is that NO uid clause is emitted for a
            # blank id (it must never become "and(uid.eq.<blank>...)").
            try:
                result = RAGService._scope_or_filter([], bad_client_id)
            except ValueError:
                return
            assert result is None or "uid.eq" not in result, (
                "blank client_id produced a uid clause in the filter"
            )
            return
        with pytest.raises(ValueError):
            RAGService._scope_or_filter([], bad_client_id)

    def test_injection_payload_never_reaches_filter_string(self):
        """Defense-in-depth: even if validation changed, the metacharacter
        payload must not end up inside the returned filter string."""
        payload = "abc),uid.not.is.null,and(uid.eq.x"
        try:
            result = RAGService._scope_or_filter([1], payload)
        except ValueError:
            return  # rejected — good
        assert "not.is.null" not in (result or ""), (
            "injection clause leaked into PostgREST filter"
        )


class TestScopeOrFilterProjectIds:
    def test_project_ids_render_as_int_csv(self):
        f = RAGService._scope_or_filter([1, 2, 3], None)
        assert f == "project_id.in.(1,2,3)"

    def test_empty_scope_returns_none(self):
        assert RAGService._scope_or_filter([], None) is None

    def test_project_ids_are_stringified_ints_no_freetext(self):
        """project_ids come from server-side membership resolution (ints). Even
        so, confirm they are rendered as bare ints with no room for free-text —
        a regression here would reintroduce an injection vector."""
        f = RAGService._scope_or_filter([42], _GOOD_UUID)
        assert f.startswith("project_id.in.(42),")
        assert _GOOD_UUID in f
