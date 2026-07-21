import pytest

from app.explore.db.rows import json_rows


def test_json_rows_accepts_list_of_objects() -> None:
    rows = [{"id": "one"}, {"id": "two", "active": True}]

    assert json_rows(rows) == rows


@pytest.mark.parametrize("value", [None, {}, "row", 1])
def test_json_rows_returns_empty_for_non_list_payload(value: object) -> None:
    assert json_rows(value) == []


def test_json_rows_filters_non_object_items() -> None:
    assert json_rows([{"id": "valid"}, "invalid", None, 3]) == [{"id": "valid"}]
