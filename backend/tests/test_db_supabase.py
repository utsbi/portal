from unittest.mock import MagicMock, patch

from app.explore.db.supabase import user_client


def test_user_client_authenticates_postgrest_with_caller_token() -> None:
    client = MagicMock()

    with patch("app.explore.db.supabase.create_client", return_value=client) as create:
        result = user_client("caller-jwt")

    assert result is client
    create.assert_called_once()
    client.postgrest.auth.assert_called_once_with("caller-jwt")
